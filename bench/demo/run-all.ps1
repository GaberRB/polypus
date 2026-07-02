# Roda as TRÊS ferramentas em sequência (polypus → opencode → aider) nas mesmas tarefas.
# Uso:  .\run-all.ps1              (todas as tarefas)
#       .\run-all.ps1 -Tasks leap  (só uma tarefa)
param(
  [string[]]$Tasks = @("leap", "rle", "roman", "anagram", "fix-flatten", "stats-bug")
)

$here = $PSScriptRoot

# fotografa o gasto atual das chaves — o placar final mostra so o gasto DESTA rodada
& (Join-Path $here "show-costs.ps1") -SetBaseline

foreach ($tool in @("polypus", "opencode", "aider")) {
  & (Join-Path $here "run-tool.ps1") -Tool $tool -Tasks $Tasks
}

Write-Host ""
Write-Host "Resultados acumulados em bench\demo\runs\results.csv:" -ForegroundColor Cyan
Get-Content (Join-Path $here "runs\results.csv") | Write-Host

# custo por ferramenta direto da API do OpenRouter (chaves dedicadas)
& (Join-Path $here "show-costs.ps1")
