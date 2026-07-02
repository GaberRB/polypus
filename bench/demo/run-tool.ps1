# Roda UMA ferramenta (polypus | opencode | aider) sobre as tarefas do demo.
# Uso:  .\run-tool.ps1 -Tool polypus            (todas as tarefas)
#       .\run-tool.ps1 -Tool aider -Tasks leap  (uma tarefa)
param(
  [Parameter(Mandatory = $true)][ValidateSet("polypus", "opencode", "aider")]
  [string]$Tool,
  [string[]]$Tasks = @("leap", "rle", "roman", "anagram", "fix-flatten", "stats-bug")
)

$ErrorActionPreference = "Continue"
$demo = $PSScriptRoot
$repo = (Resolve-Path (Join-Path $demo "..\..")).Path

# --- carrega .env (chaves por ferramenta + BENCH_MODEL) ---
Get-Content (Join-Path $demo ".env") | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}
$model = $env:BENCH_MODEL

# chave dedicada da ferramenta → OPENROUTER_API_KEY (polypus/opencode/aider leem do env;
# o delta de gasto no OpenRouter fica atribuído sem ambiguidade)
$toolKey = [Environment]::GetEnvironmentVariable("OPENROUTER_API_KEY_$($Tool.ToUpper())")
if (-not $toolKey) { throw "Chave OPENROUTER_API_KEY_$($Tool.ToUpper()) ausente no .env" }
$env:OPENROUTER_API_KEY = $toolKey
# aider instalado pelo uv fica em ~\.local\bin
$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $demo "runs\$stamp-$Tool"
$summary = @()

foreach ($task in $Tasks) {
  $ws = Join-Path $runDir $task
  New-Item -ItemType Directory -Force -Path $ws | Out-Null
  Copy-Item (Join-Path $demo "tasks\$task\*") $ws
  # workspace vira repo git próprio: sem isso, opencode/aider tratam a RAIZ do polypusCode
  # como projeto (o workspace está dentro dele) e podem escrever arquivo no lugar errado
  git -C $ws init -q; git -C $ws add -A; git -C $ws -c user.email=bench@local -c user.name=bench commit -qm init
  $prompt = (Get-Content (Join-Path $ws "PROMPT.md") -Raw).Trim()

  Write-Host ""
  Write-Host ("=" * 70) -ForegroundColor Cyan
  Write-Host ("  {0}  ×  tarefa '{1}'  ×  {2}" -f $Tool.ToUpper(), $task, $model) -ForegroundColor Cyan
  Write-Host ("=" * 70) -ForegroundColor Cyan

  # descobre fontes e testes (suporta tarefas multi-arquivo, não só solution.mjs)
  $srcNames  = @((Get-ChildItem $ws -Filter *.mjs | Where-Object { $_.Name -notlike '*.test.mjs' }).Name)
  $testNames = @((Get-ChildItem $ws -Filter *.test.mjs).Name)
  # hash dos testes ANTES — mexer em qualquer teste = desclassificado
  $testHashBefore = ($testNames | Sort-Object | ForEach-Object {
    (Get-FileHash (Join-Path $ws $_) -Algorithm SHA256).Hash }) -join ""

  $toolOut = ""
  Push-Location $ws
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  switch ($Tool) {
    "polypus" {
      node (Join-Path $repo "dist\index.js") run $prompt --agent bench-deepseek --model $model --mode bypass
    }
    "opencode" {
      opencode run $prompt --model "openrouter/$model"
    }
    "aider" {
      # --api-key força a chave dedicada: o aider carrega ~/.aider/oauth-keys.env no
      # startup e ela sobrescreveria o OPENROUTER_API_KEY do env, mandando o tráfego
      # pra chave errada (a dedicada ficava zerada). O flag explícito tem precedência.
      # Passa TODAS as fontes como editáveis e os testes como --read (multi-arquivo).
      # Tee: mostra ao vivo E captura pra extrair os tokens que o aider imprime.
      $aiderArgs = @("--model", "openrouter/$model", "--api-key", "openrouter=$toolKey",
        "--message", $prompt, "--yes-always", "--no-git", "--no-check-update", "--no-show-model-warnings")
      $aiderArgs += $srcNames
      foreach ($t in $testNames) { $aiderArgs += @("--read", $t) }
      aider @aiderArgs | Tee-Object -Variable toolOut
    }
  }
  $sw.Stop()

  Write-Host ""
  Write-Host "--- veredito (node --test) ---" -ForegroundColor Yellow
  $testOut = node --test 2>&1 | Out-String
  Write-Host $testOut
  $verdict = "FAIL"
  if ($LASTEXITCODE -eq 0) { $verdict = "PASS" }

  # score parcial: quantos subtests passaram de quantos (gradiente, não só PASS/FAIL)
  $pass = 0; $total = 0
  if ($testOut -match '#\s+pass\s+(\d+)')  { $pass  = [int]$matches[1] }
  if ($testOut -match '#\s+tests\s+(\d+)') { $total = [int]$matches[1] }
  $score = if ($total -gt 0) { "$pass/$total" } else { "0/0" }

  # qualidade da entrega: testes intocados + concisão do código
  $testHashAfter = ($testNames | Sort-Object | ForEach-Object {
    (Get-FileHash (Join-Path $ws $_) -Algorithm SHA256).Hash }) -join ""
  if ($testHashAfter -ne $testHashBefore) {
    $verdict = "DESCLASSIFICADO"
    Write-Host "⚠ arquivo de teste foi modificado pela ferramenta — desclassificado" -ForegroundColor Red
  }
  # LOC das fontes (linhas não-vazias e não-comentário) — proxy de concisão
  $loc = 0
  foreach ($s in $srcNames) {
    $loc += (Get-Content (Join-Path $ws $s) |
      Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("//") }).Count
  }

  # tokens da tarefa (fonte nativa de cada ferramenta)
  $tokens = "?"
  if ($Tool -eq "polypus") {
    $uj = Join-Path $ws ".poly\usage.jsonl"
    if (Test-Path $uj) {
      $sum = 0
      Get-Content $uj | ForEach-Object {
        $o = $_ | ConvertFrom-Json
        $sum += [int]$o.promptTokens + [int]$o.completionTokens
      }
      $tokens = $sum
    }
  } elseif ($Tool -eq "aider") {
    # aider imprime "Tokens: 2.7k sent, 212 received" — soma sent+received (k = *1000)
    $sent = 0; $recv = 0
    foreach ($line in ($toolOut -split "`n")) {
      if ($line -match 'Tokens:\s*([\d.]+)(k?)\s*sent,\s*([\d.]+)(k?)\s*received') {
        $s = [double]$matches[1]; if ($matches[2] -eq 'k') { $s *= 1000 }
        $r = [double]$matches[3]; if ($matches[4] -eq 'k') { $r *= 1000 }
        $sent += $s; $recv += $r
      }
    }
    if ($sent + $recv -gt 0) { $tokens = [int]($sent + $recv) }
  }
  # opencode: sem stdout capturável (TTY) — tokens vêm do SQLite via collect-metrics.ps1
  Pop-Location

  $secs = [math]::Round($sw.Elapsed.TotalSeconds, 1)
  $summary += [PSCustomObject]@{ Tool = $Tool; Task = $task; Verdict = $verdict; Score = $score; Seconds = $secs; LOC = $loc; Tokens = $tokens }
  "$Tool,$task,$verdict,$score,$secs,$loc,$tokens" | Out-File -Append -Encoding utf8 (Join-Path $demo "runs\results.csv")
}

# o run headless do opencode não imprime tokens; o stats local mostra tokens+custo por modelo
if ($Tool -eq "opencode") {
  Write-Host ""
  Write-Host "--- tokens do opencode (opencode stats) ---" -ForegroundColor Yellow
  opencode stats
}

Write-Host ""
Write-Host ("#" * 70) -ForegroundColor Green
Write-Host "  RESUMO — $($Tool.ToUpper())" -ForegroundColor Green
$summary | Format-Table -AutoSize | Out-String | Write-Host
Write-Host "  workspace: $runDir" -ForegroundColor DarkGray
Write-Host ("#" * 70) -ForegroundColor Green
