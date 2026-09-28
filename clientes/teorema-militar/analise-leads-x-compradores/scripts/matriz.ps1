$inv=[Globalization.CultureInfo]::InvariantCulture
$LEADS = Import-Csv "$PSScriptRoot\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HM = Import-Csv "$PSScriptRoot\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$src = Get-Content "$PSScriptRoot\escola.ps1" -Raw; $i=$src.IndexOf('function Escola'); $j=$src.IndexOf('$VEND='); Invoke-Expression $src.Substring($i,$j-$i)
$lat=[Text.Encoding]::GetEncoding(28591); function Fix($s){ if($s -match 'Ã'){ [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Curto($p){ $p=(Fix $p).Trim() -replace '^TM (- )?','' -replace 'FULL','Full'; if($p.Length -gt 38){$p.Substring(0,38)}else{$p} }
$ENT=@{}; foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $dd=[datetime]$r.data
  if(-not $ENT[$r.email] -or $dd -lt $ENT[$r.email].d){ $es= if($r.base -like 'ACTIVE*'){ Escola "$($r.campaign) $($r.term)" } else { Escola $r.base }; $ENT[$r.email]=@{d=$dd; esc=$es; base=$r.base; pub=(Grp (Classe $r))} } }
$MIG=@{}; foreach($r in $LEADS){ if($r.base -eq 'ACTIVE (migrado)' -and $r.email){ $MIG[$r.email]=$r } }
$SALES=@($HM | Sort data | % { [pscustomobject]@{em=$_.email.Trim().ToLower(); dt=[datetime]$_.data; pr=(Curto $_.produto); sck=$_.sck; src=$_.src; val=[double]::Parse(("$($_.valor)" -replace ',','.'),$inv)} })
$BYEM=$SALES | Group em -AsHashTable
# ---------- 1) matriz: evento de entrada -> o que compraram depois
"=== 1) ENTRADA -> PRODUTOS COMPRADOS DEPOIS (1a compra de cada produto, pessoa entrou 1+ dia antes)"
$compras=New-Object System.Collections.ArrayList
foreach($em in $ENT.Keys){ $en=$ENT[$em]; if(-not $BYEM[$em]){continue}; $vs=@($BYEM[$em])
  if(@($vs|?{$_.dt.Date -le $en.d}).Count){continue}  # já era aluno / entrou no dia da compra
  $seenP=@{}; foreach($s in $vs){ if($seenP[$s.pr]){continue}; $seenP[$s.pr]=1; [void]$compras.Add([pscustomobject]@{base=$en.base; esc=$en.esc; pub=$en.pub; pr=$s.pr; dias=[int]($s.dt.Date-$en.d).TotalDays; val=$s.val}) } }
foreach($b in 'MAT.BAS.26','MAT.BAS.25','OP.ESPCEX.24','OP.ESPCEX.25','OP.ESPCEX.26','OP.BB23','OP.BB24','OP.BB.25','PLANO.ESPCEX.24','P.VIDA.24'){
  $g=@($compras|?{$_.base -eq $b}); $pes=@($ENT.Keys|?{$ENT[$_].base -eq $b}).Count
  "-- $b ($pes leads | $($g.Count) compras de produto | frio $(@($g|?{$_.pub -eq 'FRIO'}).Count), quente $(@($g|?{$_.pub -like 'QUENTE*'}).Count))"
  $g | Group pr | Sort Count -desc | select -First 8 | % { $ds=@($_.Group|%{$_.dias}|Sort); "     {0,-38} {1,4} (frio {2,3}) | mediana {3,4} d | até 30d {4,3} | 31-180d {5,3} | 181-365d {6,3} | +1 ano {7,3}" -f $_.Name,$_.Count,@($_.Group|?{$_.pub -eq 'FRIO'}).Count,$ds[[int]($ds.Count/2)],@($ds|?{$_ -le 30}).Count,@($ds|?{$_ -gt 30 -and $_ -le 180}).Count,@($ds|?{$_ -gt 180 -and $_ -le 365}).Count,@($ds|?{$_ -gt 365}).Count } }
# ---------- 2) de onde vieram os compradores do Full EsPCEx
"=== 2) COMPRADORES DO FULL ESPCEX (1a compra de cada pessoa)"
$esp=@{}; foreach($s in $SALES){ if($s.pr -eq 'Full - EsPCEx' -and -not $esp[$s.em]){ $esp[$s.em]=$s } }
$cat=foreach($em in $esp.Keys){ $s=$esp[$em]; $en=$ENT[$em]; $prev=@($BYEM[$em]|?{$_.dt -lt $s.dt.AddDays(-1) -and $_.pr -ne 'Full - EsPCEx'})
  $c= if($en -and $en.d -lt $s.dt.Date){'a) era lead antes'} elseif($prev.Count){'b) já era aluno de outro curso'} elseif($en){'c) entrou na base no dia/depois da compra'} elseif($MIG[$em]){'d) está no Active migrado (sem data)'} else {'e) não está em nenhuma base'}
  [pscustomobject]@{cat=$c; ano=$s.dt.Year; sck="$($s.sck)"; src="$($s.src)"} }
"total: $($cat.Count)"; $cat | Group cat | Sort Name | % { "  {0,-44} {1,5} {2,6:P1}" -f $_.Name,$_.Count,($_.Count/$cat.Count) }
"  por ano x categoria:"; $cat | Group ano | Sort Name | % { $a=$_; "   $($a.Name): " + (($a.Group|Group cat|Sort Name|%{ "$($_.Name.Substring(0,2)) $($_.Count)" }) -join ' | ') }
"  links de checkout (sck) dos que NÃO eram lead (c/d/e):"; $cat|?{$_.cat -match '^[cde]'} | % { $x=$_.sck.ToLower(); if(-not $x -or $x -eq 'null|null|null|null|null'){'(sem sck)'}elseif($x -match 'whats'){'WhatsApp'}elseif($x -match 'yt_live|live'){'Live YouTube'}elseif($x -match 'bio'){'Bio Instagram'}elseif($x -match 'stories|ig'){'Stories / IG'}elseif($x -match 'email'){'E-mail'}elseif($x -match 'yt|youtube'){'YouTube'}elseif($x -match 'ads|pf|pq|meta|fb'){'Anúncio'}elseif($x -match 'site|pv|pagina'){'Site / página'}else{'outros: '+$x.Substring(0,[math]::Min(30,$x.Length))} } | Group | Sort Count -desc | select -First 15 | % { "     {0,5} {1}" -f $_.Count,$_.Name }
# ---------- 3) frio: como/quando compra
"=== 3) FRIO: produtos comprados e tempo"
$fr=@($compras|?{$_.pub -eq 'FRIO'}); "compras de produto por leads frios: $($fr.Count) | R$ {0:N0}" -f ($fr|measure val -Sum).Sum
$fr | Group pr | Sort Count -desc | select -First 12 | % { $ds=@($_.Group|%{$_.dias}|Sort); "     {0,-38} {1,4} | mediana {2,4} d | depois de 30d {3:P0}" -f $_.Name,$_.Count,$ds[[int]($ds.Count/2)],(@($ds|?{$_ -gt 30}).Count/$ds.Count) }
