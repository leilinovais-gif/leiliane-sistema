# Quem começa por um curso individual (Edition, Combo, Geografia, Desafio...) e depois compra um Full. Só Hotmart.
$inv = [Globalization.CultureInfo]::InvariantCulture
$dados = Join-Path $PSScriptRoot '..\dados'
$HOJE = [datetime]'2026-09-28'
$arqs = @("$dados\hotmart-vendas-2021-2022.csv", "$dados\hotmart-vendas.csv") | ? { Test-Path $_ }
$HM = foreach ($a in $arqs) { Import-Csv $a -Delimiter ';' -Encoding UTF8 }
$lat = [Text.Encoding]::GetEncoding(28591)
function Fix($s) { if ($s -match 'Ã') { [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x) { if (-not $x) { return 0 }; [double]::Parse(("$x" -replace ',', '.'), $inv) }
function EhFull($p) { $p -match '(?i)\bfull\b' }
# vendas sem cobrança repetida do mesmo curso em 60 dias
$V = New-Object System.Collections.ArrayList; $seen = @{}
foreach ($s in ($HM | Sort data)) { $em = $s.email.Trim().ToLower(); $dd = [datetime]$s.data; $pr = ((Fix $s.produto).Trim() -replace '^Teorema Militar - ','TM - ' -replace ' - Prof.*$','' -replace '\s+',' ').Trim(); $k = "$em|$pr"
  if ($seen[$k] -and ($dd - $seen[$k]).TotalDays -lt 60) { continue }; $seen[$k] = $dd
  [void]$V.Add([pscustomobject]@{ em = $em; dt = $dd; prod = $pr; full = (EhFull $pr); val = (Num $s.valor) }) }
$PES = $V | Group em
$desde = ($V | measure dt -Minimum).Minimum
$ind = @(); $fullComPrev = 0; $fullTot = 0
foreach ($g in $PES) { $c = @($g.Group | Sort dt)
  $pf = @($c | ? { $_.full }); if ($pf.Count) { $fullTot++; if (@($c | ? { -not $_.full -and $_.dt -lt $pf[0].dt.AddDays(-1) }).Count) { $fullComPrev++ } }
  if ($c[0].full) { continue }                      # só quem começou por um individual
  $prim = $c[0]; $depois = @($c | ? { $_.full -and $_.dt -gt $prim.dt.AddDays(1) })
  $ind += [pscustomobject]@{ em = $g.Name; ini = $prim.dt; ano = $prim.dt.Year; prod1 = $prim.prod; exp = ($HOJE - $prim.dt).TotalDays
    upgrade = ($depois.Count -gt 0); dias = $(if ($depois.Count) { [int]($depois[0].dt - $prim.dt).TotalDays } else { $null }); full1 = $(if ($depois.Count) { $depois[0].prod } else { '' })
    fatInd = (($c | ? { -not $_.full }) | measure val -Sum).Sum; fatFull = ($depois | measure val -Sum).Sum } }
$up = @($ind | ? { $_.upgrade }); $ds = @($up | % { $_.dias } | Sort)
$R = [ordered]@{ desde = $desde.ToString('yyyy-MM'); pessoasIndividual = $ind.Count; migraram = $up.Count; mediana = $(if ($ds.Count) { $ds[[int]($ds.Count / 2)] } else { $null }); p75 = $(if ($ds.Count) { $ds[[int]($ds.Count * 3 / 4)] } else { $null })
  fatIndividuais = [math]::Round(($ind | measure fatInd -Sum).Sum, 0); fatFullDepois = [math]::Round(($ind | measure fatFull -Sum).Sum, 0)
  compradoresFull = $fullTot; fullQueComecouIndividual = $fullComPrev
  prazos = [ordered]@{}; porAno = @(); porProduto = @(); destinos = @() }
foreach ($H in 90, 180, 365, 730) { $el = @($ind | ? { $_.exp -ge $H }); $R.prazos["d$H"] = [ordered]@{ pct = $(if ($el.Count) { [math]::Round(100 * @($el | ? { $_.upgrade -and $_.dias -le $H }).Count / $el.Count, 1) } else { $null }); n = $el.Count } }
$R.porAno = @(foreach ($g in ($ind | Group ano | Sort Name)) { $u = @($g.Group | ? { $_.upgrade }); $u12 = @($g.Group | ? { $_.upgrade -and $_.dias -le 365 })
  [ordered]@{ ano = [int]$g.Name; pessoas = $g.Count; migraram = $u.Count; em12meses = $u12.Count; fatFull = [math]::Round(($u | measure fatFull -Sum).Sum, 0) } })
$R.porProduto = @(foreach ($g in ($ind | Group prod1 | ? { $_.Count -ge 20 } | Sort Count -desc)) { $u = @($g.Group | ? { $_.upgrade }); $d2 = @($u | % { $_.dias } | Sort)
  [ordered]@{ produto = $g.Name; pessoas = $g.Count; migraram = $u.Count; mediana = $(if ($d2.Count) { $d2[[int]($d2.Count / 2)] } else { $null }); fatFull = [math]::Round(($u | measure fatFull -Sum).Sum, 0)
    destinos = @($u | Group full1 | Sort Count -desc | select -First 3 | % { [ordered]@{ full = $_.Name; n = $_.Count } }) } })
$R.destinos = @($up | Group full1 | Sort Count -desc | % { [ordered]@{ full = $_.Name; n = $_.Count; fat = [math]::Round(($_.Group | measure fatFull -Sum).Sum, 0) } })
$R | ConvertTo-Json -Depth 6 | Set-Content "$dados\individual-para-full.json" -Encoding UTF8
"desde {0} | começaram por individual: {1} | migraram pra Full: {2} ({3:P1}) | mediana {4} dias, 3/4 em {5} dias | fat individuais R$ {6:N0} | fat dos Fulls depois R$ {7:N0}" -f $R.desde, $R.pessoasIndividual, $R.migraram, ($R.migraram / [math]::Max(1, $R.pessoasIndividual)), $R.mediana, $R.p75, $R.fatIndividuais, $R.fatFullDepois
"compradores de Full: {0} | começaram por individual: {1} ({2:P1})" -f $R.compradoresFull, $R.fullQueComecouIndividual, ($R.fullQueComecouIndividual / [math]::Max(1, $R.compradoresFull))
'prazos: ' + (($R.prazos.Keys | % { '{0}: {1}% (n={2})' -f $_, $R.prazos[$_].pct, $R.prazos[$_].n }) -join ' | ')
'--- por ano do 1º individual'; $R.porAno | % { '  {0}: {1} pessoas, {2} migraram ({3} em até 12 meses), R$ {4:N0}' -f $_.ano, $_.pessoas, $_.migraram, $_.em12meses, $_.fatFull }
'--- por curso de entrada'; $R.porProduto | select -First 15 | % { '  {0,-45} {1,5} pessoas | {2,4} migraram ({3:P0}) | mediana {4} d | R$ {5,9:N0} | {6}' -f $_.produto.Substring(0, [math]::Min(45, $_.produto.Length)), $_.pessoas, $_.migraram, ($_.migraram / $_.pessoas), $_.mediana, $_.fatFull, (($_.destinos | % { "$($_.full) $($_.n)" }) -join ', ') }
'--- Full de destino'; $R.destinos | select -First 10 | % { '  {0,-40} {1,4} R$ {2:N0}' -f $_.full, $_.n, $_.fat }
