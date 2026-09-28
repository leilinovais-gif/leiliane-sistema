<!-- quem alimenta: o /setup semeia na entrevista; o /atualizar acrescenta ferramenta nova, acesso novo ou "não alcanço"; a /faxina confere e pergunta. Lido antes de dizer "não consigo" e ao criar skill. -->
# Ferramentas

> O que o negócio usa e como o agente alcança cada coisa. **"não ligada" é resposta válida:** é assim
> que o agente sabe que aquilo existe e dá pra ligar, em vez de achar que é impossível.
> Chave nunca fica aqui. Chave mora no `.env` (fora do git) ou no gerenciador de senha; aqui vai só o
> nome da variável. O cardápio do que dá pra ligar está em `sistema/templates/ferramentas/catalogo.md`.

| ferramenta | pra quê | como o agente alcança | estado | última checagem |
|---|---|---|---|---|
| Meta Ads | gestão de tráfego pago | MCP no app (conta Teorema Militar MKT); token de leitura (`META_ACCESS_TOKEN`, usuário do sistema `relatorio-leitura`) nos segredos do Cloudflare, lido pelo relatório online; o MCP lista as contas de todos os clientes (Teorema, Simone Fuzaro, Lucas, Éder...) e lê pixels, qualidade dos eventos e conjuntos, mas não mostra os Parâmetros de URL do anúncio | ligada | 2026-09-24 |
| Google Ads | gestão de tráfego pago | script "Relatórios TM" dentro da conta 687-592-8792 envia todas as campanhas pro relatório (sem developer token; a API fica pra depois) | ligada | 2026-09-18 |
| WordPress (Teorema Militar) | landing pages, formulários e script de rastreamento | login da Leili no painel; scripts em Elementor → Elementos Personalizados → Código (cache: WP Rocket + Elementor, limpar depois de editar) | ligada | 2026-09-22 |
| Hotmart | produtos digitais, área de membros, export de comissões | API (`HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET`, `HOTMART_BASIC_TOKEN` no `.env` e, desde 2026-09-21, também nos segredos do Cloudflare, ainda sem uso no relatório; token OAuth expira em ~48h, gerar de novo quando vencer). Webhooks da conta (Ferramentas → Webhook, só a Leili vê): "sGTM | Compra Aprovada" manda toda compra ao Stape; outros vão pro Workspace do time, Make e Montink; o histórico de envios (60 dias) mostra status e erros | ligada | 2026-09-25 |
| YouTube | conteúdo (Teorema Militar) | não ligada | não ligada | 2026-09-17 |
| ActiveCampaign | automação e email marketing | API (`ACTIVECAMPAIGN_API_URL`, `ACTIVECAMPAIGN_API_KEY` no `.env`); 25.927 contatos em 2026-09-21; cada tag tem data; UTM (campos 27 a 32) sobrescreve; desde 2026-09-25 há os campos `TM 1a origem - fonte/meio/campanha/term/conteudo/data` (34 a 39) e `TM trilha` (40), criados por API e preenchidos pelo Worker (trilha do lead); o agente cria campos e consulta contatos pela API | ligada | 2026-09-25 |
| Cloudflare (do Teorema Militar) | hospedagem do relatório online (Worker) | painel do cliente (Worker `relatorio-espcex27`, KV e D1); Leili entra com o login dele. O agente abre o painel pelo Chrome logado da Leili, mas o editor de código não recebe cliques nem teclas dele: quem cola o código é ela | ligada | 2026-09-21 |
| DevZapp | grupos de WhatsApp: entrada e saída de leads | webhook externo pro relatório (`WHATSAPP_KEY` nos segredos do Cloudflare; URL pronta no `.env` em `DEVZAPP_WEBHOOK_URL`) | ligada | 2026-09-18 |
| Supabase (Teorema Militar) | banco de dados na nuvem; dois projetos na organização "Teorema Militar" | API REST, chave `service_role` no `.env`: projeto `dados` (`SUPABASE_URL_DADOS`/`SUPABASE_SERVICE_KEY_DADOS`, tabelas `leads`/`transactions_hotmart`, fonte do Power BI antigo, morto desde set/2025) e projeto `vendas-militares` (`SUPABASE_URL_VENDAS`/`SUPABASE_SERVICE_KEY_VENDAS`, sistema ativo não identificado, ver pendência em `agora.md`) | ligada | 2026-09-22 |
| Google Tag Manager (conta "Teorema Militar \| estrutura+") | tags do site: [NAVEGADOR] web `GTM-NW4BBML` e [CARTEIRO] servidor `GTM-T8TVMFPP` (entregue pelo Stape, com cache de 15 min) | só a Leili, no painel (edita e publica no [NAVEGADOR]; no [CARTEIRO] tem só leitura, e pede permissão de edição em 2026-09-25); o agente lê o resultado pelo site e a guia passo a passo, sem acesso direto | ligada (pela Leili) | 2026-09-24 |
| Google Analytics 4 e Google Ads (painéis, Teorema) | GA4 certa: "[PROPRIEDADE] Teorema Militar" (`457884146`, `G-S1B65J2F9H`), na conta `[GA4] Teorema Militar` (172628279); a antiga "Site Teorema Militar – GA4" (`G-VF47PJJ4YJ`) foi desconectada em 2026-09-25. Google Ads 687-592-8792 vinculado às duas; desde 2026-09-25 tem uma conversão de compra importada do `purchase` do GA4 novo (caminho: Metas → Conversões → Resumo) | só a Leili, no painel; o agente a guia | ligada (pela Leili) | 2026-09-25 |

## Os sete assuntos que todo negócio tem

| assunto | ferramenta | como o agente alcança | estado | última checagem |
|---|---|---|---|---|
| Mensagem com cliente | Slack | não ligada | não ligada | 2026-09-17 |
| Tarefa e prazo | Notion | não ligada | não ligada | 2026-09-17 |
| Email | Gmail | conector do app | ligada | 2026-09-18 |
| Agenda | Google Calendar | não ligada | não ligada | 2026-09-17 |
| Dinheiro entrando e saindo | sem ferramenta (controle sem planilha) | só você, na mão | não ligada | 2026-09-17 |
| Ficha do cliente | Google Drive | conector do app | ligada | 2026-09-18 |
| Reunião | Google Meet / Zoom | não ligada | não ligada | 2026-09-17 |
