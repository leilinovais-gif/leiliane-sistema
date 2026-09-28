$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HM = Import-Csv "$PSScriptRoot\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$src = Get-Content "$PSScriptRoot\escola.ps1" -Raw; $i=$src.IndexOf('function Escola'); $j=$src.IndexOf('function Grp'); Invoke-Expression $src.Substring($i,$j-$i)
# 1a entrada datada de cada pessoa
$ENT=@{}; foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $dd=[datetime]$r.data; if(-not $ENT[$r.email] -or $dd -lt $ENT[$r.email].d){ $es= if($r.base -like 'ACTIVE*'){ Escola "$($r.campaign) $($r.term)" } else { Escola $r.base }; $ENT[$r.email]=@{d=$dd; esc=$es} } }
$MIG=@{}; foreach($r in $LEADS){ if($r.base -eq 'ACTIVE (migrado)' -and $r.email){ $MIG[$r.email]=1 } }
# 1a compra de cada pessoa em cada escola/curso
$FC=@{}; foreach($s in ($HM|Sort data)){ $em=$s.email.Trim().ToLower(); $es=Escola $s.produto; $k="$es|$em"; if(-not $FC[$k]){ $FC[$k]=@{esc=$es; em=$em; dt=[datetime]$s.data; val=[double]::Parse(("$($s.valor)" -replace ',','.'),$inv)} } }
$OUT=foreach($k in $FC.Keys){ $c=$FC[$k]; $en=$ENT[$c.em]; $st='Não estava na base'; $dias=''; $orig=''
  if($en){ $dias=[int]($c.dt.Date-$en.d).TotalDays; $orig=$en.esc; if($dias -gt 0){ $st='Era lead antes' } else { $st='Entrou no dia ou depois' } } elseif($MIG[$c.em]){ $st='Só no Active migrado (sem data)' }
  [pscustomobject]@{curso=$c.esc; status=$st; dias=$dias; origem=$orig} }
"compradores (pessoa x curso): $($OUT.Count)"
foreach($g in ($OUT|Group curso|Sort Count -desc)){ $n=$g.Count; $l=@($g.Group|?{$_.status -eq 'Era lead antes'}); $ds=@($l|%{[int]$_.dias}|Sort); $m=@($g.Group|?{$_.status -like 'Só no Active*'}).Count
 $orig=($l|Group origem|Sort Count -desc|select -First 3|%{"$($_.Name) $($_.Count)"}) -join ', '
 "{0,-24} compradores {1,5} | eram lead antes {2,4} ({3:P0}) | mediana {4} dias | depois de 30d {5:P0} | só no Active sem data {6} | entraram como lead de: {7}" -f $g.Name,$n,$l.Count,($l.Count/$n),$(if($ds.Count){$ds[[int]($ds.Count/2)]}else{'-'}),(@($ds|?{$_ -gt 30}).Count/[math]::Max(1,$ds.Count)),$m,$orig }
"--- leads ESA/AFA/EFOMM/EEAr no Active migrado (pela campanha/UTM):"
$LEADS|?{$_.base -eq 'ACTIVE (migrado)'} | % { Escola "$($_.campaign) $($_.term)" } | Group | Sort Count -desc | % { "  {0,6} {1}" -f $_.Count,$_.Name }
