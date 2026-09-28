# Retorno de cada lançamento: tudo o que foi investido na operação (Meta + Google, todas as campanhas com o nome dela)
# contra o que o curso da escola vendeu no período do lançamento (começo da captação até 3 semanas depois do último lead).
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
$VENDAS = @($HMV | % { [pscustomobject]@{ dt = [datetime]$_.data; prod = (Fix $_.produto); val = (Num $_.valor) } })
$LANC = @(
  @{ nome = 'Barro Branco 2023'; base = 'OP.BB23'; re = 'OP\.APMBB\.23'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2024 (feita em 2023)'; base = 'OP.ESPCEX.24'; re = 'OP\.ESPCEX\.(SET\.)?24'; prod = 'Full - EsPCEx' },
  @{ nome = 'Plano EsPCEx 2024'; base = 'PLANO.ESPCEX.24'; re = 'PLANO\.?ESPCEX\.?24'; prod = 'Full - EsPCEx' },
  @{ nome = 'Barro Branco 2024'; base = 'OP.BB24'; re = 'OP\.APMBB\.24'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2025 (feita em 2024)'; base = 'OP.ESPCEX.25'; re = 'OP\.ESPCEX\.25'; prod = 'Full - EsPCEx' },
  @{ nome = 'Barro Branco 2025'; base = 'OP.BB.25'; re = 'OP\.BB\.?25'; prod = 'Barro Branco' },
  @{ nome = 'EsPCEx 2026 (feita em 2025)'; base = 'OP.ESPCEX.26'; re = 'OP\.ESPCEX\.26'; prod = 'Full - EsPCEx' })
$saida = foreach ($L in $LANC) {
  $ds = @($LEADS | ? { $_.base -eq $L.base } | % { [datetime]$_.data } | Sort)
  $ini = $ds[[int]($ds.Count * 0.02)]; $fim = $ds[[int]($ds.Count * 0.98)].AddDays(21)
  $v = @($VENDAS | ? { $_.dt -ge $ini -and $_.dt -le $fim.AddDays(1) -and $_.prod -match [regex]::Escape($L.prod) })
  $gm = (@($META | ? { $_.campanha -match $L.re }) | % { Num $_.gasto } | measure -Sum).Sum
  $gg = (@($GOO | ? { $_.campanha -match $L.re }) | % { Num $_.gasto } | measure -Sum).Sum
  $fat = ($v | measure val -Sum).Sum
  [ordered]@{ nome = $L.nome; de = $ini.ToString('yyyy-MM-dd'); ate = $fim.ToString('yyyy-MM-dd'); investMeta = [math]::Round($gm, 0); investGoogle = [math]::Round($gg, 0); vendas = $v.Count; faturamento = [math]::Round($fat, 0) }
}
$saida | ConvertTo-Json -Depth 4 | Set-Content "$dados\retorno-lancamentos.json" -Encoding UTF8
foreach ($s in $saida) { $i = $s.investMeta + $s.investGoogle; '{0,-30} {1} a {2} | investido R$ {3,8:N0} (Meta {4:N0} + Google {5:N0}) | vendas {6,4} | faturamento R$ {7,10:N0} | R$ 1 -> R$ {8:N2}' -f $s.nome, $s.de, $s.ate, $i, $s.investMeta, $s.investGoogle, $s.vendas, $s.faturamento, ($s.faturamento / [math]::Max(1, $i)) }
