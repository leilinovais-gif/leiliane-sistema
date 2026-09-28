$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HM = Import-Csv "$PSScriptRoot\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
$lat=[Text.Encoding]::GetEncoding(28591)
function Fix($s){ if($s -match 'Ã'){ [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
$ENT=@{}; foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $dd=[datetime]$r.data; if(-not $ENT[$r.email] -or $dd -lt $ENT[$r.email]){ $ENT[$r.email]=$dd } }
$FC=@{}; foreach($s in ($HM|Sort data)){ $em=$s.email.Trim().ToLower(); $pr=Fix $s.produto; $k="$pr|$em"; $vl=[double]::Parse(("$($s.valor)" -replace ',','.'),$inv)
  if(-not $FC[$k]){ $FC[$k]=@{pr=$pr; em=$em; dt=[datetime]$s.data; val=$vl} } else { $FC[$k].val+=$vl } }
$OUT=foreach($k in $FC.Keys){ $c=$FC[$k]; $en=$ENT[$c.em]; $dias= if($en){[int]($c.dt.Date-$en).TotalDays}else{$null}
  [pscustomobject]@{produto=$c.pr; lead=($en -and $dias -gt 0); dias=$dias; val=$c.val} }
$tab=foreach($g in ($OUT|Group produto)){ $n=$g.Count; $l=@($g.Group|?{$_.lead}); $ds=@($l|%{$_.dias}|Sort)
 [pscustomobject]@{produto=$g.Name; compradores=$n; fat=($g.Group|measure val -Sum).Sum; eram_lead=$l.Count; pct_lead=$l.Count/$n; fat_lead=($l|measure val -Sum).Sum; mediana_dias=$(if($ds.Count){$ds[[int]($ds.Count/2)]}else{''}); depois_30d=$(if($ds.Count){@($ds|?{$_ -gt 30}).Count/$ds.Count}else{''}); ate30=@($ds|?{$_ -le 30}).Count; d30_180=@($ds|?{$_ -gt 30 -and $_ -le 180}).Count; d180_365=@($ds|?{$_ -gt 180 -and $_ -le 365}).Count; mais_1ano=@($ds|?{$_ -gt 365}).Count } }
$tab = $tab | Sort compradores -desc
$tab | Export-Csv "$PSScriptRoot\por-produto.csv" -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"produtos: $($tab.Count) | pessoas x produto: $($OUT.Count) | eram lead antes: $(@($OUT|?{$_.lead}).Count)"
$tab | ? { $_.compradores -ge 15 } | % { "{0,-55} {1,5} | lead antes {2,4} ({3:P0}) R$ {4,9:N0} | mediana {5,4} d | até30 {6,3} | 1-6m {7,3} | 6-12m {8,3} | +1a {9,3} | depois 30d {10:P0}" -f $_.produto.Substring(0,[math]::Min(55,$_.produto.Length)),$_.compradores,$_.eram_lead,$_.pct_lead,$_.fat_lead,$_.mediana_dias,$_.ate30,$_.d30_180,$_.d180_365,$_.mais_1ano,$(if($_.depois_30d -ne ''){$_.depois_30d}else{0}) }
