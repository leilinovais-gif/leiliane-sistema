$ErrorActionPreference='Stop'
$e=@{}; Get-Content 'C:\CLAUDE 170926\.env' | % { if($_ -match '^(ACTIVECAMPAIGN_API_URL|ACTIVECAMPAIGN_API_KEY)=(.*)$'){ $e[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'") } }
$ac=$e['ACTIVECAMPAIGN_API_URL'].TrimEnd('/'); $h=@{'Api-Token'=$e['ACTIVECAMPAIGN_API_KEY']}
$tn=@{}; for($o=0;;$o+=100){ $r=Invoke-RestMethod "$ac/api/3/tags?limit=100&offset=$o" -Headers $h; $r.tags|%{$tn[[string]$_.id]=$_.tag}; if($r.tags.Count -lt 100){break} }
$total=[int](Invoke-RestMethod "$ac/api/3/contacts?limit=1" -Headers $h).meta.total
"total $total"
$out=New-Object System.Collections.Generic.List[object]
for($off=0;$off -lt $total;$off+=100){
  $r=$null; for($t=0;$t -lt 4;$t++){ try{ $r=Invoke-RestMethod "$ac/api/3/contacts?limit=100&offset=$off&include=fieldValues,contactTags" -Headers $h; break }catch{ Start-Sleep 3 } }
  if(-not $r){ "falhou offset $off"; continue }
  $fv=@{}; foreach($x in @($r.fieldValues)){ if(-not $fv[$x.contact]){$fv[$x.contact]=@{}}; $fv[$x.contact][[string]$x.field]=$x.value }
  $tg=@{}; foreach($x in @($r.contactTags)){ if(-not $tg[$x.contact]){$tg[$x.contact]=@()}; $tg[$x.contact]+= ("{0}@{1}" -f $tn[[string]$x.tag], ($x.cdate -replace 'T.*','')) }
  foreach($c in @($r.contacts)){ $v=$fv[$c.id]; if(-not $v){$v=@{}}
    $out.Add([pscustomobject]@{id=$c.id;email=$c.email;phone=$c.phone;nome="$($c.firstName) $($c.lastName)";cdate=$c.cdate;source=$v['27'];content=$v['28'];medium=$v['29'];campaign=$v['30'];term=$v['31'];src1=$v['34'];med1=$v['35'];camp1=$v['36'];tags=(@($tg[$c.id]) -join ' ; ')}) }
  if(($off/100)%25 -eq 0){ "$off / $total" }
  Start-Sleep -Milliseconds 200
}
$out | Export-Csv "$PSScriptRoot\ac-contatos.csv" -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"pronto: $($out.Count)"
