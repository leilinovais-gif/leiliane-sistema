// Teorema · gasto do Google Ads por campanha e por mês, de 2023 até hoje (para o relatório gerencial).
// Onde colar: Google Ads > Ferramentas > Ações em massa > Scripts > + Novo script. Rodar UMA vez (não precisa agendar).
// Só lê a conta: não altera campanha nenhuma. Cria uma planilha no Google Drive de quem roda e mostra o link no log.

var DESDE = '2023-01-01';

function main() {
  var conta = AdsApp.currentAccount();
  var hoje = Utilities.formatDate(new Date(), conta.getTimeZone(), 'yyyy-MM-dd');
  var query =
    'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, segments.month, ' +
    'metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions ' +
    'FROM campaign ' +
    "WHERE segments.date BETWEEN '" + DESDE + "' AND '" + hoje + "' AND metrics.cost_micros > 0";

  var linhas = [['mes', 'campanha_id', 'campanha', 'status', 'tipo', 'gasto', 'impressoes', 'cliques', 'conversoes']];
  var total = 0;
  var it = AdsApp.search(query);
  while (it.hasNext()) {
    var r = it.next();
    var gasto = Number(r.metrics.costMicros) / 1000000;
    total += gasto;
    linhas.push([
      String(r.segments.month).slice(0, 7), String(r.campaign.id), r.campaign.name, r.campaign.status,
      r.campaign.advertisingChannelType, Math.round(gasto * 100) / 100,
      Number(r.metrics.impressions), Number(r.metrics.clicks), Number(r.metrics.conversions)
    ]);
  }

  var planilha = SpreadsheetApp.create('Teorema - Google Ads gasto mensal desde 2023');
  var aba = planilha.getSheets()[0];
  aba.getRange(1, 1, linhas.length, linhas[0].length).setValues(linhas);

  Logger.log('Conta ' + conta.getCustomerId() + ' · ' + (linhas.length - 1) + ' linhas · gasto total R$ ' + total.toFixed(2));
  Logger.log('Planilha: ' + planilha.getUrl());
}
