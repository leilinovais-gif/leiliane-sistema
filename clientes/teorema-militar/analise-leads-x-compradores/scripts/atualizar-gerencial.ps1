# Coloca os números do relatório gerencial no worker.js (troca só o bloco GERENCIAL_DADOS; o resto do arquivo não muda).
# Uso: powershell -ExecutionPolicy Bypass -File atualizar-gerencial.ps1 -Json <gerencial.json>
# Antes de rodar: refazer o cruzamento (gerencial-dados.ps1) e revisar gerencial-conclusoes.json (os números das conclusões são escritos à mão).
param([Parameter(Mandatory = $true)][string]$Json)
$ErrorActionPreference = 'Stop'
$pasta = Split-Path $PSScriptRoot -Parent
$worker = Join-Path $pasta '..\operacao-espcex-27\worker.js' | Resolve-Path
$dados = Get-Content $Json -Raw -Encoding UTF8 | ConvertFrom-Json
$concl = Get-Content (Join-Path $pasta 'gerencial-conclusoes.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$dados | Add-Member conclusoes @($concl | % { $_ }) -Force
$pastaDados = Join-Path $pasta 'dados'
$dados | Add-Member coortes @((Get-Content (Join-Path $pastaDados 'coortes-lancamentos.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member invTipos @((Get-Content (Join-Path $pastaDados 'investimento-tipos.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member extra @((Get-Content (Join-Path $pastaDados 'lancamentos-extra.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member invPublico @((Get-Content (Join-Path $pastaDados 'investimento-publico.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member vendasLancBase @((Get-Content (Join-Path $pastaDados 'vendas-lancamento-base-toda.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member invPublicoTipo (Get-Content (Join-Path $pastaDados 'investimento-publico-tipo.json') -Raw -Encoding UTF8 | ConvertFrom-Json) -Force
$dados | Add-Member upgrade (Get-Content (Join-Path $pastaDados 'individual-para-full.json') -Raw -Encoding UTF8 | ConvertFrom-Json) -Force
$dados | Add-Member invVenda @((Get-Content (Join-Path $pastaDados 'investimento-venda.json') -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ }) -Force
$dados | Add-Member retornoVenda (Get-Content (Join-Path $pastaDados 'retorno-venda.json') -Raw -Encoding UTF8 | ConvertFrom-Json) -Force
$resp = Join-Path $pasta 'gerencial-resposta.html'
if (Test-Path $resp) { $dados | Add-Member resposta ([IO.File]::ReadAllText($resp, [Text.Encoding]::UTF8).Trim()) -Force }
$linha = ($dados | ConvertTo-Json -Depth 12 -Compress)
$ini = '// ==== GERENCIAL_DADOS: início (gerado por atualizar-gerencial.ps1; não editar à mão) ===='
$fim = '// ==== GERENCIAL_DADOS: fim ===='
$bloco = $ini + "`n" + 'const GERENCIAL_DADOS = ' + $linha + ';' + "`n" + $fim
$texto = [IO.File]::ReadAllText($worker, [Text.Encoding]::UTF8)
$i = $texto.IndexOf($ini); $j = $texto.IndexOf($fim)
if ($i -lt 0 -or $j -lt $i) { throw 'Não achei o bloco GERENCIAL_DADOS no worker.js.' }
$copia = Join-Path (Split-Path $worker) ('versoes\worker-' + (Get-Date -Format 'yyyy-MM-dd-HHmm') + '.js')
Copy-Item $worker $copia
$novo = $texto.Substring(0, $i) + $bloco + $texto.Substring($j + $fim.Length)
# troca também o código da página (do título do bloco até o início dos dados) pelo gerencial-pagina.js
$marcaPag = '// ================================================================ Relatório gerencial (retrato, beta)'
$p0 = $novo.IndexOf($marcaPag); $p1 = $novo.IndexOf($ini)
$pag = [IO.File]::ReadAllText((Join-Path $pasta 'gerencial-pagina.js'), [Text.Encoding]::UTF8).TrimEnd()
if ($p0 -ge 0 -and $p1 -gt $p0) { $novo = $novo.Substring(0, $p0) + $pag + "`n`n" + $novo.Substring($p1) } else { throw 'Não achei o código da página gerencial no worker.js.' }
[IO.File]::WriteAllText($worker, $novo, (New-Object Text.UTF8Encoding($false)))
"Números do relatório gerencial trocados ($($dados.geradoEm)). Cópia de segurança: $copia"
