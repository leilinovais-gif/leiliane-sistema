// Operação EsPCEx 27 · envia custo e resultados do Google Ads (por campanha e por dia) pro relatório online.
// Onde colar: Google Ads > Ferramentas > Ações em massa > Scripts > + Novo script.
// Frequência: agendar de hora em hora. Só lê a conta, não altera nada.

var CONFIG = {
  // Preencher depois que o relatório estiver no ar. Vazio = modo teste (só mostra o que leu, não envia).
  REPORT_URL: 'https://relatorio-espcex27.teoremacloudflare.workers.dev/api/google-ads',
  REPORT_KEY: '',   // colar aqui a GOOGLE_INGEST_KEY do arquivo .env (a mesma do segredo no Cloudflare)

  // Manda TODAS as campanhas da conta. Cada relatório separa as suas pelo nome da campanha.
  NAME_REGEX: '.*',
  START_DATE: '2026-08-01',

  // Vendas da Hotmart: 0 = desligado. As vendas chegam pelo webhook da Hotmart (Ferramentas > Webhook); este envio só serve de reserva
  // (ex.: 3 = confere os últimos 3 dias a cada hora), mas a Hotmart pode recusar pedidos vindos de servidores do Google.
  HOTMART_DIAS: 0,

  // Frequência (quantas vezes cada pessoa viu o anúncio). O Google só informa pras campanhas de vídeo (YouTube) e por um intervalo fechado,
  // de no máximo ~90 dias: usamos os últimos FREQUENCIA_DIAS dias, sem passar do START_DATE.
  FREQUENCIA_DIAS: 45
};

function main() {
  var account = AdsApp.currentAccount();
  var today = Utilities.formatDate(new Date(), account.getTimeZone(), 'yyyy-MM-dd');

  var query =
    'SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ' +
    'segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions ' +
    'FROM campaign ' +
    "WHERE segments.date BETWEEN '" + CONFIG.START_DATE + "' AND '" + today + "' " +
    "AND campaign.name REGEXP_MATCH '" + CONFIG.NAME_REGEX + "'";

  var rows = [];
  var it = AdsApp.search(query);
  while (it.hasNext()) {
    var r = it.next();
    rows.push({
      date: r.segments.date,
      campaignId: String(r.campaign.id),
      campaign: r.campaign.name,
      status: r.campaign.status,
      channel: r.campaign.advertisingChannelType,
      cost: Number(r.metrics.costMicros) / 1000000,
      impressions: Number(r.metrics.impressions),
      clicks: Number(r.metrics.clicks),
      conversions: Number(r.metrics.conversions)
    });
  }

  // Resumo no log, pra conferir se pegou as campanhas certas.
  var totals = {};
  rows.forEach(function (row) {
    var t = totals[row.campaign] || (totals[row.campaign] = { cost: 0, clicks: 0, conversions: 0 });
    t.cost += row.cost;
    t.clicks += row.clicks;
    t.conversions += row.conversions;
  });
  Logger.log('Conta ' + account.getCustomerId() + ' · ' + rows.length + ' linhas · ' + Object.keys(totals).length + ' campanhas');
  Object.keys(totals).forEach(function (name) {
    var t = totals[name];
    Logger.log(name + ' | custo ' + t.cost.toFixed(2) + ' | cliques ' + t.clicks + ' | conversões ' + t.conversions.toFixed(1));
  });

  var freq = lerFrequencia(account, today);

  if (!CONFIG.REPORT_URL || !CONFIG.REPORT_KEY) {
    Logger.log('Modo teste: REPORT_URL e REPORT_KEY vazios, nada foi enviado.');
    return;
  }

  var response = UrlFetchApp.fetch(CONFIG.REPORT_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Report-Key': CONFIG.REPORT_KEY },
    payload: JSON.stringify({
      customerId: account.getCustomerId(),
      currency: account.getCurrencyCode(),
      sentAt: new Date().toISOString(),
      rows: rows,
      frequencia: freq.itens,
      frequenciaDe: freq.de,
      frequenciaAte: freq.ate
    }),
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('O relatório recusou o envio (HTTP ' + code + '): ' + response.getContentText());
  }
  Logger.log('Enviado: ' + rows.length + ' linhas (HTTP ' + code + ').');

  // As vendas da Hotmart não passam pelo Google Ads: um erro aqui não pode derrubar o envio do Google, que já foi.
  try { enviarHotmart(); } catch (e) { Logger.log('Hotmart: ' + e.message); }
}

// A Hotmart recusa os pedidos de dados que saem do Cloudflare, então quem lê a Hotmart é este script (de fora do Cloudflare).
// O acesso à Hotmart (token) vem do próprio relatório, então as chaves da Hotmart continuam só no Cloudflare.
function enviarHotmart() {
  if (!CONFIG.HOTMART_DIAS) { Logger.log('Hotmart: desligado neste script (as vendas chegam pelo webhook da Hotmart).'); return; }
  var base = CONFIG.REPORT_URL.replace(/\/api\/google-ads$/, '');
  var cab = { 'X-Report-Key': CONFIG.REPORT_KEY };
  var t = UrlFetchApp.fetch(base + '/api/hotmart-token', { method: 'post', headers: cab, muteHttpExceptions: true });
  if (t.getResponseCode() !== 200) { Logger.log('Hotmart: o relatório não entregou o acesso (HTTP ' + t.getResponseCode() + ')'); return; }
  var token = JSON.parse(t.getContentText()).token;

  var agora = new Date().getTime();
  var itens = lerHotmart(token, agora - CONFIG.HOTMART_DIAS * 86400000, agora, ['APPROVED', 'COMPLETE']).map(enxugarVenda);
  var reembolsadas = lerHotmart(token, agora - 90 * 86400000, agora, ['REFUNDED', 'CHARGEBACK'])
    .map(function (i) { return i.purchase && i.purchase.transaction; }).filter(function (x) { return x; }).slice(0, 500);

  var lotes = Math.max(1, Math.ceil(itens.length / 100));
  var salvas = 0;
  for (var k = 0; k < lotes; k++) {
    var r = UrlFetchApp.fetch(base + '/api/hotmart-vendas', {
      method: 'post', contentType: 'application/json', headers: cab, muteHttpExceptions: true,
      payload: JSON.stringify({ itens: itens.slice(k * 100, (k + 1) * 100), reembolsadas: k === 0 ? reembolsadas : [] })
    });
    if (r.getResponseCode() !== 200) throw new Error('o relatório recusou as vendas (HTTP ' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 150));
    salvas += JSON.parse(r.getContentText()).salvas;
  }
  Logger.log('Hotmart: ' + salvas + ' vendas enviadas (últimos ' + CONFIG.HOTMART_DIAS + ' dias) e ' + reembolsadas.length + ' reembolsos conferidos.');
}

function lerHotmart(token, ini, fim, status) {
  var todas = [], pagina = null, n = 0;
  do {
    var url = 'https://developers.hotmart.com/payments/api/v1/sales/history?start_date=' + ini + '&end_date=' + fim + '&max_results=200' +
      status.map(function (s) { return '&transaction_status=' + s; }).join('') + (pagina ? '&page_token=' + encodeURIComponent(pagina) : '');
    var r = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('a Hotmart respondeu ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 150));
    var j = JSON.parse(r.getContentText());
    todas = todas.concat(j.items || []);
    pagina = j.page_info && j.page_info.next_page_token;
    n++;
  } while (pagina && n < 20);
  return todas;
}

// Só os campos que o relatório usa (do comprador vai o e-mail, que o relatório transforma num código e não guarda).
function enxugarVenda(i) {
  var c = i.purchase || {};
  return {
    buyer: { email: i.buyer && i.buyer.email },
    product: { id: i.product && i.product.id, name: i.product && i.product.name },
    purchase: {
      transaction: c.transaction, approved_date: c.approved_date, order_date: c.order_date, price: c.price,
      hotmart_fee: { total: c.hotmart_fee && c.hotmart_fee.total }, recurrency_number: c.recurrency_number,
      tracking: { source_sck: c.tracking && c.tracking.source_sck }
    }
  };
}

// Frequência por campanha de vídeo. Se o Google recusar a métrica (conta, tipo de campanha ou intervalo), devolve lista vazia e o envio segue normal.
function lerFrequencia(account, today) {
  var vazio = { itens: [], de: null, ate: null };
  try {
    var dias = CONFIG.FREQUENCIA_DIAS;
    var inicio = new Date(new Date().getTime() - dias * 86400000);
    var de = Utilities.formatDate(inicio, account.getTimeZone(), 'yyyy-MM-dd');
    if (de < CONFIG.START_DATE) de = CONFIG.START_DATE;
    var q =
      'SELECT campaign.id, campaign.name, metrics.average_impression_frequency_per_user, metrics.unique_users ' +
      'FROM campaign ' +
      "WHERE segments.date BETWEEN '" + de + "' AND '" + today + "' " +
      "AND campaign.advertising_channel_type = 'VIDEO' " +
      "AND campaign.name REGEXP_MATCH '" + CONFIG.NAME_REGEX + "'";
    var itens = [];
    var it = AdsApp.search(q);
    while (it.hasNext()) {
      var r = it.next();
      var f = Number(r.metrics.averageImpressionFrequencyPerUser);
      if (f > 0) itens.push({ campaignId: String(r.campaign.id), campaign: r.campaign.name, frequency: f, users: Number(r.metrics.uniqueUsers) || 0 });
    }
    Logger.log('Frequência: ' + itens.length + ' campanhas de vídeo (' + de + ' a ' + today + ').');
    return { itens: itens, de: de, ate: today };
  } catch (e) {
    Logger.log('Frequência: o Google não devolveu (' + e.message + '). O envio segue sem ela.');
    return vazio;
  }
}
