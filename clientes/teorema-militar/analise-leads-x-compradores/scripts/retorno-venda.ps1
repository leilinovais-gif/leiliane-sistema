# Retorno dos anúncios de venda:
#  - carrinho aberto de cada lançamento x o que o Full vendeu no período do lançamento;
#  - perpétuo por ano (EsPCEx e Barro Branco) x o que o Full da escola vendeu FORA das janelas de lançamento.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$LEADS = Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV = Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = @(Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8 | ? { $_.mes -ge '2023-08' })  # mesmo período do Meta
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function EhCaptacao($c) { $u = $c.ToUpper(); ($u -match 'CAPTA|CADASTRO|LEADS|DISTRIBUI') -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|CONVERS') }
function EhCarrinho($c) { $u = $c.ToUpper(); (-not (EhCaptacao $c)) -and ($u -match 'CARRINHO|VENDA') -and ($u -notmatch 'INSTAGRAM POST|PUBLICA') }
function EhPerpetuo($c) { $u = $c.ToUpper(); (-not (EhCaptacao $c)) -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|AO VIVO|LIVE') -and ($u -match '(^|[^A-Z])PP[ .\-]|PERP|DESCOBERTA|RELACIONAMENTO|REMARKETING|CONVERS') }
$G = @(); foreach ($x in $META) { $G += [pscustomobject]@{ c = $x.campanha; ano = $x.ano; g = (Num $x.gasto) } }; foreach ($x in $GOO) { $G += [pscustomobject]@{ c = $x.campanha; ano = $x.mes.Substring(0, 4); g = (Num $x.gasto) } }
$V = @($HMV | % { [pscustomobject]@{ dt = [datetime]$_.data; prod = (Fix $_.produto); val = (Num $_.valor) } })
$LANC = @(
  @{ nome = 'Barro Branco 2023'; base = 'OP.BB23'; re = 'OP\.APMBB\.23'; prod = 'Barro Branco'; esc = 'BB' },
  @{ nome = 'EsPCEx 2024 (feita em 2023)'; base = 'OP.ESPCEX.24'; re = 'OP\.ESPCEX\.(SET\.)?24'; prod = 'Full - EsPCEx'; esc = 'ESP' },
  @{ nome = 'Plano EsPCEx 2024'; base = 'PLANO.ESPCEX.24'; re = 'PLANO\.?ESPCEX\.?24'; prod = 'Full - EsPCEx'; esc = 'ESP' },
  @{ nome = 'Barro Branco 2024'; base = 'OP.BB24'; re = 'OP\.APMBB\.24'; prod = 'Barro Branco'; esc = 'BB' },
  @{ nome = 'EsPCEx 2025 (feita em 2024)'; base = 'OP.ESPCEX.25'; re = 'OP\.ESPCEX\.25'; prod = 'Full - EsPCEx'; esc = 'ESP' },
  @{ nome = 'Barro Branco 2025'; base = 'OP.BB.25'; re = 'OP\.BB\.?25'; prod = 'Barro Branco'; esc = 'BB' },
  @{ nome = 'EsPCEx 2026 (feita em 2025)'; base = 'OP.ESPCEX.26'; re = 'OP\.ESPCEX\.26'; prod = 'Full - EsPCEx'; esc = 'ESP' })
$JAN = @{ ESP = @(); BB = @() }
$carr = foreach ($L in $LANC) {
  $ds = @($LEADS | ? { $_.base -eq $L.base } | % { [datetime]$_.data } | Sort); $ini = $ds[[int]($ds.Count * 0.02)]; $fim = $ds[[int]($ds.Count * 0.98)].AddDays(21)
  $JAN[$L.esc] += , @($ini, $fim)
  $gc = (@($G | ? { $_.c -match $L.re -and (EhCarrinho $_.c) }) | measure g -Sum).Sum
  $fat = (@($V | ? { $_.dt -ge $ini -and $_.dt -le $fim.AddDays(1) -and $_.prod -match [regex]::Escape($L.prod) }) | measure val -Sum).Sum
  [ordered]@{ nome = $L.nome; carrinho = [math]::Round($gc, 0); faturamento = [math]::Round($fat, 0) } }
function ForaDeLancamento($dt, $esc) { foreach ($j in $JAN[$esc]) { if ($dt -ge $j[0] -and $dt -le $j[1].AddDays(1)) { return $false } }; $true }
$perp = foreach ($e in @(@{ esc = 'ESP'; nome = 'EsPCEx'; reC = 'ESPCEX'; prod = 'Full - EsPCEx' }, @{ esc = 'BB'; nome = 'Barro Branco'; reC = 'APMBB|BARRO|(^|[^A-Z])BB'; prod = 'Barro Branco' })) {
  $anos = foreach ($a in 2023..2026) {
    $gp = (@($G | ? { $_.ano -eq "$a" -and (EhPerpetuo $_.c) -and $_.c.ToUpper() -match $e.reC }) | measure g -Sum).Sum
    $fv = @($V | ? { $_.dt.Year -eq $a -and $_.prod -match [regex]::Escape($e.prod) -and (ForaDeLancamento $_.dt $e.esc) })
    [ordered]@{ ano = $a; perpetuo = [math]::Round($gp, 0); vendasForaLancamento = [math]::Round(($fv | measure val -Sum).Sum, 0); nVendas = $fv.Count } }
  [ordered]@{ escola = $e.nome; anos = @($anos) } }
$perpTot = (@($G | ? { EhPerpetuo $_.c }) | measure g -Sum).Sum
$R = [ordered]@{ carrinho = @($carr); perpetuo = @($perp); perpetuoTotal = [math]::Round($perpTot, 0) }
$R | ConvertTo-Json -Depth 6 | Set-Content "$dados\retorno-venda.json" -Encoding UTF8
'CARRINHO ABERTO'; foreach ($c in $carr) { '{0,-30} carrinho R$ {1,8:N0} | Full vendido no lançamento R$ {2,9:N0} | R$ 1 -> R$ {3:N2}' -f $c.nome, $c.carrinho, $c.faturamento, ($c.faturamento / [math]::Max(1, $c.carrinho)) }
''; "PERPÉTUO (total de campanhas de perpétuo, todas as escolas: R$ {0:N0})" -f $perpTot
foreach ($p in $perp) { foreach ($a in $p.anos) { '{0,-14} {1}: perpétuo R$ {2,8:N0} | Full vendido fora de lançamento R$ {3,9:N0} ({4} vendas) | R$ 1 -> R$ {5:N2}' -f $p.escola, $a.ano, $a.perpetuo, $a.vendasForaLancamento, $a.nVendas, ($a.vendasForaLancamento / [math]::Max(1, $a.perpetuo)) } }
