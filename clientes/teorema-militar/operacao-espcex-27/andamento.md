# Andamento · Operação EsPCEx 27

## Onde está (2026-09-21)

No ar em `relatorio.teoremamilitar.com.br/espcex-27` (dentro do menu lateral dos relatórios do Teorema; entrada só com senha) e
formulário público em `teoremamilitar.com.br/espcex-27/pesquisa`. Ligados: ActiveCampaign, Meta, Google Ads (script de hora em
hora), DevZapp e pesquisa. 144 testes locais. Onde fica cada coisa no Cloudflare: `cloudflare-atalhos.md`.
Etapas: captação 13/09 a 28/09, lembrete 22/09 a 29/09, vendas 29/09 a 11/10. O relatório tem filtro de datas, base do grupo de
WhatsApp (208 em 2026-09-19), meta diária de leads (~133 por dia em 21/09), quadro "Público" (quente, frio, sem classificação) e
meta de 65% de quente, e a aba "Histórico" (2021 a 2025, com o 2026 em branco pra preencher). 342 leads em 2026-09-21 (meta 1.400). Chaves da Hotmart já estão nos segredos do Cloudflare, sem uso ainda.

## Pendências

- Passar a senha ao Teorema; avisar o site do subdomínio `relatorio.` e do caminho `/espcex-27/pesquisa`
- DevZapp: trocar o `token` se der acesso à conta; opcional, importar a lista de membros pra conversão exata do grupo
- Orçamento, gasto e saldo "em todos": definir onde (por etapa e/ou plataforma) e com que divisão de verba
- Hotmart no relatório (vendas), a partir de 2026-09-29
- GA4 (funil geral) se a página de captura tiver
- Automação de boas-vindas inativa no ActiveCampaign (id 176)
- Se o Teorema quiser: tirar a senha (uma linha) ou ligar o Cloudflare Access (login por e-mail/Google)


## Pendências da conversa dos relatórios (2026-09-25; retomar na segunda 28/09, lembrete agendado 09h30)

1. Implantar o `worker.js` novo no Cloudflare (traz o webhook da Hotmart e a trilha do lead da outra conversa).
2. Cadastrar na Hotmart o webhook próprio do relatório (Ferramentas > Webhook), enviar o teste e conferir o formato em `/api/hotmart-amostras`. Não mexer nos webhooks do Workspace Teorema nem do n8n.
3. Visão geral (beta): conferir os números; guardar a primeira origem (`src`) e montar o funil origem do lead x origem da compra; tirar a trava de beta quando aprovar; investimento do Google e do Meta desde 2023.
4. Colar o script novo do Google Ads (frequência do YouTube); a parte da Hotmart dele ficou desligada.
5. Decidir se importa os leads do banco antigo (Supabase `dados`) pra reforçar a origem histórica.
6. Rodar o `/atualizar`: previsão por etapa (captação R$ 7.093,78, lembrete e vendas R$ 886,72, sem imposto), limite de frequência do quente = 10, webhook no lugar do Google Ads, regra de olhar a outra conversa antes de mexer no `worker.js`.
7. Antigas: senha do relatório ao Teorema e aviso do subdomínio; orçamento "em todos"; Hotmart na EsPCEx 27 a partir de 29/09.