# Teorema Militar · contexto do cliente

Cliente principal (preparatório militar). Uma pasta por operação/lançamento dentro desta.

## Identidade visual por operação

Cada escola/operação tem a sua identidade. O relatório de uma operação usa a paleta dela.

| operação | fundo | cartão | linha | destaque | texto secundário | onde está |
|---|---|---|---|---|---|---|
| Teorema (menu, página inicial e tela de entrada) | #080B07 | #0D140F | #2B4E2B | #E8C52B | #8FA08C | `operacao-espcex-27/worker.js`, em `HUB.tema` (o verde e amarelo do Teorema, a mesma base da EsPCEx) |
| EsPCEx | #080B07 (verde escuro) | #0D140F | #2B4E2B | #E8C52B (amarelo do botão) | #8FA08C | `operacao-espcex-27/worker.js`, em `OPERACOES` → `tema` |
| Barro Branco | #090915 | #151928 | #262b40 | #FAE60D | #8B8FA3 | retrato de 2026-09-18 dentro do `worker.js` (`ARQUIVO`, `/barro-branco-27`); fonte em `barro-branco-2026/relatorio.html` (fontes Big Shoulders Display + Titillium Web) |
| ESA e as próximas | a definir | | | | | |

## Regras que valem pra todo relatório do Teorema

- O Meta cobra 13,85% de imposto por cima do gasto: todo valor do Meta sai com ele. O Google não cobra. O relatório do Barro Branco foi corrigido em 2026-09-21 (Meta com o imposto; os valores de 2025 dele ficaram como estavam, sem confirmar se já incluíam).
- Lead se conta pela "Data do último Engajamento" (campo 33 do ActiveCampaign), nunca pela data da tag nem pela de criação do contato.
- Na voz da Leili, "SpaceX" é sempre EsPCEx.
- A operação do Barro Branco é a de 2027 (turma de 2027), embora a captação e o carrinho tenham sido em ago e set de 2026; o relatório dela chama-se "Operação 2027".
- ActiveCampaign (testado em 2026-09-21): cada tag do contato tem a própria data (cdate); os campos de UTM (27 a 32) guardam um valor só e são sobrescritos campo a campo a cada cadastro, e não existe campo de primeira origem. Pra saber a primeira origem daqui pra frente, criar campos próprios e uma automação que os preenche só quando vazios (não recupera o passado).

## Rastreamento e origem das vendas (diagnóstico 2026-09-21/22)

- No Barro Branco (164 vendas, 04/07-21/09/2026): 48% sem lead encontrado no ActiveCampaign (por email ou telefone), 40% sem nenhuma leitura de origem (nem lead, nem campanha no `sck` da Hotmart). Detalhe completo em `rastreamento-origem-das-vendas.md` e checklist de correções em `checklist-rastreamento.md`.
- O script do site (WordPress/Elementor) monta o `sck` só com a UTM da visita atual — não guarda a primeira origem, e sobrescreve campanha antiga com "direct"/"referral" quando a pessoa volta sem UTM. Correção combinada: guardar primeira e última origem separadas.
- Achados nos links: grupo de WhatsApp sai marcado como Instagram (`utm_source=ig`), campanhas antigas (`OP.APMBB.24`, `OP.BB.25`) ainda circulando, possível falta de UTM nos anúncios de Google Pesquisa. Lista completa em `links-a-corrigir.md`.
- GTM do lado do servidor (Stape, `stape.teoremamilitar.com.br`), GA4 `G-S1B65J2F9H` — diferente do `G-VF47PJJ4YJ` que a Leili vê no painel. Confirmado que o GA4 não liga a visita do site à compra (o checkout da Hotmart cria um visitante novo).
- Histórico (banco Supabase `dados`, morto desde set/2025, ver `_contexto/infra.md`): a leitura do `sck` nunca foi 100%, mas melhorou com o tempo — no Barro Branco, 99% sem sck em 2022, 68% em 2023, 51% em 2024, 31% em 2025 (parcial). Em ago-set/2025, com o rastreamento bem ajustado, chegou a 11-13% sem sck — é a meta de referência pra 2026 (hoje: 29%).
- Hotmart respondeu em 2026-09-24: o checkout registra o que recebe; o `sck` com fonte e meio invertidos vem de um script antigo de HTML personalizado no GTM [NAVEGADOR] (código original do EstruturA+), que sobrescreve o do site novo no clique. A tag antiga foi pausada e publicada no GTM em 2026-09-24. O limite de 30 caracteres que a Hotmart citou não corta o registro (o `sck` chega a 155 caracteres nas vendas do Meta); o relatório lê o `sck` completo (`meta.ads|<conjunto>|<campanha>|...`), então as campanhas não são renomeadas. Estado e pendências em `andamento.md`.
- Achado um sistema Supabase vivo não documentado (`vendas-militares`) — ver `_contexto/infra.md` e a pendência em `_contexto/agora.md`.

## Contas

- Meta: conta de anúncios "Teorema Militar MKT" (277024930231617), negócio "PE - Teorema Militar MKT". Pixels: "GTM TRACK - Teorema MKT" (507767231935600, ativo, usado por todas as campanhas) e "[ANTIGO] Teorema MKT" (771981546872163, legado de 2020; saiu do GTM [NAVEGADOR] em 2026-09-24, falta tirar do [CARTEIRO] — ver `checklist-rastreamento.md`).
- Google Ads: 687-592-8792.
- Hotmart: produtos "TM - Full - <escola>" (EsPCEx 2025: id 1686920).
- Hospedagem dos relatórios online: Cloudflare do Teorema (conta "Teoremacloudflare…"), Worker `relatorio-espcex27`, com KV `relatorio-espcex27-kv` e banco D1 `relatorio-espcex27-db`.

## Relatórios online (um Worker só, várias operações)

- A página `/` tem menu lateral por escola → operação (Barro Branco 2027 e EsPCEx 2027) e a aba "Histórico" da EsPCEx; cada operação em `/<nome>` (ao vivo: `/espcex-27`; encerrada: `/barro-branco-27`, página pronta dentro do Worker). Logos do Teorema e das escolas vieram do zip "Identidade Visual" (Downloads, recebido 2026-09-21) e estão como SVG dentro do `worker.js`. Cada uma é um bloco `OPERACOES` no começo do `worker.js`; pra criar outra (ESA, Barro Branco…), copiar o bloco e ajustar tag, campanhas, datas, metas e cores. Clientes diferentes do Teorema ficam em Worker e domínio separados.
- Endereço: `relatorio.teoremamilitar.com.br` (domínio personalizado do Worker). Entrada por tela com uma senha só (sem usuário), que a Leili passa por mensagem privada; a senha e as chaves ficam nos segredos do Cloudflare e no `.env` (fora do git). O formulário público da pesquisa mora no site do Teorema, em `/<operacao>/pesquisa`, por rota do Worker.
- Google Ads: o script "Relatórios TM" manda todas as campanhas da conta; cada relatório pega as suas pelo nome.
- Pesquisa e grupo de WhatsApp (DevZapp) são por operação (`/<nome>/pesquisa` e `/api/whatsapp?op=<nome>`).
- Ideia em andamento (Leili, 2026-09-21): "Visão geral" no topo do menu, com vendas gerais e do mês (Hotmart desde 2023, se a API devolver), investimento em Meta e Google (o Meta guarda cerca de 3 anos; a testar), por escola e o total, e origem das vendas lida no ActiveCampaign sem filtrar por tag. Precisa de cópia automática de contatos (25.927) e vendas no banco D1, porque o Worker lê só ~4.000 contatos por vez.
