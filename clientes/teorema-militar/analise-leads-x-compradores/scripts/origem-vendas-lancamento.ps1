# Vendas do Full no período de cada lançamento, pela origem do comprador (último cadastro antes da compra, qualquer base)
$inv=[Globalization.CultureInfo]::InvariantCulture
$dados=Join-Path $PSScriptRoot '..\dados'
$LEADS=Import-Csv "$dados\leads-unificados.csv" -Delimiter ';' -Encoding UTF8
$HMV=Import-Csv "$dados\hotmart-vendas.csv" -Delimiter ';' -Encoding UTF8
. "$PSScriptRoot\classe.ps1"
$lat=[Text.Encoding]::GetEncoding(28591); function Fix($s){ if($s -match 'Ã'){ [Text.Encoding]::UTF8.GetString($lat.GetBytes($s)) } else { $s } }
function Num($x){ if(-not $x){return 0}; [double]::Parse(("$x" -replace ',','.'),$inv) }
function Grupo($x){ switch -wildcard($x){ 'Frio*'{'frio'} 'Quente org*'{'org'} 'Quente pago*'{'pq'} default{'semorigem'} } }
$CAD=@{}; foreach($r in $LEADS){ if(-not $r.email -or $r.base -eq 'ACTIVE (migrado)'){continue}; $em=$r.email.Trim().ToLower(); if(-not $CAD[$em]){$CAD[$em]=New-Object System.Collections.ArrayList}; [void]$CAD[$em].Add([pscustomobject]@{d=[datetime]$r.data; pub=(Grupo (Classe $r)); src="$($r.source) | $($r.medium)"}) }
$LANC=@(@{n='EsPCEx 2024';b='OP.ESPCEX.24';p='Full - EsPCEx'},@{n='EsPCEx 2025';b='OP.ESPCEX.25';p='Full - EsPCEx'},@{n='EsPCEx 2026';b='OP.ESPCEX.26';p='Full - EsPCEx'},@{n='Barro Branco 2024';b='OP.BB24';p='Barro Branco'},@{n='Barro Branco 2025';b='OP.BB.25';p='Barro Branco'})
foreach($L in $LANC){ $ds=@($LEADS|?{$_.base -eq $L.b}|%{[datetime]$_.data}|Sort); $ini=$ds[[int]($ds.Count*0.02)]; $fim=$ds[[int]($ds.Count*0.98)].AddDays(21)
  $vs=@($HMV|?{ $d=[datetime]$_.data; $d -ge $ini -and $d -le $fim.AddDays(1) -and (Fix $_.produto) -match [regex]::Escape($L.p) })
  $acc=@{}; $orgSrc=@{}
  foreach($s in $vs){ $em=$s.email.Trim().ToLower(); $dv=[datetime]$s.data; $c=@(); if($CAD[$em]){ $c=@($CAD[$em]|?{$_.d -lt $dv.Date}|Sort d) }
    $k= if($c.Count){ $c[-1].pub } else { 'naoLead' }; $acc[$k]=[double]$acc[$k]+(Num $s.valor)
    if($k -eq 'org'){ $orgSrc[$c[-1].src]=[double]$orgSrc[$c[-1].src]+1 } }
  $tot=($vs|%{Num $_.valor}|measure -Sum).Sum
  "{0,-18} {1} a {2} | vendas {3} R$ {4,9:N0} | frio {5:P0} | quente {6:P0} | orgânico {7:P0} | sem origem {8:P0} | não era lead {9:P0}" -f $L.n,$ini.ToString('dd/MM/yy'),$fim.ToString('dd/MM/yy'),$vs.Count,$tot,([double]$acc.frio/$tot),([double]$acc.pq/$tot),([double]$acc.org/$tot),([double]$acc.semorigem/$tot),([double]$acc.naoLead/$tot)
  "     orgânico veio de: " + (($orgSrc.GetEnumerator()|Sort Value -desc|select -First 6|%{ "$($_.Key) ($($_.Value))" }) -join ', ') }
