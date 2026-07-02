# Stress test das features do Polypus (hooks + swarm) — trilha de diagnóstico interno.
# Roda cada cenário num workspace descartável, com TIMEOUT rígido (pega loop infinito),
# e verifica se a feature se comportou como especificado. Métricas: comportamento (pass/fail),
# tempo de parede, tokens (workspace/.poly/usage.jsonl), notas.
#
# Uso:  .\run-stress.ps1                     (todos)
#       .\run-stress.ps1 -Only hook-block    (um cenário)
param([string]$Only = "")

$ErrorActionPreference = "Continue"
$stress = $PSScriptRoot
$demo   = (Resolve-Path (Join-Path $stress "..\demo")).Path
$repo   = (Resolve-Path (Join-Path $stress "..\..")).Path
$cli    = Join-Path $repo "dist\index.js"

# chave dedicada do polypus (do .env do demo)
Get-Content (Join-Path $demo ".env") | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process") }
}
$env:OPENROUTER_API_KEY = $env:OPENROUTER_API_KEY_POLYPUS
$model = $env:BENCH_MODEL

$runRoot = Join-Path $stress ("runs\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force $runRoot | Out-Null
$results = @()

function New-Workspace($name) {
  $ws = Join-Path $runRoot $name
  New-Item -ItemType Directory -Force $ws | Out-Null
  $scn = Join-Path $stress "scenarios\$name"
  if (Test-Path $scn) {
    Copy-Item "$scn\*" $ws -Recurse -Exclude "hooks.json"
    New-Item -ItemType Directory -Force (Join-Path $ws ".poly") | Out-Null
    if (Test-Path "$scn\hooks.json") { Copy-Item "$scn\hooks.json" (Join-Path $ws ".poly\hooks.json") }
  }
  # *> $null: git commit imprime "nothing to commit" no STDOUT em repo vazio (swarm),
  # o que poluiria o valor de retorno da função e deixaria $ws inválido.
  git -C $ws init -q *> $null
  git -C $ws add -A *> $null
  git -C $ws -c user.email=b@l -c user.name=b commit -qm init *> $null
  return $ws
}

# roda polypus (run ou swarm) com timeout rígido; devolve @{ exited; seconds; out }
function Invoke-Polypus($ws, [string[]]$cliArgs, $timeoutMs) {
  $outFile = Join-Path $ws "_stdout.txt"
  # Start-Process junta -ArgumentList com espaço SEM aspas → prompts multi-palavra quebram
  # (e trechos como "--test" viram flags). Cita cada arg que tenha espaço/aspas.
  $quoted = $cliArgs | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }
  $argLine = ('"' + $cli + '" ') + ($quoted -join ' ')
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process node -ArgumentList $argLine -WorkingDirectory $ws -PassThru -NoNewWindow `
        -RedirectStandardOutput $outFile -RedirectStandardError (Join-Path $ws "_stderr.txt")
  $exited = $p.WaitForExit($timeoutMs)
  if (-not $exited) { try { $p.Kill($true) } catch {}; Start-Sleep 1 }
  $sw.Stop()
  $out = ""
  if (Test-Path $outFile) { $out = Get-Content $outFile -Raw }
  return @{ exited = $exited; seconds = [math]::Round($sw.Elapsed.TotalSeconds, 1); out = $out }
}

function Get-Tokens($ws) {
  $uj = Join-Path $ws ".poly\usage.jsonl"
  if (-not (Test-Path $uj)) { return 0 }
  $sum = 0
  Get-Content $uj | ForEach-Object { try { $o = $_ | ConvertFrom-Json; $sum += [int]$o.promptTokens + [int]$o.completionTokens } catch {} }
  return $sum
}

function Add-Result($scenario, $feature, $behavior, $r, $tokens, $notes) {
  $script:results += [PSCustomObject]@{ Scenario = $scenario; Feature = $feature; Behavior = $behavior; Seconds = $r.seconds; Tokens = $tokens; Notes = $notes }
  "$scenario,$feature,$behavior,$($r.seconds),$tokens,`"$notes`"" | Out-File -Append -Encoding utf8 (Join-Path $runRoot "stress-results.csv")
  $color = if ($behavior -eq "OK") { "Green" } else { "Red" }
  Write-Host ("  [{0}] {1} — {2}" -f $behavior, $scenario, $notes) -ForegroundColor $color
}

function Should-Run($n) { return ($Only -eq "" -or $Only -eq $n) }

# ===================== HOOK 1: PostToolUse self-correction =====================
if (Should-Run "hook-selfcorrect") {
  Write-Host "`n=== hook-selfcorrect (PostToolUse injeta review → modelo obedece?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "hook-selfcorrect"
  $prompt = (Get-Content (Join-Path $ws "PROMPT.md") -Raw).Trim()
  $r = Invoke-Polypus $ws @("run", $prompt, "--agent", "bench-deepseek", "--mode", "bypass", "--max-steps", "12") 180000
  $sol = ""; if (Test-Path (Join-Path $ws "solution.mjs")) { $sol = Get-Content (Join-Path $ws "solution.mjs") -Raw }
  Push-Location $ws; node --test *> $null; $testsPass = ($LASTEXITCODE -eq 0); Pop-Location
  $hasMarker = $sol -match "// audited:ok"
  $behavior = if ($hasMarker -and $testsPass) { "OK" } else { "GAP" }
  $notes = "marker=$([bool]$hasMarker) tests=$testsPass exited=$($r.exited) — injeção PostToolUse dirigiu comportamento?"
  Add-Result "hook-selfcorrect" "PostToolUse" $behavior $r (Get-Tokens $ws) $notes
}

# ===================== HOOK 2: PreToolUse block (loop infinito?) =====================
if (Should-Run "hook-block") {
  Write-Host "`n=== hook-block (PreToolUse bloqueia edit de config; termina sem travar?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "hook-block"
  $prompt = (Get-Content (Join-Path $ws "PROMPT.md") -Raw).Trim()
  $r = Invoke-Polypus $ws @("run", $prompt, "--agent", "bench-deepseek", "--mode", "bypass", "--max-steps", "15") 180000
  $cfg = Get-Content (Join-Path $ws "config.mjs") -Raw
  $blocked = $cfg -match 'hello'          # arquivo protegido ficou intacto = bloqueio funcionou
  $terminated = $r.exited                  # não travou (gap seria loop infinito)
  $blockMsgs = ([regex]::Matches($r.out, "PreToolUse|bloque|blocked|Tool blocked")).Count
  $behavior = if ($blocked -and $terminated) { "OK" } else { "GAP" }
  $notes = "protegido_intacto=$([bool]$blocked) terminou=$terminated sinais_bloqueio=$blockMsgs"
  Add-Result "hook-block" "PreToolUse" $behavior $r (Get-Tokens $ws) $notes
}

# ===================== HOOK 3: Stop hook =====================
if (Should-Run "hook-stop") {
  Write-Host "`n=== hook-stop (Stop roda no finish?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "hook-stop"
  $prompt = (Get-Content (Join-Path $ws "PROMPT.md") -Raw).Trim()
  $r = Invoke-Polypus $ws @("run", $prompt, "--agent", "bench-deepseek", "--mode", "bypass", "--max-steps", "12") 180000
  $stopRan = Test-Path (Join-Path $ws ".poly\STOP_RAN")
  Push-Location $ws; node --test *> $null; $testsPass = ($LASTEXITCODE -eq 0); Pop-Location
  $behavior = if ($stopRan -and $testsPass) { "OK" } else { "GAP" }
  $notes = "stop_marker=$stopRan tests=$testsPass — Stop hook executou no finish?"
  Add-Result "hook-stop" "Stop" $behavior $r (Get-Tokens $ws) $notes
}

# ===================== PATH-PROTECT: proteção real (read-only no SO) =====================
if (Should-Run "path-protect") {
  Write-Host "`n=== path-protect (--protect torna arquivo read-only no SO; sobrevive ao shell?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "path-protect"
  $prompt = (Get-Content (Join-Path $ws "PROMPT.md") -Raw).Trim()
  # Mesma task que furou o hook (#213), agora com proteção FS-level em vez de hook.
  $r = Invoke-Polypus $ws @("run", $prompt, "--agent", "bench-deepseek", "--mode", "bypass", "--protect", "config.mjs", "--max-steps", "15") 180000
  $cfg = Get-Content (Join-Path $ws "config.mjs") -Raw
  $protected = $cfg -match 'hello'    # arquivo intacto = SO recusou toda escrita (inclusive shell)
  $behavior = if ($protected -and $r.exited) { "OK" } else { "GAP" }
  $notes = "arquivo_intacto=$([bool]$protected) terminou=$($r.exited) — proteção FS-level aguenta o shell?"
  Add-Result "path-protect" "protect" $behavior $r (Get-Tokens $ws) $notes
}

# ===================== SWARM 1: fan-out paralelo =====================
if (Should-Run "swarm-fanout") {
  Write-Host "`n=== swarm-fanout (decompõe → workers paralelos → merge no Windows?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "swarm-fanout"
  $task = "Create three independent utility files, each with its own export: (1) strings.mjs exporting capitalize(s), (2) numbers.mjs exporting isEven(n), (3) arrays.mjs exporting last(arr). Each file is standalone."
  $r = Invoke-Polypus $ws @("swarm", $task, "--workers", "3") 420000
  $filesMade = @("strings.mjs","numbers.mjs","arrays.mjs" | Where-Object { Test-Path (Join-Path $ws $_) }).Count
  # "sem conflito" = merge limpo. Cuidado: "conflito" casa dentro de "sem conflito".
  $mergedClean = $r.out -match "sem conflito"
  $conflicts   = ($r.out -match "conflito") -and (-not $mergedClean)
  $behavior = if ($r.exited -and $filesMade -ge 2 -and $mergedClean) { "OK" } else { "GAP" }
  $notes = "arquivos_criados=$filesMade/3 terminou=$($r.exited) merge_limpo=$([bool]$mergedClean) conflitos=$([bool]$conflicts)"
  Add-Result "swarm-fanout" "swarm" $behavior $r (Get-Tokens $ws) $notes
}

# ===================== SWARM 2: conflito no mesmo arquivo =====================
if (Should-Run "swarm-conflict") {
  Write-Host "`n=== swarm-conflict (subtasks no mesmo arquivo → detecta conflito sem corromper?) ===" -ForegroundColor Cyan
  $ws = New-Workspace "swarm-conflict"
  Set-Content (Join-Path $ws "utils.mjs") "// shared module`nexport const VERSION = 1;`n" -Encoding utf8
  git -C $ws add -A *> $null; git -C $ws -c user.email=b@l -c user.name=b commit -qm base *> $null
  $task = "In utils.mjs, add three exported functions all in this same file: add(a,b), sub(a,b), and mul(a,b)."
  $r = Invoke-Polypus $ws @("swarm", $task, "--workers", "3") 420000
  $stillValid = $false; $fnCount = 0
  if (Test-Path (Join-Path $ws "utils.mjs")) {
    $u = Get-Content (Join-Path $ws "utils.mjs") -Raw
    $stillValid = -not ($u -match "<<<<<<<|=======|>>>>>>>")   # sem marcadores de conflito não resolvidos
    $fnCount = @("add","sub","mul" | Where-Object { $u -match "function\s+$_\b" }).Count
  }
  $mergedClean = $r.out -match "sem conflito"
  # O bug (#212) é PERDA SILENCIOSA: alegar "sem conflito" mas ter perdido contribuições.
  # Pós-fix, o correto é ou mesclar tudo (3/3) OU reportar o conflito honestamente
  # (workers ficam no branch, recuperáveis) — nunca alegar limpo escondendo perda.
  $silentLoss = $mergedClean -and ($fnCount -lt 3)
  $behavior = if ($r.exited -and (-not $silentLoss)) { "OK" } else { "GAP" }
  $notes = "funcoes_sobreviventes=$fnCount/3 alegou_limpo=$([bool]$mergedClean) perda_silenciosa=$([bool]$silentLoss)"
  Add-Result "swarm-conflict" "swarm" $behavior $r (Get-Tokens $ws) $notes
}

Write-Host "`n$('#'*66)" -ForegroundColor Green
Write-Host "  RESUMO STRESS" -ForegroundColor Green
$results | Format-Table -AutoSize | Out-String | Write-Host
Write-Host "  runs em: $runRoot" -ForegroundColor DarkGray
Write-Host ('#'*66) -ForegroundColor Green
