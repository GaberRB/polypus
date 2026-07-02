# Placar de custo por ferramenta — consulta o gasto acumulado de cada chave dedicada
# na API do OpenRouter (fonte neutra; cada ferramenta tem sua propria chave).
#
# Uso:
#   .\show-costs.ps1               mostra Total e, se houver baseline, o gasto DA RODADA
#   .\show-costs.ps1 -SetBaseline  fotografa o gasto atual como baseline (inicio da rodada)
#
# A contabilizacao do OpenRouter atrasa alguns MINUTOS: se o valor da rodada parecer
# baixo logo apos rodar, rode de novo depois.
param(
  [switch]$SetBaseline
)

$demo = $PSScriptRoot
Get-Content (Join-Path $demo ".env") | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}

$baselineFile = Join-Path $demo "runs\cost-baseline.json"

# le o gasto atual de cada chave
$usage = @{}
foreach ($tool in @("POLYPUS", "OPENCODE", "AIDER")) {
  $key = [Environment]::GetEnvironmentVariable("OPENROUTER_API_KEY_$tool")
  if (-not $key) { continue }
  try {
    $h = @{ Authorization = "Bearer $key" }
    $r = Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/auth/key" -Headers $h -TimeoutSec 15
    $usage[$tool] = [double]$r.data.usage
  } catch {
    $usage[$tool] = $null
  }
}

if ($SetBaseline) {
  New-Item -ItemType Directory -Force -Path (Join-Path $demo "runs") | Out-Null
  $usage | ConvertTo-Json | Out-File -Encoding utf8 $baselineFile
  Write-Host "baseline de custo salvo (gasto da rodada contara a partir daqui)" -ForegroundColor DarkGray
  return
}

$baseline = $null
if (Test-Path $baselineFile) {
  $baseline = Get-Content $baselineFile -Raw | ConvertFrom-Json
}

Write-Host ""
Write-Host ("=" * 58) -ForegroundColor Cyan
Write-Host "  CUSTO POR FERRAMENTA (API OpenRouter, chave dedicada)" -ForegroundColor Cyan
Write-Host ("=" * 58) -ForegroundColor Cyan

$rows = @()
foreach ($tool in @("POLYPUS", "OPENCODE", "AIDER")) {
  if (-not $usage.ContainsKey($tool)) { continue }
  $total = $usage[$tool]
  if ($null -eq $total) {
    $rows += [PSCustomObject]@{ Ferramenta = $tool.ToLower(); RodadaUSD = "erro"; TotalUSD = "erro" }
    continue
  }
  $rodada = "-"
  if ($null -ne $baseline -and $null -ne $baseline.$tool) {
    $rodada = [math]::Round($total - [double]$baseline.$tool, 5)
  }
  $rows += [PSCustomObject]@{
    Ferramenta = $tool.ToLower()
    RodadaUSD  = $rodada
    TotalUSD   = [math]::Round($total, 5)
  }
}
$rows | Format-Table -AutoSize | Out-String | Write-Host
Write-Host "  RodadaUSD = gasto desde o baseline (inicio do run-all)" -ForegroundColor DarkGray
Write-Host "  (o OpenRouter contabiliza com atraso de alguns minutos)" -ForegroundColor DarkGray
Write-Host ("=" * 58) -ForegroundColor Cyan
