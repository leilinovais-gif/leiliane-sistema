$inv=[Globalization.CultureInfo]::InvariantCulture
$RW = Import-Csv "$PSScriptRoot\leads-x-compradores-escola.csv" -Delimiter ';' -Encoding UTF8
foreach($x in $RW){ $x.comprou = $x.comprou -eq 'True'; $x.exposicao=[int]$x.exposicao; $x.fat= if($x.fat){[double]::Parse(("$($x.fat)" -replace ',','.'),$inv)}else{0} }
function Resumo($nome,$g){ $n=$g.Count; $b=@($g|?{$_.comprou}); $ds=@($b|%{[int]$_.dias}|Sort); $ft=($b|measure fat -Sum).Sum; $fd=($b|?{[int]$_.dias -gt 30}|measure fat -Sum).Sum
 "{0,-20} leads {1,6} | compraram {2,5} ({3:P2}) | até 30d {4,4} | depois 30d {5,4} ({6:P0}) | mediana {7} dias, 75% até {8} | R$ {9,11:N0} (depois 30d R$ {10,9:N0} = {11:P0}) | R$/lead {12:N2}" -f $nome,$n,$b.Count,($b.Count/$n),@($ds|?{$_ -le 30}).Count,@($ds|?{$_ -gt 30}).Count,(@($ds|?{$_ -gt 30}).Count/[math]::Max(1,$ds.Count)),$(if($ds.Count){$ds[[int]($ds.Count/2)]}else{'-'}),$(if($ds.Count){$ds[[int]($ds.Count*3/4)]}else{'-'}),$ft,$fd,($fd/[math]::Max(1,$ft)),($ft/$n)
 $line="{0,-20} curva:" -f ''; foreach($H in 30,90,180,365,730){ $el=@($g|?{$_.exposicao -ge $H}); $c=@($el|?{$_.comprou -and [int]$_.dias -le $H}).Count; $line+= " | {0}d {1:P2} (n={2})" -f $H,($c/[math]::Max(1,$el.Count)),$el.Count }; $line }
"=== BASE TODA"; Resumo 'TODOS' $RW
"=== faixas de tempo (todos os compradores)"; $bb=@($RW|?{$_.comprou}); $bb | Group { $d=[int]$_.dias; if($d -le 30){'1) até 30 dias'}elseif($d -le 90){'2) 1-3 meses'}elseif($d -le 180){'3) 3-6 meses'}elseif($d -le 365){'4) 6-12 meses'}elseif($d -le 730){'5) 1-2 anos'}else{'6) 2+ anos'} } | Sort Name | % { "  {0,-16} {1,5} {2,6:P1}  R$ {3,10:N0}" -f $_.Name,$_.Count,($_.Count/$bb.Count),($_.Group|measure fat -Sum).Sum }
"=== POR ESCOLA (todos os públicos)"; foreach($e in ($RW|Group escola|Sort Count -desc)){ Resumo $e.Name $e.Group }
