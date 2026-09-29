# Abre o investimento em anúncios que NÃO são captação de lead (venda): carrinho, lembrete/aquecimento, perpétuo, impulsionamento...
# e, por lançamento, quanto foi captação e quanto foi venda.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$META = Import-Csv (Join-Path $PSScriptRoot '..\meta-gasto-por-conjunto.csv') -Delimiter ';' -Encoding UTF8
$GOO = @(Import-Csv "$dados\google-ads-gasto-mensal.csv" -Encoding UTF8 | ? { $_.mes -ge '2023-08' })  # mesmo período do Meta
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function EhCaptacao($c) { $u = $c.ToUpper(); ($u -match 'CAPTA|CADASTRO|LEADS|DISTRIBUI') -and ($u -notmatch 'CARRINHO|VENDA|LEMBRETE|AQUEC|CONVERS') }
function Sub($c) { $u = $c.ToUpper()
  if ($u -match 'INSTAGRAM POST|PUBLICA.{1,3}O DO INSTAGRAM|POST DO INSTAGRAM') { return 'Impulsionamento de posts' }
  if ($u -match 'CARRINHO|VENDA') { return 'Carrinho aberto (venda no lançamento)' }
  if ($u -match 'LEMBRETE|AQUEC|AO VIVO|LIVE') { return 'Lembrete e aquecimento (levar pra live)' }
  if ($u -match '(^|[^A-Z])PP[ .\-]|PERP|DESCOBERTA|RELACIONAMENTO|REMARKETING|CONVERS') { return 'Perpétuo (venda fora de lançamento)' }
  if ($u -match 'ANIVERS|BLACK|RECONHECIMENTO|ALCANCE|INSTITUC') { return 'Datas e marca (aniversário, Black, alcance)' }
  return 'Outros' }
$lin = @(); foreach ($x in $META) { $lin += [pscustomobject]@{ c = $x.campanha; ano = $x.ano; g = (Num $x.gasto) } }; foreach ($x in $GOO) { $lin += [pscustomobject]@{ c = $x.campanha; ano = $x.mes.Substring(0, 4); g = (Num $x.gasto) } }
$venda = @($lin | ? { -not (EhCaptacao $_.c) })
$tot = ($venda | measure g -Sum).Sum
$out = @($venda | Group { Sub $_.c } | Sort { -($_.Group | measure g -Sum).Sum } | % { [ordered]@{ tipo = $_.Name; total = [math]::Round(($_.Group | measure g -Sum).Sum, 0); anos = @(foreach ($a in 2023..2026) { [math]::Round((@($_.Group | ? { $_.ano -eq "$a" }) | measure g -Sum).Sum, 0) }) } })
$out | ConvertTo-Json -Depth 4 | Set-Content "$dados\investimento-venda.json" -Encoding UTF8
"anúncios que não são captação: R$ {0:N0}" -f $tot
foreach ($o in $out) { '{0,-45} R$ {1,9:N0} | {2}' -f $o.tipo, $o.total, (($o.anos | % { '{0:N0}' -f $_ }) -join ' / ') }
''; '--- "Outros" (maiores campanhas)'; $venda | ? { (Sub $_.c) -eq 'Outros' } | Group c | Sort { -($_.Group | measure g -Sum).Sum } | select -First 12 | % { '  R$ {0,8:N0} {1}' -f ($_.Group | measure g -Sum).Sum, $_.Name }
