$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HM = Import-Csv "$PSScriptRoot\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$GASTO = Import-Csv 'C:\CLAUDE 170926\clientes\teorema-militar\analise-leads-x-compradores\meta-gasto-por-conjunto.csv' -Delimiter ';' -Encoding UTF8
$HOJE=[datetime]'2026-09-28'
function Plat($r){ $s="$($r.source)".ToLower(); $m="$($r.medium) $($r.campaign)".ToLower()
  if($s -match 'youtube_p|yt_p|pf_yt|yt_ads|youtube.*paid|^yt$' -or ($s -match 'youtube|yt' -and $m -match 'paid|ads')){ return 'YouTube Ads' }
  if($s -match 'facebook|^fb|meta|instagram|^ig' -and ($m -match 'ads|paid|\d+ -' -or $s -match 'ads|_p[fq]|\.p[fq]')){ return 'Meta Ads' }
  if($s -match 'facebook|^fb|meta'){ return 'Meta Ads' }
  return 'Orgânico / outros' }
function Grp($x){ switch -wildcard($x){ 'Frio*'{'FRIO'} 'Quente org*'{'QUENTE org'} 'Quente pago*'{'QUENTE PQ'} default{'Sem classif.'} } }
$VEND=@{}; foreach($s in ($HM|Sort data)){ $em=$s.email.Trim().ToLower(); if(-not $VEND[$em]){$VEND[$em]=New-Object System.Collections.ArrayList}; [void]$VEND[$em].Add(@{dt=[datetime]$s.data; val=[double]::Parse(("$($s.valor)" -replace ',','.'),$inv)}) }
$ENT=@{}; foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $d=[datetime]$r.data; if(-not $ENT[$r.email] -or $d -lt $ENT[$r.email].d){ $ENT[$r.email]=@{d=$d; pub=(Grp (Classe $r)); plat=(Plat $r)} } }
$R=foreach($em in $ENT.Keys){ $en=$ENT[$em]; $vs=@(); if($VEND[$em]){$vs=@($VEND[$em])}
  if(@($vs|?{$_.dt.Date -le $en.d}).Count){continue}
  $f90=($vs|?{($_.dt.Date-$en.d).TotalDays -le 90}|%{$_.val}|measure -Sum).Sum; $f365=($vs|?{($_.dt.Date-$en.d).TotalDays -le 365}|%{$_.val}|measure -Sum).Sum; $ft=($vs|%{$_.val}|measure -Sum).Sum
  [pscustomobject]@{ano=$en.d.Year; pub=$en.pub; plat=$en.plat; comprou=($vs.Count -gt 0); f90=[double]$f90; f365=[double]$f365; ft=[double]$ft; exp=($HOJE-$en.d).TotalDays} }
"--- leads por plataforma x público (entrada)"
$R | Group plat,pub | Sort Name | % { $b=@($_.Group|?{$_.comprou}); "  {0,-32} leads {1,6} | compraram {2,4} ({3:P2}) | R$ {4,11:N0}" -f $_.Name,$_.Count,$b.Count,($b.Count/$_.Count),($_.Group|measure ft -Sum).Sum }
"=== META: gasto x faturamento dos leads que vieram do Meta (ago/2023 em diante)"
$gF=($GASTO|?{$_.publico -eq 'Frio (PF)'}|%{[double]::Parse(("$($_.gasto)" -replace ',','.'),$inv)}|measure -Sum).Sum
$gQ=($GASTO|?{$_.publico -eq 'Quente (PQ)'}|%{[double]::Parse(("$($_.gasto)" -replace ',','.'),$inv)}|measure -Sum).Sum
$gT=($GASTO|%{[double]::Parse(("$($_.gasto)" -replace ',','.'),$inv)}|measure -Sum).Sum
$mF=@($R|?{$_.plat -eq 'Meta Ads' -and $_.pub -eq 'FRIO' -and $_.ano*100 -ge 202308}); $mQ=@($R|?{$_.plat -eq 'Meta Ads' -and $_.pub -eq 'QUENTE PQ'})
foreach($x in @(@('FRIO (PF)',$gF,$mF),@('QUENTE pago (PQ)',$gQ,$mQ))){ $g=$x[1]; $l=$x[2]; $n=$l.Count; $b=@($l|?{$_.comprou}).Count; $a=($l|measure f90 -Sum).Sum; $y=($l|measure f365 -Sum).Sum; $t=($l|measure ft -Sum).Sum
 "  {0,-17} gasto R$ {1,10:N0} | leads Meta {2,6} (R$ {3:N2}/lead) | compraram {4,4} ({5:P2}) | fat 90d R$ {6,9:N0} ({7:N2}x) | 1 ano R$ {8,9:N0} ({9:N2}x) | total R$ {10,9:N0} ({11:N2}x)" -f $x[0],$g,$n,($g/[math]::Max(1,$n)),$b,($b/[math]::Max(1,$n)),$a,($a/$g),$y,($y/$g),$t,($t/$g) }
"  gasto total Meta: R$ {0:N0} | fat total de TODOS os leads da base: R$ {1:N0} ({2:N2}x)" -f $gT,($R|measure ft -Sum).Sum,(($R|measure ft -Sum).Sum/$gT)
"=== por ano: gasto frio Meta x leads frios do Meta que entraram no ano"
foreach($a in 2023..2026){ $g=($GASTO|?{$_.ano -eq "$a" -and $_.publico -eq 'Frio (PF)'}|%{[double]::Parse(("$($_.gasto)" -replace ',','.'),$inv)}|measure -Sum).Sum; $l=@($R|?{$_.plat -eq 'Meta Ads' -and $_.pub -eq 'FRIO' -and $_.ano -eq $a}); $f90=($l|measure f90 -Sum).Sum; $t=($l|measure ft -Sum).Sum
 "  {0}: gasto frio R$ {1,9:N0} | leads {2,5} (R$ {3:N2}/lead) | compraram {4,3} | fat 90d R$ {5,8:N0} ({6:N2}x) | total até hoje R$ {7,8:N0} ({8:N2}x)" -f $a,$g,$l.Count,($g/[math]::Max(1,$l.Count)),@($l|?{$_.comprou}).Count,$f90,($f90/[math]::Max(1,$g)),$t,($t/[math]::Max(1,$g)) }
