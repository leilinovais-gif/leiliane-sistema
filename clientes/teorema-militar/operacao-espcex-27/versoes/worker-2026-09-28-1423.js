// Relatório online · Operação EsPCEx 27 · Teorema Militar
// Cloudflare Worker em arquivo único: serve a página, lê o ActiveCampaign e o Meta na hora,
// e guarda o que o script do Google Ads envia.
//
// Segredos (Cloudflare > Worker > Settings > Variables and Secrets), nunca no código:
//   AC_API_URL, AC_API_KEY      ActiveCampaign
//   META_ACCESS_TOKEN           opcional. Sem ele o Meta aparece como "aguardando conexão"
//   REPORT_PASSWORD             senha pra abrir o relatório (o usuário pode ser qualquer um)
//   BETA_PASSWORD               opcional: senha de teste. Quem entra com ela vê os recursos em teste (ver BETA)
//   ACCESS_TEAM, ACCESS_AUD     opcionais: entrada por e-mail do Cloudflare Access (ver acessoValido). Não são segredos
//   GOOGLE_INGEST_KEY           senha que o script do Google Ads usa pra enviar
// Armazenamento: um KV namespace ligado ao Worker com o nome REPORT_KV.

// ================================================================ configuração
// GLOBAL vale pra todas as operações. Cada operação é um bloco em OPERACOES: endereço = /<nome do bloco>.
// Pra criar uma operação nova, copie o bloco de uma existente, troque o nome e ajuste os campos.

const GLOBAL = {
  cliente: 'Teorema Militar',

  // Campos personalizados do ActiveCampaign.
  campoEngajamento: '33', // "Data do último Engajamento": é ele que define o dia do lead
  campoUtm: { source: '27', content: '28', medium: '29', campaign: '30', term: '31' },

  // O Meta cobra 13,85% de imposto por cima do gasto. Todo valor do Meta no relatório já sai com ele.
  // O Google não cobra.
  impostoMeta: 0.1385,

  // Meta Ads.
  meta: { contaId: '277024930231617', versao: 'v23.0', desde: '2026-07-01' },

  cacheSegundos: 120,
  maxPaginas: 40 // 100 leads por página; o plano gratuito aceita 50 chamadas externas por acesso
};

const OPERACOES = {
  'espcex-27': {
    titulo: 'Operação EsPCEx 27',
    escola: 'EsPCEx',            // agrupa na página inicial dos relatórios
    edicao: 'Operação 2027',
    ano: 2027,

    // Histórico dos lançamentos anteriores (aba "Histórico" do menu). Números passados pela Leili em 2026-09-21.
    // Cada linha tem um valor por ano, na ordem de "anos"; null = em branco (aparece como "—"). O 2026 fica em branco
    // pra preencher conforme o evento acontece: é só trocar o null da última posição pelo número.
    // Os percentuais não são digitados: saem de valor ÷ total de leads do ano (conferi que batem com os da planilha da Leili).
    historico: {
      anos: [2021, 2022, 2023, 2024, 2025, 2026],
      linhas: [
        { id: 'leads', rotulo: 'Leads', valores: [1943, 1841, 3819, 5187, 5421, null], pct: false },
        { id: 'quente', rotulo: 'Público quente', valores: [null, null, 1719, 2749, 1464, null], pct: true },
        { id: 'frio', rotulo: 'Público frio', valores: [null, null, 2100, 2438, 3957, null], pct: true },
        { id: 'cpl1', rotulo: '1 CPL', valores: [526, 314, 750, 796, 640, null], pct: true },
        { id: 'cpl2', rotulo: '2 CPL', valores: [424, 232, 532, 561, 413, null], pct: true },
        { id: 'cpl3', rotulo: '3 CPL', valores: [337, 150, 473, 480, 353, null], pct: true },
        { id: 'cpl4', rotulo: '4 CPL', valores: [376, 219, 365, 406, 286, null], pct: true },
        { id: 'dia1', rotulo: 'Primeiro dia de vendas', valores: [123, 82, 98, 130, 115, null], pct: true },
        { id: 'vendas', rotulo: 'Total de vendas', valores: [263, 178, 232, 261, 180, null], pct: true }
      ]
    },
    tagNome: 'OP.EsPCEx.27',
    megaNome: 'Mega EsPCEx',

    // Tags do ActiveCampaign (id da tag).
    tagOperacao: 349, // OP.EsPCEx.27
    tagMega: 342,     // MEGA.ESPCEX.26

    // Como reconhecer as campanhas desta operação pelo nome (expressões regulares, sem diferenciar maiúscula).
    padroes: {
      escola: 'espcex',                  // campanhas da escola (Operação e Mega)
      operacao: 'espcex[.\\-\\s_]?27',   // só desta operação
      antiga: 'espcex[.\\-\\s_]?26',     // UTM de campanha da operação anterior
      mega: 'mega'
    },
    metaFiltro: 'ESPCEX',        // texto que o Meta usa pra filtrar campanhas pelo nome
    metaFiltroOperacao: 'ESPCEX.27', // só as campanhas desta operação (sem o Mega); serve pra somar o alcance sem contar a mesma pessoa duas vezes
    googleConta: '687-592-8792', // conta do Google Ads (o script de lá manda todas as campanhas)

    // Etapas do lançamento. Datas AAAA-MM-DD; null = ainda não definida.
    // Datas informadas pela Leili em 2026-09-19. As etapas se sobrepõem: a captação segue durante o lembrete.
    // Vendas: 29/09 a 11/10 (domingo); seriam 10 dias (até 09/10), mas o carrinho fecha no domingo.
    captacaoInicio: '2026-09-13',
    // orcamento = previsão de gasto da etapa (só anúncios: Meta + Google). maisImposto: o valor informado é SEM o imposto do Meta,
    // e o relatório soma os 13,85%. null = previsão ainda não informada.
    // Informado pela Leili em 2026-09-24, todos sem imposto (o relatório soma os 13,85%): captação R$ 7.093,78, lembrete R$ 886,72 e vendas R$ 886,72.
    etapas: [
      { id: 'captacao', nome: 'Captação', inicio: '2026-09-13', fim: '2026-09-28', orcamento: 7093.78, maisImposto: true },
      { id: 'lembrete', nome: 'Lembrete', inicio: '2026-09-22', fim: '2026-09-29', orcamento: 886.72, maisImposto: true },
      { id: 'vendas', nome: 'Vendas', inicio: '2026-09-29', fim: '2026-10-11', orcamento: 886.72, maisImposto: true } // carrinho abre em 29/09 (Hotmart)
    ],

    // Metas da captação. null = aparece como "meta não definida".
    //  orcamentoTotal: verba total de 15 mil, com imposto, INCLUINDO o Mega. O relatório desconta o gasto do Mega
    //                  e compara o resto com o investimento da operação.
    //  cplMax: 5,81 = orçamento da captação (79% dos R$ 10.293 que sobram, como no Barro Branco = R$ 8.131) ÷ 1.400 leads.
    //  quentePct: 65% (quente = PQ + orgânico), o que sustentou as vendas do Barro Branco na janela do carrinho.
    //  frequenciaQuenteMax: limite de frequência do público quente (quantas vezes, em média, cada pessoa viu o anúncio). Acima dele o número
    //                  fica vermelho na tabela do Meta. null = sem limite definido (só mostra o número). 10 = definido pela Leili em 2026-09-24.
    metas: { leads: 1400, cplMax: 5.81, quentePct: 65, orcamentoTotal: 15000, frequenciaQuenteMax: 10 },

    // Identidade visual desta operação. Cada operação tem a sua: o Barro Branco usaria
    // bg #090915, card #151928, line #262b40, accent #FAE60D, textWeak #8B8FA3.
    tema: { bg: '#080B07', card: '#0D140F', line: '#2B4E2B', accent: '#E8C52B', textWeak: '#8FA08C', text: '#F2F2F5' },

    // Usado no Mega enquanto o Meta não estiver conectado. Valor SEM imposto (o imposto entra na conta).
    megaGastoManual: { valor: 4134.59, em: '2026-09-18' },

    // Grupo de WhatsApp (DevZapp). Só conta grupo cujo nome contenha este texto (sem diferenciar maiúscula).
    // Vazio = conta todos os grupos monitorados nesta operação.
    grupoFiltro: '',

    // Quem já estava nos grupos ANTES da ligação do DevZapp (a captação começou em 2026-09-13). É só um número, sem telefone.
    // 213 membros (sem os 3 administradores) informados pela Leili em 2026-09-19, menos as 5 entradas que o relatório já
    // tinha contado pelo DevZapp naquele momento = 208. O total do grupo = base + entradas − saídas contadas pelo DevZapp.
    grupoBase: { quantidade: 208, em: '2026-09-19' },

    // Pesquisa de qualificação: a MESMA do formulário do Google "[Operação] EsPCEx 26/27" (copiada em 2026-09-18).
    // tipo: 'texto' | 'email' | 'paragrafo' | 'escolha'. Só as de 'escolha' viram tabela no relatório.
    // O formulário é PÚBLICO (sem senha) e mora num caminho do site do Teorema, longe do relatório:
    //   caminho: onde o Worker atende (no Cloudflare: Worker > Domínios e rotas > Rota `teoremamilitar.com.br/espcex-27/pesquisa`).
    //            O ano vai no caminho: em 2027 a operação nova (espcex-28) terá /espcex-28/pesquisa e a sua própria rota.
    //   enderecoPublico: o link que vai pros leads
    // Respostas completas: /api/espcex-27/pesquisa.csv (com senha, no endereço do relatório).
    pesquisa: {
      caminho: '/espcex-27/pesquisa',
      enderecoPublico: 'https://teoremamilitar.com.br/espcex-27/pesquisa',
      titulo: '[Operação] EsPCEx',
      intro: 'Caro aluno! Começamos a preparação para o concurso da EsPCEx e queremos reforçar nosso compromisso com a sua aprovação. Para tanto, queremos entender mais no detalhe quais são suas aspirações e dificuldades nessa jornada, para que possamos ajudar ainda mais com aquilo que temos de melhor - o Padrão TM! Obs.: Caso você seja a mãe ou o pai do aluno, responda com as informações do seu filho ou filha.',
      aviso: 'Suas respostas são usadas pela equipe do Teorema Militar para entender a sua preparação.',
      perguntas: [
        { id: 'nome', tipo: 'texto', rotulo: 'Primeiro Nome', obrigatoria: true },
        { id: 'email', tipo: 'email', rotulo: 'e-mail', obrigatoria: true },
        { id: 'genero', tipo: 'escolha', rotulo: 'Gênero', opcoes: ['Masculino', 'Feminino'], obrigatoria: true },
        { id: 'idade', tipo: 'escolha', rotulo: 'Idade', opcoes: ['até 16 anos', '16 a 18', '19 a 21', '21 a 24'], obrigatoria: true },
        { id: 'instituicao', tipo: 'escolha', rotulo: 'Em qual instituição de ensino você estudou?', opcoes: ['Escola Pública', 'Escola Privada', 'Colégio Militar'], outro: true, obrigatoria: true },
        { id: 'aluno', tipo: 'escolha', rotulo: 'Aluno ou seguidor?', opcoes: ['Aluno', 'Seguidor'], obrigatoria: true },
        { id: 'oficial', tipo: 'escolha', rotulo: 'Você deseja ser Oficial de Carreira do Exército? (não subestime o poder dessa pergunta)', opcoes: ['Sim', 'Não', 'Talvez'], obrigatoria: true },
        { id: 'vezes', tipo: 'escolha', rotulo: 'Quantas vezes você já fez a prova da EsPCEx?', opcoes: ['Nenhuma', '1', '2', '3', '4 ou mais'], obrigatoria: true },
        { id: 'nivel', tipo: 'escolha', rotulo: 'Qual seu nível de experiência com a prova da EsPCEx?', opcoes: [
          'Não sabia que tinha que fazer uma prova para ser Oficial de Carreira',
          'Não tenho nenhuma experiência, acabei de conhecer este universo',
          'Já estou estudando há algum tempo, mas sinto que não estou aprendendo direito',
          'Tenho feito várias provas, acho que sei o conteúdo, mas meu desempenho não é satisfatório',
          'Fui bem nas provas e não passei por um detalhe'
        ], obrigatoria: true },
        { id: 'cursinho', tipo: 'texto', rotulo: 'Faz ou já fez algum cursinho preparatório? Se sim, escreva abaixo qual(is)', obrigatoria: true },
        { id: 'motivo', tipo: 'paragrafo', rotulo: 'Qual o motivo pelo qual você quer passar na EsPCEx? (pode citar mais de um)', obrigatoria: true },
        { id: 'desafio', tipo: 'paragrafo', rotulo: 'Qual seu maior desafio nessa preparação?', obrigatoria: true },
        { id: 'dificuldade', tipo: 'paragrafo', rotulo: 'Qual a sua maior dificuldade nos estudos?', obrigatoria: true },
        { id: 'ajuda', tipo: 'paragrafo', rotulo: 'Como você acredita que nós podemos te ajudar a ser aprovado ano que vem?', obrigatoria: false }
      ]
    }
  }
};

// Relatórios de operações já encerradas, guardados como página pronta (sem leitura ao vivo). Entram na página inicial
// junto com as operações vivas. Pra acrescentar um: cole a página no fim do arquivo (como BARRO_BRANCO_2026) e
// crie uma linha aqui. O endereço é /<nome>.
const ARQUIVO = {
  'barro-branco-27': {
    escola: 'Barro Branco', edicao: 'Operação 2027', ano: 2027,
    titulo: 'Operação Barro Branco 27', cliente: GLOBAL.cliente,
    atualizadoEm: '2026-09-21',
    tema: { bg: '#090915', card: '#151928', line: '#262b40', accent: '#FAE60D', textWeak: '#8B8FA3', text: '#F2F2F5' },
    // Pesquisa dos alunos que compraram sem passar pelo cadastro do evento (criada em 2026-09-24). Mesmo formulário da EsPCEx
    // (ver `pesquisa` em OPERACOES), com a identidade do Barro Branco (o `tema` acima). Respostas no D1 com op = 'barro-branco-27';
    // planilha em /api/barro-branco-27/pesquisa.csv (com senha). Rota no Cloudflare: `teoremamilitar.com.br/barro-branco-27/pesquisa-aluno`.
    // `secao` (opcional): título que aparece acima da pergunta.
    pesquisa: {
      caminho: '/barro-branco-27/pesquisa-aluno',
      enderecoPublico: 'https://teoremamilitar.com.br/barro-branco-27/pesquisa-aluno',
      titulo: 'Pesquisa Aluno',
      intro: 'Olá, aluno! Seja bem-vindo ao Full do Barro Branco. Queremos conhecer a sua preparação e entender como você chegou até a gente. Leva 1 minuto.',
      aviso: 'Suas respostas são usadas pela equipe do Teorema Militar para entender a sua preparação e como os alunos chegam até a gente.',
      perguntas: [
        { id: 'nome', tipo: 'texto', rotulo: 'Primeiro Nome', obrigatoria: true },
        { id: 'email', tipo: 'email', rotulo: 'e-mail', obrigatoria: true },
        { id: 'desafio', tipo: 'paragrafo', rotulo: 'Qual seu maior desafio nessa preparação?', obrigatoria: true },
        { id: 'origem', secao: 'Como você chegou até a gente', tipo: 'escolha', rotulo: 'Onde você conheceu o Teorema Militar pela primeira vez?', opcoes: [
          'Instagram (perfil, stories ou reels)', 'Anúncio (Instagram ou Facebook)', 'YouTube', 'Google', 'Indicação de amigo ou aluno', 'Grupo de WhatsApp', 'Já era aluno'
        ], outro: true, obrigatoria: true },
        { id: 'aulas', tipo: 'escolha', rotulo: 'Você assistiu às aulas ao vivo gratuitas do Barro Branco antes de comprar?', opcoes: ['Sim, me cadastrei e assisti', 'Sim, assisti sem me cadastrar', 'Não assisti'], obrigatoria: true },
        { id: 'link', tipo: 'escolha', rotulo: 'De onde veio o link que você usou para comprar?', opcoes: [
          'Grupo de WhatsApp', 'Descrição ou comentário fixado no YouTube', 'Instagram (bio, stories ou direct)', 'E-mail', 'Busquei no Google ou entrei direto no site', 'Me mandaram no atendimento (suporte ou comercial)'
        ], outro: true, obrigatoria: true }
      ]
    },
    pagina: () => BARRO_BRANCO_2026
  }
};

// Tema da página inicial e da tela de entrada quando o endereço não é de uma operação específica.
const HUB = {
  cliente: GLOBAL.cliente, titulo: 'Relatórios',
  // Verde e amarelo do Teorema Militar (a mesma base da EsPCEx). Cada operação segue com a cor dela dentro do relatório.
  tema: { bg: '#080B07', card: '#0D140F', line: '#2B4E2B', accent: '#E8C52B', textWeak: '#8FA08C', text: '#F2F2F5' }
};

// Junta o que é global com o que é da operação. Devolve null se a operação não existe.
function contexto(slug) {
  if (!Object.prototype.hasOwnProperty.call(OPERACOES, slug)) return null;
  const op = OPERACOES[slug];
  const p = op.padroes;
  const re = {};
  for (const k of Object.keys(p)) re[k] = new RegExp(p[k], 'i');
  return { ...GLOBAL, ...op, slug, re };
}

// Contexto só pra pesquisa: vale pras operações vivas (OPERACOES) e pras encerradas que têm `pesquisa` (ARQUIVO).
function contextoPesquisa(slug) {
  if (Object.prototype.hasOwnProperty.call(OPERACOES, slug)) return contexto(slug);
  if (Object.prototype.hasOwnProperty.call(ARQUIVO, slug) && ARQUIVO[slug].pesquisa) return { ...GLOBAL, ...ARQUIVO[slug], slug };
  return null;
}

// ---------------------------------------------------------------- classificação

function cap(s) {
  s = String(s || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function publicoDoNome(nome) {
  const m = String(nome || '').match(/(?:^|[^a-z0-9])(pq|pf)(?:[^a-z0-9]|$)/i);
  return m ? m[1].toLowerCase() : null;
}

function publicoDoMedium(medium) {
  const m = String(medium || '');
  if (/envolvimento|remarketing|engaj|visitante/i.test(m)) return 'pq';
  if (/interesse|advantage|lookalike|semelhante|\(\d+\s?%\)/i.test(m)) return 'pf';
  return null;
}

function etapaDoNome(nome) {
  if (/capta[cç]|leads/i.test(nome)) return 'captacao';
  if (/aquec|lembrete/i.test(nome)) return 'lembrete';
  if (/carrinho|venda/i.test(nome)) return 'vendas';
  return 'outra';
}

function operacaoDoNome(nome, cfg) {
  nome = String(nome || '');
  if (cfg.re.mega.test(nome) && cfg.re.escola.test(nome)) return 'mega';
  if (cfg.re.operacao.test(nome)) return 'operacao';
  return null;
}

function classificar(r, cfg) {
  const src = String(r.source || '').trim().toLowerCase();
  let canal;
  if (src === 'meta.ads') canal = 'meta';
  else if (src === 'yt_ads') canal = 'youtube_ads';
  else if (/utm_source=ig|^ig$|instagram/.test(src)) canal = 'instagram';
  else if (/utm_source=youtube|^youtube$/.test(src)) canal = 'youtube';
  else if (src === 'direct' || src === '(direct)') canal = 'direto';
  else if (!src) canal = 'sem_origem';
  else canal = 'outro';

  const pago = canal === 'meta' || canal === 'youtube_ads';
  let publico;
  if (pago) publico = publicoDoNome(r.campaign) || 'nc';
  else if (canal === 'sem_origem' || canal === 'outro') publico = 'nc';
  else publico = 'organico';

  // Lead com UTM de campanha da operação anterior conta pela origem que tem, sem penalizar.
  // Só é contado em `antigas` pra dar transparência; não muda a classificação.
  const antiga = cfg.re.antiga.test(String(r.campaign || '')) || cfg.re.antiga.test(String(r.medium || ''));
  // Anúncio cuja campanha não traz PQ/PF no nome: tenta pelo nome do público (utm_medium).
  if (pago && publico === 'nc') publico = publicoDoMedium(r.medium) || 'nc';

  // Nos anúncios pagos, o detalhe é o NOME DO PÚBLICO: no Meta vem no utm_medium (conjunto de anúncios),
  // no YouTube Ads vem no utm_term. No orgânico, o detalhe é o utm_term (stories, bio, e-mail...).
  const term = String(r.term || '').trim().toLowerCase();
  const sufixo = publico === 'pq' ? ' · quente' : publico === 'pf' ? ' · frio' : '';
  let detalhe;
  if (canal === 'meta') {
    detalhe = (String(r.medium || '').trim() || 'Público não identificado') + sufixo;
  } else if (canal === 'youtube_ads') {
    detalhe = (term ? cap(term.replace(/[_\-]+/g, ' ')) : 'Público não identificado') + sufixo;
  } else {
    detalhe = term ? cap(term.replace(/[_\-]+/g, ' ')) : 'Sem detalhe';
  }

  let motivoNc = null;
  if (publico === 'nc') {
    motivoNc = canal === 'sem_origem' ? 'Sem UTM'
      : canal === 'outro' ? 'Origem fora do padrão'
      : 'Anúncio sem PQ/PF no nome da campanha nem no público';
  }

  let criativo = null;
  if (pago) {
    const m = String(r.content || '').match(/cap[_\-\s]?ad([ve])[_\-\s]?0*(\d+)/i);
    if (m) {
      criativo = { chave: 'Cap_Ad' + m[1].toUpperCase() + '_' + String(m[2]).padStart(3, '0'), nome: /^cap_/i.test(String(r.content)) ? String(r.content).trim() : null };
    }
  }
  return { canal, pago, publico, antiga, detalhe, criativo, motivoNc };
}

const CANAL_ROTULO = {
  meta: 'Meta Ads (anúncio pago)',
  youtube_ads: 'YouTube Ads (anúncio pago)',
  instagram: 'Instagram orgânico',
  youtube: 'YouTube orgânico',
  direto: 'Direto (digitou o link)',
  sem_origem: 'Sem origem identificada',
  outro: 'Outros'
};

function dia(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function hojeBRT() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

function somarDias(d, n) {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- período do relatório (filtro de datas)

// ?de=AAAA-MM-DD&ate=AAAA-MM-DD. Sem nada, vale a captação inteira (do início até hoje). Datas fora do intervalo ou trocadas
// são corrigidas em vez de dar erro. `completo` = período é o total acumulado (só nele valem as metas e a base do grupo).
function periodoDe(url, cfg, hoje) {
  const valida = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v + 'T00:00:00Z')) ? v : null);
  let de = valida(url.searchParams.get('de')) || cfg.captacaoInicio;
  let ate = valida(url.searchParams.get('ate')) || hoje;
  if (de < cfg.captacaoInicio) de = cfg.captacaoInicio;
  if (ate > hoje) ate = hoje;
  if (de > ate) de = ate;
  return { de, ate, completo: de === cfg.captacaoInicio && ate === hoje };
}

// Os bancos guardam a hora em UTC; o dia do relatório é o de Brasília (UTC-3).
const limitesUTC = per => ({ ini: per.de + 'T03:00:00.000Z', fim: somarDias(per.ate, 1) + 'T03:00:00.000Z' });

// ---------------------------------------------------------------- agregação dos leads

function agregarLeads(rows, inicio, fim, cfg) {
  const porDia = {};
  const publico = { pq: 0, pf: 0, organico: 0, nc: 0 };
  const canais = {};
  const criativos = {};
  const ncMotivos = {};
  let total = 0, semData = 0, antigas = 0;

  for (const r of rows) {
    const d = dia(r.engaj);
    if (!d) { semData++; continue; }
    if (d < inicio || d > fim) continue;
    const c = classificar(r, cfg);
    total++;
    if (c.antiga) antigas++;
    publico[c.publico]++;
    if (c.motivoNc) ncMotivos[c.motivoNc] = (ncMotivos[c.motivoNc] || 0) + 1;

    const pd =porDia[d] || (porDia[d] = { dia: d, n: 0, pq: 0, pf: 0, organico: 0, nc: 0 });
    pd.n++; pd[c.publico]++;

    const cn = canais[c.canal] || (canais[c.canal] = { canal: c.canal, rotulo: CANAL_ROTULO[c.canal], pago: c.pago, n: 0, detalhe: {} });
    cn.n++;
    cn.detalhe[c.detalhe] = (cn.detalhe[c.detalhe] || 0) + 1;

    if (c.criativo) {
      const k = c.criativo.chave;
      const cr = criativos[k] || (criativos[k] = { chave: k, nome: null, n: 0, meta: 0, youtube_ads: 0 });
      cr.n++; cr[c.canal]++;
      if (c.criativo.nome && !cr.nome) cr.nome = c.criativo.nome;
    }
  }

  const serie = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    serie.push(porDia[d] || { dia: d, n: 0, pq: 0, pf: 0, organico: 0, nc: 0 });
  }

  return {
    total, semData, antigas, publico, serie,
    ncDetalhe: Object.entries(ncMotivos).map(([rotulo, n]) => ({ rotulo, n })).sort((a, b) => b.n - a.n),
    canais: Object.values(canais)
      .map(c => ({ canal: c.canal, rotulo: c.rotulo, pago: c.pago, n: c.n, detalhe: Object.entries(c.detalhe).map(([rotulo, n]) => ({ rotulo, n })).sort((a, b) => b.n - a.n) }))
      .sort((a, b) => b.n - a.n),
    criativos: Object.values(criativos).map(c => ({ chave: c.chave, rotulo: c.nome || c.chave, n: c.n, meta: c.meta, youtube_ads: c.youtube_ads })).sort((a, b) => b.n - a.n)
  };
}

// ---------------------------------------------------------------- custos (Meta e Google)

// Todo gasto do Meta sai já com o imposto (GLOBAL.impostoMeta) somado.
function agregarMeta(linhas, cfg) {
  const f = 1 + cfg.impostoMeta;
  const op = [];
  const z = () => ({ impressoes: 0, linkCliques: 0, paginas: 0, leads: 0 });
  const funil = { total: z(), pq: z(), pf: z(), nc: z() }; // só a etapa de captação
  let mega = 0, opSemImposto = 0;
  for (const l of linhas) {
    const tipo = operacaoDoNome(l.nome, cfg);
    if (tipo === 'mega') { mega += l.gasto; continue; }
    if (tipo !== 'operacao') continue;
    opSemImposto += l.gasto;
    const etapa = etapaDoNome(l.nome), publico = publicoDoNome(l.nome) || 'nc';
    op.push({ nome: l.nome, etapa, publico, gasto: l.gasto * f, cliques: l.cliques, impressoes: l.impressoes, linkCliques: l.linkCliques || 0, paginas: l.paginas || 0, leads: l.leads, alcance: l.alcance || 0, frequencia: l.frequencia || 0 });
    if (etapa === 'captacao') {
      for (const k of ['total', publico]) {
        funil[k].impressoes += l.impressoes; funil[k].linkCliques += l.linkCliques || 0; funil[k].paginas += l.paginas || 0; funil[k].leads += l.leads;
      }
    }
  }
  op.sort((a, b) => b.gasto - a.gasto);
  return { campanhas: op, funil, gastoOperacao: opSemImposto * f, gastoOperacaoSemImposto: opSemImposto, gastoMega: mega * f };
}

function agregarGoogle(google, cfg, de, ate) {
  if (!google || !Array.isArray(google.rows)) return null;
  const por = {};
  let mega = 0;
  for (const r of google.rows) {
    if (de && (r.date < de || r.date > ate)) continue; // filtro de datas (sem `de`: acumulado)
    const tipo = operacaoDoNome(r.campaign, cfg);
    if (tipo === 'mega') { mega += r.cost; continue; }
    if (tipo !== 'operacao') continue;
    const k = r.campaignId;
    const c = por[k] || (por[k] = { nome: r.campaign, etapa: etapaDoNome(r.campaign), publico: publicoDoNome(r.campaign) || 'nc', status: r.status, canal: r.channel, gasto: 0, cliques: 0, impressoes: 0, conversoes: 0 });
    c.gasto += r.cost; c.cliques += r.clicks; c.impressoes += r.impressions; c.conversoes += r.conversions;
  }
  // Frequência: o Google só informa pras campanhas de vídeo, por um intervalo fechado (não por dia), então não acompanha o filtro de datas.
  const freq = {};
  (Array.isArray(google.freq) ? google.freq : []).forEach(x => { freq[String(x.campaignId)] = x; });
  for (const k of Object.keys(por)) { const x = freq[k]; if (x && x.frequency > 0) { por[k].frequencia = x.frequency; por[k].usuarios = x.users || 0; } }
  const campanhas = Object.values(por).sort((a, b) => b.gasto - a.gasto);
  return { enviadoEm: google.sentAt, campanhas, gastoOperacao: campanhas.reduce((s, c) => s + c.gasto, 0), gastoMega: mega, freq: campanhas.some(c => c.frequencia) ? { de: google.freqDe || null, ate: google.freqAte || null } : null };
}

// ---------------------------------------------------------------- fontes externas

async function acGet(env, path) {
  const res = await fetch(String(env.AC_API_URL).replace(/\/+$/, '') + path, { headers: { 'Api-Token': env.AC_API_KEY } });
  if (!res.ok) throw new Error('ActiveCampaign respondeu HTTP ' + res.status);
  return res.json();
}

async function lerLeads(env, tagId, cfg) {
  const F = cfg.campoUtm;
  const rows = [];
  for (let p = 0; p < cfg.maxPaginas; p++) {
    const j = await acGet(env, '/api/3/contacts?tagid=' + tagId + '&limit=100&offset=' + (p * 100) + '&include=fieldValues');
    const porContato = {};
    for (const fv of j.fieldValues || []) (porContato[fv.contact] || (porContato[fv.contact] = {}))[fv.field] = fv.value;
    const contatos = j.contacts || [];
    for (const c of contatos) {
      const v = porContato[c.id] || {};
      rows.push({ source: v[F.source], content: v[F.content], medium: v[F.medium], campaign: v[F.campaign], term: v[F.term], engaj: v[cfg.campoEngajamento], phone: c.phone, email: c.email });
    }
    if (contatos.length < 100) return { rows, truncado: false };
  }
  return { rows, truncado: true };
}

async function lerTotalTag(env, tagId) {
  const j = await acGet(env, '/api/3/contacts?tagid=' + tagId + '&limit=1');
  return parseInt(j && j.meta && j.meta.total, 10) || 0;
}

async function lerMeta(env, desde, ate, cfg) {
  if (!env.META_ACCESS_TOKEN) return { ok: false, motivo: 'aguardando conexão (falta o token do Meta)' };
  try {
    const q = new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,campaign_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,actions',
      time_range: JSON.stringify({ since: desde, until: ate }),
      filtering: JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: cfg.metaFiltro }]),
      limit: '500',
      access_token: env.META_ACCESS_TOKEN
    });
    const res = await fetch('https://graph.facebook.com/' + cfg.meta.versao + '/act_' + cfg.meta.contaId + '/insights?' + q.toString());
    const j = await res.json();
    if (!res.ok || j.error) return { ok: false, motivo: 'o Meta recusou a leitura' + (j.error && j.error.code ? ' (código ' + j.error.code + ')' : '') };
    const linhas = (j.data || []).map(d => {
      const acao = (d.actions || []).find(a => a.action_type === 'offsite_conversion.fb_pixel_lead') || (d.actions || []).find(a => a.action_type === 'lead');
      const pag = (d.actions || []).find(a => a.action_type === 'landing_page_view') || (d.actions || []).find(a => a.action_type === 'omni_landing_page_view');
      return {
        nome: d.campaign_name, gasto: parseFloat(d.spend) || 0,
        impressoes: parseInt(d.impressions, 10) || 0, cliques: parseInt(d.clicks, 10) || 0,
        alcance: parseInt(d.reach, 10) || 0, frequencia: parseFloat(d.frequency) || 0,
        linkCliques: parseInt(d.inline_link_clicks, 10) || 0,
        paginas: pag ? parseInt(pag.value, 10) || 0 : 0,
        leads: acao ? parseInt(acao.value, 10) || 0 : 0
      };
    });
    const publicos = await lerAlcancePublicos(env, desde, ate, cfg);
    return { ok: true, ...agregarMeta(linhas, cfg), publicos };
  } catch (e) {
    return { ok: false, motivo: 'não consegui falar com o Meta agora' };
  }
}

// Alcance e frequência de um GRUPO de campanhas, contando cada pessoa uma vez só (a soma das campanhas repetiria quem viu mais de uma).
// Pede ao Meta no nível da conta, filtrando pelo nome das campanhas: operação toda, só as PQ (público quente) e só as PF (público frio).
// Se o Meta recusar, devolve null e o relatório segue só com o alcance de cada campanha.
async function lerAlcancePublicos(env, desde, ate, cfg) {
  const base = cfg.metaFiltroOperacao || cfg.metaFiltro;
  const ler = async extra => {
    const filtros = [{ field: 'campaign.name', operator: 'CONTAIN', value: base }].concat(extra ? [{ field: 'campaign.name', operator: 'CONTAIN', value: extra }] : []);
    const q = new URLSearchParams({
      level: 'account', fields: 'impressions,reach,frequency', time_range: JSON.stringify({ since: desde, until: ate }),
      filtering: JSON.stringify(filtros), access_token: env.META_ACCESS_TOKEN
    });
    const res = await fetch('https://graph.facebook.com/' + cfg.meta.versao + '/act_' + cfg.meta.contaId + '/insights?' + q.toString());
    const j = await res.json();
    if (!res.ok || j.error || !j.data || !j.data[0]) return null;
    const d = j.data[0];
    return { impressoes: parseInt(d.impressions, 10) || 0, alcance: parseInt(d.reach, 10) || 0, frequencia: parseFloat(d.frequency) || 0 };
  };
  try {
    const [total, pq, pf] = await Promise.all([ler(null), ler('PQ'), ler('PF')]);
    return total || pq || pf ? { total, pq, pf } : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- grupo de WhatsApp (DevZapp)
// O DevZapp avisa cada entrada/saída de grupo por webhook. Guardamos só um código (hash) do telefone,
// nunca o número. O casamento com os leads é feito pelo telefone do cadastro do ActiveCampaign.

// Uma linha por (operação, pessoa). `op` é o nome do bloco em OPERACOES.
const SQL_CRIAR = 'CREATE TABLE IF NOT EXISTS entradas (op TEXT, h TEXT, grupo TEXT, entrou_em TEXT, saiu_em TEXT, PRIMARY KEY (op, h))';
const SQL_ENTRADA = 'INSERT INTO entradas (op, h, grupo, entrou_em, saiu_em) VALUES (?1, ?2, ?3, ?4, NULL) ON CONFLICT(op, h) DO UPDATE SET saiu_em = NULL, grupo = excluded.grupo, entrou_em = COALESCE(entradas.entrou_em, excluded.entrou_em)';
const SQL_SAIDA = 'UPDATE entradas SET saiu_em = ?3 WHERE op = ?1 AND h = ?2';
const SQL_LER = 'SELECT h, entrou_em, saiu_em FROM entradas WHERE op = ?1 AND entrou_em >= ?2 AND entrou_em < ?3';

// DDD + últimos 8 dígitos: serve com ou sem o 9 na frente e com ou sem o 55.
function chaveTelefone(bruto) {
  let d = String(bruto || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

async function hashTelefone(env, bruto) {
  const k = chaveTelefone(bruto);
  if (!k) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k + '|' + (env.PHONE_SALT || 'relatorio')));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function achatar(obj, prefixo, out) {
  if (obj && typeof obj === 'object') { for (const k of Object.keys(obj)) achatar(obj[k], prefixo ? prefixo + '.' + k : k, out); }
  else out.push([String(prefixo).toLowerCase(), obj]);
  return out;
}

const soDigitos = v => String(v == null ? '' : v).replace(/\D/g, '');
const ehTelefone = v => { const d = soDigitos(v); return d.length >= 10 && d.length <= 15; };

// Formato real do DevZapp (igual ao da Z-API), visto em 2026-09-18:
//   notification: "GROUP_PARTICIPANT_INVITE" (entrou pelo link) | "..._ADD" | "..._LEAVE" | "..._REMOVE" | outras
//   notificationParameters: [telefone de quem entrou/saiu]   participantPhone: idem   chatName: nome do grupo
//   connectedPhone = o número do PRÓPRIO DevZapp: nunca é o do lead.
// Se o aviso vier em outro formato, cai numa leitura genérica pelos nomes de campo mais comuns.
function lerEventoGrupo(corpo) {
  const pares = achatar(corpo, '', []);
  const valorDe = re => { const p = pares.find(([k]) => re.test(k)); return p ? String(p[1] == null ? '' : p[1]) : ''; };
  const notificacao = valorDe(/^notification$/);

  if (notificacao) {
    let tipo = null;
    if (/remov|leave|left|exit|sa[ií]/i.test(notificacao)) tipo = 'saida';
    else if (/add|invite|join|entr/i.test(notificacao)) tipo = 'entrada';
    let telefones = pares.filter(([k, v]) => /^notificationparameters\.\d+$/.test(k) && ehTelefone(v)).map(([, v]) => soDigitos(v));
    if (!telefones.length) telefones = pares.filter(([k, v]) => /^(participantphone|participant|telefone)$/.test(k) && ehTelefone(v)).map(([, v]) => soDigitos(v)).slice(0, 1);
    return { telefones: [...new Set(telefones)], tipo, ignorar: !tipo, grupo: valorDe(/^chatname$/) || valorDe(/^group(name|subject)$/), notificacao };
  }

  let tipo = null, grupo = '';
  const telefones = [];
  for (const [k, v] of pares) {
    const s = String(v == null ? '' : v);
    if (!telefones.length && /phone|telefone|numero|number|whats|celular|participant|jid|contato|contact|lead/.test(k) && !/connected|instance|owner|business|bot/.test(k) && ehTelefone(s)) telefones.push(soDigitos(s));
    if (!tipo && /event|evento|type|tipo|action|acao|status/.test(k)) {
      if (/remov|leave|left|exit|sa[ií]|out|delete/i.test(s)) tipo = 'saida';
      else if (/add|join|entr|enter|insert/i.test(s)) tipo = 'entrada';
    }
    if (!grupo && /group|grupo|chat/.test(k) && /name|nome|title|subject|titulo/.test(k) && s && !/^\d+$/.test(s)) grupo = s;
  }
  return { telefones, tipo: tipo || 'entrada', ignorar: false, grupo }; // a monitoração é de "entrada de grupos": sem tipo, assume entrada
}

// Amostras guardadas pra diagnóstico: números de telefone, códigos longos e campos de senha/token saem mascarados.
function mascarar(texto) {
  return String(texto)
    .replace(/"(token|apikey|api_key|secret|senha|password|authorization)"\s*:\s*"[^"]*"/gi, '"$1":"***"')
    .replace(/[A-Fa-f0-9]{20,}/g, m => m.slice(0, 4) + '***')
    .replace(/\d{7,}/g, m => m.slice(0, 2) + '*'.repeat(m.length - 4) + m.slice(-2))
    .slice(0, 1500);
}

async function receberWhatsapp(request, env, url) {
  const chave = url.searchParams.get('k') || request.headers.get('X-Report-Key');
  if (!env.WHATSAPP_KEY || !iguais(chave, env.WHATSAPP_KEY)) return json({ erro: 'não autorizado' }, 401);
  const cfg = contexto(String(url.searchParams.get('op') || ''));
  if (!cfg) return json({ erro: 'operação desconhecida: faltou ?op=nome-da-operacao no endereço' }, 400);
  if (!env.DB) return json({ erro: 'banco (DB) não está ligado ao Worker' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 64 * 1024) return json({ erro: 'corpo grande demais' }, 413);
  const texto = await request.text();
  let corpo;
  try { corpo = JSON.parse(texto); } catch (e) { corpo = Object.fromEntries(new URLSearchParams(texto)); }

  // Guarda as primeiras amostras (com os números mascarados) pra conferir o formato do DevZapp.
  if (env.REPORT_KV) {
    try {
      const amostras = JSON.parse((await env.REPORT_KV.get('whatsapp-amostras:' + cfg.slug)) || '[]');
      if (amostras.length < 5) { amostras.push(mascarar(texto)); await env.REPORT_KV.put('whatsapp-amostras:' + cfg.slug, JSON.stringify(amostras)); }
    } catch (e) { /* amostra é só diagnóstico */ }
  }

  const ev = lerEventoGrupo(corpo);
  if (cfg.grupoFiltro && ev.grupo && !ev.grupo.toLowerCase().includes(cfg.grupoFiltro.toLowerCase())) return json({ ok: true, ignorado: 'outro grupo' });
  if (ev.ignorar) return json({ ok: true, ignorado: ev.notificacao }); // aviso que não é entrada nem saída de pessoa
  const codigos = [];
  for (const tel of ev.telefones) { const h = await hashTelefone(env, tel); if (h) codigos.push(h); }
  if (!codigos.length) return json({ ok: false, motivo: 'telefone não encontrado no aviso' }); // 200 de propósito: evita repetição em cascata
  await env.DB.prepare(SQL_CRIAR).run();
  const agora = new Date().toISOString();
  for (const h of codigos) {
    if (ev.tipo === 'saida') await env.DB.prepare(SQL_SAIDA).bind(cfg.slug, h, agora).run();
    else await env.DB.prepare(SQL_ENTRADA).bind(cfg.slug, h, ev.grupo.slice(0, 200), agora).run();
  }
  limparCache();
  return json({ ok: true, tipo: ev.tipo, pessoas: codigos.length });
}

async function lerGrupo(env, leadsRows, cfg, per) {
  if (!env.DB) return null;
  try {
    const lim = limitesUTC(per);
    await env.DB.prepare(SQL_CRIAR).run();
    const r = await env.DB.prepare(SQL_LER).bind(cfg.slug, lim.ini, lim.fim).all();
    const linhas = r.results || [];
    const hashLeads = new Set();
    for (const l of leadsRows) {
      const d = dia(l.engaj);
      if (!d || d < per.de || d > per.ate) continue;
      const h = await hashTelefone(env, l.phone);
      if (h) hashLeads.add(h);
    }
    const entraram = linhas.length, sairam = linhas.filter(l => l.saiu_em).length;
    // A base (quem já estava antes da ligação do DevZapp) só entra no total acumulado, não em recortes de datas.
    const base = per.completo && cfg.grupoBase ? cfg.grupoBase.quantidade : 0;
    return {
      desde: per.de,
      ate: per.ate,
      entraram,
      leadsQueEntraram: linhas.filter(l => hashLeads.has(l.h)).length,
      sairam,
      base,
      baseEm: base ? cfg.grupoBase.em : null,
      pessoasNoGrupo: per.completo ? base + entraram - sairam : null
    };
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- pesquisa de qualificação (formulário próprio)
// As respostas ficam no banco D1 (tabela `pesquisa`), uma linha por pessoa (e-mail) e operação.
// O relatório só recebe totais; o texto das respostas só sai pelo arquivo .csv, com senha.

const SQL_PESQ_CRIAR = 'CREATE TABLE IF NOT EXISTS pesquisa (op TEXT, h TEXT, criado_em TEXT, ip_h TEXT, dados TEXT, PRIMARY KEY (op, h))';
const SQL_PESQ_SALVAR = 'INSERT INTO pesquisa (op, h, criado_em, ip_h, dados) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(op, h) DO UPDATE SET criado_em = excluded.criado_em, ip_h = excluded.ip_h, dados = excluded.dados';
const SQL_PESQ_RITMO = 'SELECT COUNT(*) AS n FROM pesquisa WHERE op = ?1 AND ip_h = ?2 AND criado_em >= ?3';
const SQL_PESQ_LER = 'SELECT h, criado_em, dados FROM pesquisa WHERE op = ?1 AND criado_em >= ?2 AND criado_em < ?3';
const SQL_PESQ_TUDO = 'SELECT criado_em, dados FROM pesquisa WHERE op = ?1 ORDER BY criado_em';

// ---------------------------------------------------------------- trilha do lead (histórico de origens)
// O script do site avisa (POST /api/visita) a cada origem nova de um visitante; cada aviso vira uma linha na tabela
// `visitas` (D1). Quando o visitante se identifica (e-mail no cookie do site), o Worker liga o visitante ao hash do
// e-mail e grava no ActiveCampaign: a primeira origem (só se o campo estiver vazio) e a trilha (recalculada do histórico).
// Guarda só o hash do e-mail e do IP. O e-mail em si só passa pela memória, pra achar o contato no ActiveCampaign.
// Campos do ActiveCampaign, achados pelo título (crie com estes nomes exatos): TRILHA_CAMPOS.
// Rota no Cloudflare: Worker > Domínios e rotas > Rota `teoremamilitar.com.br/api/visita` (exata, sem asterisco).

const SQL_VIS_CRIAR = 'CREATE TABLE IF NOT EXISTS visitas (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT NOT NULL, criado_em TEXT NOT NULL, fonte TEXT, meio TEXT, campanha TEXT, term TEXT, content TEXT, utm_id TEXT, pagina TEXT, ref TEXT, ip_h TEXT)';
const SQL_VIS_INDICE = 'CREATE INDEX IF NOT EXISTS visitas_v ON visitas (v, criado_em)';
const SQL_VIS_LIGA_CRIAR = 'CREATE TABLE IF NOT EXISTS visitantes (v TEXT PRIMARY KEY, h TEXT, ligado_em TEXT, ac_id TEXT, ac_em TEXT, email_pend TEXT)';
// email_pend: o e-mail fica guardado só até a gravação no ActiveCampaign dar certo (no máximo 24 h); depois é apagado.

const TRILHA_CAMPOS = { fonte: 'TM 1a origem - fonte', meio: 'TM 1a origem - meio', campanha: 'TM 1a origem - campanha', term: 'TM 1a origem - term', content: 'TM 1a origem - conteudo', data: 'TM 1a origem - data', trilha: 'TM trilha' };
const TRILHA_MAX = 10;        // últimos toques que vão no campo de texto
const VIS_MESMA_ORIGEM_MIN = 30; // mesma origem em menos de 30 min é a mesma visita
const VIS_LIMITE_HORA = 200;  // avisos por local (hash do IP) por hora

const limpaTxt = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

async function criarTabelasVisitas(env) {
  await env.DB.prepare(SQL_VIS_CRIAR).run();
  await env.DB.prepare(SQL_VIS_INDICE).run();
  await env.DB.prepare(SQL_VIS_LIGA_CRIAR).run();
  try { await env.DB.prepare('ALTER TABLE visitantes ADD COLUMN email_pend TEXT').run(); } catch (e) { /* a coluna já existe */ }
}

// Quem se identificou mas ainda não foi gravado no ActiveCampaign (o contato pode demorar a existir): tenta de novo
// a cada tanto, aproveitando os avisos que chegam do site. Depois de 24 h desiste e apaga o e-mail guardado.
async function varrerPendentes(env) {
  if (!env.AC_API_URL || !env.AC_API_KEY || Math.random() > 0.25) return;
  try {
    await env.DB.prepare('UPDATE visitantes SET email_pend = NULL WHERE email_pend IS NOT NULL AND ligado_em < ?1').bind(new Date(Date.now() - 24 * 3600 * 1000).toISOString()).run();
    const r = await env.DB.prepare('SELECT v, email_pend FROM visitantes WHERE email_pend IS NOT NULL LIMIT 2').all();
    for (const x of r.results || []) {
      try { if (await gravarTrilhaAC(env, x.v, x.email_pend)) await env.DB.prepare('UPDATE visitantes SET email_pend = NULL WHERE v = ?1').bind(x.v).run(); } catch (e) { /* tenta na próxima */ }
    }
  } catch (e) { /* segue */ }
}

async function receberVisita(request, env, ctx) {
  if (!env.DB) return json({ ok: false }, 503);
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return json({ ok: false }, 413);
  const origem = request.headers.get('Origin') || '';
  if (origem) { let h = ''; try { h = new URL(origem).hostname; } catch (e) { /* sem host */ } if (!/(^|\.)teoremamilitar\.com\.br$/.test(h)) return json({ ok: false }, 403); }
  let c;
  try { c = JSON.parse(await request.text()); } catch (e) { return json({ ok: false }, 400); }
  const v = limpaTxt(c && c.v, 80);
  if (!/^[A-Za-z0-9._-]{8,80}$/.test(v)) return json({ ok: false }, 400);

  await criarTabelasVisitas(env);
  const agora = new Date().toISOString();
  const ipH = await sha256Hex(String(request.headers.get('CF-Connecting-IP') || 'sem-ip') + '|' + (env.PHONE_SALT || 'relatorio'));
  const ritmo = await env.DB.prepare('SELECT COUNT(*) AS n FROM visitas WHERE ip_h = ?1 AND criado_em >= ?2').bind(ipH, new Date(Date.now() - 3600 * 1000).toISOString()).first();
  if (ritmo && Number(ritmo.n) >= VIS_LIMITE_HORA) return json({ ok: false }, 429);

  const t = c.t && typeof c.t === 'object' ? c.t : null;
  if (t && limpaTxt(t.fonte, 120)) {
    const k = { fonte: limpaTxt(t.fonte, 120), meio: limpaTxt(t.meio, 200), campanha: limpaTxt(t.campanha, 200), term: limpaTxt(t.term, 200), content: limpaTxt(t.content, 200), utm_id: limpaTxt(t.utm_id, 200), pagina: limpaTxt(t.pagina, 200), ref: limpaTxt(t.ref, 100) };
    const ultimo = await env.DB.prepare('SELECT fonte, meio, campanha, term, content, criado_em FROM visitas WHERE v = ?1 ORDER BY id DESC LIMIT 1').bind(v).first();
    const repetido = ultimo && ultimo.fonte === k.fonte && (ultimo.meio || '') === k.meio && (ultimo.campanha || '') === k.campanha && (ultimo.term || '') === k.term && (ultimo.content || '') === k.content && (Date.now() - Date.parse(ultimo.criado_em)) < VIS_MESMA_ORIGEM_MIN * 60000;
    if (!repetido) {
      await env.DB.prepare('INSERT INTO visitas (v, criado_em, fonte, meio, campanha, term, content, utm_id, pagina, ref, ip_h) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)').bind(v, agora, k.fonte, k.meio, k.campanha, k.term, k.content, k.utm_id, k.pagina, k.ref, ipH).run();
    }
  }

  const email = limpaTxt(c.e, 200).toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    const h = await hashEmail(env, email);
    await env.DB.prepare('INSERT INTO visitantes (v, h, ligado_em, email_pend) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(v) DO UPDATE SET h = excluded.h, email_pend = excluded.email_pend').bind(v, h, agora, email).run();
    if (env.AC_API_URL && env.AC_API_KEY) ctx.waitUntil(atualizarTrilhaAC(env, v, email));
  }
  ctx.waitUntil(varrerPendentes(env));
  return json({ ok: true });
}

async function acEnviar(env, metodo, caminho, corpo) {
  const res = await fetch(String(env.AC_API_URL).replace(/\/+$/, '') + caminho, { method: metodo, headers: { 'Api-Token': env.AC_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  if (!res.ok) throw new Error('ActiveCampaign respondeu HTTP ' + res.status);
  return res.json();
}

let camposTrilhaMemo = null;
async function camposTrilha(env) {
  if (camposTrilhaMemo && Date.now() - camposTrilhaMemo.em < 10 * 60000) return camposTrilhaMemo.ids;
  const j = await acGet(env, '/api/3/fields?limit=100');
  const porTitulo = {};
  for (const f of j.fields || []) porTitulo[String(f.title || '').trim().toLowerCase()] = String(f.id);
  const ids = {};
  for (const k of Object.keys(TRILHA_CAMPOS)) ids[k] = porTitulo[TRILHA_CAMPOS[k].toLowerCase()] || null;
  camposTrilhaMemo = { em: Date.now(), ids };
  return ids;
}

// Tenta 3 vezes (0 s, 8 s e 20 s): logo depois do cadastro o contato pode ainda não existir no ActiveCampaign.
async function atualizarTrilhaAC(env, v, email) {
  for (const espera of [0, 8000, 20000]) {
    if (espera) await new Promise(r => setTimeout(r, espera));
    try {
      if (await gravarTrilhaAC(env, v, email)) {
        await env.DB.prepare('UPDATE visitantes SET email_pend = NULL WHERE v = ?1').bind(v).run();
        return;
      }
    } catch (e) { /* tenta de novo */ }
  }
}

const diaBRT = iso => { const d = new Date(Date.parse(iso) - 3 * 3600 * 1000); return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0'); };
const dataBRT = iso => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);

function rotuloToque(t) {
  let det;
  if (t.fonte === 'meta.ads' || t.fonte === 'referral') det = t.meio;
  else det = t.term || t.content || t.campanha || t.meio;
  det = String(det || '').replace(/^\d+\s*-\s*/, '');
  return diaBRT(t.criado_em) + ' ' + t.fonte + (det ? ':' + det.slice(0, 24) : '');
}

// Devolve true quando terminou (gravou ou não há o que gravar) e false quando vale tentar de novo.
async function gravarTrilhaAC(env, v, email) {
  const campos = await camposTrilha(env);
  if (!campos.trilha || !campos.fonte) return true; // os campos ainda não foram criados: nada a fazer
  const j = await acGet(env, '/api/3/contacts?email=' + encodeURIComponent(email) + '&include=fieldValues');
  const contato = (j.contacts || [])[0];
  if (!contato) return false;
  const atuais = {};
  for (const fv of j.fieldValues || []) if (String(fv.contact) === String(contato.id)) atuais[String(fv.field)] = fv.value;
  const vazio = id => id && !String(atuais[id] == null ? '' : atuais[id]).trim();

  const r = await env.DB.prepare('SELECT criado_em, fonte, meio, campanha, term, content FROM visitas WHERE v = ?1 ORDER BY id ASC').bind(v).all();
  const toques = r.results || [];
  if (!toques.length) return true;

  const valores = [];
  const primeiro = toques[0];
  if (vazio(campos.fonte)) {
    const mapa = { fonte: primeiro.fonte, meio: primeiro.meio, campanha: primeiro.campanha, term: primeiro.term, content: primeiro.content, data: dataBRT(primeiro.criado_em) };
    for (const k of Object.keys(mapa)) if (campos[k] && mapa[k]) valores.push({ field: campos[k], value: String(mapa[k]) });
  }
  const rotulos = [];
  for (const t of toques) { const x = rotuloToque(t); if (rotulos[rotulos.length - 1] !== x) rotulos.push(x); }
  const trilha = rotulos.slice(-TRILHA_MAX).join(' > ');
  if (trilha && trilha !== String(atuais[campos.trilha] || '')) valores.push({ field: campos.trilha, value: trilha });

  if (valores.length) await acEnviar(env, 'POST', '/api/3/contact/sync', { contact: { email, fieldValues: valores } });
  await env.DB.prepare('UPDATE visitantes SET ac_id = ?2, ac_em = ?3 WHERE v = ?1').bind(v, String(contato.id), new Date().toISOString()).run();
  return true;
}

// Resumo pra conferir se a trilha está funcionando (só pra quem vê a Visão geral). Nunca devolve e-mail nem IP.
async function resumoVisitas(env) {
  if (!env.DB) return { erro: 'o banco (DB) não está ligado ao Worker' };
  await criarTabelasVisitas(env);
  const tot = await env.DB.prepare('SELECT COUNT(*) AS avisos, COUNT(DISTINCT v) AS visitantes, MIN(criado_em) AS desde, MAX(criado_em) AS ate FROM visitas').first();
  const lig = await env.DB.prepare('SELECT COUNT(*) AS identificados, SUM(CASE WHEN ac_em IS NOT NULL THEN 1 ELSE 0 END) AS gravados_no_ac FROM visitantes WHERE h IS NOT NULL').first();
  const fontes = await env.DB.prepare('SELECT fonte, COUNT(*) AS n FROM visitas GROUP BY fonte ORDER BY n DESC LIMIT 15').all();
  const ult = await env.DB.prepare("SELECT substr(v, 1, 8) || '...' AS visitante, criado_em, fonte, meio, campanha, pagina FROM visitas ORDER BY id DESC LIMIT 15").all();
  return { total: tot, identificacao: lig, porFonte: fontes.results || [], ultimos: ult.results || [] };
}

async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const hashEmail = (env, email) => sha256Hex(String(email || '').trim().toLowerCase() + '|' + (env.PHONE_SALT || 'relatorio'));

// Confere cada resposta contra as perguntas da operação. Devolve { resposta } ou { erro }.
function validarResposta(cfg, corpo) {
  const resposta = {};
  for (const q of cfg.pesquisa.perguntas) {
    let v = String(corpo && corpo[q.id] != null ? corpo[q.id] : '').trim();
    if (!v) { if (q.obrigatoria) return { erro: 'Falta responder: ' + q.rotulo }; resposta[q.id] = ''; continue; }
    if (q.tipo === 'escolha') {
      const ehOutro = q.outro && /^Outro: .{1,120}$/s.test(v);
      if (!q.opcoes.includes(v) && !ehOutro) return { erro: 'Resposta inválida em: ' + q.rotulo };
    } else if (q.tipo === 'email') {
      if (v.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return { erro: 'Confira o e-mail digitado.' };
    } else {
      v = v.slice(0, q.tipo === 'paragrafo' ? 2000 : 300);
    }
    resposta[q.id] = v;
  }
  return { resposta };
}

async function receberResposta(request, env, cfg) {
  if (!env.DB) return json({ erro: 'Formulário indisponível no momento.' }, 503);
  if (Number(request.headers.get('Content-Length') || 0) > 32 * 1024) return json({ erro: 'Resposta grande demais.' }, 413);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return json({ erro: 'Não entendi o envio. Tente de novo.' }, 400); }
  if (corpo && corpo.site) return json({ ok: true }); // campo escondido preenchido: é robô, finge que deu certo
  const v = validarResposta(cfg, corpo);
  if (v.erro) return json({ erro: v.erro }, 400);

  await env.DB.prepare(SQL_PESQ_CRIAR).run();
  const ipH = await sha256Hex(String(request.headers.get('CF-Connecting-IP') || 'sem-ip') + '|' + (env.PHONE_SALT || 'relatorio'));
  const umaHoraAtras = new Date(Date.now() - 3600 * 1000).toISOString();
  const ritmo = await env.DB.prepare(SQL_PESQ_RITMO).bind(cfg.slug, ipH, umaHoraAtras).first();
  if (ritmo && Number(ritmo.n) >= 8) return json({ erro: 'Muitas respostas enviadas deste local. Tente novamente mais tarde.' }, 429);

  const h = await hashEmail(env, v.resposta.email);
  await env.DB.prepare(SQL_PESQ_SALVAR).bind(cfg.slug, h, new Date().toISOString(), ipH, JSON.stringify(v.resposta)).run();
  limparCache();
  return json({ ok: true });
}

// Totais da pesquisa pro relatório. Nunca devolve nome, e-mail nem texto livre.
async function lerPesquisa(env, leadsRows, cfg, per) {
  if (!env.DB) return null;
  try {
    const lim = limitesUTC(per);
    await env.DB.prepare(SQL_PESQ_CRIAR).run();
    const r = await env.DB.prepare(SQL_PESQ_LER).bind(cfg.slug, lim.ini, lim.fim).all();
    const linhas = r.results || [];
    const emailsLeads = new Set();
    for (const l of leadsRows) {
      const d = dia(l.engaj);
      if (!d || d < per.de || d > per.ate || !l.email) continue;
      emailsLeads.add(await hashEmail(env, l.email));
    }
    const dados = linhas.map(l => { try { return JSON.parse(l.dados); } catch (e) { return {}; } });
    const tabelas = cfg.pesquisa.perguntas.filter(q => q.tipo === 'escolha').map(q => {
      const cont = {};
      for (const d of dados) {
        let v = d[q.id];
        if (!v) continue;
        if (/^Outro: /.test(v)) v = 'Outro';
        cont[v] = (cont[v] || 0) + 1;
      }
      const ordem = q.outro ? q.opcoes.concat(['Outro']) : q.opcoes;
      return { id: q.id, rotulo: q.rotulo.replace(/\s*\(.*\)\s*$/, ''), opcoes: ordem.map(k => ({ k, n: cont[k] || 0 })) };
    });
    return {
      desde: per.de,
      ate: per.ate,
      total: linhas.length,
      leadsQueResponderam: linhas.filter(l => emailsLeads.has(l.h)).length,
      link: cfg.pesquisa.enderecoPublico || '/' + cfg.slug + '/pesquisa',
      tabelas
    };
  } catch (e) {
    return null;
  }
}

// Todas as respostas em .csv (com senha). Cuidado com planilha: células que começam com = + - @ viram texto.
async function exportarRespostas(env, cfg) {
  if (!env.DB) return json({ erro: 'banco (DB) não está ligado ao Worker' }, 500);
  await env.DB.prepare(SQL_PESQ_CRIAR).run();
  const r = await env.DB.prepare(SQL_PESQ_TUDO).bind(cfg.slug).all();
  const cel = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const cab = ['Carimbo de data/hora'].concat(cfg.pesquisa.perguntas.map(q => q.rotulo));
  const linhas = [cab.map(cel).join(',')];
  for (const l of r.results || []) {
    let d = {}; try { d = JSON.parse(l.dados); } catch (e) { /* linha estragada: sai vazia */ }
    linhas.push([l.criado_em].concat(cfg.pesquisa.perguntas.map(q => d[q.id])).map(cel).join(','));
  }
  return new Response('﻿' + linhas.join('\r\n'), { headers: { ...CABECALHOS, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pesquisa-' + cfg.slug + '.csv"' } });
}

// O script do Google Ads manda todas as campanhas da conta, dia a dia; `agregarGoogle` pega só as desta operação.
async function lerGoogle(env, cfg) {
  if (!env.REPORT_KV) return null;
  try {
    const bruto = await env.REPORT_KV.get('google-ads:' + cfg.googleConta);
    return bruto ? JSON.parse(bruto) : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- montagem do relatório

function etapaAtual(hoje, cfg) {
  let atual = cfg.etapas[0].id;
  for (const e of cfg.etapas) if (e.inicio && e.inicio <= hoje) atual = e.id;
  return atual;
}

// `per` é o período pedido (ver periodoDe). Leads, origens, funil, gasto do dia a dia, pesquisa e grupo seguem o período;
// o ORÇAMENTO, o Mega e as metas são sempre do total acumulado da captação.
async function montarDados(env, cfg, per) {
  const hoje = hojeBRT();
  const [leadsLidos, megaLeads, metaAcum, googleBruto, metaRecorte] = await Promise.all([
    lerLeads(env, cfg.tagOperacao, cfg),
    lerTotalTag(env, cfg.tagMega).catch(() => null),
    lerMeta(env, cfg.meta.desde, hoje, cfg),
    lerGoogle(env, cfg),
    per.completo ? null : lerMeta(env, per.de, per.ate, cfg)
  ]);
  const meta = per.completo ? metaAcum : metaRecorte;
  const googleAcum = googleBruto ? agregarGoogle(googleBruto, cfg) : null;
  const google = googleBruto ? (per.completo ? googleAcum : agregarGoogle(googleBruto, cfg, per.de, per.ate)) : null;

  const leads = agregarLeads(leadsLidos.rows, per.de, per.ate, cfg);
  const grupo = await lerGrupo(env, leadsLidos.rows, cfg, per);
  const pesquisa = await lerPesquisa(env, leadsLidos.rows, cfg, per);

  // Do período: o que aparece nos cartões de investimento e custo por lead.
  const gastoMeta = meta.ok ? meta.gastoOperacao : 0;
  const gastoGoogle = google ? google.gastoOperacao : 0;
  const investimento = gastoMeta + gastoGoogle;

  // Acumulado: Mega e orçamento.
  const megaGasto = metaAcum.ok
    ? { valor: metaAcum.gastoMega + (googleAcum ? googleAcum.gastoMega : 0), manual: false }
    : { valor: cfg.megaGastoManual.valor * (1 + cfg.impostoMeta), manual: true, em: cfg.megaGastoManual.em };
  const gastoMetaAcum = metaAcum.ok ? metaAcum.gastoOperacao : 0;
  const gastoGoogleAcum = googleAcum ? googleAcum.gastoOperacao : 0;

  const metas = { ...cfg.metas, orcamento: cfg.metas.orcamentoTotal ? Math.max(0, cfg.metas.orcamentoTotal - megaGasto.valor) : null };

  // Gasto e previsão de cada etapa (sempre do acumulado, mesmo com filtro de datas): soma das campanhas de cada etapa, pelo nome (Meta com imposto, Google sem).
  const gastoEtapa = { captacao: 0, lembrete: 0, vendas: 0, outra: 0 };
  if (metaAcum.ok) metaAcum.campanhas.forEach(c => { gastoEtapa[c.etapa] = (gastoEtapa[c.etapa] || 0) + c.gasto; });
  if (googleAcum) googleAcum.campanhas.forEach(c => { gastoEtapa[c.etapa] = (gastoEtapa[c.etapa] || 0) + c.gasto; });
  const etapas = cfg.etapas.map(e => ({
    ...e,
    gasto: gastoEtapa[e.id] || 0,
    orcamentoBase: e.orcamento == null ? null : e.orcamento,
    orcamento: e.orcamento == null ? null : e.orcamento * (e.maisImposto ? 1 + cfg.impostoMeta : 1)
  }));

  // Orçamento total (Mega incluído) x quanto já foi gasto desde o começo. Meta com imposto, Google sem.
  const orcTotal = cfg.metas.orcamentoTotal || null;
  const orcGasto = gastoMetaAcum + gastoGoogleAcum + megaGasto.valor;
  const orcamento = orcTotal ? { total: orcTotal, gasto: orcGasto, saldo: orcTotal - orcGasto, mega: megaGasto.valor, megaNome: cfg.megaNome, meta: gastoMetaAcum, google: gastoGoogleAcum, parcial: !metaAcum.ok || !googleAcum } : null;

  return {
    geradoEm: new Date().toISOString(),
    hoje,
    periodo: per,
    slug: cfg.slug,
    titulo: cfg.titulo,
    tagNome: cfg.tagNome,
    cliente: cfg.cliente,
    etapaAtual: etapaAtual(hoje, cfg),
    etapas,
    gastoSemEtapa: gastoEtapa.outra || 0,
    gastoEtapasParcial: !metaAcum.ok || !googleAcum,
    metas,
    orcamento,
    captacaoInicio: cfg.captacaoInicio,
    leads,
    truncado: leadsLidos.truncado,
    impostoMeta: cfg.impostoMeta,
    investimento: { total: investimento, meta: gastoMeta, google: gastoGoogle },
    meta,
    google,
    mega: { nome: cfg.megaNome, leads: megaLeads, gasto: megaGasto },
    pesquisa,
    grupo,
    fontes: { activecampaign: true, meta: metaAcum.ok, google: !!googleBruto, pesquisa: !!pesquisa, whatsapp: !!grupo && grupo.entraram > 0, hotmart: false }
  };
}

// Resultado guardado por operação e período por alguns minutos, pra não repetir as leituras a cada acesso.
const cache = {};

function limparCache() {
  for (const k of Object.keys(cache)) delete cache[k];
}

async function dadosComCache(env, cfg, ignorarCache, per) {
  const chave = cfg.slug + '|' + per.de + '|' + per.ate;
  const c = cache[chave];
  if (!ignorarCache && c && Date.now() - c.em < cfg.cacheSegundos * 1000) return c.dados;
  const dados = await montarDados(env, cfg, per);
  if (Object.keys(cache).length > 60) limparCache(); // evita crescer sem limite se alguém testar muitos períodos
  cache[chave] = { em: Date.now(), dados };
  return dados;
}

// ---------------------------------------------------------------- segurança e rotas

function iguais(a, b) {
  a = String(a || ''); b = String(b || '');
  let r = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

// ---- Entrada por e-mail (Cloudflare Access): opcional.
// Com ACCESS_TEAM (ex.: teorema.cloudflareaccess.com) e ACCESS_AUD (código do aplicativo no Access) definidos, o relatório
// aceita quem o Access deixou entrar. O aviso vem num JWT assinado pelo Cloudflare, que conferimos aqui (assinatura, dono,
// aplicativo e validade). Assim o endereço provisório (workers.dev) não vira porta dos fundos.
let chavesAcesso = { em: 0, lista: null };

const b64url = s => {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
};

async function certificadosAcesso(env, recarregar) {
  if (!recarregar && chavesAcesso.lista && Date.now() - chavesAcesso.em < 3600 * 1000) return chavesAcesso.lista;
  const res = await fetch('https://' + env.ACCESS_TEAM + '/cdn-cgi/access/certs');
  if (!res.ok) throw new Error('certificados do Access indisponíveis');
  const j = await res.json();
  chavesAcesso = { em: Date.now(), lista: j.keys || [] };
  return chavesAcesso.lista;
}

async function acessoValido(request, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return false;
  const partes = (request.headers.get('Cf-Access-Jwt-Assertion') || '').split('.');
  if (partes.length !== 3) return false;
  try {
    const cab = JSON.parse(new TextDecoder().decode(b64url(partes[0])));
    if (cab.alg !== 'RS256') return false;
    let chave = (await certificadosAcesso(env, false)).find(k => k.kid === cab.kid);
    if (!chave) chave = (await certificadosAcesso(env, true)).find(k => k.kid === cab.kid); // o Cloudflare pode ter trocado a chave
    if (!chave) return false;
    const pub = await crypto.subtle.importKey('jwk', chave, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const assinaturaOk = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pub, b64url(partes[2]), new TextEncoder().encode(partes[0] + '.' + partes[1]));
    if (!assinaturaOk) return false;
    const c = JSON.parse(new TextDecoder().decode(b64url(partes[1])));
    const agora = Math.floor(Date.now() / 1000);
    return c.exp > agora && (!c.nbf || c.nbf <= agora + 30) && c.iss === 'https://' + env.ACCESS_TEAM && [].concat(c.aud || []).includes(env.ACCESS_AUD);
  } catch (e) {
    return false;
  }
}

// ---- Sessão por cookie: a tela de entrada (/entrar) confere a senha e entrega um cookie assinado (HMAC) que vale
// 12 horas, ou 30 dias se a pessoa marcar "manter conectado". Trocar a REPORT_PASSWORD derruba todas as sessões.
const SESSAO = 'sessao_relatorio';

const bytesB64url = u8 => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const textoB64url = s => bytesB64url(new TextEncoder().encode(s));

const chaveSessao = env => crypto.subtle.importKey('raw', new TextEncoder().encode('sessao|' + (env.PHONE_SALT || '') + '|' + (env.REPORT_PASSWORD || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

async function criarSessao(env, segundos, beta) {
  const corpo = textoB64url(JSON.stringify(beta ? { exp: Math.floor(Date.now() / 1000) + segundos, beta: true } : { exp: Math.floor(Date.now() / 1000) + segundos }));
  const assinatura = await crypto.subtle.sign('HMAC', await chaveSessao(env), new TextEncoder().encode(corpo));
  return corpo + '.' + bytesB64url(new Uint8Array(assinatura));
}

// Devolve o conteúdo da sessão (ou null se não há sessão válida).
async function dadosSessao(request, env) {
  if (!env.REPORT_PASSWORD) return null;
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(SESSAO + '='));
  if (!cookie) return null;
  const [corpo, assinatura] = cookie.slice(SESSAO.length + 1).split('.');
  if (!corpo || !assinatura) return null;
  try {
    if (!(await crypto.subtle.verify('HMAC', await chaveSessao(env), b64url(assinatura), new TextEncoder().encode(corpo)))) return null;
    const d = JSON.parse(new TextDecoder().decode(b64url(corpo)));
    return d.exp > Math.floor(Date.now() / 1000) ? d : null;
  } catch (e) {
    return null;
  }
}
const sessaoValida = async (request, env) => !!(await dadosSessao(request, env));

// Recursos em teste (BETA). Enquanto o recurso estiver em teste, só quem entrou com a senha de teste (segredo BETA_PASSWORD) o enxerga:
// quem entra com a senha normal do relatório nem vê o item no menu, e o endereço responde "não encontrado".
// Quando o recurso estiver pronto, é só trocar pra false e ele abre pra todo mundo que já tem a senha do relatório.
const BETA = { geral: true, gerencial: true };

async function betaAtivo(request, env) {
  if (!env.BETA_PASSWORD) return false;
  const s = await dadosSessao(request, env);
  if (s && s.beta === true) return true;
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try { const dec = atob(h.slice(6)); return iguais(dec.slice(dec.indexOf(':') + 1), env.BETA_PASSWORD); } catch (e) { return false; }
}
const podeGeral = async (request, env) => !BETA.geral || await betaAtivo(request, env);
const podeGerencial = async (request, env) => !BETA.gerencial || await betaAtivo(request, env);

// Entra quem tem sessão da tela de entrada, quem o Access liberou (se ligado) ou quem manda a senha no cabeçalho (curl, testes).
async function autorizado(request, env) {
  if (await sessaoValida(request, env)) return true;
  if (await acessoValido(request, env)) return true;
  if (!env.REPORT_PASSWORD) return false;
  const h = request.headers.get('Authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const dec = atob(h.slice(6));
    const senha = dec.slice(dec.indexOf(':') + 1);
    return iguais(senha, env.REPORT_PASSWORD) || (!!env.BETA_PASSWORD && iguais(senha, env.BETA_PASSWORD));
  } catch (e) {
    return false;
  }
}

const CABECALHOS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { ...CABECALHOS, 'Content-Type': 'application/json; charset=utf-8' } });
}

// Sem WWW-Authenticate de propósito: assim o navegador nunca mostra a caixinha feia de usuário e senha.
function pedirSenha() {
  return new Response('Acesso restrito. Entre pela tela de entrada do relatório.', { status: 401, headers: CABECALHOS });
}

const CSP_ENTRADA = CSP_BASE => CSP_BASE.replace("form-action 'none'", "form-action 'self'; img-src 'self' data:");

const SQL_LOGIN_CRIAR = 'CREATE TABLE IF NOT EXISTS login_falhas (ip_h TEXT, quando TEXT)';
const SQL_LOGIN_FALHA = 'INSERT INTO login_falhas (ip_h, quando) VALUES (?1, ?2)';
const SQL_LOGIN_CONTAR = 'SELECT COUNT(*) AS n FROM login_falhas WHERE ip_h = ?1 AND quando >= ?2';

// Só volta pra caminhos do próprio relatório (evita mandar a pessoa pra outro site).
const voltaSegura = v => { const s = String(v || ''); return /^\/[a-z0-9\-\/\.]*$/.test(s) && !s.startsWith('//') ? s : '/'; };

function respostaHtml(corpo, status, csp) {
  return new Response(corpo, { status: status || 200, headers: { ...CABECALHOS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp } });
}

function paginaEntrada(volta, erro) {
  // A tela de entrada é a mesma pra todos os relatórios: marca do Teorema Militar, sem nome de operação.
  const cfg = HUB;
  const t = cfg.tema;
  const css = ':root{--bg:' + COR(t.bg) + ';--card:' + COR(t.card) + ';--line:' + COR(t.line) + ';--accent:' + COR(t.accent) + ';--weak:' + COR(t.textWeak) + ';--text:' + COR(t.text) + '}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text);font-family:"Titillium Web",system-ui,sans-serif;padding:24px 16px;' +
    'background-image:radial-gradient(circle at 15% 0%,color-mix(in srgb,var(--accent) 8%,transparent),transparent 45%),radial-gradient(circle at 90% 90%,color-mix(in srgb,var(--line) 40%,transparent),transparent 50%)}' +
    '.c{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:12px;padding:28px}' +
    '.logo{display:block;width:230px;max-width:100%;color:var(--text)}.logo svg{display:block;width:100%;height:auto}' +
    'h1{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:34px;line-height:1;margin:6px 0 20px}' +
    'label{display:block;font-size:13px;color:var(--weak);margin-bottom:6px}' +
    'input[type=password],input.visivel{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:13px;font:inherit;font-size:16px}' +
    'input[type=password]:focus,input.visivel:focus{outline:2px solid var(--accent);outline-offset:1px}' +
    '.campo{position:relative}.campo input{padding-right:52px}' +
    '.campo #olho{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:auto;background:transparent;color:var(--weak);border:0;padding:10px;line-height:0;border-radius:8px}' +
    '.campo #olho:hover,.campo #olho.on{color:var(--accent)}' +
    '.caps{font-size:13px;color:var(--accent);margin:8px 0 0}' +
    '.lembrar{display:flex;align-items:center;gap:10px;margin:14px 0 18px;font-size:14px;color:var(--weak)}.lembrar input{accent-color:var(--accent);width:18px;height:18px}' +
    'button{width:100%;background:var(--accent);color:var(--bg);border:0;border-radius:8px;padding:14px;font:inherit;font-weight:700;font-size:16px;cursor:pointer}' +
    '.erro{color:#f87171;font-size:14px;margin:0 0 14px}.rodape{font-size:12px;color:var(--weak);margin-top:18px;text-align:center}';
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>Entrar — Relatórios</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body><form class="c" method="post" action="/entrar">' +
    marcaHtml() + '<h1>' + escaparHtml(cfg.titulo) + '</h1>' +
    (erro ? '<p class="erro" role="alert">' + escaparHtml(erro) + '</p>' : '') +
    '<input type="text" name="usuario" value="relatorio" autocomplete="username" hidden>' +
    '<label for="s">Senha do relatório</label>' +
    '<div class="campo"><input id="s" class="visivel" type="password" name="senha" autocomplete="current-password" autocapitalize="none" spellcheck="false" autofocus required>' +
    '<button type="button" id="olho" aria-label="Mostrar senha" title="Mostrar senha">' + OLHO_ABERTO + '</button></div>' +
    '<div id="caps" class="caps" hidden>Caps Lock ligado: as letras estão saindo em MAIÚSCULA.</div>' +
    '<label class="lembrar"><input type="checkbox" name="lembrar" value="1" checked> Manter conectado por 30 dias</label>' +
    '<input type="hidden" name="volta" value="' + escaparHtml(voltaSegura(volta)) + '"><button type="submit">Entrar</button>' +
    '<div class="rodape">Acesso restrito à equipe.</div></form>' +
    '<script>(function(){var i=document.getElementById("s"),b=document.getElementById("olho"),c=document.getElementById("caps");' +
    'var ab=' + JSON.stringify(OLHO_ABERTO) + ',fe=' + JSON.stringify(OLHO_FECHADO) + ';' +
    'b.addEventListener("click",function(){var ver=i.type==="password";i.type=ver?"text":"password";b.innerHTML=ver?fe:ab;' +
    'b.setAttribute("aria-label",ver?"Ocultar senha":"Mostrar senha");b.title=b.getAttribute("aria-label");b.className=ver?"on":"";i.focus();});' +
    'function caps(e){if(e.getModifierState){c.hidden=!e.getModifierState("CapsLock");}}' +
    'i.addEventListener("keydown",caps);i.addEventListener("keyup",caps);})();</script></body></html>';
}

// Olhinho da senha: aberto = "mostrar"; riscado = "ocultar".
const OLHO_ABERTO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const OLHO_FECHADO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/><line x1="3" y1="3" x2="21" y2="21"/></svg>';

async function entrar(request, env, cspBase) {
  if (!env.REPORT_PASSWORD) return json({ erro: 'A senha do relatório não está configurada.' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return json({ erro: 'Pedido grande demais.' }, 413);
  const form = new URLSearchParams(await request.text());
  const volta = voltaSegura(form.get('volta'));
  const csp = CSP_ENTRADA(cspBase);
  let ipH = null;
  if (env.DB) {
    try {
      ipH = await sha256Hex(String(request.headers.get('CF-Connecting-IP') || 'sem-ip') + '|' + (env.PHONE_SALT || 'relatorio'));
      await env.DB.prepare(SQL_LOGIN_CRIAR).run();
      const r = await env.DB.prepare(SQL_LOGIN_CONTAR).bind(ipH, new Date(Date.now() - 15 * 60 * 1000).toISOString()).first();
      if (r && Number(r.n) >= 8) return respostaHtml(paginaEntrada(volta, 'Muitas tentativas. Espere 15 minutos e tente de novo.'), 429, csp);
    } catch (e) { /* sem o limite, a senha continua protegendo */ }
  }
  const senhaNormal = iguais(form.get('senha'), env.REPORT_PASSWORD);
  const senhaBeta = !senhaNormal && !!env.BETA_PASSWORD && iguais(form.get('senha'), env.BETA_PASSWORD);
  if (senhaNormal || senhaBeta) {
    const lembrar = form.get('lembrar') === '1';
    const segundos = lembrar ? 30 * 24 * 3600 : 12 * 3600;
    const cookie = SESSAO + '=' + (await criarSessao(env, segundos, senhaBeta)) + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (lembrar ? '; Max-Age=' + segundos : '');
    return new Response(null, { status: 303, headers: { ...CABECALHOS, Location: volta, 'Set-Cookie': cookie } });
  }
  if (env.DB && ipH) { try { await env.DB.prepare(SQL_LOGIN_FALHA).bind(ipH, new Date().toISOString()).run(); } catch (e) { /* segue */ } }
  return respostaHtml(paginaEntrada(volta, 'Senha incorreta.'), 401, csp);
}

const sair = () => new Response(null, { status: 303, headers: { ...CABECALHOS, Location: '/entrar', 'Set-Cookie': SESSAO + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' } });

// A Hotmart recusa (400) os pedidos de dados que saem do Cloudflare, então as vendas entram de fora: o script do Google Ads
// (de hora em hora) e a carga inicial (feita no computador) leem a Hotmart e mandam pra cá. Mesma chave do Google (GOOGLE_INGEST_KEY).
async function receberVendasHotmart(request, env) {
  if (!env.GOOGLE_INGEST_KEY || !iguais(request.headers.get('X-Report-Key'), env.GOOGLE_INGEST_KEY)) return json({ erro: 'não autorizado' }, 401);
  if (!env.DB || !env.REPORT_KV) return json({ erro: 'faltam o banco (DB) e o armazenamento (KV) no Worker' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 1024 * 1024) return json({ erro: 'corpo grande demais' }, 413);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return json({ erro: 'JSON inválido' }, 400); }
  const itens = Array.isArray(corpo && corpo.itens) ? corpo.itens : [];
  const reembolsadas = Array.isArray(corpo && corpo.reembolsadas) ? corpo.reembolsadas.map(String) : [];
  if (itens.length > 250 || reembolsadas.length > 500) return json({ erro: 'lote grande demais (até 250 vendas e 500 reembolsos por vez)' }, 413);
  await garantirTabelaVendas(env);
  const salvas = await salvarItens(env, itens);
  for (let i = 0; i < reembolsadas.length; i += 50) {
    const fatia = reembolsadas.slice(i, i + 50);
    await env.DB.prepare('DELETE FROM vendas WHERE tx IN (' + fatia.map(() => '?').join(',') + ')').bind(...fatia).run();
  }
  let est = { cursor: GERAL.primeiroMes, feito: true };
  try { est = JSON.parse((await env.REPORT_KV.get('geral:estado')) || 'null') || est; } catch (e) { /* recomeça o estado */ }
  est.feito = true; est.erro = null; est.aviso = null; est.recente = new Date().toISOString();
  await env.REPORT_KV.put('geral:estado', JSON.stringify(est));
  return json({ ok: true, salvas, removidas: reembolsadas.length });
}

// ---------------------------------------------------------------- webhook da Hotmart
// A Hotmart avisa o relatório a cada compra, reembolso etc. (Hotmart > Ferramentas > Webhook), sem depender de ninguém buscar as vendas.
// É o caminho normal; a carga do computador (carga-hotmart.ps1) só completa o histórico ou um dia em que o aviso falhou.
// Segurança: o endereço leva ?k=<chave> (segredo HOTMART_WEBHOOK_KEY; se não existir, vale a GOOGLE_INGEST_KEY). Se existir o segredo
// HOTMART_HOTTOK, o "hottok" que a Hotmart manda (cabeçalho X-HOTMART-HOTTOK ou campo hottok do corpo) também precisa bater.
const EVENTOS_HOTMART_VENDA = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'];
const EVENTOS_HOTMART_SAI = ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED'];
const CAMPOS_PESSOAIS_HOTMART = /^(email|name|first_name|last_name|full_name|phone|checkout_phone|phone_number|document|document_type|address|zip_code|city|state|neighborhood|number|complement|ip|hottok|ucode|birth_date)$/i;

// O aviso da Hotmart (versão 2.0.0) vira o mesmo formato da API de vendas, pra reaproveitar a leitura (linhaDeVenda).
// Taxa da Hotmart = comissão de origem MARKETPLACE. Se a Hotmart mudar o desenho do aviso, a amostra guardada (/api/hotmart-amostras) mostra como veio.
function itemDoWebhook(corpo) {
  const d = (corpo && corpo.data) || {};
  const c = d.purchase || {};
  const preco = c.price || c.full_price || {};
  const comissoes = Array.isArray(d.commissions) ? d.commissions : [];
  const taxa = comissoes.filter(x => x && /marketplace/i.test(String(x.source || ''))).reduce((s, x) => s + (Number(x.value) || 0), 0);
  return {
    buyer: { email: d.buyer && d.buyer.email },
    product: { id: d.product && d.product.id, name: d.product && d.product.name },
    purchase: {
      transaction: c.transaction, approved_date: c.approved_date, order_date: c.order_date || (corpo && corpo.creation_date),
      price: { value: preco.value, currency_code: preco.currency_value || preco.currency_code },
      hotmart_fee: { total: taxa }, recurrency_number: c.recurrency_number,
      tracking: { source_sck: (c.origin && c.origin.sck) || (c.tracking && c.tracking.source_sck) || '' }
    }
  };
}

// Cópia do aviso sem dados pessoais (nome, e-mail, telefone, documento, endereço...), pra conferir o formato sem guardar gente.
function mascararHotmart(v, fundo) {
  if ((fundo || 0) > 8) return '…';
  if (Array.isArray(v)) return v.slice(0, 10).map(x => mascararHotmart(x, (fundo || 0) + 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = CAMPOS_PESSOAIS_HOTMART.test(k) ? '***' : mascararHotmart(v[k], (fundo || 0) + 1);
    return o;
  }
  return typeof v === 'string' ? v.slice(0, 200) : v;
}

// Uma amostra de cada tipo de evento basta (o KV do plano grátis limita as gravações do dia).
async function guardarAmostraHotmart(env, corpo, evento) {
  try {
    const bruto = await env.REPORT_KV.get('hotmart-webhook:amostras');
    const amostras = bruto ? JSON.parse(bruto) : {};
    const chave = evento || '(sem evento)';
    if (amostras[chave]) return;
    amostras[chave] = { em: new Date().toISOString(), corpo: mascararHotmart(corpo) };
    await env.REPORT_KV.put('hotmart-webhook:amostras', JSON.stringify(amostras));
  } catch (e) { /* a amostra é só pra conferência */ }
}

const amostrasHotmart = async env => {
  try { return { amostras: env.REPORT_KV ? JSON.parse((await env.REPORT_KV.get('hotmart-webhook:amostras')) || '{}') : {} }; } catch (e) { return { amostras: {} }; }
};

// Marca "vendas atualizadas agora" (o que a Visão geral mostra), no máximo uma gravação por minuto.
async function marcarAtualizacaoVendas(env) {
  try {
    let est = { cursor: GERAL.primeiroMes, feito: true };
    try { est = JSON.parse((await env.REPORT_KV.get('geral:estado')) || 'null') || est; } catch (e) { /* recomeça o estado */ }
    if (est.feito && est.recente && Date.now() - Date.parse(est.recente) < 60000) return;
    est.feito = true; est.erro = null; est.aviso = null; est.recente = new Date().toISOString();
    await env.REPORT_KV.put('geral:estado', JSON.stringify(est));
  } catch (e) { /* segue: o dado já foi gravado */ }
}

async function receberWebhookHotmart(request, env, url) {
  const chave = env.HOTMART_WEBHOOK_KEY || env.GOOGLE_INGEST_KEY;
  if (!chave || !iguais(url.searchParams.get('k'), chave)) return json({ erro: 'não autorizado' }, 401);
  if (!env.DB || !env.REPORT_KV) return json({ erro: 'faltam o banco (DB) e o armazenamento (KV) no Worker' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 256 * 1024) return json({ erro: 'corpo grande demais' }, 413);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return json({ erro: 'JSON inválido' }, 400); }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return json({ erro: 'formato inesperado' }, 400);
  if (env.HOTMART_HOTTOK && !iguais(request.headers.get('X-Hotmart-Hottok') || corpo.hottok, env.HOTMART_HOTTOK)) return json({ erro: 'não autorizado' }, 401);
  const evento = String(corpo.event || '').toUpperCase().slice(0, 60);
  await guardarAmostraHotmart(env, corpo, evento);
  let acao = 'ignorado';
  try {
    await garantirTabelaVendas(env);
    if (EVENTOS_HOTMART_VENDA.includes(evento)) {
      acao = (await salvarItens(env, [itemDoWebhook(corpo)])) ? 'salva' : 'sem_dados';
    } else if (EVENTOS_HOTMART_SAI.includes(evento)) {
      const tx = corpo.data && corpo.data.purchase && corpo.data.purchase.transaction;
      if (tx) { await env.DB.prepare('DELETE FROM vendas WHERE tx = ?1').bind(String(tx)).run(); acao = 'removida'; } else acao = 'sem_dados';
    }
    if (acao === 'salva' || acao === 'removida') await marcarAtualizacaoVendas(env);
  } catch (e) {
    return json({ erro: 'não consegui gravar agora', evento }, 500); // a Hotmart tenta de novo
  }
  return json({ ok: true, evento, acao });
}

// Entrega um acesso novo da Hotmart pro script (que lê a Hotmart de fora), pra as chaves ficarem só no Cloudflare.
async function entregarTokenHotmart(request, env) {
  if (!env.GOOGLE_INGEST_KEY || !iguais(request.headers.get('X-Report-Key'), env.GOOGLE_INGEST_KEY)) return json({ erro: 'não autorizado' }, 401);
  if (!env.REPORT_KV) return json({ erro: 'armazenamento (REPORT_KV) não está ligado ao Worker' }, 500);
  try { return json({ token: await tokenHotmart(env) }); } catch (e) { return json({ erro: String((e && e.message) || e).slice(0, 160) }, 502); }
}

async function receberGoogle(request, env) {
  if (!env.GOOGLE_INGEST_KEY || !iguais(request.headers.get('X-Report-Key'), env.GOOGLE_INGEST_KEY)) return json({ erro: 'não autorizado' }, 401);
  if (!env.REPORT_KV) return json({ erro: 'armazenamento (REPORT_KV) não está ligado ao Worker' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 4 * 1024 * 1024) return json({ erro: 'corpo grande demais' }, 413);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return json({ erro: 'JSON inválido' }, 400); }
  if (!corpo || !Array.isArray(corpo.rows) || corpo.rows.length > 50000) return json({ erro: 'formato inesperado' }, 400);
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const rows = corpo.rows.map(r => ({
    date: dia(r.date), campaignId: String(r.campaignId || ''), campaign: String(r.campaign || '').slice(0, 300),
    status: String(r.status || ''), channel: String(r.channel || ''),
    cost: num(r.cost), impressions: num(r.impressions), clicks: num(r.clicks), conversions: num(r.conversions)
  })).filter(r => r.date);
  const conta = String(corpo.customerId || '').replace(/[^0-9-]/g, '').slice(0, 20);
  if (!conta) return json({ erro: 'faltou o customerId da conta' }, 400);
  // Frequência por campanha (opcional; só campanhas de vídeo): { campaignId, frequency, users }, de um intervalo fechado (frequenciaDe a frequenciaAte).
  const freq = (Array.isArray(corpo.frequencia) ? corpo.frequencia.slice(0, 500) : []).map(x => ({ campaignId: String((x && x.campaignId) || ''), frequency: num(x && x.frequency), users: num(x && x.users) })).filter(x => x.campaignId && x.frequency > 0);
  await env.REPORT_KV.put('google-ads:' + conta, JSON.stringify({ sentAt: new Date().toISOString(), customerId: conta, rows, freq, freqDe: dia(corpo.frequenciaDe), freqAte: dia(corpo.frequenciaAte) }));
  limparCache();
  return json({ ok: true, linhas: rows.length });
}

// ================================================================ Visão geral (todas as escolas)
// Vendas da Hotmart (por categoria e por escola) e investimento em Meta e Google, do período que a pessoa escolher.
// As vendas são copiadas da Hotmart pro banco (D1) aos poucos: a primeira abertura traz o histórico desde 2021, mês a mês,
// e depois cada abertura só busca os últimos dias. Assim a página é rápida e o histórico do Meta (que só guarda ~3 anos) não se perde.
// Segredos: HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, HOTMART_BASIC_TOKEN (Cloudflare > Worker > Variáveis e segredos).

const GERAL = {
  primeiroMes: '2021-01',
  api: 'https://developers.hotmart.com',
  tokenUrl: 'https://api-sec-vlc.hotmart.com/security/oauth/token',
  metaDesde: '2023-08-01' // o Meta só devolve gasto dos últimos ~37 meses
};

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// Escola de cada produto, pelo nome na Hotmart ("TM - Full - EsPCEx" etc.). A primeira que casar vale.
const ESCOLA_RE = [
  [/tripl/, 'Tríplice (AFA, EFOMM, EN)'], [/colegio naval/, 'Colégio Naval'], [/escola naval/, 'Escola Naval'],
  [/barro branco|apmbb/, 'Barro Branco'], [/espcex/, 'EsPCEx'], [/\besa\b/, 'ESA'], [/\bafa\b/, 'AFA'], [/\beear\b/, 'EEAr'],
  [/epcar/, 'EPCAr'], [/efomm/, 'EFOMM'], [/cbmerj/, 'CBMERJ'], [/\bcfo\b/, 'CFO Paraná'], [/sargento/, 'Sargentos'],
  [/soldado/, 'Soldado PM SP'], [/vestibular/, 'Vestibulares']
];
const escolaDoNome = n => { for (const [re, nome] of ESCOLA_RE) if (re.test(n)) return nome; return null; };

// Full / Combo / Avulso / Outros (a divisão do site do Teorema). Full Promo não se separa: é tudo Full.
function classificarProduto(nome) {
  const n = semAcento(nome);
  if (/^tm\s*-?\s*full\b/.test(n)) return { categoria: 'Full', escola: escolaDoNome(n) || 'Outras escolas' };
  if (/\bcombo\b/.test(n)) return { categoria: 'Combo', escola: /\besa\b/.test(n) ? 'ESA' : /espcex/.test(n) ? 'EsPCEx' : null }; // Humanas ESA / Humanas EsPCEx; os demais combos não são de uma escola
  if (/^tm\s*-?\s*edition\b|respeita a geografia/.test(n)) return { categoria: 'Avulso', escola: /\besa\b/.test(n) ? 'ESA' : /espcex/.test(n) ? 'EsPCEx' : /apmbb/.test(n) ? 'Barro Branco' : null };
  return { categoria: 'Outros', escola: null };
}

// recorrência 1 (ou vazia) = primeira compra; 2 em diante = renovação. Valor pequeno (R$ 54, R$ 65...) é venda como qualquer outra:
// pode ser entrada no Pix, desconto ou troca de curso (Leili, 2026-09-21).
function tipoVenda(recorrencia) {
  return (Number(recorrencia) || 0) <= 1 ? 'nova' : 'renovacao';
}

const SQL_VENDAS_CRIAR = 'CREATE TABLE IF NOT EXISTS vendas (tx TEXT PRIMARY KEY, dia TEXT, mes TEXT, produto TEXT, categoria TEXT, escola TEXT, tipo TEXT, moeda TEXT, valor REAL, liquido REAL, origem TEXT, comprador_h TEXT, clique TEXT, clique_det TEXT)';
const SQL_VENDAS_COLUNAS_NOVAS = ['ALTER TABLE vendas ADD COLUMN clique TEXT', 'ALTER TABLE vendas ADD COLUMN clique_det TEXT']; // bancos criados antes dessas colunas existirem
const SQL_VENDAS_INDICE = 'CREATE INDEX IF NOT EXISTS vendas_dia ON vendas (dia)';
const COLUNAS_VENDA = 14;
const SQL_VENDAS_LINHA = '(' + new Array(COLUNAS_VENDA).fill('?').join(',') + ')';
// ?3 é a escola ('' = todas).
const SQL_VENDAS_BASE = "FROM vendas WHERE dia >= ?1 AND dia <= ?2 AND moeda = 'BRL' AND (?3 = '' OR escola = ?3)";
// Mesmo trecho do calendário (mês-dia) em todos os anos: ?1 e ?2 são 'MM-DD'.
const SQL_VENDAS_ANOS = "SELECT substr(dia, 1, 4) AS ano, categoria AS cat, COUNT(*) AS n, SUM(valor) AS bruto, SUM(liquido) AS liq FROM vendas WHERE substr(dia, 6, 5) >= ?1 AND substr(dia, 6, 5) <= ?2 AND moeda = 'BRL' AND (?3 = '' OR escola = ?3) GROUP BY substr(dia, 1, 4), categoria ORDER BY ano";
const sqlGrupo = (col, ordem, limite) => 'SELECT ' + col + ' AS k, COUNT(*) AS n, SUM(valor) AS bruto, SUM(liquido) AS liq ' + SQL_VENDAS_BASE + ' GROUP BY ' + col + ' ORDER BY ' + ordem + (limite ? ' LIMIT ' + limite : '');

async function garantirTabelaVendas(env) {
  await env.DB.prepare(SQL_VENDAS_CRIAR).run();
  await env.DB.prepare(SQL_VENDAS_INDICE).run();
  await env.DB.prepare(SQL_CONTATOS_CRIAR).run();
  for (const alter of SQL_VENDAS_COLUNAS_NOVAS) { try { await env.DB.prepare(alter).run(); } catch (e) { /* a coluna já existe */ } }
}

// De onde veio o CLIQUE da compra: o source_sck que a Hotmart guarda no checkout, normalmente no formato origem|meio|campanha|conteúdo
// (ex.: ig|organic|OP.BB.26|bio). É o último clique antes da compra, não a origem do lead. Devolve o canal e um detalhe
// (o conteúdo do link, como "bio" ou "stories"; nos anúncios do Meta, o nome do público).
// Como o Meta aparece no checkout (visto em 2026-09-21): "pp.dmb" (com o nome do conjunto de anúncios no lugar do meio), "facebook.ads" e "meta.ads".
function classificarClique(sck) {
  const s = String(sck || '').trim().toLowerCase();
  if (!s) return { canal: 'sem_registro', detalhe: '' };
  const limpo = x => { x = String(x || '').trim(); return x && !/^\(not set\)$|^undefined$|^\{\{.*\}\}$|^not set$/.test(x) ? x : ''; };
  let p = s.split('|').map(x => x.trim());
  // formatos antigos da Hotmart, sem barras: undefined-ig_bio-org-undefined, plano.espcex.24-fb-ads-undefined
  if (p.length === 1 && s.indexOf('-') > 0) {
    if (/(^|-)ig[_-]/.test(s)) return { canal: 'instagram', detalhe: (s.match(/ig_([a-z0-9]+)/) || [])[1] || '' };
    if (/-fb-|facebook/.test(s)) return { canal: 'meta', detalhe: '' };
    if (/yt_.*ads|-yt-.*ads/.test(s)) return { canal: 'youtube_ads', detalhe: '' };
    if (/site-org/.test(s)) return { canal: 'site', detalhe: '' };
    return { canal: 'outro', detalhe: '' };
  }
  let src = p[0];
  if (src === 'referral' && p[1]) src = p[1]; // formato invertido: referral|www.google.com
  let canal = 'outro';
  if (/^direct$|^\(direct\)$/.test(src)) canal = 'direto';
  else if (/^pp\.dmb$|meta\.ads|facebook|^fb$/.test(src)) canal = 'meta';
  else if (/yt_ads/.test(src)) canal = 'youtube_ads';
  else if (/^ig$|instagram/.test(src)) canal = 'instagram';
  else if (/^yt$|youtube/.test(src)) canal = 'youtube';
  else if (/linktr\.ee|linktree/.test(src)) canal = 'linktree';
  else if (/google\.|bing\.|yahoo\.|duckduckgo|ecosia|search\./.test(src)) canal = 'busca';
  else if (/teoremamilitar/.test(src)) canal = 'site';
  else if (/hotmart|new_club/.test(src)) canal = 'hotmart';
  else if (/whatsapp|^wa$|zap/.test(src)) canal = 'whatsapp';
  else if (/email|e-mail|activecampaign|^ac$/.test(src)) canal = 'email';
  let detalhe;
  if (canal === 'meta') detalhe = limpo(p[1]);          // nome do conjunto de anúncios (o público)
  else detalhe = limpo(p[3]) || limpo(p[2]);            // conteúdo do link, ou a campanha
  return { canal, detalhe: detalhe.slice(0, 60) };
}
const canalDoClique = sck => classificarClique(sck).canal;
const CLIQUE_ROTULO = { meta: 'Meta Ads', youtube_ads: 'YouTube Ads', instagram: 'Instagram', youtube: 'YouTube', linktree: 'Linktree (link da bio)', busca: 'Busca (Google, Bing...)', site: 'Site do Teorema', hotmart: 'Hotmart (área de membros)', direto: 'Direto (sem origem no clique)', whatsapp: 'WhatsApp', email: 'E-mail', sem_registro: 'Sem registro no checkout', outro: 'Outros' };

// ---- Contatos do ActiveCampaign (todos, de qualquer tag), pra saber de onde veio o lead que comprou.
// Guarda só o código do e-mail (hash) e a origem já classificada; o e-mail em si nunca fica no banco.
const SQL_CONTATOS_CRIAR = 'CREATE TABLE IF NOT EXISTS contatos (h TEXT PRIMARY KEY, canal TEXT, publico TEXT, detalhe TEXT, cadastro TEXT, atualizado TEXT)';
const CFG_ORIGEM = { re: { antiga: /(?!)/ } }; // classificar() olha a campanha antiga da operação; aqui não há operação

async function salvarContatos(env, lista) {
  const linhas = [];
  for (const c of lista) {
    if (!c || !c.email) continue;
    const cl = classificar({ source: c.source, content: c.content, medium: c.medium, campaign: c.campaign, term: c.term }, CFG_ORIGEM);
    linhas.push([await hashEmail(env, c.email), cl.canal, cl.publico, String(cl.detalhe || '').slice(0, 120), String(c.cadastro || '').slice(0, 25), new Date().toISOString()]);
  }
  const cmds = [];
  for (let i = 0; i < linhas.length; i += 15) {
    const fatia = linhas.slice(i, i + 15);
    cmds.push(env.DB.prepare('INSERT OR REPLACE INTO contatos (h, canal, publico, detalhe, cadastro, atualizado) VALUES ' + fatia.map(() => '(?,?,?,?,?,?)').join(',')).bind(...fatia.flat()));
  }
  for (let i = 0; i < cmds.length; i += 25) await env.DB.batch(cmds.slice(i, i + 25));
  return linhas.length;
}

// Contatos criados ou alterados desde ontem (o ActiveCampaign filtra por dia). Roda no máximo a cada 10 minutos, em segundo plano.
async function atualizarContatosRecentes(env) {
  if (!env.AC_API_URL || !env.AC_API_KEY || !env.DB || !env.REPORT_KV) return { pulou: true };
  let est = null;
  try { est = JSON.parse((await env.REPORT_KV.get('ac-contatos:estado')) || 'null'); } catch (e) { /* recomeça */ }
  if (est && est.ultima && Date.now() - Date.parse(est.ultima) < 10 * 60 * 1000) return { pulou: true };
  const desde = somarDias(hojeBRT(), est && est.ultima ? -1 : -2);
  const F = GLOBAL.campoUtm;
  let salvos = 0;
  try {
    await garantirTabelaVendas(env);
    for (let p = 0; p < 5; p++) {
      const j = await acGet(env, '/api/3/contacts?filters[updated_after]=' + desde + '&limit=100&offset=' + (p * 100) + '&include=fieldValues');
      const porContato = {};
      for (const fv of j.fieldValues || []) (porContato[fv.contact] || (porContato[fv.contact] = {}))[fv.field] = fv.value;
      const contatos = j.contacts || [];
      salvos += await salvarContatos(env, contatos.map(c => { const v = porContato[c.id] || {}; return { email: c.email, source: v[F.source], content: v[F.content], medium: v[F.medium], campaign: v[F.campaign], term: v[F.term], cadastro: c.cdate }; }));
      if (contatos.length < 100) break;
    }
    await env.REPORT_KV.put('ac-contatos:estado', JSON.stringify({ ultima: new Date().toISOString(), salvos }));
  } catch (e) {
    return { erro: String((e && e.message) || e).slice(0, 160) };
  }
  return { salvos };
}

// Carga de contatos vinda de fora (script no computador da Leili): mesma chave do Google.
async function receberContatosAC(request, env) {
  if (!env.GOOGLE_INGEST_KEY || !iguais(request.headers.get('X-Report-Key'), env.GOOGLE_INGEST_KEY)) return json({ erro: 'não autorizado' }, 401);
  if (!env.DB) return json({ erro: 'o banco (DB) não está ligado ao Worker' }, 500);
  if (Number(request.headers.get('Content-Length') || 0) > 1024 * 1024) return json({ erro: 'corpo grande demais' }, 413);
  let corpo;
  try { corpo = await request.json(); } catch (e) { return json({ erro: 'JSON inválido' }, 400); }
  const lista = Array.isArray(corpo && corpo.contatos) ? corpo.contatos : [];
  if (lista.length > 250) return json({ erro: 'lote grande demais (até 250 contatos por vez)' }, 413);
  await garantirTabelaVendas(env);
  return json({ ok: true, salvos: await salvarContatos(env, lista) });
}

async function tokenHotmart(env, renovar) {
  if (!env.HOTMART_CLIENT_ID || !env.HOTMART_CLIENT_SECRET || !env.HOTMART_BASIC_TOKEN) throw new Error('faltam as chaves da Hotmart no Cloudflare');
  if (!renovar) {
    const guardado = await env.REPORT_KV.get('hotmart:token');
    if (guardado) { try { const g = JSON.parse(guardado); if (g.exp > Date.now() + 60000) return g.token; } catch (e) { /* pede outro */ } }
  }
  const basico = /^basic /i.test(env.HOTMART_BASIC_TOKEN) ? env.HOTMART_BASIC_TOKEN : 'Basic ' + env.HOTMART_BASIC_TOKEN;
  const q = new URLSearchParams({ grant_type: 'client_credentials', client_id: env.HOTMART_CLIENT_ID, client_secret: env.HOTMART_CLIENT_SECRET });
  const res = await fetch(GERAL.tokenUrl + '?' + q.toString(), { method: 'POST', headers: { Authorization: basico, Accept: 'application/json', 'User-Agent': 'relatorio-teorema/1.0' } });
  if (!res.ok) throw new Error('a Hotmart recusou as chaves (' + res.status + ')');
  const j = await res.json();
  if (!j.access_token) throw new Error('a Hotmart não devolveu o acesso');
  const dura = Math.max(300, (Number(j.expires_in) || 3600) - 3600);
  await env.REPORT_KV.put('hotmart:token', JSON.stringify({ token: j.access_token, exp: Date.now() + dura * 1000 }), { expirationTtl: dura });
  return j.access_token;
}

async function chamarHotmart(env, caminho, q) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const token = await tokenHotmart(env, tentativa === 1);
    const res = await fetch(GERAL.api + caminho + '?' + q.toString(), { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'User-Agent': 'relatorio-teorema/1.0' } });
    if (res.status === 401 && tentativa === 0) continue;
    if (!res.ok) {
      let corpo = '';
      try { corpo = (await res.text()).replace(/\s+/g, ' ').slice(0, 200); } catch (e) { /* sem detalhe */ }
      throw new Error('a Hotmart respondeu ' + res.status + (corpo ? ': ' + corpo : '') + ' [' + q.toString().replace(/page_token=[^&]*/, 'page_token=…').slice(0, 160) + ']');
    }
    return res.json();
  }
  throw new Error('a Hotmart recusou o acesso');
}

// Diagnóstico (só beta): roda pedidos diferentes à Hotmart, de dentro do Cloudflare, pra descobrir qual formato ela recusa.
async function diagnosticoHotmart(env) {
  const out = [];
  let token;
  try { token = await tokenHotmart(env, true); out.push('token novo: ok'); } catch (e) { return ['token novo: FALHOU ' + String((e && e.message) || e).slice(0, 160)]; }
  const tenta = async (rot, pares, extra) => {
    const q = new URLSearchParams(pares);
    try {
      const res = await fetch(GERAL.api + '/payments/api/v1/sales/history?' + q.toString(), { headers: Object.assign({ Authorization: 'Bearer ' + token }, extra || {}) });
      const txt = res.ok ? '' : ' ' + (await res.text()).replace(/\s+/g, ' ').slice(0, 90);
      out.push(rot + ': ' + res.status + txt);
    } catch (e) { out.push(rot + ': erro ' + String((e && e.message) || e).slice(0, 100)); }
  };
  const d1 = String(Date.UTC(2021, 0, 1, 3)), d2 = String(Date.UTC(2021, 1, 1, 3) - 1);
  const s1 = String(Date.UTC(2026, 8, 1, 3)), s2 = String(Date.now());
  await tenta('1) só max_results=1', [['max_results', '1']]);
  await tenta('2) datas jan/2021', [['start_date', d1], ['end_date', d2]]);
  await tenta('3) datas jan/2021 + max_results=200', [['start_date', d1], ['end_date', d2], ['max_results', '200']]);
  await tenta('4) + status APPROVED', [['start_date', d1], ['end_date', d2], ['max_results', '200'], ['transaction_status', 'APPROVED']]);
  await tenta('5) + status APPROVED e COMPLETE (repetido)', [['start_date', d1], ['end_date', d2], ['max_results', '200'], ['transaction_status', 'APPROVED'], ['transaction_status', 'COMPLETE']]);
  await tenta('6) set/2026 até agora, com os dois status', [['start_date', s1], ['end_date', s2], ['max_results', '200'], ['transaction_status', 'APPROVED'], ['transaction_status', 'COMPLETE']]);
  await tenta('7) jan/2021 com Accept e User-Agent', [['start_date', d1], ['end_date', d2], ['max_results', '200']], { Accept: 'application/json', 'User-Agent': 'relatorio-teorema/1.0' });
  await tenta('8) ano 2021 inteiro', [['start_date', String(Date.UTC(2021, 0, 1))], ['end_date', String(Date.UTC(2021, 11, 31, 23, 59, 59))], ['max_results', '200']]);
  await tenta('9) últimos 5 dias', [['start_date', String(Date.now() - 5 * 86400000)], ['end_date', String(Date.now())], ['max_results', '200']]);
  return out;
}

// Uma página do histórico de vendas. Páginas de 200 (não 500) pra cada passo da cópia gastar pouco processamento do Worker.
async function paginaHotmart(env, deMs, ateMs, status, token) {
  const q = new URLSearchParams({ start_date: String(deMs), end_date: String(ateMs), max_results: '200' });
  status.forEach(s => q.append('transaction_status', s));
  if (token) q.set('page_token', token);
  const j = await chamarHotmart(env, '/payments/api/v1/sales/history', q);
  return { itens: j.items || [], proxima: (j.page_info && j.page_info.next_page_token) || null };
}

async function paginasHotmart(env, deMs, ateMs, status, maxPaginas) {
  const itens = [];
  let proxima = null, n = 0;
  do {
    const r = await paginaHotmart(env, deMs, ateMs, status, proxima);
    r.itens.forEach(i => itens.push(i));
    proxima = r.proxima;
    n++;
  } while (proxima && n < maxPaginas);
  return { itens, truncado: !!proxima };
}

// Uma venda da Hotmart vira uma linha do banco. Do comprador guarda só um código (hash do e-mail), pra cruzar com o ActiveCampaign.
async function linhaDeVenda(env, it) {
  const c = it.purchase || {};
  const ms = Number(c.approved_date || c.order_date) || 0;
  if (!c.transaction || !ms) return null;
  const d = new Date(ms - 3 * 3600 * 1000).toISOString();
  const nome = String((it.product && it.product.name) || '').trim().slice(0, 150);
  const cl = classificarProduto(nome);
  const valor = Number(c.price && c.price.value) || 0;
  const moeda = String((c.price && c.price.currency_code) || '?').slice(0, 5);
  const taxa = Number(c.hotmart_fee && c.hotmart_fee.total) || 0;
  const origem = String((c.tracking && c.tracking.source_sck) || '').slice(0, 200);
  const h = it.buyer && it.buyer.email ? await hashEmail(env, it.buyer.email) : null;
  const clique = classificarClique(origem);
  return [String(c.transaction), d.slice(0, 10), d.slice(0, 7), nome, cl.categoria, cl.escola, tipoVenda(c.recurrency_number), moeda, valor, valor - taxa, origem, h, clique.canal, clique.detalhe];
}

async function salvarVendas(env, linhas) {
  const por = 7; // 7 linhas x 14 colunas = 98 valores por comando (o D1 aceita até 100)
  const cmds = [];
  for (let i = 0; i < linhas.length; i += por) {
    const fatia = linhas.slice(i, i + por);
    cmds.push(env.DB.prepare('INSERT OR REPLACE INTO vendas (tx, dia, mes, produto, categoria, escola, tipo, moeda, valor, liquido, origem, comprador_h, clique, clique_det) VALUES ' + fatia.map(() => SQL_VENDAS_LINHA).join(',')).bind(...fatia.flat()));
  }
  for (let i = 0; i < cmds.length; i += 25) await env.DB.batch(cmds.slice(i, i + 25));
}

async function salvarItens(env, itens) {
  const linhas = (await Promise.all(itens.map(i => linhaDeVenda(env, i)))).filter(Boolean);
  if (linhas.length) await salvarVendas(env, linhas);
  return linhas.length;
}

async function sincronizarJanela(env, deMs, ateMs, maxPaginas) {
  const { itens, truncado } = await paginasHotmart(env, deMs, ateMs, ['APPROVED', 'COMPLETE'], maxPaginas || 4);
  return { n: await salvarItens(env, itens), truncado };
}

// Venda que depois foi reembolsada ou virou chargeback sai do banco.
async function limparReembolsos(env, deMs, ateMs) {
  const { itens } = await paginasHotmart(env, deMs, ateMs, ['REFUNDED', 'CHARGEBACK'], 4);
  const txs = itens.map(i => i.purchase && i.purchase.transaction).filter(Boolean).map(String);
  for (let i = 0; i < txs.length; i += 50) {
    const fatia = txs.slice(i, i + 50);
    await env.DB.prepare('DELETE FROM vendas WHERE tx IN (' + fatia.map(() => '?').join(',') + ')').bind(...fatia).run();
  }
}

const mesSeguinte = m => { const [a, n] = m.split('-').map(Number); return n === 12 ? (a + 1) + '-01' : a + '-' + String(n + 1).padStart(2, '0'); };
const janelaMes = m => { const [a, n] = m.split('-').map(Number); return [Date.UTC(a, n - 1, 1, 3), Date.UTC(a, n, 1, 3) - 1]; }; // de meia-noite a meia-noite de Brasília
const mesesEntre = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };

function statusGeral(est, atualizou) {
  const atual = hojeBRT().slice(0, 7);
  const total = mesesEntre(GERAL.primeiroMes, atual) + 1;
  const feitos = est.feito ? total : Math.max(0, Math.min(total, mesesEntre(GERAL.primeiroMes, est.cursor)));
  return { feito: !!est.feito, mes: est.cursor, progresso: Math.round(feitos / total * 100), recente: est.recente || null, aviso: est.aviso || null, erro: est.erro || null, atualizou: !!atualizou };
}

// Um passo da cópia: enquanto o histórico não terminou, traz uma ou mais páginas (até ~400 vendas, ou vários meses vazios) e guarda onde parou;
// depois, só os últimos 2 dias (no máximo a cada 10 minutos).
async function avancarGeral(env) {
  if (!env.DB || !env.REPORT_KV) return { erro: 'faltam o banco (DB) e o armazenamento (KV) no Worker' };
  let est = { cursor: GERAL.primeiroMes, feito: false, recente: null, token: null };
  let atualizou = false;
  try {
    await garantirTabelaVendas(env);
    est = JSON.parse((await env.REPORT_KV.get('geral:estado')) || 'null') || est;
    est.erro = null;
    const atual = hojeBRT().slice(0, 7);
    let voltas = 0, vendas = 0;
    while (!est.feito && voltas < 6 && vendas < 400) {
      const [ini, fim] = janelaMes(est.cursor);
      try {
        const r = await paginaHotmart(env, ini, fim, ['APPROVED', 'COMPLETE'], est.token);
        vendas += await salvarItens(env, r.itens);
        if (r.proxima) est.token = r.proxima;
        else { est.token = null; est.cursor = mesSeguinte(est.cursor); if (est.cursor > atual) est.feito = true; }
      } catch (e) {
        est.token = null; // a Hotmart pode ter esquecido a página; recomeça o mês (gravar de novo não duplica)
        throw e;
      }
      voltas++; atualizou = true;
    }
    if (est.feito && (!est.recente || Date.now() - Date.parse(est.recente) > 10 * 60 * 1000)) {
      const fim = Date.now();
      await sincronizarJanela(env, fim - 2 * 86400000, fim, 4);
      await limparReembolsos(env, fim - 90 * 86400000, fim);
      est.recente = new Date().toISOString();
      atualizou = true;
    }
  } catch (e) {
    est.erro = String((e && e.message) || e).slice(0, 420);
  }
  try { await env.REPORT_KV.put('geral:estado', JSON.stringify(est)); } catch (e) { /* segue */ }
  return statusGeral(est, atualizou);
}

// Gasto do Meta (com o imposto de 13,85%), por mês, da conta inteira.
async function gastoMeta(env, de, ate) {
  if (!env.META_ACCESS_TOKEN) return { ok: false, motivo: 'aguardando conexão do Meta' };
  const ini = de < GERAL.metaDesde ? GERAL.metaDesde : de;
  if (ini > ate) return { ok: true, total: 0, meses: {}, desde: GERAL.metaDesde };
  const chave = 'geral:meta:' + ini + ':' + ate;
  try {
    const guardado = await env.REPORT_KV.get(chave);
    if (guardado) { const g = JSON.parse(guardado); if (g.t > Date.now() - 10 * 60 * 1000) return g.v; }
  } catch (e) { /* lê de novo */ }
  try {
    const q = new URLSearchParams({ fields: 'spend', time_increment: 'monthly', time_range: JSON.stringify({ since: ini, until: ate }), limit: '200', access_token: env.META_ACCESS_TOKEN });
    const res = await fetch('https://graph.facebook.com/' + GLOBAL.meta.versao + '/act_' + GLOBAL.meta.contaId + '/insights?' + q.toString());
    const j = await res.json();
    if (!res.ok || j.error) return { ok: false, motivo: 'o Meta recusou a leitura' + (j.error && j.error.code ? ' (código ' + j.error.code + ')' : '') };
    const meses = {};
    let total = 0;
    (j.data || []).forEach(d => { const v = (parseFloat(d.spend) || 0) * (1 + GLOBAL.impostoMeta); const m = String(d.date_start || '').slice(0, 7); if (m) { meses[m] = (meses[m] || 0) + v; total += v; } });
    const v = { ok: true, total, meses, desde: GERAL.metaDesde };
    try { await env.REPORT_KV.put(chave, JSON.stringify({ t: Date.now(), v }), { expirationTtl: 900 }); } catch (e) { /* segue */ }
    return v;
  } catch (e) {
    return { ok: false, motivo: 'não consegui falar com o Meta agora' };
  }
}

// Gasto do Google: o que o script "Relatórios TM" mandou (todas as campanhas da conta), por mês.
async function gastoGoogle(env, de, ate) {
  const conta = OPERACOES[Object.keys(OPERACOES)[0]].googleConta;
  const bruto = env.REPORT_KV ? await env.REPORT_KV.get('google-ads:' + conta) : null;
  if (!bruto) return { ok: false, motivo: 'o Google ainda não enviou dados' };
  let g;
  try { g = JSON.parse(bruto); } catch (e) { return { ok: false, motivo: 'os dados do Google estão ilegíveis' }; }
  const rows = g.rows || [];
  const meses = {};
  let total = 0, desde = null;
  rows.forEach(r => { if (r.date && (!desde || r.date < desde)) desde = r.date; if (r.date >= de && r.date <= ate) { const m = r.date.slice(0, 7); meses[m] = (meses[m] || 0) + r.cost; total += r.cost; } });
  return { ok: true, total, meses, desde, enviadoEm: g.sentAt || null };
}

function periodoGeral(url) {
  const hoje = hojeBRT();
  const valida = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !isNaN(new Date(v + 'T00:00:00Z')) ? v : null);
  let de = valida(url.searchParams.get('de')) || hoje.slice(0, 8) + '01';
  let ate = valida(url.searchParams.get('ate')) || hoje;
  if (de < GERAL.primeiroMes + '-01') de = GERAL.primeiroMes + '-01';
  if (ate > hoje) ate = hoje;
  if (de > ate) de = ate;
  return { de, ate, escola: String(url.searchParams.get('escola') || '').trim().slice(0, 40) };
}

// De onde veio o lead que comprou (ActiveCampaign, cruzado pelo e-mail da compra), os públicos dos anúncios pagos e de onde veio o clique da compra (Hotmart).
const SQL_ORIGEM_CAPTACAO = "SELECT COALESCE(c.canal, 'nao_achado') AS k, COUNT(*) AS n, SUM(v.valor) AS bruto, SUM(v.liquido) AS liq FROM vendas v LEFT JOIN contatos c ON c.h = v.comprador_h WHERE v.dia >= ?1 AND v.dia <= ?2 AND v.moeda = 'BRL' AND (?3 = '' OR v.escola = ?3) GROUP BY COALESCE(c.canal, 'nao_achado') ORDER BY bruto DESC";
const SQL_PUBLICOS_PAGOS = "SELECT c.canal AS canal, c.detalhe AS k, COUNT(*) AS n, SUM(v.valor) AS bruto, SUM(v.liquido) AS liq FROM vendas v JOIN contatos c ON c.h = v.comprador_h WHERE v.dia >= ?1 AND v.dia <= ?2 AND v.moeda = 'BRL' AND (?3 = '' OR v.escola = ?3) AND c.canal IN ('meta', 'youtube_ads') GROUP BY c.canal, c.detalhe ORDER BY bruto DESC LIMIT 15";
const SQL_ORIGEM_CLIQUE = "SELECT COALESCE(clique, 'sem_registro') AS k, COUNT(*) AS n, SUM(valor) AS bruto, SUM(liquido) AS liq " + SQL_VENDAS_BASE + " GROUP BY COALESCE(clique, 'sem_registro') ORDER BY bruto DESC";
const SQL_CLIQUE_DETALHE = "SELECT COALESCE(clique, 'sem_registro') AS canal, COALESCE(clique_det, '') AS k, COUNT(*) AS n, SUM(valor) AS bruto, SUM(liquido) AS liq " + SQL_VENDAS_BASE + " AND COALESCE(clique, 'sem_registro') <> 'sem_registro' GROUP BY COALESCE(clique, 'sem_registro'), COALESCE(clique_det, '') ORDER BY n DESC LIMIT 30";
const SQL_ESCOLAS_LISTA = 'SELECT escola AS k, COUNT(*) AS n FROM vendas WHERE escola IS NOT NULL GROUP BY escola ORDER BY n DESC';
const SQL_CONTATOS_RESUMO = 'SELECT COUNT(*) AS n, MAX(atualizado) AS ate FROM contatos';

async function dadosGeral(env, per, ctx) {
  if (!env.DB) return { erro: 'o banco (DB) não está ligado ao Worker' };
  await garantirTabelaVendas(env);
  const esc = per.escola || '';
  // Contatos novos do ActiveCampaign entram em segundo plano (a página não espera por isso).
  const atualizando = atualizarContatosRecentes(env);
  if (ctx && ctx.waitUntil) ctx.waitUntil(atualizando); else await atualizando;
  const lista = async (col, ordem, limite) => ((await env.DB.prepare(sqlGrupo(col, ordem, limite)).bind(per.de, per.ate, esc).all()).results || []).map(r => ({ k: r.k, n: Number(r.n) || 0, bruto: Number(r.bruto) || 0, liq: Number(r.liq) || 0 }));
  const [categorias, escolas, tipos, meses, produtos, tot, moedas, lim, estado, anosRaw] = await Promise.all([
    lista('categoria', 'bruto DESC'),
    lista("CASE WHEN categoria = 'Full' THEN escola END", 'bruto DESC'),
    lista('tipo', 'bruto DESC'),
    lista('mes', 'k'),
    lista('produto', 'bruto DESC', 12),
    env.DB.prepare('SELECT COUNT(*) AS n, SUM(valor) AS bruto, SUM(liquido) AS liq ' + SQL_VENDAS_BASE).bind(per.de, per.ate, esc).first(),
    env.DB.prepare("SELECT moeda AS k, COUNT(*) AS n, SUM(valor) AS bruto FROM vendas WHERE dia >= ?1 AND dia <= ?2 AND moeda <> 'BRL' AND (?3 = '' OR escola = ?3) GROUP BY moeda ORDER BY n DESC").bind(per.de, per.ate, esc).all(),
    env.DB.prepare('SELECT MIN(dia) AS de, MAX(dia) AS ate, COUNT(*) AS n FROM vendas').first(),
    env.REPORT_KV ? env.REPORT_KV.get('geral:estado') : null,
    env.DB.prepare(SQL_VENDAS_ANOS).bind(per.de.slice(5), per.ate.slice(5), esc).all()
  ]);
  const consulta = async (sql, ...args) => ((await env.DB.prepare(sql).bind(...args).all()).results || []);
  const num = r => ({ k: r.k, n: Number(r.n) || 0, bruto: Number(r.bruto) || 0, liq: Number(r.liq) || 0 });
  const [origemCaptacao, publicosPagos, origemClique, cliqueDetalhe, escolasLista, resumoContatos] = await Promise.all([
    consulta(SQL_ORIGEM_CAPTACAO, per.de, per.ate, esc).then(l => l.map(num)),
    consulta(SQL_PUBLICOS_PAGOS, per.de, per.ate, esc).then(l => l.map(r => Object.assign(num(r), { canal: r.canal }))),
    consulta(SQL_ORIGEM_CLIQUE, per.de, per.ate, esc).then(l => l.map(num)),
    consulta(SQL_CLIQUE_DETALHE, per.de, per.ate, esc).then(l => l.map(r => Object.assign(num(r), { canal: r.canal }))),
    consulta(SQL_ESCOLAS_LISTA).then(l => l.map(r => ({ k: r.k, n: Number(r.n) || 0 }))),
    env.DB.prepare(SQL_CONTATOS_RESUMO).first()
  ]);
  const porAno = {};
  ((anosRaw && anosRaw.results) || []).forEach(r => {
    const a = porAno[r.ano] = porAno[r.ano] || { ano: r.ano, n: 0, bruto: 0, liq: 0, cat: {} };
    a.n += Number(r.n) || 0; a.bruto += Number(r.bruto) || 0; a.liq += Number(r.liq) || 0; a.cat[r.cat] = Number(r.n) || 0;
  });
  const anos = Object.keys(porAno).sort().map(k => porAno[k]);
  const [meta, google] = await Promise.all([gastoMeta(env, per.de, per.ate), gastoGoogle(env, per.de, per.ate)]);
  const invest = (meta.ok ? meta.total : 0) + (google.ok ? google.total : 0);
  const mesesInv = {};
  [meta, google].forEach(f => { if (f.ok) for (const m of Object.keys(f.meses)) mesesInv[m] = (mesesInv[m] || 0) + f.meses[m]; });
  let est = { cursor: GERAL.primeiroMes, feito: false };
  try { est = JSON.parse(estado) || est; } catch (e) { /* estado ainda não existe */ }
  return {
    periodo: per, hoje: hojeBRT(), geradoEm: new Date().toISOString(),
    total: { n: Number(tot && tot.n) || 0, bruto: Number(tot && tot.bruto) || 0, liq: Number(tot && tot.liq) || 0 },
    categorias, escolas: escolas.filter(e => e.k), tipos, meses, produtos, anos,
    origemCaptacao, publicosPagos, origemClique, cliqueDetalhe, escolasLista,
    contatos: { n: Number(resumoContatos && resumoContatos.n) || 0, ate: (resumoContatos && resumoContatos.ate) || null },
    moedas: ((moedas && moedas.results) || []).map(r => ({ moeda: r.k, n: Number(r.n) || 0, valor: Number(r.bruto) || 0 })),
    banco: { de: lim && lim.de, ate: lim && lim.ate, n: Number(lim && lim.n) || 0 },
    investimento: { total: invest, meta, google, meses: mesesInv },
    sync: statusGeral(est, false),
    atualizadoEm: est.recente || null
  };
}

const PAGINA_GERAL = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Visão geral — Relatórios</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { __TEMA__ }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Titillium Web',sans-serif; padding:32px 16px 64px; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1,h2,.num { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
  header { border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:22px; }
  .tag { font-size:12px; letter-spacing:0.15em; color:var(--accent); font-weight:700; text-transform:uppercase; }
  header h1 { font-size:clamp(32px,5vw,52px); line-height:1; margin-top:4px; }
  .periodo { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 6px; font-size:13px; }
  .periodo .rot { color:var(--text-weak); text-transform:uppercase; letter-spacing:.08em; font-size:11px; margin-right:4px; }
  .periodo button { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:999px; padding:7px 14px; font:inherit; cursor:pointer; }
  .periodo button.on { background:var(--accent); color:var(--bg); border-color:var(--accent); font-weight:700; }
  .periodo input { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:8px; padding:6px 8px; font:inherit; color-scheme:dark; }
  .custom { display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap; color:var(--text-weak); }
  .sync { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin:12px 0 0; font-size:14px; color:var(--text-weak); }
  .sync .barra { height:6px; background:var(--line); border-radius:3px; margin-top:8px; overflow:hidden; }
  .sync .barra i { display:block; height:100%; background:var(--accent); }
  .sync.erro { border-color:#F87171; color:#F87171; }
  .section-title { font-size:22px; margin:36px 0 14px; padding-left:12px; border-left:4px solid var(--accent); }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; }
  .kpi .label { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .kpi .num { font-size:32px; color:var(--accent); margin-top:6px; }
  .kpi .sub { font-size:12px; color:var(--text-weak); margin-top:4px; line-height:1.4; }
  .kpi.destaque { border-color:var(--accent); }
  .rolar { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
  table { width:100%; border-collapse:collapse; background:var(--card); font-size:14px; }
  th,td { padding:11px 14px; border-bottom:1px solid var(--line); text-align:left; }
  th { background:#000; color:var(--accent); font-size:11px; text-transform:uppercase; letter-spacing:.06em; }
  .c { text-align:right; font-variant-numeric:tabular-nums; }
  tr.total td { font-weight:700; color:var(--accent); }
  tr:last-child td { border-bottom:0; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:760px) { .two-col { grid-template-columns:1fr; } }
  .note { font-size:13px; color:var(--text-weak); background:var(--card); border-left:3px solid var(--accent); padding:12px 16px; border-radius:4px; margin-top:12px; line-height:1.5; }
  .vazio { color:var(--text-weak); padding:14px; }
</style>
</head>
<body>
<div class="wrap">
  <header><div class="tag">Teorema Militar · todas as escolas · beta</div><h1>Visão geral</h1></header>
  <div id="barra"></div>
  <div id="sync"></div>
  <div id="app"><div class="sync">Carregando…</div></div>
</div>
<script>
(function () {
  var app = document.getElementById('app'), barra = document.getElementById('barra'), syncEl = document.getElementById('sync');
  var hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  var qs = new URLSearchParams(location.search);
  var per = { de: qs.get('de') || hoje.slice(0, 8) + '01', ate: qs.get('ate') || hoje, escola: qs.get('escola') || '' };
  var escolasOpc = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n0(v) { return Number(v || 0).toLocaleString('pt-BR'); }
  function brl(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function brl0(v) { return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }); }
  function fdia(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function fmes(m) { var p = String(m || '').split('-'); return p.length === 2 ? p[1] + '/' + p[0] : ''; }
  function roas(b, i) { return i > 0 ? (b / i).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x' : '—'; }
  var CAT = ['Full', 'Combo', 'Avulso', 'Outros'];
  var TIPO = { nova: 'Primeira compra', renovacao: 'Renovação' };

  function iso(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function presets() {
    var y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
    var pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
    var ultimo = new Date(Date.UTC(py, pm, 0)).getUTCDate();
    return [['Este mês', hoje.slice(0, 8) + '01', hoje], ['Mês passado', iso(py, pm, 1), iso(py, pm, ultimo)], ['Este ano', y + '-01-01', hoje], ['Ano passado', (y - 1) + '-01-01', (y - 1) + '-12-31'], ['Tudo', '2021-01-01', hoje]];
  }
  function desenharBarra() {
    var achou = false;
    var opcoes = '<option value="">Todas</option>' + escolasOpc.map(function (e) { return '<option value="' + esc(e.k) + '"' + (per.escola === e.k ? ' selected' : '') + '>' + esc(e.k) + '</option>'; }).join('');
    if (per.escola && !escolasOpc.some(function (e) { return e.k === per.escola; })) opcoes += '<option value="' + esc(per.escola) + '" selected>' + esc(per.escola) + '</option>';
    var bots = presets().map(function (p, i) {
      var on = per.de === p[1] && per.ate === p[2]; if (on) achou = true;
      return '<button type="button" data-i="' + i + '"' + (on ? ' class="on"' : '') + '>' + esc(p[0]) + '</button>';
    }).join('');
    barra.innerHTML = '<div class="periodo"><span class="rot">Escola</span><select id="pesc">' + opcoes + '</select><span class="rot" style="margin-left:10px">Período</span>' + bots +
      '<span class="custom">De <input type="date" id="pde" value="' + esc(per.de) + '" min="2021-01-01" max="' + esc(hoje) + '"> até <input type="date" id="pate" value="' + esc(per.ate) + '" min="2021-01-01" max="' + esc(hoje) + '"> <button type="button" data-i="ok"' + (achou ? '' : ' class="on"') + '>Aplicar</button></span></div>';
  }
  barra.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-i]') : null; if (!b) return;
    var i = b.getAttribute('data-i');
    if (i === 'ok') { var de = document.getElementById('pde').value, ate = document.getElementById('pate').value; if (!de || !ate) return; per = { de: de, ate: ate, escola: per.escola }; }
    else { var p = presets()[Number(i)]; per = { de: p[1], ate: p[2], escola: per.escola }; }
    guardarEndereco();
    dados();
  });
  barra.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'pesc') { per.escola = e.target.value; guardarEndereco(); dados(); }
  });
  function guardarEndereco() {
    try { history.replaceState(null, '', location.pathname + '?embed=1&de=' + per.de + '&ate=' + per.ate + (per.escola ? '&escola=' + encodeURIComponent(per.escola) : '')); } catch (er) { /* segue */ }
  }

  function tab(cols, linhas, rodape) {
    var cab = cols.map(function (c, i) { return '<th' + (i ? ' class="c"' : '') + '>' + esc(c) + '</th>'; }).join('');
    var corpo = linhas.map(function (l) { return '<tr>' + l.map(function (c, i) { return '<td' + (i ? ' class="c"' : '') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('');
    if (rodape) corpo += '<tr class="total">' + rodape.map(function (c, i) { return '<td' + (i ? ' class="c"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    return '<div class="rolar"><table><thead><tr>' + cab + '</tr></thead><tbody>' + corpo + '</tbody></table></div>';
  }
  function grupo(lista, rotulo, tot, nomeTotal, semTotal) {
    if (!lista.length) return '<div class="vazio">Sem vendas neste período.</div>';
    var linhas = lista.map(function (x) { return [esc(rotulo(x.k)), n0(x.n), brl(x.bruto), brl(x.liq), x.n ? brl(x.bruto / x.n) : '—', tot.bruto ? (x.bruto / tot.bruto * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—']; });
    return tab([rotulo.titulo || 'Grupo', 'Vendas', 'Bruto', 'Líquido', 'Ticket médio', '% do total'], linhas, semTotal ? null : [nomeTotal || 'Total', n0(tot.n), brl(tot.bruto), brl(tot.liq), tot.n ? brl(tot.bruto / tot.n) : '—', '100%']);
  }
  function rot(titulo, fn) { var f = fn || function (k) { return k; }; f.titulo = titulo; return f; }

  function render(d) {
    var T = d.total, I = d.investimento, avisos = '';
    if (!I.meta.ok) avisos += '<div class="note">Meta: ' + esc(I.meta.motivo) + '.</div>';
    if (!I.google.ok) avisos += '<div class="note">Google: ' + esc(I.google.motivo) + '.</div>';
    else if (I.google.desde && I.google.desde > d.periodo.de) avisos += '<div class="note">O Google só tem dados a partir de ' + esc(fdia(I.google.desde)) + '; antes disso o investimento em Google não entra na conta.</div>';
    if (I.meta.ok && I.meta.desde > d.periodo.de) avisos += '<div class="note">O Meta só devolve gasto a partir de ' + esc(fdia(I.meta.desde)) + '.</div>';
    var esc1 = d.periodo.escola || '';
    var h = '<div class="section-title">Resultado' + (esc1 ? ' — ' + esc(esc1) : '') + ' de ' + esc(fdia(d.periodo.de)) + ' a ' + esc(fdia(d.periodo.ate)) + '</div><div class="kpi-grid">' +
      '<div class="kpi destaque"><div class="label">Faturamento bruto</div><div class="num">' + brl0(T.bruto) + '</div><div class="sub">' + n0(T.n) + ' vendas · ticket médio ' + (T.n ? brl0(T.bruto / T.n) : '—') + '</div></div>' +
      '<div class="kpi"><div class="label">Faturamento líquido</div><div class="num">' + brl0(T.liq) + '</div><div class="sub">bruto menos a taxa da Hotmart</div></div>' +
      '<div class="kpi"><div class="label">Investimento (Meta + Google)</div><div class="num">' + brl0(I.total) + '</div><div class="sub">Meta c/ imposto ' + (I.meta.ok ? brl0(I.meta.total) : '—') + ' · Google ' + (I.google.ok ? brl0(I.google.total) : '—') + '</div></div>' +
      '<div class="kpi destaque"><div class="label">ROAS ' + (esc1 ? 'da escola' : 'geral') + '</div><div class="num">' + (esc1 ? '—' : roas(T.bruto, I.total)) + '</div><div class="sub">' + (esc1 ? 'o investimento é da conta inteira: escolha &quot;Todas&quot; pra ver o ROAS' : 'bruto ÷ investimento (todas as escolas)') + '</div></div></div>' + avisos +
      '<div class="note">Bruto é o valor pago pelo comprador (inclui juros do parcelamento) e só soma vendas em reais. O faturamento inclui renovações e todos os produtos; o investimento é o da conta inteira, sem dividir por escola.</div>';
    var porTipo = d.tipos.slice().sort(function (a, b) { return ['nova', 'renovacao'].indexOf(a.k) - ['nova', 'renovacao'].indexOf(b.k); });
    var cats = d.categorias.slice().sort(function (a, b) { return CAT.indexOf(a.k) - CAT.indexOf(b.k); });
    h += '<div class="section-title">Por categoria de produto</div>' + grupo(cats, rot('Categoria'), T);
    var full = cats.filter(function (x) { return x.k === 'Full'; })[0] || { n: 0, bruto: 0, liq: 0 };
    // Origem da venda, em duas leituras separadas (não são a mesma coisa): de onde veio o LEAD e de onde veio o CLIQUE da compra.
    var ROT_CAP = { meta: 'Meta Ads (anúncio pago)', youtube_ads: 'YouTube Ads (anúncio pago)', instagram: 'Instagram orgânico', youtube: 'YouTube orgânico', direto: 'Direto (digitou o link)', sem_origem: 'Lead sem UTM (origem não registrada)', outro: 'Outras origens', nao_achado: 'Comprador não encontrado no ActiveCampaign' };
    var ROT_CLI = { meta: 'Meta Ads', youtube_ads: 'YouTube Ads', instagram: 'Instagram', youtube: 'YouTube', linktree: 'Linktree (link da bio)', busca: 'Busca (Google, Bing...)', site: 'Site do Teorema', hotmart: 'Hotmart (área de membros)', direto: 'Direto (sem origem no clique)', whatsapp: 'WhatsApp', email: 'E-mail', sem_registro: 'Sem registro no checkout', outro: 'Outros' };
    var naoAch = d.origemCaptacao.filter(function (x) { return x.k === 'nao_achado'; })[0] || { n: 0, bruto: 0 };
    var achouPct = T.n ? ((T.n - naoAch.n) / T.n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%' : '—';
    h += '<div class="section-title">De onde veio o lead que comprou</div>' +
      (d.contatos.n ? '' : '<div class="note" style="margin:0 0 12px">Os contatos do ActiveCampaign ainda não foram carregados, então nada foi cruzado. Falta a carga de contatos.</div>') +
      '<div class="note" style="margin:0 0 12px">Cruzamento pelo e-mail da compra com os contatos do ActiveCampaign (' + n0(d.contatos.n) + ' contatos). Achamos o comprador em ' + achouPct + ' das vendas. A origem é a da última vez que o lead se cadastrou: o ActiveCampaign sobrescreve, e ainda não guarda a primeira origem.</div>' +
      grupo(d.origemCaptacao, rot('Origem do lead', function (k) { return ROT_CAP[k] || k; }), T);
    if (d.publicosPagos.length) h += '<div class="section-title">Públicos dos anúncios pagos que venderam</div>' + grupo(d.publicosPagos.map(function (x) { return { k: (x.canal === 'meta' ? 'Meta Ads' : 'YouTube Ads') + ' · ' + x.k, n: x.n, bruto: x.bruto, liq: x.liq }; }), rot('Anúncio · público'), T, null, true);
    h += '<div class="section-title">De onde veio o clique da compra</div><div class="note" style="margin:0 0 12px">Esta leitura vem da Hotmart e mostra o último clique antes de pagar (origem do checkout). Ela não diz de onde o lead veio: quem comprou depois de pesquisar no Google, por exemplo, já era lead de outro canal.</div>' +
      grupo(d.origemClique, rot('Origem do clique', function (k) { return ROT_CLI[k] || k; }), T);
    if (d.cliqueDetalhe && d.cliqueDetalhe.length) h += '<div class="note" style="margin:14px 0 12px">Detalhe do clique: o que vem depois do canal no link (o conteúdo, como bio ou stories; nos anúncios do Meta, o nome do público). Os 30 maiores.</div>' +
      grupo(d.cliqueDetalhe.map(function (x) { return { k: (ROT_CLI[x.canal] || x.canal) + (x.k ? ' · ' + x.k : ' · sem detalhe'), n: x.n, bruto: x.bruto, liq: x.liq }; }), rot('Canal · detalhe'), T, null, true);
    if (!esc1) h += '<div class="section-title">Full por escola</div>' + grupo(d.escolas, rot('Escola'), full, 'Total Full');
    h += '<div class="section-title">Primeira compra e renovação</div>' + grupo(porTipo, rot('Tipo', function (k) { return TIPO[k] || k; }), T);
    h += '<div class="section-title">Produtos mais vendidos</div>' + grupo(d.produtos, rot('Produto'), T, null, true);
    var meses = d.meses.map(function (m) { var inv = I.meses[m.k] || 0; return [esc(fmes(m.k)), n0(m.n), brl(m.bruto), inv ? brl(inv) : '—', roas(m.bruto, inv)]; });
    var anoAtual = d.hoje.slice(0, 4);
    var linhasAnos = d.anos.map(function (a, i) {
      var ant = i ? d.anos[i - 1] : null;
      var v = ant && ant.n ? ((a.n - ant.n) / ant.n * 100) : null;
      var vTxt = v == null ? '—' : (v > 0 ? '+' : '') + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%';
      return [esc(a.ano) + (a.ano === anoAtual ? ' (em andamento)' : ''), n0(a.n), vTxt, brl(a.bruto), brl(a.liq), a.n ? brl(a.bruto / a.n) : '—', n0(a.cat.Full || 0), n0(a.cat.Combo || 0), n0(a.cat.Avulso || 0), n0(a.cat.Outros || 0)];
    });
    h += '<div class="section-title">Comparação entre anos</div><div class="note" style="margin:0 0 12px">Mesmo trecho do calendário em cada ano: de ' + esc(fdia(d.periodo.de).slice(0, 5)) + ' a ' + esc(fdia(d.periodo.ate).slice(0, 5)) + '. Muda junto com o período escolhido lá em cima (por exemplo, &quot;Este mês&quot; compara setembro até hoje em todos os anos).</div>' +
      (linhasAnos.length ? tab(['Ano', 'Vendas', 'vs ano anterior', 'Bruto', 'Líquido', 'Ticket médio', 'Full', 'Combo', 'Avulso', 'Outros'], linhasAnos) : '<div class="vazio">Sem vendas nesse trecho do calendário.</div>');
    h += '<div class="section-title">Mês a mês</div>' + (meses.length ? tab(['Mês', 'Vendas', 'Bruto', 'Investimento', 'ROAS'], meses) : '<div class="vazio">Sem vendas neste período.</div>');
    if (d.moedas.length) h += '<div class="note">Vendas em outras moedas (fora dos totais acima): ' + d.moedas.map(function (m) { return n0(m.n) + ' em ' + esc(m.moeda); }).join(', ') + '.</div>';
    if (d.banco.n) h += '<div class="note">Base de vendas copiada da Hotmart: ' + n0(d.banco.n) + ' vendas, de ' + esc(fdia(d.banco.de)) + ' a ' + esc(fdia(d.banco.ate)) + '.</div>';
    app.innerHTML = h;
  }

  function chamar(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { (window.top || window).location.href = '/entrar?volta=' + encodeURIComponent('/geral'); throw new Error('Sessão expirada. Entre de novo.'); }
      return r.json();
    });
  }
  function dados() {
    desenharBarra();
    return chamar('/api/geral/data?de=' + per.de + '&ate=' + per.ate + '&escola=' + encodeURIComponent(per.escola)).then(function (d) {
      if (d.erro) throw new Error(d.erro);
      escolasOpc = d.escolasLista || [];
      desenharBarra();
      render(d);
      var a = d.atualizadoEm ? new Date(d.atualizadoEm) : null;
      syncEl.innerHTML = a
        ? '<div class="sync">Vendas da Hotmart atualizadas em ' + a.toLocaleDateString('pt-BR') + ' às ' + a.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.</div>'
        : '<div class="sync">Ainda não chegaram vendas da Hotmart. Elas entram pela carga inicial e, depois, pelo script de hora em hora.</div>';
    }).catch(function (e) { app.innerHTML = '<div class="sync erro">' + esc(e.message) + '</div>'; });
  }
  dados();})();
</script>
</body>
</html>`;

function paginaGeral() {
  const t = HUB.tema;
  return PAGINA_GERAL.replace('__TEMA__', '--bg:' + COR(t.bg) + '; --card:' + COR(t.card) + '; --line:' + COR(t.line) + '; --accent:' + COR(t.accent) + '; --text-weak:' + COR(t.textWeak) + '; --text:' + COR(t.text) + ';');
}
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; base-uri 'none'; form-action 'none'";

// Endereços:
//   /                          lista das operações
//   /<operacao>                relatório da operação
//   /api/<operacao>/data       dados do relatório (a página usa)
//   <pesquisa.caminho>         formulário da pesquisa (PÚBLICO, sem senha; ex.: /espcex-27/pesquisa no site do Teorema)
//   POST <pesquisa.caminho>    envio do formulário (público, no mesmo caminho)
//   /<operacao>/pesquisa e POST /api/<operacao>/pesquisa   caminho alternativo, também público (só mostra o formulário)
//   /api/<operacao>/pesquisa.csv    todas as respostas em planilha (com senha)
//   POST /api/google-ads       script do Google Ads (manda todas as campanhas da conta)
//   POST /api/whatsapp?op=...  webhook do DevZapp
//   POST /api/visita           aviso do site a cada origem nova do visitante (PÚBLICO; trilha do lead; rota `teoremamilitar.com.br/api/visita`)
//   /api/visitas/resumo        conferência da trilha (com senha, mesma permissão da Visão geral)
//   POST /api/hotmart-webhook?k=...   aviso da Hotmart (compra aprovada, reembolso...); GET /api/hotmart-amostras = como os avisos chegaram (com senha)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    const html = (corpo, csp) => new Response(corpo, { headers: { ...CABECALHOS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': csp || CSP } });
    // Caminho público do formulário de alguma operação (ex.: /espcex-27/pesquisa, no site do Teorema).
    const opPublica = Object.keys(OPERACOES).concat(Object.keys(ARQUIVO)).find(s => { const o = OPERACOES[s] || ARQUIVO[s]; return o.pesquisa && o.pesquisa.caminho === p; });
    try {
      if (opPublica) {
        if (request.method === 'GET') return html(paginaPesquisa(contextoPesquisa(opPublica)));
        if (request.method === 'POST') return await receberResposta(request, env, contextoPesquisa(opPublica));
        return json({ erro: 'método não permitido' }, 405);
      }
      if (request.method === 'POST') {
        if (p === '/entrar') return await entrar(request, env, CSP);
        if (p === '/api/google-ads') return await receberGoogle(request, env);
        if (p === '/api/hotmart-vendas') return await receberVendasHotmart(request, env);
        if (p === '/api/hotmart-token') return await entregarTokenHotmart(request, env);
        if (p === '/api/hotmart-webhook') return await receberWebhookHotmart(request, env, url);
        if (p === '/api/ac-contatos') return await receberContatosAC(request, env);
        if (p === '/api/whatsapp') return await receberWhatsapp(request, env, url);
        if (p === '/api/visita') return await receberVisita(request, env, ctx);
        const envio = p.match(/^\/api\/([a-z0-9-]+)\/pesquisa$/);
        if (envio) {
          const c = contextoPesquisa(envio[1]);
          return c ? await receberResposta(request, env, c) : json({ erro: 'operação não encontrada' }, 404);
        }
      }
      if (request.method !== 'GET') return json({ erro: 'método não permitido' }, 405);

      if (p === '/entrar') return respostaHtml(paginaEntrada(url.searchParams.get('volta'), ''), 200, CSP_ENTRADA(CSP));
      if (p === '/sair') return sair();

      const formulario = p.match(/^\/([a-z0-9-]+)\/pesquisa$/);
      if (formulario) {
        const c = contextoPesquisa(formulario[1]);
        return c ? html(paginaPesquisa(c)) : json({ erro: 'operação não encontrada' }, 404);
      }

      const api = p.match(/^\/api\/([a-z0-9-]+)\/(data|whatsapp-amostras|pesquisa\.csv)$/);
      const pagina = p.match(/^\/([a-z0-9-]+)$/);
      const hist = p.match(/^\/([a-z0-9-]+)\/historico$/);
      const apiGeral = p === '/api/geral/data' || p === '/api/geral/sincronizar' || p === '/api/geral/diagnostico' || p === '/api/visitas/resumo';
      const apiHotmartAmostras = p === '/api/hotmart-amostras'; // conferência do formato dos avisos da Hotmart (com senha; sem dados pessoais)
      if (p !== '/' && !api && !pagina && !hist && !apiGeral && !apiHotmartAmostras) return json({ erro: 'não encontrado' }, 404);
      if (!(await autorizado(request, env))) {
        // Páginas (e o arquivo de respostas, que se baixa clicando) levam à tela de entrada; os dados internos respondem 401.
        if ((!api && !apiGeral && !apiHotmartAmostras) || (api && api[2] === 'pesquisa.csv')) return new Response(null, { status: 302, headers: { ...CABECALHOS, Location: '/entrar?volta=' + encodeURIComponent(p) } });
        return pedirSenha();
      }

      if (apiHotmartAmostras) return json(await amostrasHotmart(env));
      const veGeral = await podeGeral(request, env);
      const veGerencial = await podeGerencial(request, env);
      if (p === '/') return html(paginaShell(null, veGeral, veGerencial), CSP_SHELL(CSP));
      // Relatório gerencial (retrato de 2023 até a data do bloco GERENCIAL_DADOS; em teste = só com a senha de teste).
      if (p === '/gerencial') {
        if (!veGerencial) return json({ erro: 'não encontrado' }, 404);
        return url.searchParams.get('embed') === '1' ? html(paginaGerencial()) : html(paginaShell('gerencial', veGeral, veGerencial), CSP_SHELL(CSP));
      }
      if ((p === '/geral' || apiGeral) && !veGeral) return json({ erro: 'não encontrado' }, 404);
      if (p === '/api/geral/data') { try { return json(await dadosGeral(env, periodoGeral(url), ctx)); } catch (e) { return json({ erro: 'Não consegui montar a visão geral agora. Tenta de novo em um minuto.' }, 502); } }
      if (p === '/api/geral/sincronizar') return json(await avancarGeral(env));
      if (p === '/api/geral/diagnostico') return json({ linhas: await diagnosticoHotmart(env) });
      if (p === '/api/visitas/resumo') return json(await resumoVisitas(env));
      if (p === '/geral') return url.searchParams.get('embed') === '1' ? html(paginaGeral()) : html(paginaShell('geral', veGeral, veGerencial), CSP_SHELL(CSP));
      if (hist) {
        const ch = contexto(hist[1]);
        if (!ch || !ch.historico) return json({ erro: 'não encontrado' }, 404);
        return url.searchParams.get('embed') === '1' ? html(paginaHistorico(ch)) : html(paginaShell(hist[1] + '/historico', veGeral, veGerencial), CSP_SHELL(CSP));
      }

      // ?embed=1 é o relatório puro (o que aparece dentro do menu lateral); sem isso, a página vem com o menu.
      const embed = url.searchParams.get('embed') === '1';
      const arquivado = pagina && Object.prototype.hasOwnProperty.call(ARQUIVO, pagina[1]) ? ARQUIVO[pagina[1]] : null;
      if (arquivado) return embed ? html(arquivado.pagina()) : html(paginaShell(pagina[1], veGeral, veGerencial), CSP_SHELL(CSP));

      // Respostas da pesquisa de operação encerrada (ex.: barro-branco-27): planilha com senha, sem passar pelo relatório vivo.
      if (api && api[2] === 'pesquisa.csv' && !Object.prototype.hasOwnProperty.call(OPERACOES, api[1])) {
        const cp = contextoPesquisa(api[1]);
        return cp ? await exportarRespostas(env, cp) : json({ erro: 'operação não encontrada' }, 404);
      }
      const cfg = contexto((api || pagina)[1]);
      if (!cfg) return json({ erro: 'operação não encontrada' }, 404);
      if (api && api[2] === 'whatsapp-amostras') {
        return json({ amostras: env.REPORT_KV ? JSON.parse((await env.REPORT_KV.get('whatsapp-amostras:' + cfg.slug)) || '[]') : [] });
      }
      if (api && api[2] === 'pesquisa.csv') return await exportarRespostas(env, cfg);
      if (api) {
        try { return json(await dadosComCache(env, cfg, url.searchParams.has('fresh'), periodoDe(url, cfg, hojeBRT()))); } catch (e) { return json({ erro: 'Não consegui ler o ActiveCampaign agora. Tenta de novo em um minuto.' }, 502); }
      }
      return embed ? html(paginaOperacao(cfg)) : html(paginaShell(cfg.slug, veGeral, veGerencial), CSP_SHELL(CSP));
    } catch (e) {
      return json({ erro: 'Algo deu errado do nosso lado.' }, 500);
    }
  }
};

// ================================================================ Relatório gerencial (retrato, beta)
// Investimento, leads e vendas de 2023 até a data do retrato: de onde veio o faturamento, por escola e por curso,
// o que cada captação vendeu, quanto tempo o lead leva pra comprar e se o público frio se paga.
// Não é painel diário: os números ficam em GERENCIAL_DADOS (bloco gerado no computador da Leili por
// clientes/teorema-militar/analise-leads-x-compradores/scripts/atualizar-gerencial.ps1). Refazer a cada 3 ou 6 meses.

function paginaGerencial() {
  const t = HUB.tema;
  const dados = JSON.stringify(GERENCIAL_DADOS).replace(/</g, '\\u003c');
  return PAGINA_GERENCIAL
    .replace('__TEMA__', '--bg:' + COR(t.bg) + '; --card:' + COR(t.card) + '; --line:' + COR(t.line) + '; --accent:' + COR(t.accent) + '; --text-weak:' + COR(t.textWeak) + '; --text:' + COR(t.text) + ';')
    .replace('__DADOS__', () => dados);
}

const PAGINA_GERENCIAL = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Relatório gerencial — Relatórios</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { __TEMA__
    /* séries (paleta categórica validada, passos do modo escuro, ordem fixa) */
    --s-frio:#3987e5; --s-pq:#d95926; --s-org:#199e70; --s-aluno:#c98500; --s-nao:#5f6a5c;
    --s-esp:#3987e5; --s-bb:#d95926; --s-mat:#199e70; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Titillium Web',sans-serif; padding:32px 16px 64px; line-height:1.45; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1,h2,.num { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
  header { border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:22px; }
  .tag { font-size:12px; letter-spacing:0.15em; color:var(--accent); font-weight:700; text-transform:uppercase; }
  header h1 { font-size:clamp(30px,5vw,50px); line-height:1; margin-top:4px; }
  header p { color:var(--text-weak); margin-top:10px; max-width:760px; }
  .section-title { font-size:22px; margin:40px 0 6px; padding-left:12px; border-left:4px solid var(--accent); }
  .lede { color:var(--text-weak); margin:0 0 14px 16px; max-width:820px; font-size:15px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; }
  .kpi .label { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .kpi .num { font-size:32px; color:var(--text); margin-top:6px; }
  .kpi .sub { font-size:13px; color:var(--text-weak); margin-top:4px; }
  .kpi.destaque { border-color:var(--accent); } .kpi.destaque .num { color:var(--accent); }
  .concl { list-style:none; display:grid; gap:10px; margin-top:14px; }
  .concl li { background:var(--card); border:1px solid var(--line); border-left:4px solid var(--accent); border-radius:8px; padding:14px 16px; }
  .concl b { color:var(--text); }
  .rolar { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:12px; }
  table { width:100%; border-collapse:collapse; background:var(--card); font-size:14px; }
  th,td { padding:10px 12px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
  th { background:#000; color:var(--accent); font-size:11px; text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; }
  .c { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .fraco { color:var(--text-weak); }
  tr.total td { font-weight:700; }
  tr:last-child td { border-bottom:0; }
  .note { font-size:13px; color:var(--text-weak); background:var(--card); border-left:3px solid var(--accent); padding:12px 16px; border-radius:4px; margin-top:12px; }
  .legenda { display:flex; flex-wrap:wrap; gap:6px 16px; margin:10px 0 4px; font-size:13px; color:var(--text-weak); }
  .legenda span { display:inline-flex; align-items:center; gap:6px; }
  .legenda i { width:12px; height:12px; border-radius:3px; display:inline-block; }
  .barras { display:grid; gap:10px; margin-top:8px; }
  .linha-barra { display:grid; grid-template-columns:90px 1fr 120px; gap:12px; align-items:center; font-size:14px; }
  .linha-barra .rot { color:var(--text); font-weight:600; }
  .linha-barra .tot { text-align:right; color:var(--text-weak); font-variant-numeric:tabular-nums; }
  .pilha { display:flex; gap:2px; height:26px; }
  .pilha div { height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff; overflow:hidden; white-space:nowrap; cursor:default; }
  .pilha div:first-child { border-radius:4px 0 0 4px; } .pilha div:last-child { border-radius:0 4px 4px 0; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(310px,1fr)); gap:12px; margin-top:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; }
  .card h3 { font-family:'Big Shoulders Display',sans-serif; text-transform:uppercase; font-size:22px; }
  .card .meta { color:var(--text-weak); font-size:13px; margin:2px 0 10px; }
  .mini { display:grid; grid-template-columns:1fr 60px; gap:4px 10px; font-size:13px; align-items:center; }
  .mini .b { height:10px; border-radius:0 4px 4px 0; background:var(--text-weak); opacity:.8; }
  .graficos { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:12px; }
  @media (max-width:760px) { .graficos { grid-template-columns:1fr; } .linha-barra { grid-template-columns:60px 1fr 90px; } }
  .graf { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 14px 8px; }
  .graf h4 { font-size:14px; color:var(--text); margin-bottom:6px; }
  .graf svg { width:100%; height:auto; display:block; }
  .graf text { fill:var(--text-weak); font-size:11px; font-family:'Titillium Web',sans-serif; }
  .graf .rotulo { fill:var(--text); font-weight:700; font-size:12px; }
  details { margin-top:10px; }
  summary { cursor:pointer; color:var(--accent); font-weight:600; font-size:14px; }
  #tip { position:fixed; pointer-events:none; background:#000; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font-size:13px; max-width:280px; z-index:10; display:none; line-height:1.35; }
  footer { margin-top:44px; color:var(--text-weak); font-size:13px; border-top:1px solid var(--line); padding-top:16px; }
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<div id="tip"></div>
<script>
var D = __DADOS__;
var ORIG = [
  { k:'frio', nome:'Lead de anúncio · público frio', cor:'var(--s-frio)' },
  { k:'pq', nome:'Lead de anúncio · público quente', cor:'var(--s-pq)' },
  { k:'org', nome:'Lead orgânico ou sem origem', cor:'var(--s-org)' },
  { k:'aluno', nome:'Já era aluno', cor:'var(--s-aluno)' },
  { k:'nao', nome:'Não achado como lead', cor:'var(--s-nao)' }
];
function grupos(o) { // junta as origens finas nos 5 grupos do relatório
  function s(ks, c) { var t = 0; ks.forEach(function (k) { t += (o[k] && o[k][c]) || 0; }); return t; }
  return { frio:{n:s(['frio'],'n'),fat:s(['frio'],'fat')}, pq:{n:s(['pq'],'n'),fat:s(['pq'],'fat')}, org:{n:s(['org','semorigem'],'n'),fat:s(['org','semorigem'],'fat')},
           aluno:{n:s(['aluno'],'n'),fat:s(['aluno'],'fat')}, nao:{n:s(['active','nunca'],'n'),fat:s(['active','nunca'],'fat')} };
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
function n0(v) { return Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits:0 }); }
function rs(v) { return 'R$ ' + n0(v); }
function rsk(v) { v = Number(v || 0); return v >= 1e6 ? 'R$ ' + (v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits:2 }) + ' mi' : v >= 1e3 ? 'R$ ' + (v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits:0 }) + ' mil' : rs(v); }
function pc(a, b, d) { return b ? (100 * a / b).toLocaleString('pt-BR', { maximumFractionDigits: d == null ? 0 : d }) + '%' : '—'; }
function x2(a, b) { return b ? (a / b).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) + 'x' : '—'; }
function soma(lista, f) { var t = 0; lista.forEach(function (x) { t += f(x) || 0; }); return t; }
function dataBR(s) { var p = String(s).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

function legenda(itens) { return '<div class="legenda">' + itens.map(function (i) { return '<span><i style="background:' + i.cor + '"></i>' + esc(i.nome) + '</span>'; }).join('') + '</div>'; }
function pilha(o, total, rotulo, direita) {
  var g = grupos(o);
  return '<div class="linha-barra"><div class="rot">' + esc(rotulo) + '</div><div class="pilha">' + ORIG.map(function (s) {
    var v = g[s.k].fat; if (!v) return ''; var p = 100 * v / total;
    return '<div style="flex:' + v + ';background:' + s.cor + '" data-tip="<b>' + esc(rotulo) + ' · ' + esc(s.nome) + '</b><br>' + rs(v) + ' (' + pc(v, total, 1) + ')<br>' + n0(g[s.k].n) + ' vendas">' + (p >= 8 ? Math.round(p) + '%' : '') + '</div>';
  }).join('') + '</div><div class="tot">' + esc(direita) + '</div></div>';
}

// gráfico de linhas: % dos leads que já compraram até X dias (só leads que já tiveram esse tempo na base)
function curvas(titulo, series) {
  var X = [30, 90, 180, 365, 730], W = 460, H = 230, L = 40, R = 90, T = 12, B = 30;
  var ymax = 0; series.forEach(function (s) { X.forEach(function (d) { var v = s.c['d' + d]; if (v != null && v > ymax) ymax = v; }); });
  ymax = Math.max(2, Math.ceil(ymax / 2) * 2);
  function px(i) { return L + i * (W - L - R) / (X.length - 1); }
  function py(v) { return T + (H - T - B) * (1 - v / ymax); }
  var g = '';
  for (var k = 0; k <= 4; k++) { var v = ymax * k / 4, y = py(v); g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + v.toLocaleString('pt-BR', { maximumFractionDigits:1 }) + '%</text>'; }
  var nomes = ['30 dias', '90 dias', '6 meses', '1 ano', '2 anos'];
  X.forEach(function (d, i) { g += '<text x="' + px(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + nomes[i] + '</text>'; });
  var rotY = [];
  series.forEach(function (s) {
    var pts = []; X.forEach(function (d, i) { var v = s.c['d' + d]; if (v != null) pts.push([px(i), py(v), v, nomes[i], s.c['n' + d]]); });
    if (!pts.length) return;
    g += '<polyline fill="none" stroke="' + s.cor + '" stroke-width="2" stroke-linejoin="round" points="' + pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ') + '"/>';
    pts.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + s.cor + '" stroke="var(--card)" stroke-width="2"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="12" fill="transparent" data-tip="<b>' + esc(s.nome) + ' · ' + p[3] + '</b><br>' + p[2].toLocaleString('pt-BR', { maximumFractionDigits:2 }) + '% já tinham comprado<br>(' + n0(p[4]) + ' leads com esse tempo de base)"/>'; });
    var u = pts[pts.length - 1]; rotY.push({ y:u[1], x:u[0], t:s.nome + ' ' + u[2].toLocaleString('pt-BR', { maximumFractionDigits:1 }) + '%' });
  });
  rotY.sort(function (a, b) { return a.y - b.y; }); for (var r = 1; r < rotY.length; r++) if (rotY[r].y - rotY[r - 1].y < 14) rotY[r].y = rotY[r - 1].y + 14;
  rotY.forEach(function (r) { g += '<text class="rotulo" x="' + (r.x + 8) + '" y="' + (r.y + 4) + '">' + esc(r.t) + '</text>'; });
  return '<div class="graf"><h4>' + esc(titulo) + '</h4>' + legenda(series.map(function (s) { return { nome:s.nome, cor:s.cor }; })) + '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(titulo) + '">' + g + '</svg></div>';
}

function montar() {
  var anos = D.anos, fatTot = soma(anos, function (a) { return a.fat; }), metaTot = soma(anos, function (a) { return a.meta; });
  var oTot = {}; ['frio','pq','org','semorigem','aluno','active','nunca'].forEach(function (k) { oTot[k] = { n:soma(anos, function (a) { return a.origem[k].n; }), fat:soma(anos, function (a) { return a.origem[k].fat; }) }; });
  var gT = grupos(oTot), anuncio = gT.frio.fat + gT.pq.fat, deLead = anuncio + gT.org.fat;
  var fr = D.frio, frG = soma(fr, function (f) { return f.gasto; }), frT = soma(fr, function (f) { return f.fatTotal; });
  var h = '';
  h += '<header><div class="tag">Relatório gerencial · beta · retrato de ' + dataBR(D.geradoEm) + '</div><h1>Investimento, leads e vendas<br>2023 a 2026</h1>' +
    '<p>De onde veio o faturamento do Teorema, quanto do que investimos em anúncio voltou em venda, e quanto tempo o aluno leva pra comprar depois de entrar na nossa base. ' +
    'É um retrato: os números não mudam sozinhos e são refeitos a cada 3 ou 6 meses.</p></header>';

  // 1. resumo
  h += '<h2 class="section-title">Resumo</h2><div class="kpi-grid">' +
    '<div class="kpi"><div class="label">Faturamento Hotmart</div><div class="num">' + rsk(fatTot) + '</div><div class="sub">' + n0(D.cobertura.vendas) + ' vendas · jan/2023 a ' + dataBR(D.geradoEm).slice(3) + '</div></div>' +
    '<div class="kpi"><div class="label">Investido no Meta</div><div class="num">' + rsk(metaTot) + '</div><div class="sub">ago/2023 a ' + dataBR(D.geradoEm).slice(3) + ' · Google Ads ainda fora</div></div>' +
    '<div class="kpi destaque"><div class="label">Vendas de quem era lead antes</div><div class="num">' + rsk(deLead) + '</div><div class="sub">' + pc(deLead, fatTot) + ' do faturamento · ' + rsk(anuncio) + ' de leads de anúncio</div></div>' +
    '<div class="kpi"><div class="label">Público frio do Meta</div><div class="num">' + x2(frT, frG) + '</div><div class="sub">voltou ' + rsk(frT) + ' dos ' + rsk(frG) + ' investidos (até hoje)</div></div>' +
    '</div>';
  if (D.conclusoes && D.conclusoes.length) h += '<ul class="concl">' + D.conclusoes.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>';

  // 2. de onde veio o faturamento
  h += '<h2 class="section-title">De onde veio o faturamento</h2><p class="lede">Cada venda foi ligada à pessoa que comprou. Se ela já estava na nossa base de leads antes da compra, a venda conta pela forma como ela entrou (anúncio frio, anúncio quente ou orgânico). Se não estava, ou já era aluno, ou não foi achada em nenhuma base.</p>' +
    legenda(ORIG) + '<div class="barras">' + anos.map(function (a) { return pilha(a.origem, a.fat, String(a.ano), rsk(a.fat)); }).join('') + pilha(oTot, fatTot, 'Total', rsk(fatTot)) + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Ano</th><th class="c">Investido Meta</th>' + ORIG.map(function (s) { return '<th class="c">' + esc(s.nome) + '</th>'; }).join('') + '<th class="c">Total</th></tr></thead><tbody>' +
    anos.concat([{ ano:'Total', fat:fatTot, meta:metaTot, origem:oTot }]).map(function (a) { var g = grupos(a.origem); return '<tr' + (a.ano === 'Total' ? ' class="total"' : '') + '><td>' + a.ano + '</td><td class="c">' + rs(a.meta) + '</td>' + ORIG.map(function (s) { return '<td class="c">' + rs(g[s.k].fat) + '<br><span class="fraco">' + pc(g[s.k].fat, a.fat) + '</span></td>'; }).join('') + '<td class="c">' + rs(a.fat) + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<div class="note">"Não achado como lead" junta quem comprou sem nunca se cadastrar (entrou direto pelo YouTube, Instagram, Google, indicação), quem se cadastrou com outro e-mail e quem só aparece no ActiveCampaign antigo, sem data. Em 2023 ele é maior porque as bases de leads começam em ago/2023; e escolas sem planilha de leads antes de 2026 (ESA, EFOMM, AFA...) aparecem quase inteiras aqui.</div>';

  // 3. por escola
  var escolas = D.escolas.filter(function (e) { return e.vendas >= 50; });
  h += '<h2 class="section-title">Por escola</h2><p class="lede">Escola do curso vendido. O investimento é o do Meta, somado pelo nome da campanha (operação, ultimato, perpétuo). Campanhas institucionais e de várias escolas (' + rsk(D.gastoSemEscola) + ') não entram em nenhuma linha.</p>' +
    '<div class="rolar"><table><thead><tr><th>Escola</th><th class="c">Investido Meta</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado como lead</th></tr></thead><tbody>' +
    escolas.map(function (e) { var g = grupos(e.origem); return '<tr><td><b>' + esc(e.escola) + '</b></td><td class="c">' + (e.meta ? rs(e.meta) : '<span class="fraco">—</span>') + '</td><td class="c">' + n0(e.vendas) + '</td><td class="c">' + rs(e.fat) + '</td><td class="c">' + rs(g.frio.fat + g.pq.fat) + '<br><span class="fraco">' + pc(g.frio.fat + g.pq.fat, e.fat) + ' · frio ' + rsk(g.frio.fat) + '</span></td><td class="c">' + rs(g.org.fat) + '<br><span class="fraco">' + pc(g.org.fat, e.fat) + '</span></td><td class="c">' + rs(g.aluno.fat) + '<br><span class="fraco">' + pc(g.aluno.fat, e.fat) + '</span></td><td class="c">' + rs(g.nao.fat) + '<br><span class="fraco">' + pc(g.nao.fat, e.fat) + '</span></td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<details><summary>Ver cada escola ano a ano</summary><div class="rolar"><table><thead><tr><th>Escola</th><th>Ano</th><th class="c">Investido Meta</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado</th></tr></thead><tbody>' +
    escolas.map(function (e) { return e.anos.map(function (a, i) { var g = grupos(a.origem); return '<tr><td>' + (i ? '' : '<b>' + esc(e.escola) + '</b>') + '</td><td>' + a.ano + '</td><td class="c">' + (a.meta ? rs(a.meta) : '—') + '</td><td class="c">' + n0(a.vendas) + '</td><td class="c">' + rs(a.fat) + '</td><td class="c">' + rs(g.frio.fat + g.pq.fat) + '</td><td class="c">' + rs(g.org.fat) + '</td><td class="c">' + rs(g.aluno.fat) + '</td><td class="c">' + rs(g.nao.fat) + '</td></tr>'; }).join(''); }).join('') +
    '</tbody></table></div></details>' +
    (D.gastoPorEscola ? '<details><summary>Ver o investimento do Meta por escola e ano</summary><div class="rolar"><table><thead><tr><th>Escola (pela campanha)</th><th class="c">2023</th><th class="c">2024</th><th class="c">2025</th><th class="c">2026</th><th class="c">Total</th></tr></thead><tbody>' +
      D.gastoPorEscola.map(function (g) { return '<tr><td>' + esc(g.escola === 'Outros / matérias' ? 'Institucional / várias escolas' : g.escola) + '</td>' + g.anos.map(function (v) { return '<td class="c">' + (v ? rs(v) : '—') + '</td>'; }).join('') + '<td class="c"><b>' + rs(g.total) + '</b></td></tr>'; }).join('') + '</tbody></table></div></details>' : '');

  // 4. captou X, vendeu o quê
  h += '<h2 class="section-title">Captou onde, vendeu o quê</h2><p class="lede">Escola em que a pessoa entrou como lead (o evento ou a captação) e o que ela comprou depois, em qualquer data. Conta cada curso comprado uma vez por pessoa.</p><div class="cards">' +
    D.matriz.filter(function (m) { return m.compras >= 20; }).map(function (m) {
      var max = Math.max.apply(null, m.porEscolaProduto.map(function (x) { return x.n; }));
      return '<div class="card"><h3>' + esc(m.escolaLead) + '</h3><div class="meta">' + n0(m.leads) + ' leads · ' + n0(m.compradores) + ' compraram (' + pc(m.compradores, m.leads, 1) + ') · ' + rsk(m.fat) + '</div>' +
        '<div class="mini">' + m.porEscolaProduto.slice(0, 7).map(function (x) { return '<div><div style="display:flex;justify-content:space-between;gap:8px"><span>' + esc(x.escola) + '</span><span class="fraco">' + rsk(x.fat) + '</span></div><div class="b" style="width:' + Math.max(2, 100 * x.n / max) + '%" data-tip="<b>' + esc(m.escolaLead) + ' → ' + esc(x.escola) + '</b><br>' + n0(x.n) + ' compras · ' + rs(x.fat) + '"></div></div><div class="c">' + n0(x.n) + '</div>'; }).join('') + '</div>' +
        '<details><summary>Cursos mais comprados</summary><div class="rolar"><table><thead><tr><th>Curso</th><th class="c">Compras</th><th class="c">De frios</th><th class="c">Mediana até comprar</th></tr></thead><tbody>' +
        m.topProdutos.map(function (p) { return '<tr><td>' + esc(p.produto) + '</td><td class="c">' + n0(p.n) + '</td><td class="c">' + n0(p.frio) + '</td><td class="c">' + n0(p.medianaDias) + ' dias</td></tr>'; }).join('') + '</tbody></table></div></details></div>';
    }).join('') + '</div>';

  // 5. tempo
  function tp(e, p) { return D.tempo.filter(function (t) { return t.escola === e && t.publico === p; })[0]; }
  var cores = { 'EsPCEx':'var(--s-esp)', 'Barro Branco':'var(--s-bb)', 'Matemática Básica':'var(--s-mat)' };
  function ser(p) { return ['EsPCEx', 'Barro Branco', 'Matemática Básica'].map(function (e) { var t = tp(e, p); return t ? { nome:e, cor:cores[e], c:t.curva } : null; }).filter(Boolean); }
  h += '<h2 class="section-title">Quanto tempo o lead leva pra comprar</h2><p class="lede">Percentual dos leads que já tinham comprado alguma coisa X dias depois de entrar na base. Cada ponto só usa leads que já estão na base há pelo menos aquele tempo, pra não misturar lead novo com antigo.</p>' +
    '<div class="graficos">' + curvas('Lead de público frio', ser('frio')) + curvas('Lead de público quente (anúncio quente + orgânico)', ser('quente')) + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Escola onde entrou</th><th>Público</th><th class="c">Leads</th><th class="c">Compraram</th><th class="c">Metade comprou em até</th><th class="c">3 em 4 compraram em até</th><th class="c">Compraram depois de 90 dias</th><th class="c">Em 2 anos</th></tr></thead><tbody>' +
    D.tempo.map(function (t) { return '<tr' + (t.escola === '(todas)' ? ' class="total"' : '') + '><td>' + esc(t.escola === '(todas)' ? 'Todas' : t.escola) + '</td><td>' + (t.publico === 'frio' ? 'Frio' : 'Quente') + '</td><td class="c">' + n0(t.leads) + '</td><td class="c">' + n0(t.compraram) + '</td><td class="c">' + (t.mediana == null ? '—' : n0(t.mediana) + ' dias') + '</td><td class="c">' + (t.p75 == null ? '—' : n0(t.p75) + ' dias') + '</td><td class="c">' + (t.depois90 == null ? '—' : t.depois90 + '%') + '</td><td class="c">' + (t.curva.d730 == null ? '<span class="fraco">cedo</span>' : t.curva.d730.toLocaleString('pt-BR') + '%') + '</td></tr>'; }).join('') +
    '</tbody></table></div>';

  // 6. frio compensa?
  h += '<h2 class="section-title">O público frio se paga?</h2><p class="lede">Só Meta: o que investimos em público frio em cada ano contra tudo o que os leads frios que vieram do Meta naquele ano compraram depois, em qualquer curso. Faturamento bruto da Hotmart, antes de taxa e imposto.</p>' +
    '<div class="rolar"><table><thead><tr><th>Ano em que entrou</th><th class="c">Investido no frio</th><th class="c">Leads frios</th><th class="c">Custo por lead</th><th class="c">Compraram</th><th class="c">Voltou em 90 dias</th><th class="c">Em 1 ano</th><th class="c">Até hoje</th></tr></thead><tbody>' +
    fr.map(function (f) { return '<tr><td>' + f.ano + '</td><td class="c">' + rs(f.gasto) + '</td><td class="c">' + n0(f.leads) + '</td><td class="c">' + (f.leads ? 'R$ ' + (f.gasto / f.leads).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '—') + '</td><td class="c">' + n0(f.compraram) + '</td><td class="c">' + rs(f.fat90) + '<br><span class="fraco">' + x2(f.fat90, f.gasto) + '</span></td><td class="c">' + rs(f.fat365) + '<br><span class="fraco">' + x2(f.fat365, f.gasto) + '</span></td><td class="c"><b>' + rs(f.fatTotal) + '</b><br><span class="fraco">' + x2(f.fatTotal, f.gasto) + '</span></td></tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="c">' + rs(frG) + '</td><td class="c">' + n0(soma(fr, function (f) { return f.leads; })) + '</td><td></td><td class="c">' + n0(soma(fr, function (f) { return f.compraram; })) + '</td><td class="c">' + x2(soma(fr, function (f) { return f.fat90; }), frG) + '</td><td class="c">' + x2(soma(fr, function (f) { return f.fat365; }), frG) + '</td><td class="c">' + x2(frT, frG) + '</td></tr>' +
    '</tbody></table></div><div class="note">Os leads que entraram há pouco tempo (2025 e 2026) ainda vão comprar mais: nas turmas de 2023 e 2024, o que voltou depois de 1 ano foi de 50% a 60% a mais. Mesmo assim, a turma de 2025 dificilmente passa de 1x.</div>';

  // 7. leads por ano e 2027
  var L = D.leads, maxL = Math.max.apply(null, L.map(function (l) { return l.total; }));
  function pl(a, p) { return D.porLead12m.filter(function (x) { return x.ano === a && x.publico === p; })[0] || { porLead:0, fat12m:0, leads:0 }; }
  var l25 = L.filter(function (l) { return l.ano === 2025; })[0], l26 = L.filter(function (l) { return l.ano === 2026; })[0];
  var q25 = l25.pq + l25.org, q26 = l26.pq + l26.org;
  var real25 = pl(2025, 'frio').fat12m + pl(2025, 'quente').fat12m;
  var est26 = l26.frio * pl(2025, 'frio').porLead + q26 * pl(2025, 'quente').porLead;
  h += '<h2 class="section-title">Leads captados por ano e o que isso indica pra 2027</h2><p class="lede">Pessoas que entraram na base pela primeira vez em cada ano, pelo público de entrada. 2026 vai até ' + dataBR(D.geradoEm) + ' (a captação da EsPCEx 27 ainda está em andamento).</p>' +
    legenda([{ nome:'Frio', cor:'var(--s-frio)' }, { nome:'Quente (anúncio)', cor:'var(--s-pq)' }, { nome:'Orgânico', cor:'var(--s-org)' }, { nome:'Sem origem', cor:'var(--s-nao)' }]) +
    '<div class="barras">' + L.map(function (l) {
      var partes = [['frio', 'Frio', 'var(--s-frio)'], ['pq', 'Quente (anúncio)', 'var(--s-pq)'], ['org', 'Orgânico', 'var(--s-org)'], ['semorigem', 'Sem origem', 'var(--s-nao)']];
      return '<div class="linha-barra"><div class="rot">' + l.ano + '</div><div class="pilha" style="width:' + (100 * l.total / maxL) + '%">' + partes.map(function (p) { var v = l[p[0]]; if (!v) return ''; return '<div style="flex:' + v + ';background:' + p[2] + '" data-tip="<b>' + l.ano + ' · ' + p[1] + '</b><br>' + n0(v) + ' leads (' + pc(v, l.total) + ')">' + (v / l.total >= .12 ? n0(v) : '') + '</div>'; }).join('') + '</div><div class="tot">' + n0(l.total) + ' leads</div></div>';
    }).join('') + '</div>' +
    '<div class="rolar"><table><thead><tr><th>Ano em que entrou</th><th class="c">Leads frios</th><th class="c">Leads quentes</th><th class="c">Faturamento por lead frio em 12 meses</th><th class="c">Por lead quente em 12 meses</th><th>Escolas com mais leads</th></tr></thead><tbody>' +
    L.map(function (l) { var f = pl(l.ano, 'frio'), q = pl(l.ano, 'quente'); return '<tr><td>' + l.ano + '</td><td class="c">' + n0(l.frio) + '</td><td class="c">' + n0(l.pq + l.org) + '</td><td class="c">' + (f.leads ? 'R$ ' + f.porLead.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '<span class="fraco">cedo</span>') + '</td><td class="c">' + (q.leads ? 'R$ ' + q.porLead.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 }) : '<span class="fraco">cedo</span>') + '</td><td class="fraco">' + l.porEscola.slice(0, 4).map(function (e) { return esc(e.escola === 'Outros / matérias' ? 'outras campanhas' : e.escola) + ' ' + n0(e.n); }).join(' · ') + '</td></tr>'; }).join('') +
    '</tbody></table></div>' +
    '<div class="kpi-grid" style="margin-top:12px"><div class="kpi"><div class="label">Leads frios 2025 → 2026</div><div class="num">' + n0(l25.frio) + ' → ' + n0(l26.frio) + '</div><div class="sub">' + pc(l26.frio - l25.frio, l25.frio) + '</div></div>' +
    '<div class="kpi"><div class="label">Leads quentes 2025 → 2026</div><div class="num">' + n0(q25) + ' → ' + n0(q26) + '</div><div class="sub">' + (q26 >= q25 ? '+' : '') + pc(q26 - q25, q25) + '</div></div>' +
    '<div class="kpi destaque"><div class="label">Vendas esperadas dos leads de 2026 (12 meses)</div><div class="num">' + rsk(est26) + '</div><div class="sub">contra ' + rsk(real25) + ' dos leads de 2025 (' + (est26 >= real25 ? '+' : '') + pc(est26 - real25, real25) + ')</div></div></div>' +
    '<div class="note">Estimativa simples: leads de 2026 × o quanto cada lead de 2025 (frio e quente, separados) comprou nos 12 meses seguintes. Como o lead quente compra 8 vezes mais que o frio, a queda de leads frios pesa pouco; o que decide 2027 é manter o volume de leads quentes.</div>';

  // 8. cursos
  h += '<h2 class="section-title">Todos os cursos</h2><p class="lede">Cada curso da Hotmart, com o quanto das vendas veio de quem já era lead. "Mediana até comprar" é o tempo entre entrar na base e comprar aquele curso, só pra quem era lead.</p>' +
    '<div class="rolar"><table><thead><tr><th>Curso</th><th>Escola</th><th class="c">Vendas</th><th class="c">Faturamento</th><th class="c">De lead de anúncio</th><th class="c">De lead orgânico</th><th class="c">Já era aluno</th><th class="c">Não achado</th><th class="c">Mediana até comprar</th></tr></thead><tbody>' +
    D.produtos.filter(function (p) { return p.vendas >= 5; }).map(function (p) { var g = grupos(p.origem); return '<tr><td>' + esc(p.produto) + '</td><td class="fraco">' + esc(p.escola) + '</td><td class="c">' + n0(p.vendas) + '</td><td class="c">' + rs(p.fat) + '</td><td class="c">' + pc(g.frio.fat + g.pq.fat, p.fat) + '</td><td class="c">' + pc(g.org.fat, p.fat) + '</td><td class="c">' + pc(g.aluno.fat, p.fat) + '</td><td class="c">' + pc(g.nao.fat, p.fat) + '</td><td class="c">' + (p.medianaDias == null ? '—' : n0(p.medianaDias) + ' dias') + '</td></tr>'; }).join('') +
    '</tbody></table></div>';

  h += '<footer><b>Como foi feito.</b> Vendas: todas as vendas aprovadas da Hotmart desde jan/2023 (' + n0(D.cobertura.vendas) + ', sem contar cobrança repetida do mesmo curso). Leads: ' + esc(D.cobertura.bases) + ' (' + n0(D.cobertura.leadsPessoas) + ' pessoas). ' +
    'A pessoa é ligada pela primeira vez que entrou na base; quem entrou no mesmo dia da compra ou depois conta como aluno, não como lead. Frio e quente vêm do nome do público no anúncio (UTM). Investimento: Meta, conta Teorema Militar MKT, desde ago/2023 (o Meta não guarda mais que isso). ' +
    '<b>Ainda fora:</b> Google Ads (YouTube), planilhas de leads antigas de ESA, EFOMM e AFA e as operações de 2022.</footer>';
  document.getElementById('app').innerHTML = h;
}
montar();

// dica ao passar o mouse (ou tocar) nas barras e pontos
(function () {
  var tip = document.getElementById('tip');
  function mostrar(e) { var el = e.target.closest ? e.target.closest('[data-tip]') : null; if (!el) { tip.style.display = 'none'; return; }
    tip.innerHTML = el.getAttribute('data-tip'); tip.style.display = 'block';
    var x = (e.clientX || 0) + 14, y = (e.clientY || 0) + 14; if (x + tip.offsetWidth > window.innerWidth - 8) x = window.innerWidth - tip.offsetWidth - 8; if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - 10;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; }
  document.addEventListener('mousemove', mostrar); document.addEventListener('click', mostrar);
  document.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
})();
</script>
</body>
</html>`;

// ==== GERENCIAL_DADOS: início (gerado por atualizar-gerencial.ps1; não editar à mão) ====
const GERENCIAL_DADOS = {};
// ==== GERENCIAL_DADOS: fim ====

// ---------------------------------------------------------------- páginas

function escaparHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const COR = v => (/^#[0-9a-f]{3,8}$/i.test(v) ? v : '#000000');

// Formulário público da pesquisa: as mesmas perguntas do Google Forms, com as cores da operação.
function paginaPesquisa(cfg) {
  const s = cfg.pesquisa, t = cfg.tema;
  // O envio vai pro mesmo caminho público do formulário (a rota do Cloudflare só cobre esse caminho).
  const alvo = (s.caminho && /^\/[a-z0-9\/-]+$/.test(s.caminho)) ? s.caminho : '/api/' + cfg.slug + '/pesquisa';
  const campos = s.perguntas.map(q => {
    const nome = escaparHtml(q.id);
    const obrig = q.obrigatoria ? ' required' : '';
    let ctrl;
    if (q.tipo === 'escolha') {
      ctrl = q.opcoes.map(o => '<label class="opt"><input type="radio" name="' + nome + '" value="' + escaparHtml(o) + '"' + obrig + '><span>' + escaparHtml(o) + '</span></label>').join('');
      if (q.outro) ctrl += '<label class="opt"><input type="radio" name="' + nome + '" value="__outro__"' + obrig + '><span>Outro:</span><input type="text" class="inline" data-outro="' + nome + '" maxlength="120" aria-label="Outro"></label>';
    } else if (q.tipo === 'paragrafo') {
      ctrl = '<textarea name="' + nome + '" rows="3" maxlength="2000"' + obrig + '></textarea>';
    } else {
      ctrl = '<input type="' + (q.tipo === 'email' ? 'email' : 'text') + '" name="' + nome + '" maxlength="' + (q.tipo === 'email' ? 200 : 300) + '"' + obrig + (q.tipo === 'email' ? ' autocomplete="email"' : '') + '>';
    }
    const secao = q.secao ? '<h2 class="sec">' + escaparHtml(q.secao) + '</h2>' : '';
    return secao + '<fieldset class="q"><legend>' + escaparHtml(q.rotulo) + (q.obrigatoria ? ' <span class="req">*</span>' : '') + '</legend>' + ctrl + '</fieldset>';
  }).join('');

  const css = ':root{--bg:' + COR(t.bg) + ';--card:' + COR(t.card) + ';--line:' + COR(t.line) + ';--accent:' + COR(t.accent) + ';--weak:' + COR(t.textWeak) + ';--text:' + COR(t.text) + '}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"Titillium Web",system-ui,sans-serif;padding:24px 16px 64px}' +
    '.w{max-width:680px;margin:0 auto}h1{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:34px;margin:0 0 8px;color:var(--accent)}' +
    '.intro{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:10px;padding:18px;line-height:1.5;margin-bottom:16px}' +
    '.q{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:0 0 12px}legend{padding:0 6px;font-weight:600}.req{color:#f87171}' +
    '.opt{display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer}.opt input[type=radio]{accent-color:var(--accent);width:18px;height:18px}' +
    'input[type=text],input[type=email],textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:11px;font:inherit}' +
    'input.inline{flex:1;width:auto;padding:6px 8px}input:focus,textarea:focus{outline:2px solid var(--accent);outline-offset:1px}' +
    'button{background:var(--accent);color:var(--bg);border:0;border-radius:8px;padding:13px 26px;font:inherit;font-weight:700;cursor:pointer}button:disabled{opacity:.6}' +
    '.msg{margin-top:14px}.msg.erro{color:#f87171}.msg.ok{background:var(--card);border:1px solid var(--accent);border-radius:10px;padding:18px;font-size:18px}' +
    '.aviso{font-size:12px;color:var(--weak);margin-top:18px}.hp{position:absolute;left:-9999px;height:0;overflow:hidden}' +
    '.sec{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:22px;letter-spacing:.04em;color:var(--accent);margin:26px 0 10px}';

  const js = "var f=document.getElementById('f'),msg=document.getElementById('msg'),btn=document.getElementById('btn');" +
    "f.addEventListener('submit',function(e){e.preventDefault();var dados={};new FormData(f).forEach(function(v,k){dados[k]=v;});" +
    "Object.keys(dados).forEach(function(k){if(dados[k]==='__outro__'){var i=f.querySelector('[data-outro=\"'+k+'\"]');var t=((i&&i.value)||'').trim();dados[k]=t?'Outro: '+t:'';}});" +
    "btn.disabled=true;msg.className='msg';msg.textContent='Enviando…';" +
    "fetch('" + alvo + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)})" +
    ".then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j&&j.erro?j.erro:'Erro ao enviar');return j;});})" +
    ".then(function(){f.style.display='none';msg.className='msg ok';msg.textContent='Sua resposta foi registrada. Obrigado!';window.scrollTo(0,0);})" +
    ".catch(function(err){btn.disabled=false;msg.className='msg erro';msg.textContent=err.message;});});";

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow">' +
    '<title>' + escaparHtml(s.titulo) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body><div class="w"><h1>' + escaparHtml(s.titulo) + '</h1>' +
    '<div class="intro">' + escaparHtml(s.intro) + '</div>' +
    '<form id="f">' + campos +
    '<div class="hp" aria-hidden="true"><label>Não preencha este campo<input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>' +
    '<button id="btn" type="submit">Enviar</button></form><div id="msg" class="msg" role="status"></div>' +
    '<p class="aviso">' + escaparHtml(s.aviso || '') + ' * Pergunta obrigatória.</p></div><script>' + js + '</script></body></html>';
}

function paginaOperacao(cfg) {
  const t = cfg.tema;
  return PAGINA
    .replace('__TEMA__', '--bg:' + COR(t.bg) + '; --card:' + COR(t.card) + '; --line:' + COR(t.line) + '; --accent:' + COR(t.accent) + '; --text-weak:' + COR(t.textWeak) + '; --text:' + COR(t.text) + ';')
    .replace('__TITULO__', escaparHtml(cfg.titulo))
    .replace('__SLUG__', cfg.slug);
}

// Lista plana de tudo o que aparece no menu: operações vivas (lidas ao vivo) e encerradas (página pronta).
function operacoesLista() {
  const hoje = hojeBRT();
  const itens = [];
  for (const slug of Object.keys(OPERACOES)) {
    const cfg = contexto(slug);
    const fins = cfg.etapas.map(e => e.fim).filter(Boolean).sort();
    const fim = fins.length ? fins[fins.length - 1] : null;
    const estado = cfg.captacaoInicio && cfg.captacaoInicio > hoje ? 'Em breve' : (fim && fim < hoje ? 'Encerrada' : 'Em andamento');
    itens.push({ chave: slug, href: '/' + slug, slug, escola: cfg.escola || cfg.titulo, edicao: cfg.edicao || cfg.titulo, ano: cfg.ano || 0, tema: cfg.tema, estado });
    if (cfg.historico) itens.push({ chave: slug + '/historico', href: '/' + slug + '/historico', slug, escola: cfg.escola || cfg.titulo, edicao: 'Histórico', ano: (cfg.ano || 0) - 0.5, tema: cfg.tema, estado: 'Referência' });
  }
  for (const slug of Object.keys(ARQUIVO)) {
    const a = ARQUIVO[slug];
    itens.push({ chave: slug, href: '/' + slug, slug, escola: a.escola, edicao: a.edicao, ano: a.ano || 0, tema: a.tema, estado: 'Encerrada' });
  }
  return itens;
}

// Agrupa por escola (ordem alfabética); dentro de cada escola, a operação mais nova primeiro.
function agruparEscolas(itens) {
  const escolas = {};
  itens.forEach(i => { (escolas[i.escola] = escolas[i.escola] || []).push(i); });
  return Object.keys(escolas).sort((a, b) => a.localeCompare(b, 'pt-BR')).map(nome => ({ nome, ops: escolas[nome].sort((a, b) => b.ano - a.ano) }));
}

// Marca do topo do menu e da tela de entrada: a logo do Teorema Militar (SVG no fim do arquivo).
function marcaHtml() {
  return '<span class="logo">' + LOGO_TM + '</span>';
}

// Página com menu lateral. Sem "ativo": página inicial (cartões). Com "ativo": o relatório aparece à direita (iframe do mesmo site).
function paginaShell(ativo, veGeral, veGerencial) {
  const grupos = agruparEscolas(operacoesLista());
  const t = HUB.tema;
  const atual = ativo === 'geral' ? { chave: 'geral', href: '/geral', escola: null, edicao: 'Visão geral', tema: HUB.tema, estado: '' }
    : ativo === 'gerencial' ? { chave: 'gerencial', href: '/gerencial', escola: null, edicao: 'Relatório gerencial', tema: HUB.tema, estado: '' }
    : (ativo ? operacoesLista().filter(o => o.chave === ativo)[0] : null);
  const menu = grupos.map(g => {
    const aberto = g.ops.some(o => o.chave === ativo);
    return '<details class="g"' + (aberto ? ' open' : '') + '><summary>' + escaparHtml(g.nome) + '</summary>' +
      g.ops.map(o => '<a class="it' + (o.chave === ativo ? ' on' : '') + '" href="' + o.href + '"><i></i><span>' + escaparHtml(o.edicao) + '</span><em>' + escaparHtml(o.estado) + '</em></a>').join('') + '</details>';
  }).join('');
  const cartoes = grupos.map(g => '<section>' + (LOGOS_ESCOLA[g.nome] ? '<div class="esc">' + LOGOS_ESCOLA[g.nome] + '</div>' : '<h2>' + escaparHtml(g.nome) + '</h2>') + '<div class="ops">' +
    g.ops.map(o => '<a class="op" href="' + o.href + '"><b>' + escaparHtml(o.edicao) + '</b><span class="st' + (o.estado === 'Encerrada' ? '' : ' vivo') + '">' + escaparHtml(o.estado) + '</span></a>').join('') + '</div></section>').join('');
  const principal = atual
    ? '<iframe title="' + escaparHtml(atual.edicao) + '" src="' + atual.href + '?embed=1" style="background:' + COR(atual.tema.bg) + '"></iframe>'
    : '<div class="inicio"><h1>Relatórios</h1><p class="sub">Escolha uma operação no menu ou aqui.</p>' + cartoes + '</div>';
  const css = ':root{--bg:' + COR(t.bg) + ';--card:' + COR(t.card) + ';--line:' + COR(t.line) + ';--weak:' + COR(t.textWeak) + ';--text:' + COR(t.text) + ';--acc:' + COR(t.accent) + ';--c:' + COR(t.accent) + '}' +
    '*{box-sizing:border-box}html,body{height:100%}body{margin:0;display:flex;background:var(--bg);color:var(--text);font-family:"Titillium Web",system-ui,sans-serif;overflow:hidden}' +
    'aside{width:272px;flex:none;display:flex;flex-direction:column;background:var(--card);border-right:1px solid var(--line);overflow-y:auto}' +
    '.topo{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:18px 16px 14px;border-bottom:1px solid var(--line)}' +
    '.topo a{color:inherit;text-decoration:none}.logo{display:block;width:158px;color:var(--text)}.logo svg,.sim svg,.elogo svg{display:block;width:100%;height:auto}.sim{display:none;width:26px;color:var(--acc)}' +
    '.topo .t{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:26px;line-height:1;margin-top:8px}' +
    '#tg{flex:none;background:transparent;border:1px solid var(--line);color:var(--weak);border-radius:8px;width:34px;height:34px;cursor:pointer;font-size:16px;line-height:1}#tg:hover{color:var(--text);border-color:var(--weak)}' +
    'nav{padding:12px 10px;flex:1}.rot{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--weak);margin:14px 8px 6px;font-weight:700}' +
    '.it,summary{display:flex;align-items:center;gap:10px;padding:10px;border-radius:8px;color:var(--text);text-decoration:none;cursor:pointer}' +
    'summary{list-style:none;font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:19px;font-weight:800;letter-spacing:.02em}summary::-webkit-details-marker{display:none}' +
    'summary::before{content:"\\25B8";font-size:12px;color:var(--weak);transition:transform .15s}details[open]>summary::before{transform:rotate(90deg)}summary:hover,.it:hover{background:color-mix(in srgb,var(--line) 55%,transparent)}' +
    '.it{margin-left:14px;font-size:15px}.it.inicio-link{margin-left:0;font-weight:600}.it i{width:8px;height:8px;border-radius:50%;background:var(--c);flex:none}.it span{flex:1}.it em{font-style:normal;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--weak)}' +
    '.it.on{background:color-mix(in srgb,var(--c) 14%,transparent);box-shadow:inset 3px 0 0 var(--c)}.it.off{margin-left:0;color:var(--weak);cursor:default}.it.off:hover{background:none}.it.off i{background:var(--line)}' +
    'main{flex:1;min-width:0;height:100%;display:flex;flex-direction:column}.cont{flex:1;min-height:0;overflow:auto}iframe{display:block;width:100%;height:100%;border:0}' +
    '.barra{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;height:54px;padding:0 18px;background:var(--card);border-bottom:1px solid var(--line)}' +
    '.mig{font-size:14px;color:var(--weak);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mig a{color:var(--text);text-decoration:none;font-weight:600}.mig a:hover{text-decoration:underline}.mig b{color:var(--text);font-weight:600}' +
    '.sair{flex:none;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:8px;padding:8px 14px;color:var(--text);text-decoration:none;font-weight:700;font-size:14px}.sair:hover{border-color:var(--weak);background:color-mix(in srgb,var(--line) 55%,transparent)}' +
    '.inicio{max-width:860px;margin:0 auto;padding:40px 24px 64px}.inicio h1{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:44px;line-height:1;margin:0}.sub{color:var(--weak);margin:6px 0 28px}' +
    'section{margin-bottom:28px}h2{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:26px;margin:0 0 12px;padding-left:12px;border-left:4px solid var(--acc)}' +
    '.esc{width:250px;max-width:70%;color:var(--text);margin:0 0 14px}.esc svg{display:block;width:100%;height:auto}.ops{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}.op{display:flex;flex-direction:column;gap:8px;background:var(--card);border:1px solid var(--line);border-top:3px solid var(--c);border-radius:10px;padding:18px;text-decoration:none;color:inherit}.op:hover{border-color:var(--c)}.op b{font-size:20px}' +
    '.st{font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--weak)}.st.vivo{color:#4ADE80}' +
    'body.min aside{width:56px}body.min .topo{flex-direction:column;padding:12px 8px;border:0}body.min .topo>a:not(.sim),body.min nav{display:none}body.min .sim{display:block}' +
    '@media(max-width:800px){aside{position:fixed;z-index:5;top:0;bottom:0;left:0;width:82vw;max-width:300px;box-shadow:0 0 30px rgba(0,0,0,.5)}body.min aside{width:48px;box-shadow:none}main{margin-left:48px}body:not(.min) main{margin-left:48px}}';
  const js = '(function(){var b=document.body,t=document.getElementById("tg");function set(m){b.classList.toggle("min",m);t.textContent=m?"\\u00BB":"\\u00AB";t.title=m?"Abrir menu":"Fechar menu";try{localStorage.setItem("menuMin",m?"1":"0")}catch(e){}}' +
    'var s=null;try{s=localStorage.getItem("menuMin")}catch(e){}set(s===null?window.innerWidth<800:s==="1");t.addEventListener("click",function(){set(!b.classList.contains("min"))});})();';
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>' + escaparHtml(atual ? atual.edicao + ' · ' + atual.escola + ' — Relatórios' : 'Relatórios — ' + HUB.cliente) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body><aside><div class="topo"><a href="/">' + marcaHtml() + '<div class="t">Relatórios</div></a><a class="sim" href="/" title="Todos os relatórios">' + SIMBOLO_TM + '</a><button id="tg" type="button" aria-label="Fechar ou abrir o menu">&laquo;</button></div>' +
    '<nav><a class="it inicio-link' + (atual ? '' : ' on') + '" href="/"><i></i><span>Todos os relatórios</span></a>' + (veGeral ? '<a class="it inicio-link' + (ativo === 'geral' ? ' on' : '') + '" href="/geral"><i></i><span>Visão geral</span>' + (BETA.geral ? '<em>beta</em>' : '') + '</a>' : '') + (veGerencial ? '<a class="it inicio-link' + (ativo === 'gerencial' ? ' on' : '') + '" href="/gerencial"><i></i><span>Relatório gerencial</span>' + (BETA.gerencial ? '<em>beta</em>' : '') + '</a>' : '') + '<div class="rot">Operações</div>' + menu + '</nav></aside>' +
    '<main><div class="barra"><div class="mig"><a href="/">Relatórios</a>' + (atual ? (atual.escola ? ' &rsaquo; ' + escaparHtml(atual.escola) : '') + ' &rsaquo; <b>' + escaparHtml(atual.edicao) + '</b>' : '') + '</div><a class="sair" href="/sair">Sair &rarr;</a></div><div class="cont">' + principal + '</div></main><script>' + js + '</script></body></html>';
}

// Aba "Histórico": os lançamentos de anos anteriores lado a lado, com o ano em andamento em branco pra preencher.
function paginaHistorico(cfg) {
  const h = cfg.historico, t = cfg.tema;
  const n0 = v => Number(v).toLocaleString('pt-BR');
  const leads = (h.linhas.filter(l => l.id === 'leads')[0] || { valores: [] }).valores;
  const ultimo = h.anos.length - 1;
  const cab = h.anos.map((a, i) => '<th class="num-cell' + (i === ultimo ? ' novo' : '') + '">' + a + (i === ultimo ? '<span>em andamento</span>' : '') + '</th>').join('');
  const linhas = h.linhas.map(l => {
    const cel = l.valores.map((v, i) => {
      if (v == null) return '<td class="num-cell vazio' + (i === ultimo ? ' novo' : '') + '">—</td>';
      const p = l.pct && leads[i] ? '<small>' + Math.round(v / leads[i] * 100) + '%</small>' : '';
      return '<td class="num-cell' + (i === ultimo ? ' novo' : '') + '">' + n0(v) + p + '</td>';
    }).join('');
    return '<tr' + (l.id === 'leads' || l.id === 'vendas' ? ' class="forte"' : '') + '><td>' + escaparHtml(l.rotulo) + '</td>' + cel + '</tr>';
  }).join('');
  const css = ':root{--bg:' + COR(t.bg) + ';--card:' + COR(t.card) + ';--line:' + COR(t.line) + ';--accent:' + COR(t.accent) + ';--weak:' + COR(t.textWeak) + ';--text:' + COR(t.text) + '}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:"Titillium Web",system-ui,sans-serif;padding:32px 16px 64px}.w{max-width:1080px;margin:0 auto}' +
    'header{border-bottom:2px solid var(--accent);padding-bottom:20px;margin-bottom:24px}.tag{font-size:12px;letter-spacing:.15em;color:var(--accent);font-weight:700;text-transform:uppercase}' +
    'h1{font-family:"Big Shoulders Display","Titillium Web",sans-serif;text-transform:uppercase;font-size:clamp(32px,5vw,52px);line-height:1;margin:4px 0 0}' +
    '.rolar{overflow-x:auto;border:1px solid var(--line);border-radius:10px}table{width:100%;border-collapse:collapse;background:var(--card);font-size:15px;min-width:640px}' +
    'th,td{padding:12px 14px;border-bottom:1px solid var(--line);text-align:left}th{background:#000;color:var(--accent);font-size:12px;text-transform:uppercase;letter-spacing:.06em}' +
    'th span{display:block;font-size:10px;letter-spacing:.04em;color:var(--weak);text-transform:none;font-weight:400}.num-cell{text-align:right;font-variant-numeric:tabular-nums}' +
    'td small{display:block;font-size:12px;color:var(--weak)}tr.forte td{font-weight:700}tr.forte td:first-child{color:var(--accent)}tr:last-child td{border-bottom:0}' +
    '.vazio{color:var(--weak)}.novo{background:color-mix(in srgb,var(--accent) 8%,transparent);border-left:1px dashed var(--accent)}' +
    '.note{font-size:13px;color:var(--weak);background:var(--card);border-left:3px solid var(--accent);padding:12px 16px;border-radius:4px;margin-top:14px;line-height:1.5}';
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>Histórico — ' + escaparHtml(cfg.escola) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body><div class="w"><header><div class="tag">' + escaparHtml(cfg.cliente) + ' · ' + escaparHtml(cfg.escola) + '</div><h1>Histórico de lançamentos</h1></header>' +
    '<div class="rolar"><table><thead><tr><th>Lançamento</th>' + cab + '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<div class="note">O percentual é sobre o total de leads do ano. O público quente e o frio só existem a partir de 2023. A coluna em andamento (' + h.anos[ultimo] + ') fica em branco e vai sendo preenchida conforme o evento acontece.</div></div></body></html>';
}
// CSP das páginas com menu: deixa mostrar o relatório num quadro do próprio site e imagens (o logo).
const CSP_SHELL = CSP => CSP.replace("form-action 'none'", "form-action 'none'; frame-src 'self'; img-src 'self' data:");

const PAGINA =`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>__TITULO__ — Relatório</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root { __TEMA__ --black:var(--bg); --pq:var(--accent); --nc:var(--text-weak); --good:#4ADE80; --bad:#F87171; --pf:#60A5FA; --org:#4ADE80; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Titillium Web',sans-serif; padding:32px 16px 64px;
    background-image:radial-gradient(circle at 10% 0%,color-mix(in srgb,var(--accent) 6%,transparent),transparent 40%),radial-gradient(circle at 90% 20%,color-mix(in srgb,var(--line) 35%,transparent),transparent 50%); }
  .wrap { max-width:1080px; margin:0 auto; }
  h1,h2,h3,.num { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; letter-spacing:0.02em; }
  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid var(--accent); padding-bottom:20px; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
  .brand-tag { font-size:12px; letter-spacing:0.15em; color:var(--accent); font-weight:700; }
  header h1 { font-size:clamp(32px,5vw,52px); line-height:1; margin-top:4px; }
  header .meta { text-align:right; font-size:13px; color:var(--text-weak); }
  .live { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--good); margin-right:6px; }
  .stepper { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }
  .step { flex:1; min-width:150px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; }
  .step .n { font-size:11px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .step .t { font-family:'Big Shoulders Display',sans-serif; font-weight:800; text-transform:uppercase; font-size:20px; margin-top:2px; }
  .step .d { font-size:12px; color:var(--text-weak); margin-top:2px; }
  .step.active { border-color:var(--accent); background:linear-gradient(135deg,var(--card),color-mix(in srgb,var(--accent) 8%,var(--card))); }
  .step.active .t { color:var(--accent); }
  .step.done .t { color:var(--good); }
  .step.locked { opacity:0.6; border-style:dashed; }
  .step .gasto { font-size:12px; color:var(--text-weak); margin-top:8px; }
  .step .gasto b { color:var(--text); font-size:15px; }
  .step .gasto.sem { font-style:italic; }
  .step .bar { margin-top:6px; }
  .num-cell.alta { color:var(--bad); font-weight:700; }
  .section-title { font-size:22px; margin:40px 0 16px; padding-left:12px; border-left:4px solid var(--accent); }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; }
  .kpi .label { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; }
  .kpi .num { font-size:32px; color:var(--accent); margin-top:6px; }
  .kpi .sub { font-size:12px; color:var(--text-weak); margin-top:4px; }
  .kpi.highlight { border-color:var(--accent); background:linear-gradient(135deg,var(--card),color-mix(in srgb,var(--accent) 8%,var(--card))); }
  .bar { height:6px; background:var(--line); border-radius:3px; margin-top:10px; overflow:hidden; }
  .bar i { display:block; height:100%; background:var(--accent); }
  .bar.ok i { background:var(--good); } .bar.over i { background:var(--bad); }
  .goal { font-size:11px; color:var(--text-weak); margin-top:6px; }
  .goal.none { font-style:italic; }
  table { width:100%; border-collapse:collapse; background:var(--card); border-radius:10px; overflow:hidden; font-size:14px; }
  th,td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--line); }
  th { background:var(--black); color:var(--accent); font-weight:700; text-transform:uppercase; font-size:11px; letter-spacing:0.06em; }
  tr:last-child td { border-bottom:none; }
  tr.total td { font-weight:700; color:var(--accent); background:color-mix(in srgb,var(--accent) 6%,transparent); }
  tr.sub td { font-weight:700; background:color-mix(in srgb,var(--line) 25%,transparent); }
  td.ind { padding-left:32px; color:var(--text-weak); }
  tr.group td { color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black); }
  td.num-cell,th.num-cell { text-align:right; font-variant-numeric:tabular-nums; }
  .table-scroll { overflow-x:auto; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:720px) { .two-col { grid-template-columns:1fr; } body { padding:20px 16px 48px; } }
  .note { font-size:13px; color:var(--text-weak); background:var(--card); border-left:3px solid var(--accent); padding:12px 16px; border-radius:4px; margin-top:12px; }
  .note.warn { border-left-color:var(--bad); }
  .chart { display:flex; align-items:flex-end; gap:6px; height:180px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 12px 8px; }
  .col { flex:1; min-width:0; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; height:100%; }
  .col .stack { width:100%; max-width:44px; display:flex; flex-direction:column-reverse; }
  .col .stack i { display:block; width:100%; }
  .col .v { font-size:11px; color:var(--text); margin-bottom:3px; }
  .col .d { font-size:10px; color:var(--text-weak); margin-top:6px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:10px; font-size:12px; color:var(--text-weak); }
  .legend b { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
  .locked-card { background:var(--card); border:1px dashed var(--line); border-radius:10px; padding:28px; text-align:center; }
  .locked-card .num { font-size:28px; color:var(--text-weak); }
  .locked-card p { font-size:13px; color:var(--text-weak); margin-top:8px; }
  footer { margin-top:48px; padding-top:16px; border-top:1px solid var(--line); font-size:12px; color:var(--text-weak); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-size:11px; font-weight:700; text-transform:uppercase; }
  .pill.on { background:rgba(74,222,128,0.15); color:var(--good); }
  .pill.off { background:rgba(139,143,163,0.15); color:var(--text-weak); }
  .funnel { display:flex; gap:8px; flex-wrap:wrap; align-items:stretch; margin-bottom:14px; }
  .funnel .stage { flex:1; min-width:150px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px; text-align:center; }
  .funnel .stage .num { font-size:32px; color:var(--accent); }
  .funnel .stage .label { font-size:12px; color:var(--text-weak); margin-top:6px; text-transform:uppercase; letter-spacing:0.06em; }
  .funnel .stage .rate { font-size:12px; color:var(--good); margin-top:6px; }
  .funnel .arrow { display:flex; align-items:center; color:var(--accent); font-size:24px; }
  .periodo { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 0 18px; padding:12px 14px; background:var(--card); border:1px solid var(--line); border-radius:10px; }
  .periodo .rot { font-size:12px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.08em; margin-right:4px; }
  .periodo button { background:transparent; color:var(--text); border:1px solid var(--line); border-radius:999px; padding:6px 14px; font:inherit; font-size:13px; cursor:pointer; }
  .periodo button:hover { border-color:var(--accent); }
  .periodo button.on { background:var(--accent); color:var(--bg); border-color:var(--accent); font-weight:700; }
  .periodo .custom { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-left:auto; font-size:13px; color:var(--text-weak); }
  .periodo input[type=date] { background:var(--bg); color:var(--text); border:1px solid var(--line); border-radius:8px; padding:5px 8px; font:inherit; font-size:13px; color-scheme:dark; }
  #erro { display:none; }
</style>
</head>
<body>
<div class="wrap">
  <div id="erro" class="note warn"></div>
  <div id="app"><p class="note">Carregando…</p></div>
</div>
<script>
(function () {
  var app = document.getElementById('app');
  var erro = document.getElementById('erro');

  // Período escolhido (filtro de datas). Fica na URL (?de=...&ate=...), então dá pra mandar o link já filtrado.
  var qs = new URLSearchParams(location.search);
  var periodo = { de: qs.get('de') || '', ate: qs.get('ate') || '' };
  var hojeAtual = '';
  function urlDados() {
    var q = [];
    if (periodo.de) q.push('de=' + encodeURIComponent(periodo.de));
    if (periodo.ate) q.push('ate=' + encodeURIComponent(periodo.ate));
    return '/api/__SLUG__/data' + (q.length ? '?' + q.join('&') : '');
  }
  function somaDias(iso, n) { var t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function intervalo(a, b) { return 'de ' + fdia(a) + ' a ' + fdia(b); }
  function barraPeriodo(d) {
    var h = d.hoje, p = d.periodo;
    var pre = [['tudo', 'Tudo', null, null], ['hoje', 'Hoje', h, h], ['ontem', 'Ontem', somaDias(h, -1), somaDias(h, -1)], ['3', 'Últimos 3 dias', somaDias(h, -2), h], ['7', 'Últimos 7 dias', somaDias(h, -6), h]];
    var achou = false;
    var bots = pre.map(function (x) {
      var on = x[0] === 'tudo' ? p.completo : (!p.completo && p.de === x[2] && p.ate === x[3]);
      if (on) achou = true;
      return '<button type="button" data-p="' + x[0] + '"' + (on ? ' class="on"' : '') + '>' + esc(x[1]) + '</button>';
    }).join('');
    return '<div class="periodo"><span class="rot">Período</span>' + bots +
      '<span class="custom' + (achou ? '' : ' on') + '">De <input type="date" id="pde" min="' + esc(d.captacaoInicio) + '" max="' + esc(h) + '" value="' + esc(p.de) + '"> até <input type="date" id="pate" min="' + esc(d.captacaoInicio) + '" max="' + esc(h) + '" value="' + esc(p.ate) + '"> <button type="button" data-p="aplicar"' + (achou ? '' : ' class="on"') + '>Aplicar</button></span></div>';
  }
  function aplicarPeriodo(de, ate) {
    periodo = { de: de || '', ate: ate || '' };
    var q = [];
    if (de) q.push('de=' + de);
    if (ate) q.push('ate=' + ate);
    try { history.replaceState(null, '', location.pathname + (q.length ? '?' + q.join('&') : '')); } catch (e) { /* segue sem mexer na barra de endereço */ }
    carregar();
  }
  app.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-p]') : null;
    if (!b) return;
    var h = hojeAtual, k = b.getAttribute('data-p');
    if (k === 'tudo') return aplicarPeriodo('', '');
    if (k === 'hoje') return aplicarPeriodo(h, h);
    if (k === 'ontem') return aplicarPeriodo(somaDias(h, -1), somaDias(h, -1));
    if (k === '3') return aplicarPeriodo(somaDias(h, -2), h);
    if (k === '7') return aplicarPeriodo(somaDias(h, -6), h);
    if (k === 'aplicar') {
      var de = (document.getElementById('pde') || {}).value || '', ate = (document.getElementById('pate') || {}).value || '';
      if (de && !ate) ate = de;
      if (!de && ate) de = ate;
      aplicarPeriodo(de, ate);
    }
  });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n0(v) { return Number(v || 0).toLocaleString('pt-BR'); }
  function brl(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function pct(a, b) { return b ? (a / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—'; }
  function fdia(d) { var p = String(d).split('-'); return p[2] + '/' + p[1]; }
  function hora(iso) { try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }); } catch (e) { return ''; } }
  var PUB = { pq: 'Quente pago (PQ)', pf: 'Frio pago (PF)', organico: 'Quente orgânico', nc: 'Não classificado' };
  var ETAPA = { captacao: 'Captação', lembrete: 'Lembrete', vendas: 'Vendas', outra: 'Outra' };

  function goal(valor, meta, tipo, fmt) {
    if (meta == null) return '<div class="goal none">meta não definida</div>';
    var w = meta ? Math.min(100, valor / meta * 100) : 0;
    var ok = tipo === 'max' ? valor <= meta : valor >= meta;
    var cls = tipo === 'max' ? (ok ? 'ok' : 'over') : (ok ? 'ok' : '');
    var txt = tipo === 'max' ? (ok ? 'dentro do limite de ' : 'acima do limite de ') + fmt(meta) : pct(valor, meta) + ' da meta de ' + fmt(meta);
    return '<div class="bar ' + cls + '"><i style="width:' + w.toFixed(1) + '%"></i></div><div class="goal">' + esc(txt) + '</div>';
  }

  function kpi(label, num, sub, extra, hi) {
    return '<div class="kpi' + (hi ? ' highlight' : '') + '"><div class="label">' + esc(label) + '</div><div class="num">' + esc(num) + '</div>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') + (extra || '') + '</div>';
  }

  // As etapas podem se sobrepor (a captação segue durante o lembrete): cada uma tem o seu estado, pelas datas.
  function estadoEtapa(e, hoje) {
    if (e.fim && e.fim < hoje) return 'done';
    if (e.inicio && e.inicio <= hoje) return 'active';
    return 'locked';
  }
  function stepper(d) {
    return '<div class="stepper">' + d.etapas.map(function (e, i) {
      var cls = estadoEtapa(e, d.hoje);
      var fim = e.fim ? ' até ' + fdia(e.fim) : '';
      var quando = e.inicio ? (e.inicio > d.hoje ? 'abre em ' + fdia(e.inicio) + fim : 'desde ' + fdia(e.inicio) + fim) : 'data a definir';
      var estado = cls === 'done' ? 'concluída' : cls === 'active' ? 'em andamento' : 'aguardando';
      return '<div class="step ' + cls + '"><div class="n">Etapa ' + (i + 1) + ' · ' + estado + '</div><div class="t">' + esc(e.nome) + '</div><div class="d">' + esc(quando) + '</div>' + gastoDaEtapa(e, cls) + '</div>';
    }).join('') + '</div>' +
      (d.gastoSemEtapa > 0.005 ? '<div class="note" style="margin:8px 0 0">' + esc(brl(d.gastoSemEtapa)) + ' gastos em campanhas sem a etapa no nome (captação, lembrete ou venda); não entram nas etapas acima.</div>' : '');
  }
  // Quanto já foi gasto na etapa (anúncios do Meta com imposto + Google) contra a previsão dela. Sempre do total, mesmo com filtro de datas.
  function gastoDaEtapa(e, cls) {
    var g = e.gasto || 0, o = e.orcamento;
    if (o == null) return '<div class="gasto sem"><b>' + esc(brl(g)) + '</b> gastos · previsão de gasto ainda não definida</div>';
    var w = o ? Math.min(100, g / o * 100) : 0;
    if (cls === 'locked' && !g) return '<div class="gasto">Previsão: <b>' + esc(brl(o)) + '</b>' + (e.maisImposto ? ' · com imposto' : '') + '</div>';
    var rot = '<b>' + esc(brl(g)) + '</b> de ' + esc(brl(o)) + ' previstos';
    return '<div class="gasto">' + rot + '</div><div class="bar' + (g > o ? ' over' : '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
      '<div class="gasto">' + esc(pct(g, o)) + ' da previsão' + (e.maisImposto ? ' · previsão com imposto' : '') + '</div>';
  }

  function grafico(serie) {
    var max = Math.max.apply(null, serie.map(function (s) { return s.n; }).concat([1]));
    var cores = { pq: 'var(--pq)', pf: 'var(--pf)', organico: 'var(--org)', nc: 'var(--nc)' };
    var cols = serie.map(function (s) {
      var barras = ['pq', 'pf', 'organico', 'nc'].map(function (k) { return s[k] ? '<i style="height:' + (s[k] / max * 130).toFixed(1) + 'px;background:' + cores[k] + '"></i>' : ''; }).join('');
      return '<div class="col"><div class="v">' + n0(s.n) + '</div><div class="stack">' + barras + '</div><div class="d">' + esc(fdia(s.dia)) + '</div></div>';
    }).join('');
    var leg = ['pq', 'pf', 'organico', 'nc'].map(function (k) { return '<span><b style="background:' + cores[k] + '"></b>' + esc(PUB[k]) + '</span>'; }).join('');
    return '<div class="chart">' + cols + '</div><div class="legend">' + leg + '</div>';
  }

  function tabelaOrigem(canais, total) {
    var linhas = '';
    canais.forEach(function (c) {
      linhas += '<tr class="group"><td colspan="3">' + esc(c.rotulo) + ' — ' + n0(c.n) + '</td></tr>';
      c.detalhe.forEach(function (x) { linhas += '<tr><td>' + esc(x.rotulo) + '</td><td class="num-cell">' + n0(x.n) + '</td><td class="num-cell">' + pct(x.n, total) + '</td></tr>'; });
    });
    return '<div class="table-scroll"><table><thead><tr><th>Origem</th><th class="num-cell">Leads</th><th class="num-cell">%</th></tr></thead><tbody>' + linhas +
      '<tr class="total"><td>Total</td><td class="num-cell">' + n0(total) + '</td><td class="num-cell">100%</td></tr></tbody></table></div>';
  }

  function tabelaPublico(p, total, ncDet) {
    function sub(rotulo, n) { return '<tr class="sub"><td>' + esc(rotulo) + '</td><td class="num-cell">' + n0(n) + '</td><td class="num-cell">' + pct(n, total) + '</td></tr>'; }
    function ind(rotulo, n) { return '<tr><td class="ind">— ' + esc(rotulo) + '</td><td class="num-cell">' + n0(n) + '</td><td class="num-cell">' + pct(n, total) + '</td></tr>'; }
    var linhas = sub('Público quente', p.pq + p.organico) + ind('pago (PQ)', p.pq) + ind('orgânico', p.organico) +
      sub('Público frio (pago, PF)', p.pf) +
      sub('Não classificado', p.nc) + (ncDet || []).map(function (x) { return ind(x.rotulo, x.n); }).join('');
    return '<div class="table-scroll"><table><thead><tr><th>Público</th><th class="num-cell">Leads</th><th class="num-cell">%</th></tr></thead><tbody>' + linhas +
      '<tr class="total"><td>Total</td><td class="num-cell">' + n0(total) + '</td><td class="num-cell">100%</td></tr></tbody></table></div>';
  }

  function tabelaCriativos(cr) {
    if (!cr.length) return '<p class="note">Ainda sem leads de anúncio com criativo identificado.</p>';
    var linhas = cr.slice(0, 12).map(function (c) { return '<tr><td>' + esc(c.rotulo) + '</td><td class="num-cell">' + n0(c.meta) + '</td><td class="num-cell">' + n0(c.youtube_ads) + '</td><td class="num-cell">' + n0(c.n) + '</td></tr>'; }).join('');
    return '<div class="table-scroll"><table><thead><tr><th>Criativo (utm_content)</th><th class="num-cell">Meta</th><th class="num-cell">YouTube</th><th class="num-cell">Leads</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
  }

  function freqTxt(v) { return v ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'; }

  function blocoMeta(m, imposto, freqMax) {
    if (!m.ok) return '<div class="note">Meta Ads: ' + esc(m.motivo) + '. Assim que o token for ligado, os gastos e leads por campanha aparecem aqui.</div>';
    var linhas = m.campanhas.map(function (c) {
      var alta = freqMax && c.publico === 'pq' && c.frequencia > freqMax;
      return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(ETAPA[c.etapa]) + '</td><td class="num-cell">' + brl(c.gasto) + '</td><td class="num-cell">' + n0(c.cliques) + '</td><td class="num-cell">' + n0(c.leads) + '</td><td class="num-cell">' + (c.leads ? brl(c.gasto / c.leads) : '—') + '</td><td class="num-cell">' + (c.alcance ? n0(c.alcance) : '—') + '</td><td class="num-cell' + (alta ? ' alta' : '') + '">' + freqTxt(c.frequencia) + '</td></tr>';
    }).join('');
    var leads = m.campanhas.reduce(function (s, c) { return s + c.leads; }, 0);
    var tot = m.publicos && m.publicos.total;
    return '<div class="table-scroll"><table><thead><tr><th>Campanha</th><th>Etapa</th><th class="num-cell">Investido (c/ imposto)</th><th class="num-cell">Cliques</th><th class="num-cell">Leads (pixel)</th><th class="num-cell">Custo/lead</th><th class="num-cell">Alcance (pessoas)</th><th class="num-cell">Frequência</th></tr></thead><tbody>' + linhas +
      '<tr class="total"><td colspan="2">Total Meta</td><td class="num-cell">' + brl(m.gastoOperacao) + '</td><td></td><td class="num-cell">' + n0(leads) + '</td><td class="num-cell">' + (leads ? brl(m.gastoOperacao / leads) : '—') + '</td><td class="num-cell">' + (tot ? n0(tot.alcance) : '—') + '</td><td class="num-cell">' + (tot ? freqTxt(tot.frequencia) : '—') + '</td></tr></tbody></table></div>' +
      '<div class="note">Os valores do Meta já incluem ' + (imposto * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '% de imposto. Sem imposto: ' + brl(m.gastoOperacaoSemImposto) + '. O Google não cobra imposto.</div>' + blocoFrequencia(m, freqMax);
  }

  // Frequência por público, contando cada pessoa uma vez só (não é a soma das campanhas, que repetiria quem viu mais de uma).
  function blocoFrequencia(m, freqMax) {
    var p = m.publicos;
    if (!p) return '<div class="note">Frequência por público: o Meta não devolveu o alcance somado agora. A frequência de cada campanha aparece na tabela acima.</div>';
    var linhas = [['Público quente (campanhas PQ)', p.pq, true], ['Público frio (campanhas PF)', p.pf, false], ['Todas as campanhas da operação', p.total, false]].filter(function (x) { return x[1]; }).map(function (x) {
      var alta = freqMax && x[2] && x[1].frequencia > freqMax;
      return '<tr><td>' + esc(x[0]) + '</td><td class="num-cell">' + n0(x[1].alcance) + '</td><td class="num-cell">' + n0(x[1].impressoes) + '</td><td class="num-cell' + (alta ? ' alta' : '') + '">' + freqTxt(x[1].frequencia) + '</td></tr>';
    }).join('');
    return '<div class="section-title" style="font-size:18px;margin:26px 0 12px">Frequência por público (pessoas únicas)</div>' +
      '<div class="table-scroll"><table><thead><tr><th>Público</th><th class="num-cell">Pessoas alcançadas</th><th class="num-cell">Impressões</th><th class="num-cell">Frequência</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<div class="note">Frequência = quantas vezes, em média, cada pessoa alcançada viu os anúncios no período escolhido (impressões ÷ pessoas). No público quente, uma frequência alta que continua subindo indica saturação: escolha <b>Últimos 7 dias</b> no período para ver o que está acontecendo agora, sem o acumulado.' + (freqMax ? ' Em vermelho: acima do limite de ' + esc(freqTxt(freqMax)) + ' definido para o público quente.' : '') + '</div>';
  }

  function taxa(a, b) { return b ? (a / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—'; }

  function blocoFunil(m, g) {
    if (!m.ok) return '<div class="note">Funil do Meta: ' + esc(m.motivo) + '.</div>';
    var t = m.funil.total;
    var est = [['Cliques no link', t.linkCliques, ''], ['Visualizações da página', t.paginas, taxa(t.paginas, t.linkCliques) + ' dos cliques'], ['Leads (pixel)', t.leads, taxa(t.leads, t.paginas) + ' das visualizações']];
    var vis = '<div class="funnel">' + est.map(function (e, i) {
      return (i ? '<div class="arrow">›</div>' : '') + '<div class="stage"><div class="num">' + n0(e[1]) + '</div><div class="label">' + esc(e[0]) + '</div>' + (e[2] ? '<div class="rate">' + esc(e[2]) + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    function linha(rotulo, f) {
      return '<tr><td>' + esc(rotulo) + '</td><td class="num-cell">' + n0(f.linkCliques) + '</td><td class="num-cell">' + n0(f.paginas) + '</td><td class="num-cell">' + n0(f.leads) + '</td><td class="num-cell">' + taxa(f.paginas, f.linkCliques) + '</td><td class="num-cell">' + taxa(f.leads, f.paginas) + '</td><td class="num-cell">' + taxa(f.leads, f.linkCliques) + '</td></tr>';
    }
    var linhas = linha('Meta — total', m.funil.total) + linha('Público quente (PQ)', m.funil.pq) + linha('Público frio (PF)', m.funil.pf);
    if (m.funil.nc.linkCliques || m.funil.nc.leads) linhas += linha('Sem PQ/PF no nome', m.funil.nc);
    if (g) {
      var cap = g.campanhas.filter(function (c) { return c.etapa === 'captacao'; });
      var cli = cap.reduce(function (s, c) { return s + c.cliques; }, 0);
      var conv = cap.reduce(function (s, c) { return s + c.conversoes; }, 0);
      linhas += '<tr><td>Google Ads (inclui YouTube)</td><td class="num-cell">' + n0(cli) + '</td><td class="num-cell">—</td><td class="num-cell">' + n0(Math.round(conv)) + '</td><td class="num-cell">—</td><td class="num-cell">—</td><td class="num-cell">' + taxa(conv, cli) + '</td></tr>';
    }
    return vis + '<div class="table-scroll"><table><thead><tr><th>Etapa de captação</th><th class="num-cell">Cliques no link</th><th class="num-cell">Visualizações da página</th><th class="num-cell">Leads</th><th class="num-cell">Clique → página</th><th class="num-cell">Página → lead</th><th class="num-cell">Clique → lead</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<div class="note">Os leads do funil são os do pixel do Meta (só de anúncio). Os leads do topo da página vêm do ActiveCampaign e incluem o orgânico. O Google não informa visualização de página, por isso só mostra cliques e conversões.</div>';
  }

  function blocoOrcamento(o) {
    if (!o) return '';
    var w = Math.min(100, o.gasto / o.total * 100);
    var barra = '<div class="bar ' + (o.gasto > o.total ? 'over' : '') + '"><i style="width:' + w.toFixed(1) + '%"></i></div>';
    var cards = '<div class="kpi-grid">' +
      kpi('Orçamento total', brl(o.total), 'com imposto do Meta · Mega incluído', '', false) +
      kpi('Já gasto', brl(o.gasto), pct(o.gasto, o.total) + ' do orçamento', barra, true) +
      kpi('Saldo', brl(o.saldo), o.saldo < 0 ? 'orçamento estourado' : 'ainda disponível', '', false) + '</div>';
    var linhas = [[(o.megaNome || 'Mega') + ' (encerrado)', o.mega], ['Meta — operação (com imposto)', o.meta], ['Google — operação', o.google]].map(function (x) {
      return '<tr><td>' + esc(x[0]) + '</td><td class="num-cell">' + brl(x[1]) + '</td><td class="num-cell">' + pct(x[1], o.total) + '</td></tr>';
    }).join('');
    var tabela = '<div class="table-scroll" style="margin-top:12px"><table><thead><tr><th>Onde foi o dinheiro</th><th class="num-cell">Gasto</th><th class="num-cell">% do orçamento</th></tr></thead><tbody>' + linhas +
      '<tr class="total"><td>Total gasto</td><td class="num-cell">' + brl(o.gasto) + '</td><td class="num-cell">' + pct(o.gasto, o.total) + '</td></tr></tbody></table></div>';
    var aviso = o.parcial ? '<div class="note">Meta ou Google ainda sem leitura: o gasto pode estar abaixo do real até as duas fontes estarem ligadas.</div>' : '';
    return cards + tabela + aviso;
  }

  function blocoPesquisa(p, leads) {
    if (!p) return '<div class="note">Pesquisa de qualificação: o banco de dados ainda não está ligado ao relatório.</div>';
    var link = /^https?:/.test(p.link) ? p.link : location.origin + p.link;
    var kp = '<div class="kpi-grid" style="margin-bottom:14px">' +
      kpi('Respostas na captação', n0(p.total), intervalo(p.desde, p.ate), '', true) +
      kpi('Leads que responderam', pct(p.leadsQueResponderam, leads), n0(p.leadsQueResponderam) + ' ÷ ' + n0(leads) + ' leads captados (pelo e-mail)', '', false) + '</div>';
    if (!p.total) return kp + '<div class="note">Ainda sem respostas. O link do formulário, pra mandar aos leads, é <b>' + esc(link) + '</b></div>';
    var tabs = p.tabelas.map(function (t) {
      var soma = t.opcoes.reduce(function (s, o) { return s + o.n; }, 0);
      return '<div class="table-scroll"><table><thead><tr><th>' + esc(t.rotulo) + '</th><th class="num-cell">%</th><th class="num-cell">Respostas</th></tr></thead><tbody>' +
        t.opcoes.map(function (o) { return '<tr><td>' + esc(o.k) + '</td><td class="num-cell">' + pct(o.n, soma) + '</td><td class="num-cell">' + n0(o.n) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    });
    return kp + '<div class="two-col" style="align-items:start">' + tabs.map(function (h) { return '<div>' + h + '</div>'; }).join('') + '</div>' +
      '<div class="note">Formulário: <b>' + esc(link) + '</b>. Aqui entram só totais; nome, e-mail e respostas em texto ficam no banco e saem pelo arquivo de respostas, com senha.</div>';
  }

  function blocoGrupo(g, leads) {
    if (!g) return '<div class="note">Grupo de WhatsApp: aguardando a ligação com o DevZapp. Quando ligar, aparecem aqui quantas pessoas entraram no grupo e a conversão de lead pra grupo.</div>';
    if (g.base) {
      // Com a base informada: total do grupo = quem já estava + quem entrou depois (pelo DevZapp) - quem saiu.
      var novos = g.entraram - g.sairam;
      return '<div class="kpi-grid">' +
        kpi('Pessoas no grupo', n0(g.pessoasNoGrupo), 'já estavam ' + n0(g.base) + ' + ' + n0(novos) + ' entraram depois (DevZapp)' + (g.sairam ? ' · ' + n0(g.sairam) + ' saíram' : ''), '', true) +
        kpi('Conversão lead → grupo (estimativa)', pct(g.pessoasNoGrupo, leads), n0(g.pessoasNoGrupo) + ' no grupo ÷ ' + n0(leads) + ' leads captados', '', true) +
        kpi('Leads comprovados pelo telefone', n0(g.leadsQueEntraram), 'só entre os ' + n0(g.entraram) + ' que entraram depois da ligação', '', false) + '</div>' +
        '<div class="note">Os ' + n0(g.base) + ' que já estavam foram informados em ' + esc(fdia(g.baseEm)) + ' (total dos grupos da operação, sem os administradores) e não têm telefone, por isso a conversão é uma <b>estimativa</b>: ela supõe que quem está no grupo é lead. A partir da ligação do DevZapp a conta é por telefone, sem guardar o número.</div>';
    }
    if (!g.entraram) return '<div class="note">Grupo de WhatsApp: ligado, mas nenhuma entrada do DevZapp ' + esc(intervalo(g.desde, g.ate)) + '.</div>';
    return '<div class="kpi-grid">' +
      kpi('Entraram no grupo', n0(g.entraram), intervalo(g.desde, g.ate) + ' · todas as pessoas', '', true) +
      kpi('Leads que entraram', n0(g.leadsQueEntraram), 'leads captados encontrados no grupo pelo telefone', '', false) +
      kpi('Conversão lead → grupo', pct(g.leadsQueEntraram, leads), n0(g.leadsQueEntraram) + ' ÷ ' + n0(leads) + ' leads captados', '', true) +
      kpi('Saíram do grupo', n0(g.sairam), pct(g.sairam, g.entraram) + ' de quem entrou', '', false) + '</div>' +
      '<div class="note">O telefone dos leads e o do grupo são comparados por um código; o número em si nunca fica guardado no relatório.</div>';
  }

  function blocoGoogle(g) {
    if (!g) return '<div class="note">Google Ads: ainda não recebi dados. O script da conta precisa estar com o endereço e a senha de envio preenchidos.</div>';
    var temFreq = !!g.freq;
    var linhas = g.campanhas.map(function (c) { return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(ETAPA[c.etapa]) + '</td><td class="num-cell">' + brl(c.gasto) + '</td><td class="num-cell">' + n0(c.cliques) + '</td><td class="num-cell">' + n0(c.conversoes) + '</td><td class="num-cell">' + (c.conversoes ? brl(c.gasto / c.conversoes) : '—') + '</td>' + (temFreq ? '<td class="num-cell">' + freqTxt(c.frequencia) + '</td>' : '') + '</tr>'; }).join('');
    var conv = g.campanhas.reduce(function (s, c) { return s + c.conversoes; }, 0);
    var cli = g.campanhas.reduce(function (s, c) { return s + c.cliques; }, 0);
    return '<div class="table-scroll"><table><thead><tr><th>Campanha</th><th>Etapa</th><th class="num-cell">Investido</th><th class="num-cell">Cliques</th><th class="num-cell">Conversões</th><th class="num-cell">Custo/conv.</th>' + (temFreq ? '<th class="num-cell">Frequência</th>' : '') + '</tr></thead><tbody>' + linhas +
      '<tr class="total"><td colspan="2">Total Google</td><td class="num-cell">' + brl(g.gastoOperacao) + '</td><td class="num-cell">' + n0(cli) + '</td><td class="num-cell">' + n0(conv) + '</td><td class="num-cell">' + (conv ? brl(g.gastoOperacao / conv) : '—') + '</td>' + (temFreq ? '<td></td>' : '') + '</tr></tbody></table></div>' +
      '<div class="note">Dados do Google recebidos às ' + esc(hora(g.enviadoEm)) + '. As conversões vêm do próprio Google e podem diferir dos leads do ActiveCampaign.' +
      (temFreq ? ' Frequência do Google: ' + (g.freq.de ? 'de ' + esc(fdia(g.freq.de)) + ' a ' + esc(fdia(g.freq.ate)) + ', ' : '') + 'calculada pelo próprio Google e só para as campanhas de vídeo (YouTube); ela não acompanha o filtro de datas.' : ' A frequência do Google só existe para campanhas de vídeo e depende do script da conta; por enquanto não chegou.') + '</div>';
  }

  function kpiMega(m) {
    var g = m.gasto;
    var sub = (m.leads == null ? '' : n0(m.leads) + ' leads na tag · ') + 'evento encerrado · Meta com imposto' + (g.manual ? ' · valor informado em ' + fdia(g.em) : '');
    return kpi('Investimento — ' + (m.nome || 'Mega'), brl(g.valor), sub, '', false);
  }

  function render(d) {
    hojeAtual = d.hoje;
    var comp = d.periodo.completo;
    var L = d.leads;
    var quente = L.publico.pq + L.publico.organico;
    var quentePct = L.total ? quente / L.total * 100 : 0;
    var cpl = L.total && d.investimento.total ? d.investimento.total / L.total : 0;
    var vendasTrava = d.etapas.filter(function (e) { return e.id === 'vendas'; })[0];
    var vendasAberta = vendasTrava && vendasTrava.inicio && vendasTrava.inicio <= d.hoje;
    var pills = '<span class="pill ' + (d.fontes.activecampaign ? 'on' : 'off') + '">ActiveCampaign</span> · <span class="pill ' + (d.fontes.meta ? 'on' : 'off') + '">Meta Ads</span> · <span class="pill ' + (d.fontes.google ? 'on' : 'off') + '">Google Ads</span> · <span class="pill ' + (d.fontes.pesquisa ? 'on' : 'off') + '">Pesquisa</span> · <span class="pill ' + (d.fontes.whatsapp ? 'on' : 'off') + '">WhatsApp</span> · <span class="pill off">Hotmart</span>';

    var h = '';
    var ativas = d.etapas.filter(function (e) { return estadoEtapa(e, d.hoje) === 'active'; }).map(function (e) { return e.nome; }).join(' + ');
    h += '<header><div><div class="brand-tag">' + esc(d.cliente).toUpperCase() + ' · ETAPA: ' + esc(ativas || ETAPA[d.etapaAtual] || '').toUpperCase() + '</div><h1>' + esc(d.titulo) + '</h1></div>' +
      '<div class="meta"><span class="live"></span>Atualiza sozinho · última leitura às ' + esc(hora(d.geradoEm)) + '<br>Leads contados pelo último engajamento, ' + (comp ? 'desde ' + esc(fdia(d.periodo.de)) : esc(intervalo(d.periodo.de, d.periodo.ate))) + '</div></header>';
    h += stepper(d);
    h += barraPeriodo(d);
    if (!comp) h += '<div class="note" style="margin:0 0 18px">Você está vendo o período <b>' + esc(intervalo(d.periodo.de, d.periodo.ate)) + '</b>. O orçamento, o investimento do Mega e as metas continuam sendo do total da captação; escolha <b>Tudo</b> pra compará-los.</div>';
    if (d.orcamento) h += '<div class="section-title">Orçamento (total da captação)</div>' + blocoOrcamento(d.orcamento);

    // As metas (leads, custo por lead, orçamento, % quente) valem pro total; em recortes de data elas não aparecem.
    var gl = function (v, m, t, f) { return comp ? goal(v, m, t, f) : ''; };
    // Quanto falta pra fechar a captação e que ritmo diário isso pede pra bater a meta de leads.
    var cap = d.etapas.filter(function (e) { return e.id === 'captacao'; })[0];
    var faltamDias = (cap && cap.fim && cap.fim >= d.hoje) ? Math.round((new Date(cap.fim + 'T00:00:00Z') - new Date(d.hoje + 'T00:00:00Z')) / 86400000) + 1 : 0;
    var noDia = function (dia) { var x = L.serie.filter(function (s) { return s.dia === dia; })[0]; return x ? x.n : 0; };
    var ontem = new Date(new Date(d.hoje + 'T00:00:00Z').getTime() - 86400000).toISOString().slice(0, 10);
    var ritmo = '';
    if (comp && d.metas.leads && faltamDias) {
      ritmo = L.total >= d.metas.leads
        ? '<div class="goal">meta de leads já batida</div>'
        : '<div class="goal"><b>Meta diária: ~' + n0(Math.ceil((d.metas.leads - L.total) / faltamDias)) + ' leads por dia</b><br>faltam ' + n0(faltamDias) + ' dias (até ' + esc(fdia(cap.fim)) + ') · hoje ' + n0(noDia(d.hoje)) + ' · ontem ' + n0(noDia(ontem)) + '</div>';
    }
    h += '<div class="section-title">' + (comp ? 'Captação — resultado até agora' : 'Captação — resultado do período') + '</div><div class="kpi-grid">' +
      kpi('Leads captados', n0(L.total), 'tag ' + d.tagNome + ' · último engajamento', gl(L.total, d.metas.leads, 'min', n0) + ritmo, true) +
      kpi('Investimento (Meta + Google)', brl(d.investimento.total), 'Meta c/ imposto ' + (d.meta.ok ? brl(d.investimento.meta) : 'aguardando') + ' · Google ' + (d.google ? brl(d.investimento.google) : 'aguardando'), gl(d.investimento.total, d.metas.orcamento, 'max', brl), false) +
      kpi('Custo por lead', cpl ? brl(cpl) : '—', 'investimento ÷ leads', gl(cpl, d.metas.cplMax, 'max', brl), false) +
      kpi('Público', pct(quente, L.total) + ' quente', 'Quente ' + n0(quente) + ' (' + pct(quente, L.total) + ') · Frio ' + n0(L.publico.pf) + ' (' + pct(L.publico.pf, L.total) + ') · Sem classificação ' + n0(L.publico.nc) + ' (' + pct(L.publico.nc, L.total) + ')', gl(quentePct, d.metas.quentePct, 'min', function (v) { return v + '% de público quente'; }), false) +
      kpiMega(d.mega) + '</div>';

    h += '<div class="section-title">Leads por dia</div>' + grafico(L.serie);
    h += '<div class="section-title">De onde vieram</div><div class="two-col"><div>' + tabelaOrigem(L.canais, L.total) + '</div><div>' + tabelaPublico(L.publico, L.total, L.ncDetalhe) + '</div></div>';
    if (L.semData) h += '<div class="note">' + n0(L.semData) + ' contatos da tag estão sem "Data do último Engajamento" e não entram na contagem.</div>';
    if (d.truncado) h += '<div class="note warn">A lista de leads passou do limite de leitura. Os números podem estar abaixo do real; avisar quem mantém o relatório.</div>';

    h += '<div class="section-title">Funil do anúncio ao lead</div>' + blocoFunil(d.meta, d.google);
    h += '<div class="section-title">Anúncios que mais captam</div>' + tabelaCriativos(L.criativos);
    h += '<div class="section-title">Grupo de WhatsApp</div>' + blocoGrupo(d.grupo, L.total);
    h += '<div class="section-title">Pesquisa de qualificação</div>' + blocoPesquisa(d.pesquisa, L.total);
    h += '<div class="section-title">Meta Ads</div>' + blocoMeta(d.meta, d.impostoMeta, d.metas.frequenciaQuenteMax);
    h += '<div class="section-title">Google Ads (inclui YouTube Ads)</div>' + blocoGoogle(d.google);

    h += '<div class="section-title">Vendas — Hotmart</div>';
    if (!vendasAberta) {
      h += '<div class="locked-card"><div class="num">Abre em ' + esc(vendasTrava && vendasTrava.inicio ? fdia(vendasTrava.inicio) : 'data a definir') + '</div><p>O carrinho ainda não abriu. Faturamento, vendas e ROAS entram aqui quando a etapa de vendas começar.</p></div>';
    } else {
      h += '<div class="note">A etapa de vendas começou, mas a ligação com a Hotmart ainda não foi feita neste relatório.</div>';
    }

    h += '<footer><div>' + pills + '</div><div>Le · ' + esc(d.cliente) + ' · <a href="/sair" target="_top" style="color:inherit">Sair</a></div></footer>';
    app.innerHTML = h;
  }

  function carregar() {
    fetch(urlDados(), { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) { (window.top || window).location.href = '/entrar?volta=' + encodeURIComponent(location.pathname); throw new Error('Sessão expirada. Entre de novo.'); }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.erro ? j.erro : 'Erro ao carregar'); return j; });
    }).then(function (d) { erro.style.display = 'none'; render(d); }).catch(function (e) {
      erro.textContent = e.message + (app.textContent.indexOf('Carregando') === 0 ? '' : ' Mostrando a última leitura.');
      erro.style.display = 'block';
    });
  }
  carregar();
  setInterval(carregar, 60000);
})();
</script>
</body>
</html>`;

// ---------------------------------------------------------------- relatórios encerrados
// Operação Barro Branco 27 (turma de 2027; a captação e o carrinho foram em ago e set de 2026), retrato de 2026-09-18 (fonte: clientes/teorema-militar/barro-branco-2026/relatorio.html).
// O Meta desta página inclui os 13,85% de imposto (corrigido em 2026-09-21). Se mudar a fonte, cole de novo aqui.
const BARRO_BRANCO_2026 = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Operação Barro Branco 2027 — Relatório</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Titillium+Web:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #090915;
    --card: #151928;
    --accent: #FAE60D;
    --black: #070707;
    --text: #F2F2F5;
    --text-weak: #8B8FA3;
    --line: #262b40;
    --good: #4ADE80;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Titillium Web', sans-serif;
    padding: 32px 16px 64px;
    background-image:
      radial-gradient(circle at 10% 0%, rgba(250,230,13,0.06), transparent 40%),
      radial-gradient(circle at 90% 20%, rgba(21,25,40,0.8), transparent 50%);
  }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1, h2, h3, .num {
    font-family: 'Big Shoulders Display', sans-serif;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  header {
    display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 20px; margin-bottom: 32px; flex-wrap: wrap; gap: 12px;
  }
  .brand-tag {
    font-size: 12px; letter-spacing: 0.15em; color: var(--accent);
    font-family: 'Titillium Web', sans-serif; font-weight: 700;
  }
  header h1 { font-size: clamp(32px, 5vw, 52px); line-height: 1; margin-top: 4px; }
  header .meta { text-align: right; font-size: 13px; color: var(--text-weak); }

  .section-title {
    font-size: 22px; margin: 40px 0 16px; padding-left: 12px;
    border-left: 4px solid var(--accent);
  }

  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .kpi {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 18px;
  }
  .kpi .label { font-size: 12px; color: var(--text-weak); text-transform: uppercase; letter-spacing: 0.08em; }
  .kpi .num { font-size: 30px; color: var(--accent); margin-top: 6px; }
  .kpi .sub { font-size: 12px; color: var(--text-weak); margin-top: 4px; }
  .kpi.highlight { border-color: var(--accent); background: linear-gradient(135deg, var(--card), #1d1408); }
  .kpi.highlight .num { color: var(--accent); font-size: 34px; }

  table {
    width: 100%; border-collapse: collapse; background: var(--card);
    border-radius: 10px; overflow: hidden; font-size: 14px;
  }
  th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--line); }
  th {
    background: var(--black); color: var(--accent);
    font-family: 'Titillium Web', sans-serif; font-weight: 700;
    text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em;
  }
  tr:last-child td { border-bottom: none; }
  tr.total td { font-weight: 700; color: var(--accent); background: rgba(250,230,13,0.05); }
  td.num-cell { text-align: right; font-variant-numeric: tabular-nums; }

  .funnel {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: stretch;
  }
  .funnel .stage {
    flex: 1; min-width: 140px; background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 18px; text-align: center; position: relative;
  }
  .funnel .stage .num { font-size: 28px; color: var(--accent); }
  .funnel .stage .label { font-size: 12px; color: var(--text-weak); margin-top: 6px; text-transform: uppercase; }
  .funnel .arrow { display: flex; align-items: center; color: var(--accent); font-size: 20px; padding: 0 4px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 720px) { .two-col { grid-template-columns: 1fr; } }

  .note {
    font-size: 13px; color: var(--text-weak); background: var(--card);
    border-left: 3px solid var(--accent); padding: 12px 16px; border-radius: 4px; margin-top: 12px;
  }
  footer {
    margin-top: 48px; padding-top: 16px; border-top: 1px solid var(--line);
    font-size: 12px; color: var(--text-weak); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;
  }
  .pill {
    display: inline-block; padding: 2px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
  }
  .pill.on { background: rgba(74,222,128,0.15); color: var(--good); }
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <div class="brand-tag">07/26 · RETA FINAL BARRO BRANCO</div>
      <h1>Operação Barro Branco</h1>
    </div>
    <div class="meta">
      Teorema Militar · Produto: TM Full — Barro Branco (APMBB)<br>
      Captação: 16/08 – 15/09/2026 · Carrinho (lançamento): 01/09 – 13/09/2026<br>
      Relatório gerado em 18/09/2026
    </div>
  </header>

  <div class="section-title">Resultado do lançamento</div>
  <div class="kpi-grid">
    <div class="kpi highlight">
      <div class="label">Faturamento bruto — lançamento</div>
      <div class="num">R$ 145.192</div>
      <div class="sub">101 vendas (97 novas + 4 renovações) · 01/09 a 13/09</div>
    </div>
    <div class="kpi highlight">
      <div class="label">Faturamento líquido — lançamento</div>
      <div class="num">R$ 135.226</div>
      <div class="sub">bruto − taxas Hotmart</div>
    </div>
    <div class="kpi">
      <div class="label">Investimento total (Meta + Google)</div>
      <div class="num">R$ 14.591</div>
      <div class="sub">Meta R$ 10.735 (Operação + Mega, c/ imposto de 13,85%) · Google R$ 3.855</div>
    </div>
    <div class="kpi">
      <div class="label">ROAS do lançamento</div>
      <div class="num">9,95x</div>
      <div class="sub">bruto ÷ investimento · líquido: 9,27x</div>
    </div>
    <div class="kpi">
      <div class="label">Leads captados (Active Campaign)</div>
      <div class="num">753</div>
      <div class="sub">custo/lead ≈ R$ 10,08</div>
    </div>
    <div class="kpi">
      <div class="label">Grupo de WhatsApp</div>
      <div class="num">556</div>
      <div class="sub">leads no grupo</div>
    </div>
  </div>

  <div class="note">
    Fora da janela oficial do carrinho (01/09–13/09) também houve venda: <b>26 vendas (R$ 40.755,42)</b> entre 03/08 e 31/08,
    na fase de captação/aquecimento, e <b>17 vendas (R$ 25.350,02)</b> entre 14/09 e 17/09 (corte deste relatório).
    Não entram na meta do lançamento, mas mostram receita residual do funil.<br><br>
    <b>Total geral até ontem (17/09), somando os três períodos:</b> 144 vendas · faturamento bruto <b>R$ 211.297,37</b> ·
    faturamento líquido <b>R$ 196.799,62</b>.
  </div>

  <div class="section-title">Funil completo — do lead à venda</div>

  <p style="margin:18px 0 8px; font-size:13px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.06em;">Etapa 1 — Leads do Mega Revisão (aquecimento gratuito, aconteceu antes)</p>
  <div class="kpi-grid" style="margin-bottom:10px">
    <div class="kpi"><div class="label">Total de leads do Mega</div><div class="num">1.328</div></div>
  </div>

  <p style="margin:18px 0 8px; font-size:13px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.06em;">Etapa 2 — Leads captados na Operação (só OP.BB.26, sem misturar com o Mega)</p>
  <div class="kpi-grid" style="margin-bottom:10px">
    <div class="kpi highlight"><div class="label">Total de leads</div><div class="num">753</div></div>
    <div class="kpi highlight"><div class="label">Público quente (total)</div><div class="num">503</div><div class="sub">67% · PQ 25% + orgânico 42%</div></div>
    <div class="kpi"><div class="label">Público frio (PF, pago)</div><div class="num">234</div><div class="sub">31%</div></div>
  </div>
  <table>
    <thead><tr><th>Origem específica (Source + Term cruzados)</th><th class="num-cell">Leads</th></tr></thead>
    <tbody>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Meta Ads — anúncio pago (323)</td></tr>
      <tr><td>Placement Reels</td><td class="num-cell">188</td></tr>
      <tr><td>Placement Stories</td><td class="num-cell">89</td></tr>
      <tr><td>Placement Feed</td><td class="num-cell">41</td></tr>
      <tr><td>Placement não identificado</td><td class="num-cell">5</td></tr>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">YouTube Ads — anúncio pago (103)</td></tr>
      <tr><td>Lookalike visitantes do site — frio</td><td class="num-cell">71</td></tr>
      <tr><td>Site Teorema Militar — quente</td><td class="num-cell">26</td></tr>
      <tr><td>Vídeo Barro Branco — quente</td><td class="num-cell">6</td></tr>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Instagram orgânico — postagem, não é anúncio (261)</td></tr>
      <tr><td>Stories</td><td class="num-cell">180</td></tr>
      <tr><td>Bio (link na bio)</td><td class="num-cell">69</td></tr>
      <tr><td><b>ManyChat</b> (automação de resposta no direct/comentário)</td><td class="num-cell">12</td></tr>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Outros (66)</td></tr>
      <tr><td>Direto (digitou o link)</td><td class="num-cell">44</td></tr>
      <tr><td>YouTube orgânico</td><td class="num-cell">10</td></tr>
      <tr><td>Sem origem identificada</td><td class="num-cell">11</td></tr>
      <tr><td>Flyer</td><td class="num-cell">1</td></tr>
    </tbody>
  </table>

  <p style="margin:18px 0 8px; font-size:13px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.06em;">Etapa 3 — As 144 vendas do produto, de onde vieram</p>
  <table>
    <thead><tr><th>Origem (tag no Active)</th><th class="num-cell">Vendas</th><th class="num-cell">%</th></tr></thead>
    <tbody>
      <tr><td>Só lead da Operação (OP.BB.26)</td><td class="num-cell">49</td><td class="num-cell">34%</td></tr>
      <tr><td>Passou pelo Mega E pela Operação</td><td class="num-cell">13</td><td class="num-cell">9%</td></tr>
      <tr><td>Só lead do Mega (nunca entrou na captação da Operação)</td><td class="num-cell">12</td><td class="num-cell">8%</td></tr>
      <tr><td>Não encontrado (nem email, nem telefone batem com nenhuma lista)</td><td class="num-cell">70</td><td class="num-cell">49%</td></tr>
      <tr class="total"><td>Total de vendas</td><td class="num-cell">144</td><td class="num-cell">100%</td></tr>
    </tbody>
  </table>
  <p style="margin:14px 0 6px; font-size:12px; color:var(--text-weak);">Detalhe: de onde vieram as 25 vendas que passaram pelo Mega (as 12 só-Mega + as 13 que passaram pelos dois)</p>
  <table>
    <thead><tr><th>Origem do lead</th><th class="num-cell">Vendas</th></tr></thead>
    <tbody>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Só Mega (12)</td></tr>
      <tr><td>Meta Ads — Captação Mega (frio ou quente)</td><td class="num-cell">3</td></tr>
      <tr><td>Instagram orgânico (post/story do Mega)</td><td class="num-cell">9</td></tr>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Passou pelos dois — Mega e Operação (13)</td></tr>
      <tr><td>Meta Ads — Captação Operação</td><td class="num-cell">5</td></tr>
      <tr><td>Instagram orgânico (campanha da Operação)</td><td class="num-cell">8</td></tr>
    </tbody>
  </table>
  <p style="margin:18px 0 8px; font-size:13px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.06em;">Etapa 4 — Dos que a gente achou (78 de 143), que público eram</p>
  <table>
    <thead><tr><th>Público de quem comprou</th><th class="num-cell">Vendas</th></tr></thead>
    <tbody>
      <tr class="total"><td>Quente (total: orgânico + pago)</td><td class="num-cell">67</td></tr>
      <tr><td>— orgânico Instagram: Stories (conteúdo "cesar")</td><td class="num-cell">30</td></tr>
      <tr><td>— orgânico Instagram: Bio (conteúdo "cesar")</td><td class="num-cell">13</td></tr>
      <tr><td>— orgânico Instagram: ManyChat (conteúdo "cesar")</td><td class="num-cell">3</td></tr>
      <tr><td>— orgânico/direto: outros</td><td class="num-cell">4</td></tr>
      <tr><td>— pago (PQ)</td><td class="num-cell">17</td></tr>
      <tr><td>Frio (PF, pago)</td><td class="num-cell">7</td></tr>
      <tr><td>Não classificado</td><td class="num-cell">4</td></tr>
    </tbody>
  </table>

  <p style="margin:18px 0 8px; font-size:13px; color:var(--text-weak); text-transform:uppercase; letter-spacing:0.06em;">Etapa 5 — Conversão real da Operação (leads → venda, sem misturar com o Mega)</p>
  <div class="kpi-grid">
    <div class="kpi highlight"><div class="label">753 leads da Operação → 62 compraram</div><div class="num">8,2%</div><div class="sub">62 = os 49 só-Operação + os 13 que também passaram pelo Mega</div></div>
  </div>

  <div class="section-title">Anúncios pagos que mais converteram</div>
  <table>
    <thead><tr><th>Plataforma</th><th>Anúncio</th><th class="num-cell">Vendas</th></tr></thead>
    <tbody>
      <tr><td>Meta Ads</td><td>Cap_AdV_001 - institucional</td><td class="num-cell">6</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdE_001 - institucional curto</td><td class="num-cell">5</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdV_010 - Temática (evento libera matrícula c/ desconto)</td><td class="num-cell">3</td></tr>
      <tr><td>YouTube Ads</td><td>001_institucional</td><td class="num-cell">2</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdE_002 - institucional longo</td><td class="num-cell">1</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdV_0011 - Pattern interrupt "Para, para, para"</td><td class="num-cell">1</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdV_003 - demora pra passar</td><td class="num-cell">1</td></tr>
      <tr><td>Meta Ads</td><td>Cap_AdV_002 - Sei o que tenho que fazer e não faço</td><td class="num-cell">1</td></tr>
      <tr><td>YouTube Ads</td><td>007_reprovados</td><td class="num-cell">1</td></tr>
      <tr><td>YouTube Ads</td><td>011_pattern_interrupt_para_para_para</td><td class="num-cell">1</td></tr>
    </tbody>
  </table>
  <div class="section-title">YouTube Ads: público quente x frio</div>
  <table>
    <thead><tr><th>Público</th><th>Conjunto</th><th class="num-cell">Leads</th><th class="num-cell">Vendas</th><th class="num-cell">Conversão</th></tr></thead>
    <tbody>
      <tr><td>Frio</td><td>Lookalike de visitantes do site</td><td class="num-cell">72</td><td class="num-cell">0</td><td class="num-cell">0%</td></tr>
      <tr><td>Quente</td><td>Site Teorema Militar</td><td class="num-cell">30</td><td class="num-cell">3</td><td class="num-cell">10%</td></tr>
      <tr><td>Quente</td><td>VV Barro Branco</td><td class="num-cell">7</td><td class="num-cell">1</td><td class="num-cell">14,29%</td></tr>
    </tbody>
  </table>
  <div class="section-title">Meta Ads</div>
  <table>
    <thead><tr><th>Campanha</th><th class="num-cell">Investido (c/ imposto)</th></tr></thead>
    <tbody>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Operação Barro Branco (OP.BB.26)</td></tr>
      <tr><td>Captação — Leads — PQ [AGO.26]</td><td class="num-cell">R$ 3.456,96</td></tr>
      <tr><td>Captação — Leads — PF [AGO.26]</td><td class="num-cell">R$ 1.761,23</td></tr>
      <tr><td><b>Lembrete</b> — Aquecimento Live — PQ [AGO.26]</td><td class="num-cell">R$ 536,95</td></tr>
      <tr><td>Carrinho Aberto — Venda [SET.26]</td><td class="num-cell">R$ 848,02</td></tr>
      <tr class="total"><td>Subtotal Operação</td><td class="num-cell">R$ 6.603,16</td></tr>
      <tr><td colspan="2" style="color:var(--text-weak); font-size:11px; text-transform:uppercase; background:var(--black)">Mega Revisão — aquecimento gratuito (MEGA.BB.26)</td></tr>
      <tr><td>Aquecimento — Live — PQ [JUN.26]</td><td class="num-cell">R$ 550,27</td></tr>
      <tr><td>Captação — Leads — PF [JUL.26]</td><td class="num-cell">R$ 2.312,11</td></tr>
      <tr><td>Captação — Leads — PQ [JUL.26]</td><td class="num-cell">R$ 1.269,60</td></tr>
      <tr class="total"><td>Subtotal Mega Revisão</td><td class="num-cell">R$ 4.131,98</td></tr>
      <tr class="total"><td>Total Meta (Operação + Mega)</td><td class="num-cell">R$ 10.735,14</td></tr>
    </tbody>
  </table>

  <p style="margin:14px 0 6px; font-size:12px; color:var(--text-weak);">O que o pixel do Meta rastreou em cada etapa (dado direto da plataforma, não cruzado com Hotmart)</p>
  <table>
    <thead><tr><th>Campanha</th><th>O que rastreou</th><th class="num-cell">Resultado</th><th class="num-cell">Custo/resultado</th></tr></thead>
    <tbody>
      <tr><td>Captação — PQ [AGO.26]</td><td>Leads</td><td class="num-cell">267</td><td class="num-cell">R$ 12,95</td></tr>
      <tr><td>Captação — PF [AGO.26]</td><td>Leads</td><td class="num-cell">205</td><td class="num-cell">R$ 8,59</td></tr>
      <tr><td>Lembrete — Aquecimento Live</td><td>Cliques no link</td><td class="num-cell">1.300</td><td class="num-cell">R$ 0,41</td></tr>
      <tr class="total"><td>Carrinho Aberto — Venda</td><td><b>Compras (pixel)</b></td><td class="num-cell"><b>34</b></td><td class="num-cell">R$ 24,94</td></tr>
    </tbody>
  </table>
  <div class="section-title">Google Ads</div>
  <div class="kpi-grid" style="margin-bottom:14px">
    <div class="kpi"><div class="label">Cliques</div><div class="num">2.657</div></div>
    <div class="kpi"><div class="label">Impressões</div><div class="num">427.660</div></div>
    <div class="kpi"><div class="label">Conversões</div><div class="num">112</div></div>
    <div class="kpi"><div class="label">Custo/conversão</div><div class="num">R$ 34</div></div>
  </div>
  <table>
    <thead><tr><th>Campanha</th><th class="num-cell">Cliques</th><th class="num-cell">Conv.</th><th class="num-cell">Custo</th></tr></thead>
    <tbody>
      <tr><td>Captação — PF</td><td class="num-cell">1.191</td><td class="num-cell">72</td><td class="num-cell">R$ 1.184,56</td></tr>
      <tr><td>Captação — PQ</td><td class="num-cell">478</td><td class="num-cell">39</td><td class="num-cell">R$ 1.184,09</td></tr>
      <tr><td>Carrinho Aberto — Venda</td><td class="num-cell">328</td><td class="num-cell">1</td><td class="num-cell">R$ 583,78</td></tr>
      <tr><td>Aquecimento</td><td class="num-cell">384</td><td class="num-cell">0</td><td class="num-cell">R$ 497,01</td></tr>
      <tr><td>Display — Carrinho Aberto</td><td class="num-cell">276</td><td class="num-cell">0</td><td class="num-cell">R$ 405,94</td></tr>
      <tr class="total"><td>Total Google</td><td class="num-cell">2.657</td><td class="num-cell">112</td><td class="num-cell">R$ 3.855,38</td></tr>
    </tbody>
  </table>
  <div class="section-title">Pesquisa de qualificação (quiz)</div>
  <div class="kpi-grid" style="margin-bottom:14px">
    <div class="kpi highlight"><div class="label">Respostas em 2026</div><div class="num">107</div><div class="sub">de 347 respostas totais na base (2025+2026)</div></div>
    <div class="kpi"><div class="label">Grupo de WhatsApp</div><div class="num">556</div><div class="sub">leads no grupo</div></div>
  </div>
  <div class="two-col">
    <div>
      <table>
        <thead><tr><th>Quantas vezes já fez a prova</th><th class="num-cell">%</th></tr></thead>
        <tbody>
          <tr><td>Nenhuma</td><td class="num-cell">34,6%</td></tr>
          <tr><td>1 vez</td><td class="num-cell">30,8%</td></tr>
          <tr><td>2 vezes</td><td class="num-cell">21,5%</td></tr>
          <tr><td>3 vezes</td><td class="num-cell">7,5%</td></tr>
          <tr><td>4 ou mais</td><td class="num-cell">5,6%</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>Nível de experiência</th><th class="num-cell">%</th></tr></thead>
        <tbody>
          <tr><td>Estudando, mas sente que não está aprendendo direito</td><td class="num-cell">37,4%</td></tr>
          <tr><td>Já fez provas, sabe o conteúdo, mas desempenho não satisfaz</td><td class="num-cell">30,8%</td></tr>
          <tr><td>Nenhuma experiência, acabou de conhecer o universo</td><td class="num-cell">27,1%</td></tr>
          <tr><td>Foi bem nas provas, não passou por um detalhe</td><td class="num-cell">4,7%</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section-title">Hotmart — Vendas por período</div>
  <table>
    <thead><tr><th>Período</th><th class="num-cell">Vendas</th><th class="num-cell">Novas / Renovações</th><th class="num-cell">Faturamento bruto</th><th class="num-cell">Líquido</th></tr></thead>
    <tbody>
      <tr class="total"><td>Lançamento (01/09 – 13/09, horário BR) — oficial</td><td class="num-cell">101</td><td class="num-cell">97 / 4</td><td class="num-cell">R$ 145.191,93</td><td class="num-cell">R$ 135.226,46</td></tr>
      <tr><td>Anteriores (03/08 – 31/08 — captação/aquecimento)</td><td class="num-cell">26</td><td class="num-cell">21 / 5</td><td class="num-cell">R$ 40.755,42</td><td class="num-cell">R$ 37.957,00</td></tr>
      <tr><td>Posteriores (14/09 – 17/09, corte deste relatório)</td><td class="num-cell">17</td><td class="num-cell">15 / 2</td><td class="num-cell">R$ 25.350,02</td><td class="num-cell">R$ 23.616,16</td></tr>
      <tr class="total"><td>Total geral</td><td class="num-cell">144</td><td class="num-cell">133 / 11</td><td class="num-cell">R$ 211.297,37</td><td class="num-cell">R$ 196.799,62</td></tr>
    </tbody>
  </table>

  <div class="section-title">Funil combinado — Mega + Operação juntos, sem duplicar</div>
  <div class="kpi-grid" style="margin-bottom:10px">
    <div class="kpi highlight"><div class="label">Total de leads únicos</div><div class="num">1.946</div><div class="sub">753 + 1.328 − 135 que estavam nas duas listas</div></div>
    <div class="kpi"><div class="label">Público quente (total)</div><div class="num">1.007</div><div class="sub">52%</div></div>
    <div class="kpi"><div class="label">Público frio</div><div class="num">841</div><div class="sub">43%</div></div>
  </div>

  <p style="margin:14px 0 6px; font-size:12px; color:var(--text-weak);">Conversão cruzada: canal × público (cada canal, aberto em quente/frio)</p>
  <table>
    <thead><tr><th>Canal</th><th>Público</th><th class="num-cell">Leads</th><th class="num-cell">Vendas</th><th class="num-cell">Conversão</th></tr></thead>
    <tbody>
      <tr><td rowspan="3">Meta Ads</td><td>Quente (PQ)</td><td class="num-cell">277</td><td class="num-cell">12</td><td class="num-cell">4,33%</td></tr>
      <tr><td>Frio (PF)</td><td class="num-cell">770</td><td class="num-cell">5</td><td class="num-cell">0,65%</td></tr>
      <tr><td>Não classificado</td><td class="num-cell">33</td><td class="num-cell">0</td><td class="num-cell">0%</td></tr>
      <tr><td rowspan="2">YouTube Ads</td><td>Quente (PQ)</td><td class="num-cell">32</td><td class="num-cell">4</td><td class="num-cell"><b>12,50%</b></td></tr>
      <tr><td>Frio (PF)</td><td class="num-cell">71</td><td class="num-cell">0</td><td class="num-cell">0%</td></tr>
      <tr><td>Instagram orgânico</td><td>Quente (orgânico)</td><td class="num-cell">628</td><td class="num-cell">49</td><td class="num-cell">7,80%</td></tr>
      <tr><td>YouTube orgânico</td><td>Quente (orgânico)</td><td class="num-cell">10</td><td class="num-cell">1</td><td class="num-cell">10%</td></tr>
      <tr><td>Direto</td><td>Quente (orgânico)</td><td class="num-cell">57</td><td class="num-cell">0</td><td class="num-cell">0%</td></tr>
      <tr><td>Outro / sem origem</td><td>Não classificado</td><td class="num-cell">68</td><td class="num-cell">3</td><td class="num-cell">4,41%</td></tr>
    </tbody>
  </table>

  <footer>
    <div>Meta Ads <span class="pill on">conectado</span> · Google Ads <span class="pill on">CSV</span> · ActiveCampaign <span class="pill on">conectado</span> · Hotmart <span class="pill on">conectado</span></div>
    <div>Le · Teorema Militar</div>
  </footer>

  <div class="section-title">Comparação com 2025 — mesma janela de carrinho, ano a ano</div>
  <table>
    <thead><tr><th>Métrica</th><th class="num-cell">2025 (07/08–18/08)</th><th class="num-cell">2026 (01/09–13/09)</th></tr></thead>
    <tbody>
      <tr><td>Leads captados (Operação)</td><td class="num-cell">1.659</td><td class="num-cell">753</td></tr>
      <tr><td>Investimento total</td><td class="num-cell">R$ 36.085,57</td><td class="num-cell">R$ 14.590,52</td></tr>
      <tr><td>Vendas no lançamento</td><td class="num-cell">91</td><td class="num-cell">101</td></tr>
      <tr><td>Faturamento bruto</td><td class="num-cell">R$ 135.320,86</td><td class="num-cell">R$ 145.191,93</td></tr>
      <tr><td>Faturamento líquido</td><td class="num-cell">R$ 126.020,58</td><td class="num-cell">R$ 135.226,46</td></tr>
      <tr class="total"><td>ROAS bruto</td><td class="num-cell">3,75x</td><td class="num-cell">9,95x</td></tr>
      <tr class="total"><td>ROAS líquido</td><td class="num-cell">3,49x</td><td class="num-cell">9,27x</td></tr>
      <tr><td>Conversão público quente</td><td class="num-cell">7,16%</td><td class="num-cell">11,13%</td></tr>
      <tr><td>Conversão público frio</td><td class="num-cell">1,04%</td><td class="num-cell">1,28%</td></tr>
    </tbody>
  </table>
  <div class="note">Todo valor do Meta de 2026 neste relatório já inclui os 13,85% de imposto (atualizado em 21/09/2026). Os valores de 2025 estão como no relatório anterior; não confirmei se já incluem o imposto.</div>
  <p style="margin:14px 0 6px; font-size:12px; color:var(--text-weak);">Prova real: o aquecimento gratuito converteu, nos dois anos?</p>
  <table>
    <thead><tr><th></th><th class="num-cell">Investimento</th><th class="num-cell">Leads</th><th class="num-cell">Foram pra Operação</th><th class="num-cell">Compraram</th><th class="num-cell">Conversão</th><th class="num-cell">Faturamento líquido (de quem comprou)</th><th class="num-cell">ROAS líquido</th></tr></thead>
    <tbody>
      <tr><td>2025 — Ultimato</td><td class="num-cell">R$ 3.216,42</td><td class="num-cell">824</td><td class="num-cell">98 (11,9%)</td><td class="num-cell">18</td><td class="num-cell">2,18%</td><td class="num-cell">R$ 26.240,60</td><td class="num-cell">8,16x</td></tr>
      <tr><td>2026 — Mega Revisão</td><td class="num-cell">R$ 4.131,98</td><td class="num-cell">1.328</td><td class="num-cell">135 (10,2%)</td><td class="num-cell">25</td><td class="num-cell">1,88%</td><td class="num-cell">R$ 34.985,67</td><td class="num-cell">8,47x</td></tr>
    </tbody>
  </table>
  <div class="note">Só quem comprou depois de passar pelo aquecimento já rendeu cerca de 8x o investimento gasto no próprio aquecimento — nos dois anos o evento gratuito se pagou várias vezes com essa fatia de vendas.</div>
  <p style="margin:14px 0 6px; font-size:12px; color:var(--text-weak);">Vendas fora da janela do carrinho — antes e depois, 2025 x 2026</p>
  <table>
    <thead><tr><th>Período</th><th class="num-cell">2025</th><th class="num-cell">2026</th></tr></thead>
    <tbody>
      <tr><td>Anteriores (antes do carrinho abrir)</td><td class="num-cell">26 vendas · R$ 39.058,27</td><td class="num-cell">26 vendas · R$ 40.755,42</td></tr>
      <tr><td>Posteriores (+4 dias após fechar)</td><td class="num-cell">3 vendas · R$ 45.236,10</td><td class="num-cell">17 vendas · R$ 25.350,02</td></tr>
    </tbody>
  </table>
  <div class="note">
    Diferença explicada: em 2026 o comercial passou a atuar depois do fechamento, o que não existia em 2025. No dia 14/09
    (um dia após o carrinho fechar) saiu um disparo de reativação para 1.447 contatos, e a partir dele o time fechou venda
    de Full APMBB até 17/09 — 11 vendas identificadas nesse relatório do comercial, entre R$ 134,44 e R$ 1.499,90 cada,
    a maioria pela campanha "Campanha em Massa (APMBB)". Sem esse trabalho pós-carrinho, 2026 teria ficado bem mais perto
    do padrão de 2025 nessa janela.
  </div>
</div>
</body>
</html>
`;

// ---------------------------------------------------------------- logos
// Arquivos da Identidade Visual do Teorema (recebidos em 2026-09-21), como SVG dentro da página: a cor vem do texto (currentColor).
// Pra acrescentar a logo de uma escola: cole o SVG dela em LOGOS_ESCOLA, com o mesmo nome usado em escola (OPERACOES / ARQUIVO).
const LOGO_TM = '<svg fill="currentColor" role="img" aria-label="Teorema Militar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1279.72 306.93"><g><g><g><path d="m412.48,108.28V26.29h-45.51V1.48h121.92v24.81h-45.84v81.99h-30.56Z"/><path d="m499.24,1.48h99.74v24.81h-69.01v16.43h58.49v23.5h-58.49v17.25h69.01v24.81h-99.74V1.48Z"/><path d="m736.99,54.88c0,36.31-20.87,54.88-62.93,54.88s-63.09-18.57-63.09-54.88S631.84,0,674.06,0s62.93,18.57,62.93,54.88Zm-93.99,0c0,18.57,10.19,28.59,31.05,28.59s30.89-10.02,30.89-28.59-10.19-28.59-30.89-28.59-31.05,10.02-31.05,28.59Z"/><path d="m750.96,108.28V1.48h67.86c31.22,0,44.69,11.34,44.69,38.94,0,15.94-8.38,27.11-23.17,32.37l19.39,35.49h-33.36l-16.27-31.55h-28.43v31.55h-30.73Zm65.56-53.07c8.71,0,14.95-3.94,14.95-13.64s-6.24-13.8-14.95-13.8h-34.83v27.44h34.83Z"/><path d="m879.13,1.48h99.74v24.81h-69.01v16.43h58.49v23.5h-58.49v17.25h69.01v24.81h-99.74V1.48Z"/><path d="m995.62,108.28V1.48h43.87l25.47,56.03,25.3-56.03h43.87v106.8h-30.56V36.31l-23.82,52.58h-29.74l-23.83-52.58v71.97h-30.56Z"/><path d="m1144.49,108.28L1194.77,1.48h34.67l50.28,106.8h-32.04l-8.22-18.07h-54.55l-8.38,18.07h-32.04Zm84.95-40.09l-17.25-37.63-17.42,37.63h34.67Z"/></g><g><path d="m379.34,264.25v-106.8h43.87l25.47,56.03,25.3-56.03h43.87v106.8h-30.56v-71.97l-23.82,52.58h-29.74l-23.83-52.58v71.97h-30.56Z"/><path d="m536.26,264.25v-106.8h30.73v106.8h-30.73Z"/><path d="m585.55,157.45h30.56v81.17h61.78v25.63h-92.34v-106.8Z"/><path d="m692.19,264.25v-106.8h30.73v106.8h-30.73Z"/><path d="m778.78,264.25v-81.99h-45.51v-24.81h121.92v24.81h-45.84v81.99h-30.56Z"/><path d="m842.7,264.25l50.28-106.8h34.67l50.28,106.8h-32.04l-8.22-18.07h-54.55l-8.38,18.07h-32.04Zm84.95-40.09l-17.25-37.63-17.42,37.63h34.67Z"/><path d="m988.28,264.25v-106.8h67.86c31.22,0,44.69,11.34,44.69,38.94,0,15.94-8.38,27.11-23.17,32.37l19.39,35.49h-33.36l-16.27-31.55h-28.43v31.55h-30.73Zm65.56-53.07c8.71,0,14.95-3.94,14.95-13.64s-6.24-13.8-14.95-13.8h-34.83v27.44h34.83Z"/></g><g><polygon points="0 1.48 0 50.33 62.91 50.33 62.91 246.49 111.77 264.84 111.77 50.33 317.78 50.33 317.78 1.48 0 1.48"/><polygon points="130.01 117.37 130.01 271.68 178.87 290.1 178.87 117.37 199.47 117.37 199.47 297.76 223.9 306.93 248.32 297.75 248.32 117.37 268.92 117.37 268.92 290.02 317.78 271.68 317.78 117.37 317.78 75.58 317.78 68.52 130.01 68.52 130.01 117.37"/></g></g></g></svg>';
const SIMBOLO_TM = '<svg fill="currentColor" role="img" aria-label="Teorema Militar" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 429 412.36"><g><g><polygon points="0 0 0 65.95 84.93 65.95 84.93 330.77 150.88 355.53 150.88 65.95 429 65.95 429 0 0 0"/><polygon points="175.52 156.45 175.52 364.78 241.47 389.64 241.47 156.45 269.28 156.45 269.28 399.98 302.26 412.36 335.24 399.97 335.24 156.45 363.05 156.45 363.05 389.54 429 364.78 429 156.45 429 100.04 429 90.5 175.52 90.5 175.52 156.45"/></g></g></svg>';
const LOGOS_ESCOLA = {
  'EsPCEx': '<svg fill="currentColor" role="img" aria-label="TM Full EsPCEx" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1181.15 306.59"><g><g><g><path d="M260.53,175.56V0h163.95V40.78h-113.71v31.87h96.42v38.35h-96.42v64.55h-50.24Z"/><path d="M447.43,96.96V0h50.24V99.4c0,24.04,12.96,35.38,40.24,35.38s40.24-11.34,40.24-35.38V0h50.24V96.96c0,55.64-28.09,81.03-90.48,81.03s-90.48-25.39-90.48-81.03Z"/><path d="M657.57,0h50.24V133.43h101.56v42.13h-151.79V0Z"/><path d="M833.13,0h50.24V133.43h101.56v42.13h-151.79V0Z"/></g><g><polygon points="0 0 0 32.26 41.54 32.26 41.54 161.78 73.8 173.89 73.8 32.26 209.82 32.26 209.82 0 0 0"/><polygon points="85.84 76.52 85.84 179.42 118.1 191.53 118.1 76.52 131.71 76.52 131.71 195.63 147.83 201.68 163.96 195.63 163.96 76.52 177.57 76.52 177.57 190.52 209.82 178.41 209.82 76.52 209.82 48.93 209.82 44.26 85.84 44.26 85.84 76.52"/></g><g><path d="M657.67,226.04h74.19v18.46h-51.33v12.22h43.51v17.48h-43.51v12.83h51.33v18.46h-74.19v-79.45Z"/><path d="M785.88,224.94c7.09,0,21.88,.49,28.36,1.22v18.46c-6.72-.73-22.49-1.22-29.58-1.22-13.44,0-20.04,1.71-20.04,6.11,0,12.59,53.04,1.59,53.04,33.12,0,16.13-13.81,23.96-42.41,23.96-7.21,0-25.91-.49-33.24-1.22v-18.46c7.94,.73,25.67,1.22,34.96,1.22,10.88,0,16.87-1.22,16.87-5.62,0-13.32-53.04-.37-53.04-33.37,0-16.87,13.93-24.2,45.1-24.2Z"/><path d="M828.05,305.49v-79.45h49.38c23.22,0,33.24,8.43,33.24,29.21,0,18.58-11.24,27.38-34.22,27.38h-25.54v22.86h-22.86Zm47.67-59.89h-24.81v20.41h24.81c6.48,0,11.12-2.81,11.12-10.14s-4.64-10.27-11.12-10.27Z"/><path d="M941.71,265.77c0,13.2,7.46,21.27,24.69,21.27,7.33,0,21.39-.61,28.23-1.22v19.56c-6.6,.73-20.53,1.22-27.38,1.22-33.61,0-49.38-13.69-49.38-40.82s15.77-40.82,49.38-40.82c6.84,0,20.9,.49,27.5,1.22v19.55c-6.84-.73-21.02-1.22-28.36-1.22-17.23,0-24.69,8.07-24.69,21.27Z"/><path d="M1005.76,226.04h74.19v18.46h-51.33v12.22h43.51v17.48h-43.51v12.83h51.33v18.46h-74.19v-79.45Z"/><path d="M1135.93,251.22l18.46-25.18h26.16l-31.78,40.7,32.39,38.74h-28.23l-21.14-25.18-18.58,25.3h-26.28l32.02-40.82-32.51-38.75h28.11l21.39,25.18Z"/></g></g></g></svg>',
  'Barro Branco': '<svg fill="currentColor" role="img" aria-label="TM Full Barro Branco" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1215.18 411.15"><g><g><g><path d="M260.53,175.56V0h163.95V40.78h-113.71v31.87h96.42v38.35h-96.42v64.55h-50.24Z"/><path d="M447.43,96.96V0h50.24V99.4c0,24.04,12.96,35.38,40.24,35.38s40.24-11.34,40.24-35.38V0h50.24V96.96c0,55.64-28.09,81.03-90.48,81.03s-90.48-25.39-90.48-81.03Z"/><path d="M657.57,0h50.24V133.43h101.56v42.13h-151.79V0Z"/><path d="M833.13,0h50.24V133.43h101.56v42.13h-151.79V0Z"/></g><g><path d="M721.18,263.68c12.75,2.04,18.64,7.46,18.64,18.64,0,15.4-10.71,21.89-36.69,21.89h-45.71v-78.19h45.71c22.13,0,31.88,6.13,31.88,20.69,0,8.42-4.57,14.07-13.83,16.96Zm-19.73-5.65c5.77,0,9.98-2.29,9.98-7.46s-4.21-7.46-9.98-7.46h-21.53v14.92h21.53Zm1.68,28.99c8.9,0,13.11-2.41,13.11-8.18s-4.21-7.94-13.11-7.94h-23.21v16.12h23.21Z"/><path d="M741.63,304.21l36.81-78.19h25.38l36.81,78.19h-23.46l-6.01-13.23h-39.94l-6.13,13.23h-23.46Zm62.19-29.35l-12.63-27.55-12.75,27.55h25.38Z"/><path d="M848.2,304.21v-78.19h49.68c22.85,0,32.72,8.3,32.72,28.51,0,11.67-6.13,19.85-16.96,23.7l14.19,25.98h-24.42l-11.91-23.09h-20.81v23.09h-22.49Zm47.99-38.85c6.38,0,10.95-2.89,10.95-9.98s-4.57-10.1-10.95-10.1h-25.5v20.09h25.5Z"/><path d="M942.02,304.21v-78.19h49.68c22.85,0,32.72,8.3,32.72,28.51,0,11.67-6.13,19.85-16.96,23.7l14.19,25.98h-24.42l-11.91-23.09h-20.81v23.09h-22.49Zm47.99-38.85c6.38,0,10.95-2.89,10.95-9.98s-4.57-10.1-10.95-10.1h-25.5v20.09h25.5Z"/><path d="M1124.73,265.12c0,26.58-15.28,40.18-46.07,40.18s-46.19-13.59-46.19-40.18,15.28-40.18,46.19-40.18,46.07,13.59,46.07,40.18Zm-68.8,0c0,13.59,7.46,20.93,22.73,20.93s22.61-7.34,22.61-20.93-7.46-20.93-22.61-20.93-22.73,7.34-22.73,20.93Z"/><path d="M721.18,369.53c12.75,2.04,18.64,7.46,18.64,18.64,0,15.4-10.71,21.89-36.69,21.89h-45.71v-78.19h45.71c22.13,0,31.88,6.13,31.88,20.69,0,8.42-4.57,14.07-13.83,16.96Zm-19.73-5.65c5.77,0,9.98-2.29,9.98-7.46s-4.21-7.46-9.98-7.46h-21.53v14.92h21.53Zm1.68,28.99c8.9,0,13.11-2.41,13.11-8.18s-4.21-7.94-13.11-7.94h-23.21v16.12h23.21Z"/><path d="M749.93,410.07v-78.19h49.68c22.85,0,32.72,8.3,32.72,28.51,0,11.67-6.13,19.85-16.96,23.7l14.19,25.98h-24.42l-11.91-23.09h-20.81v23.09h-22.49Zm47.99-38.85c6.38,0,10.95-2.89,10.95-9.98s-4.57-10.1-10.95-10.1h-25.5v20.09h25.5Z"/><path d="M837.85,410.07l36.81-78.19h25.38l36.81,78.19h-23.46l-6.01-13.23h-39.94l-6.13,13.23h-23.46Zm62.19-29.35l-12.63-27.55-12.75,27.55h25.38Z"/><path d="M944.42,410.07v-78.19h27.79l34.76,52.44v-52.44h22.37v78.19h-27.79l-34.64-52.44v52.44h-22.49Z"/><path d="M1063.26,370.98c0,12.99,7.34,20.93,24.3,20.93,7.22,0,21.05-.6,27.79-1.2v19.25c-6.5,.72-20.21,1.2-26.94,1.2-33.08,0-48.6-13.47-48.6-40.18s15.52-40.18,48.6-40.18c6.74,0,20.57,.48,27.06,1.2v19.25c-6.74-.72-20.69-1.2-27.91-1.2-16.96,0-24.3,7.94-24.3,20.93Z"/><path d="M1215.18,370.98c0,26.58-15.28,40.18-46.07,40.18s-46.19-13.59-46.19-40.18,15.28-40.18,46.19-40.18,46.07,13.59,46.07,40.18Zm-68.8,0c0,13.59,7.46,20.93,22.73,20.93s22.61-7.34,22.61-20.93-7.46-20.93-22.61-20.93-22.73,7.34-22.73,20.93Z"/></g><g><polygon points="0 0 0 32.26 41.54 32.26 41.54 161.78 73.8 173.89 73.8 32.26 209.82 32.26 209.82 0 0 0"/><polygon points="85.84 76.52 85.84 179.42 118.1 191.53 118.1 76.52 131.71 76.52 131.71 195.63 147.83 201.68 163.96 195.63 163.96 76.52 177.57 76.52 177.57 190.52 209.82 178.41 209.82 76.52 209.82 48.93 209.82 44.26 85.84 44.26 85.84 76.52"/></g></g></g></svg>'
};
