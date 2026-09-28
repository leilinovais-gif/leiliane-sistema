$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HM = Import-Csv "$PSScriptRoot\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$HOJE=[datetime]'2026-09-25'
function Escola($txt){ $x=" $txt ".ToLower()
  if($x -match 'barro|apmbb|op\.?bb|mega\.bb|(^|[^a-z])bb[0-9. ]'){return 'Barro Branco'}
  if($x -match 'espcex'){return 'EsPCEx'}
  if($x -match 'tr.{1,4}plice'){return 'Tríplice (AFA/EFOMM/EN)'}
  if($x -match 'efomm'){return 'EFOMM'}
  if($x -match 'eear'){return 'EEAr'}
  if($x -match 'epcar'){return 'EPCAr'}
  if($x -match '(^|[^a-z])esa([^a-z]|$)'){return 'ESA'}
  if($x -match '(^|[^a-z])afa([^a-z]|$)'){return 'AFA'}
  if($x -match 'escola naval|(^|[^a-z])en([^a-z]|$)'){return 'Escola Naval'}
  if($x -match 'cbmerj'){return 'CBMERJ'}
  if($x -match 'sargento'){return 'Sargentos'}
  if($x -match 'pm.?sp'){return 'PM-SP'}
  if($x -match 'mat\.?bas|matem.{1,6}tica b'){return 'Matemática Básica'}
  if($x -match 'vida'){return 'Projeto de Vida'}
  return 'Outros / matérias' }
function Grp($x){ switch -wildcard($x){ 'Frio*'{'FRIO'} 'Quente org*'{'QUENTE org'} 'Quente pago*'{'QUENTE PQ'} default{'Sem classif.'} } }
# vendas (sem cobrança repetida do mesmo produto em 60 dias)
$VEND=New-Object System.Collections.ArrayList; $seen=@{}
foreach($s in ($HM | Sort data)){ $em=$s.email.Trim().ToLower(); $dd=[datetime]$s.data; $k="$em|$($s.produto)"; if($seen[$k] -and ($dd-$seen[$k]).TotalDays -lt 60){continue}; $seen[$k]=$dd
  [void]$VEND.Add([pscustomobject]@{email=$em; dt=$dd; prod=$s.produto; esc=(Escola $s.produto); val=[double]::Parse(("$($s.valor)" -replace ',','.'),$inv)}) }
$VPE=@{}; foreach($s in $VEND){ if(-not $VPE[$s.email]){$VPE[$s.email]=New-Object System.Collections.ArrayList}; [void]$VPE[$s.email].Add($s) }
# entrada de cada pessoa = primeira captura datada (planilhas + Active 2026)
$ENT=@{}
foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $dd=[datetime]$r.data
  if(-not $ENT[$r.email] -or $dd -lt $ENT[$r.email].d){ $esc= if($r.base -like 'ACTIVE*'){ Escola "$($r.campaign) $($r.term)" } else { Escola $r.base }
    $ENT[$r.email]=[pscustomobject]@{d=$dd; base=$r.base; esc=$esc; pub=(Grp (Classe $r))} } }
$ROWS=New-Object System.Collections.ArrayList; $exA=0; $exB=0
foreach($em in $ENT.Keys){ $en=$ENT[$em]; $vs=@(); if($VPE[$em]){$vs=@($VPE[$em] | Sort dt)}
  if(@($vs|?{$_.dt.Date -lt $en.d}).Count){ $exA++; continue }
  if($vs.Count -and ($vs[0].dt.Date - $en.d).TotalDays -le 0){ $exB++; continue }
  $f= if($vs.Count){$vs[0]}else{$null}
  $mesma=@($vs|?{$_.esc -eq $en.esc})
  [void]$ROWS.Add([pscustomobject]@{email=$em; entrada=$en.d.ToString('yyyy-MM-dd'); base=$en.base; escola=$en.esc; publico=$en.pub; exposicao=[int]($HOJE-$en.d).TotalDays
    comprou=($vs.Count -gt 0); dias=$(if($f){[int]($f.dt.Date-$en.d).TotalDays}else{''}); prod1=$(if($f){$f.prod}else{''}); esc_prod1=$(if($f){$f.esc}else{''})
    comprou_mesma_escola=($mesma.Count -gt 0); dias_mesma=$(if($mesma.Count){[int]($mesma[0].dt.Date-$en.d).TotalDays}else{''}); n_compras=$vs.Count; fat=($vs|measure val -Sum).Sum; fat_mesma=($mesma|measure val -Sum).Sum }) }
$ROWS | Export-Csv "$PSScriptRoot\leads-x-compradores-escola.csv" -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"pessoas com entrada datada: $($ENT.Count) | fora (já eram alunos antes): $exA | fora (entraram no mesmo dia da compra = só aluno): $exB | analisadas: $($ROWS.Count)"
$compr=@($ROWS|?{$_.comprou}); "compraram depois de virar lead: $($compr.Count) ({0:P2}) | R$ {1:N0}" -f ($compr.Count/$ROWS.Count),(($compr|measure fat -Sum).Sum)
"=== POR PÚBLICO (todas as escolas)"
foreach($g in ($ROWS|Group publico|Sort Name)){ $n=$g.Count; $b=@($g.Group|?{$_.comprou}); $ds=@($b|%{[int]$_.dias}|Sort)
 "  {0,-13} leads {1,6} | compraram {2,5} ({3:P2}) | R$ {4,11:N0} | R$/lead {5,7:N2} | dias até comprar: mediana {6}, 25% {7}, 75% {8} | depois de 30d {9:P0}" -f $g.Name,$n,$b.Count,($b.Count/$n),($b|measure fat -Sum).Sum,(($b|measure fat -Sum).Sum/$n),$ds[[int]($ds.Count/2)],$ds[[int]($ds.Count/4)],$ds[[int]($ds.Count*3/4)],(@($ds|?{$_ -gt 30}).Count/[math]::Max(1,$ds.Count)) }
"=== CURVA: % dos leads que já compraram até X dias (só leads com X dias de base)"
foreach($g in ($ROWS|Group publico|Sort Name)){ $line="  {0,-13}" -f $g.Name
  foreach($H in 30,90,180,365,730){ $el=@($g.Group|?{$_.exposicao -ge $H}); $c=@($el|?{$_.comprou -and [int]$_.dias -le $H}).Count; $line+= " | {0}d: {1:P2} (n={2})" -f $H,($c/[math]::Max(1,$el.Count)),$el.Count }; $line }
"=== POR ESCOLA DE ENTRADA x público"
foreach($e in ($ROWS|Group escola|Sort Count -desc)){ "-- $($e.Name) ($($e.Count) leads)"
 foreach($g in ($e.Group|Group publico|Sort Name)){ $n=$g.Count; $b=@($g.Group|?{$_.comprou}); $m=@($g.Group|?{$_.comprou_mesma_escola}); $ds=@($b|%{[int]$_.dias}|Sort); $dm=@($m|%{[int]$_.dias_mesma}|Sort)
  "   {0,-13} leads {1,6} | compraram {2,4} ({3:P2}) R$ {4,9:N0} | da própria escola {5,4} ({6:P2}) R$ {7,9:N0} | mediana dias {8} (própria escola {9}) | depois 30d {10:P0}" -f $g.Name,$n,$b.Count,($b.Count/$n),($b|measure fat -Sum).Sum,$m.Count,($m.Count/$n),($m|measure fat_mesma -Sum).Sum,$(if($ds.Count){$ds[[int]($ds.Count/2)]}else{'-'}),$(if($dm.Count){$dm[[int]($dm.Count/2)]}else{'-'}),(@($ds|?{$_ -gt 30}).Count/[math]::Max(1,$ds.Count)) } }
"=== FRIO: curva por escola (própria escola ou qualquer produto)"
foreach($e in ($ROWS|?{$_.publico -eq 'FRIO'}|Group escola|Sort Count -desc)){ $line="  {0,-24}" -f $e.Name
  foreach($H in 30,90,180,365,730){ $el=@($e.Group|?{$_.exposicao -ge $H}); $c=@($el|?{$_.comprou -and [int]$_.dias -le $H}).Count; $line+= " | {0}d {1:P2} (n={2})" -f $H,($c/[math]::Max(1,$el.Count)),$el.Count }; $line }
"=== FRIO: faixas de tempo até a 1a compra"
$fb=@($ROWS|?{$_.publico -eq 'FRIO' -and $_.comprou}); $fb | Group { $d=[int]$_.dias; if($d -le 30){'1) até 30 dias'}elseif($d -le 90){'2) 1-3 meses'}elseif($d -le 180){'3) 3-6 meses'}elseif($d -le 365){'4) 6-12 meses'}elseif($d -le 730){'5) 1-2 anos'}else{'6) 2+ anos'} } | Sort Name | % { "  {0,-16} {1,4} {2,6:P1}  R$ {3,9:N0}" -f $_.Name,$_.Count,($_.Count/$fb.Count),($_.Group|measure fat -Sum).Sum }
"  escola do 1o produto comprado pelo frio:"; $fb | Group esc_prod1 | Sort Count -desc | % { "    {0,4} {1}" -f $_.Count,$_.Name }
