# Base histórica de leads do Supabase antigo (projeto "dados", tabela leads, 2022 a 25/09/2025). Só leitura.
$e=@{}; Get-Content 'C:\CLAUDE 170926\.env' | % { if($_ -match '^(SUPABASE_URL_DADOS|SUPABASE_SERVICE_KEY_DADOS)=(.*)$'){ $e[$matches[1]]=$matches[2].Trim().Trim('"').Trim("'") } }
$u=$e['SUPABASE_URL_DADOS'].TrimEnd('/'); $h=@{apikey=$e['SUPABASE_SERVICE_KEY_DADOS']; Authorization='Bearer '+$e['SUPABASE_SERVICE_KEY_DADOS']}
$out=New-Object System.Collections.ArrayList
for($o=0;;$o+=1000){ $r=Invoke-RestMethod "$u/rest/v1/leads?select=data,hora,evento,tags,nome,email,telefone,utm_source,utm_medium,utm_campaign,utm_term,utm_content&order=id.asc&limit=1000&offset=$o" -Headers $h
  foreach($x in $r){ [void]$out.Add($x) }; if($r.Count -lt 1000){break} }
$out | Export-Csv (Join-Path $PSScriptRoot '..\dados\supabase-leads.csv') -NoTypeInformation -Encoding UTF8 -Delimiter ';'
"linhas: $($out.Count)"
"--- eventos (top 40)"; $out | Group evento | Sort Count -desc | select -First 40 | % { "{0,6} {1}" -f $_.Count,$_.Name }
