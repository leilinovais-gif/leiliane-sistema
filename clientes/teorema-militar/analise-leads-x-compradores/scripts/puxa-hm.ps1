$ErrorActionPreference='Stop'
$e=@{}; Get-Content 'C:\CLAUDE 170926\.env' | % { if($_ -match '^(HOTMART_CLIENT_ID|HOTMART_CLIENT_SECRET|HOTMART_BASIC_TOKEN)=(.*)$'){ $e[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'") } }
$b=$e['HOTMART_BASIC_TOKEN']; if($b -notmatch '^Basic '){$b='Basic '+$b}
$tk=Invoke-RestMethod -Method Post -Uri ("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials&client_id="+$e['HOTMART_CLIENT_ID']+"&client_secret="+$e['HOTMART_CLIENT_SECRET']) -Headers @{Authorization=$b}
$h=@{Authorization=('Bearer '+$tk.access_token)}
function Ms([datetime]$d){ [long]([DateTimeOffset]::new([datetime]::SpecifyKind($d,'Utc'))).ToUnixTimeMilliseconds() }
$out=New-Object System.Collections.Generic.List[object]
$a=2023;$m=1;$hoje=[datetime]::UtcNow
while($true){
  $ini=[datetime]::new($a,$m,1,3,0,0,[DateTimeKind]::Utc); if($ini -gt $hoje){break}; $fim=$ini.AddMonths(1).AddMilliseconds(-1)
  $pg=$null; $n=0
  do { $u="https://developers.hotmart.com/payments/api/v1/sales/history?start_date=$(Ms $ini)&end_date=$(Ms $fim)&max_results=200&transaction_status=APPROVED&transaction_status=COMPLETE"
    if($pg){$u+='&page_token='+[uri]::EscapeDataString($pg)}
    $r=$null; for($t=0;$t -lt 4;$t++){ try{$r=Invoke-RestMethod -Uri $u -Headers $h; break}catch{Start-Sleep 3} }
    foreach($i in @($r.items)){ $c=$i.purchase
      $out.Add([pscustomobject]@{transacao=$c.transaction;produto_id=$i.product.id;produto=$i.product.name;email=$i.buyer.email;nome=$i.buyer.name;telefone=$i.buyer.phone;
        data=[DateTimeOffset]::FromUnixTimeMilliseconds([long]$c.order_date).ToOffset([timespan]::FromHours(-3)).ToString('yyyy-MM-dd HH:mm');
        valor=$c.price.value;parcela_recorrencia=$c.recurrency_number;pagamento=$c.payment.type;sck=$c.tracking.source_sck;src=$c.tracking.source;oferta=$c.offer.code;status=$c.status}) }
    $pg=$r.page_info.next_page_token; $n++ } while($pg -and $n -lt 60)
  '{0}-{1:D2}: {2} acumuladas' -f $a,$m,$out.Count
  $m++; if($m -gt 12){$m=1;$a++}
}
$out | Export-Csv "$PSScriptRoot\hotmart-vendas.csv" -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"pronto: $($out.Count)"
