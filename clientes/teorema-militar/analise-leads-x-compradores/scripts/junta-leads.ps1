$D='C:\Users\User\Downloads\'
$bases = [ordered]@{
 'OP.BB23'        = @{f='OP.BB23 - ACTIVE - Página1.csv'; ano=2023; mes=8}
 'OP.ESPCEX.24'   = @{f='OP.ESPCEX.24 - Lançamento - LEADS.csv'; ano=2023; mes=9}
 'PLANO.ESPCEX.24'= @{f='PLANO.ESPCEX.24 - BASE - Página1.csv'; ano=2024; mes=2}
 'P.VIDA.24'      = @{f='Leads - P.VIDA.24 - Página1.csv'; ano=2024; mes=4}
 'OP.BB24'        = @{f='BASE - OP.BB24 - Página1.csv'; ano=2024; mes=8}
 'OP.ESPCEX.25'   = @{f='BASE - OP.ESPCEX.25 - Leads.csv'; ano=2024; mes=9}
 'MAT.BAS.25'     = @{f='BASE - MAT.BAS.25 - Leads.csv'; ano=2024; mes=12}
 'OP.BB.25'       = @{f='BASE - OP.BB.25 - Leads (1).csv'; ano=2025; mes=7}
 'OP.ESPCEX.26'   = @{f='Base - OP.ESPCEX.26 - Leads.csv'; ano=2025; mes=9}
 'MAT.BAS.26'     = @{f='_BASE - MAT.BAS.26 - Leads.csv'; ano=2025; mes=12}
}
function Col($row,$pats){ foreach($p in $pats){ foreach($k in $row.PSObject.Properties.Name){ if($k -match $p){ $v=$row.$k; if($v -ne $null){ return "$v".Trim() } } } }; '' }
function Dt($s,$b){ $s="$s".Trim(); if($s -match '^(\d{1,2})/(\d{1,2})/(\d{4})'){ return [datetime]::new([int]$matches[3],[int]$matches[2],[int]$matches[1]) }
  if($s -match '^(\d{1,2})/(\d{1,2})$'){ $m=[int]$matches[2]; $a=$b.ano; if($m -lt $b.mes -and ($b.mes-$m) -gt 3){$a++}; return [datetime]::new($a,$m,[int]$matches[1]) }
  return [datetime]::new($b.ano,$b.mes,1) }
$out=New-Object System.Collections.Generic.List[object]
foreach($nome in $bases.Keys){ $b=$bases[$nome]
  $rows = Get-Content ($D+$b.f) -Encoding UTF8 | ConvertFrom-Csv
  $c=0
  foreach($r in $rows){ $em=(Col $r @('^e-?mail$')).ToLower(); if($em -notmatch '@'){$em=''}
    $tel=Col $r @('telefone','phone','^\d{8,}$')
    if(-not $em -and -not $tel){continue}
    $out.Add([pscustomobject]@{base=$nome; email=$em; tel=$tel; nome=(Col $r @('^nome$')); source=(Col $r @('utm source')); medium=(Col $r @('utm medium')); campaign=(Col $r @('utm campaign')); content=(Col $r @('utm content')); term=(Col $r @('utm term')); data=(Dt (Col $r @('^data( lead)?$')) $b).ToString('yyyy-MM-dd')}); $c++ }
  "$nome : $c"
}
$ac = Import-Csv "$PSScriptRoot\ac-contatos.csv" -Delimiter ';' -Encoding UTF8
foreach($r in $ac){ $cd=[datetime]::Parse($r.cdate.Substring(0,10))
  $out.Add([pscustomobject]@{base= $(if($cd -lt [datetime]'2026-04-23'){'ACTIVE (migrado)'}else{'ACTIVE (2026)'}); email=$r.email.Trim().ToLower(); tel=$r.phone; nome=$r.nome; source=$r.source; medium=$r.medium; campaign=$r.campaign; content=$r.content; term=$r.term; data=$cd.ToString('yyyy-MM-dd')}) }
"ACTIVE: $($ac.Count)"
$out | Export-Csv "$PSScriptRoot\leads-unificados.csv" -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"total: $($out.Count)"
$out | Group base,source,medium | Sort Count -desc | ? Count -ge 15 | % { "{0,5} {1}" -f $_.Count,$_.Name }
