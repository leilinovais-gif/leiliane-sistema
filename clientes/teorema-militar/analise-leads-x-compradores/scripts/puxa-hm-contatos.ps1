# Telefone e nome completo do comprador de cada venda (Hotmart, endpoint de participantes), ago/2023 em diante. Só pra cruzar com a base de leads.
$ErrorActionPreference='Stop'
$e=@{}; Get-Content 'C:\CLAUDE 170926\.env' | % { if($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN)=(.*)$'){ $e[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'") } }
$b=$e['HOTMART_BASIC_TOKEN']; if($b -notmatch '^Basic '){$b='Basic '+$b}
$tk=Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id="+$e['HOTMART_CLIENT_ID']+"&client_secret="+$e['HOTMART_CLIENT_SECRET']) -Headers @{Authorization=$b}
$h=@{Authorization=('Bearer '+$tk.access_token)}
function Ms([datetime]$d){ [long]([DateTimeOffset]::new([datetime]::SpecifyKind($d,'Utc'))).ToUnixTimeMilliseconds() }
$out=New-Object System.Collections.ArrayList
$a=2023;$m=8
while($true){ $ini=[datetime]::new($a,$m,1,3,0,0,[DateTimeKind]::Utc); if($ini -gt [datetime]::UtcNow){break}; $fim=$ini.AddMonths(1).AddMilliseconds(-1)
  $pg=$null; $n=0
  do { $u="https://developers.hotmart.com/payments/api/v1/sales/users?start_date=$(Ms $ini)&end_date=$(Ms $fim)&max_results=200"; if($pg){$u+='&page_token='+[uri]::EscapeDataString($pg)}
    $r=$null; for($t=0;$t -lt 4;$t++){ try{$r=Invoke-RestMethod -Uri $u -Headers $h; break}catch{Start-Sleep 3} }
    foreach($i in @($r.items)){ $c=@($i.users | ? { $_.role -eq 'BUYER' })[0].user; if(-not $c){continue}
      [void]$out.Add([pscustomobject]@{ transacao=$i.transaction; email="$($c.email)".Trim().ToLower(); nome=$c.name; celular=$c.cellphone; telefone=$c.phone }) }
    $pg=$r.page_info.next_page_token; $n++ } while($pg -and $n -lt 60)
  '{0}-{1:D2}: {2}' -f $a,$m,$out.Count; $m++; if($m -gt 12){$m=1;$a++} }
$out | Export-Csv (Join-Path $PSScriptRoot '..\dados\hotmart-compradores-contato.csv') -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"pronto: $($out.Count) | com celular: $(@($out|?{$_.celular -or $_.telefone}).Count)"
