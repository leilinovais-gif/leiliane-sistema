# Rastreamento: origem das vendas (diagnóstico de 2026-09-21)

Feito com as vendas do Barro Branco (produto "TM - Full - Barro Branco - APMBB", 164 vendas de 04/07 a 21/09/2026), a base do ActiveCampaign (25.931 contatos) e o código público do site. Este arquivo pode ser entregue ao desenvolvedor: a seção 3 é o que precisa ser feito.

## 1. O que os dados mostram

- 164 vendas. **88 estão no ActiveCampaign** (achadas por email, por telefone ou por nome) e **76 não estão** (46%). Só 8 se recuperam pelo telefone, então o problema não é email diferente.
- Origem gravada pela Hotmart no `sck`: 116 das 164 vendas têm. Das 76 que não estão no ActiveCampaign, 56 chegaram por Google, YouTube, acesso direto ou sem origem, sem UTM de campanha.
- Meta Ads: o Meta reporta 20 e poucas vendas, e a Hotmart tem só 2 com origem `facebook.ads`/`meta.ads`. O Meta atribui por visualização ou clique em janela de dias. A Hotmart guarda só o último caminho.
- Só 1 de 164 compradores foi criado no ActiveCampaign na hora da compra: a Hotmart não cria o comprador lá.
- Base do ActiveCampaign: 18.790 dos 25.931 contatos têm data de criação em abril de 2026 (importação em massa). Conta: `teoremamilitar2026.activehosted.com`.
- Operação Barro Branco: 753 leads com a tag OP.BB.26 e 1.328 do Mega, contra 164 vendas.
- A API da Hotmart devolve o campo `source` (parâmetro `src`), mas só 1 de 470 vendas usa. `sck` é o campo usado hoje.

## 2. Falhas encontradas

1. **O script de UTM não guarda a primeira origem.** Ele lê só a URL da visita atual. Sem UTM na URL, escreve `referral` (com o site de origem) ou `direct`. Quem chegou por anúncio e volta por outro caminho perde a campanha. O script é o mesmo na página de vendas e na de captação (o UTM do formulário sai da mesma lógica).
2. **Links sem UTM.** Descrição e comentário fixado do YouTube, links soltos em WhatsApp e Google chegam sem parâmetro. São a maior parte das vendas de origem "google", "youtube", "direct" ou vazia.
3. **Pop-up "preencha o formulário e prossiga com a sua matrícula"** (Elementor, modelo 545, formulário "TM Full") existe em todas as páginas: pede nome, email e WhatsApp, leva UTMs e `checkout_url`, e depois vai pro checkout. Não sabemos pra onde ele envia (ActiveCampaign, email, só WordPress). Ele não tem gatilho automático (abre só por botão) e a Leili disse em 2026-09-21 que a ideia é ele deixar de existir: o desenvolvedor confirma se algum botão ainda o abre e se pode remover. Se ainda for usado, o redirecionamento pro checkout pelo campo `checkout_url` pode ir sem `sck` (uma das explicações possíveis pros `sck` vazios).
4. **A Hotmart não cria o comprador no ActiveCampaign.** Decisão da Leili (2026-09-21): não criar, pra não pesar o plano do ActiveCampaign, já que não há contato por email depois da compra. A origem da venda se lê direto da Hotmart (`sck`/`src` pela API) e se cruza com o ActiveCampaign por email e telefone fora dele. O item 4 da seção 3 fica opcional.
5. **O GA4 não liga a visita ao site à compra.** A compra vem do checkout da Hotmart e o GA4 cria um visitante novo ali (`first_visit`, `session_start` e `begin_checkout` no mesmo segundo). O `marca_user` (usado como `xcod` no checkout) é um código aleatório do navegador e não chega ao GA4 como `user_id` (os IDs do Explorador são `999967094.1782689674`, o padrão do GA4). O GTM do site usa `G-S1B65J2F9H` e o GA4 do painel é `G-VF47PJJ4YJ`.
6. **Nome de campanha inconsistente (problema menor: se o nome da campanha vem no `sck`, a origem é conhecida e o relatório normaliza por máscara).** A captação usa `utm_campaign=OP.BARROBRANCO.27`, e as vendas mostram `OP.BB.26`. No ActiveCampaign a tag `OP.BARROBRANCO.27` (344) tem 0 contatos e a `OP.BB.26` (345) tem 753.
7. **Painel do WordPress:** o que a Leili abriu mostra "WordPress 7.1.1 disponível", mas o site público já roda 7.1.1, e a licença do Elementor Pro consta como cancelada. Pode ser uma cópia (staging). Conferir qual é o site de produção.

## 3. O que fazer

1. **Corrigir o script de UTM** (WPCode → Snippets de código, ou onde ele estiver): guardar no navegador a **primeira origem** (`first_touch`, nunca sobrescrita) e a **última** (`last_touch`). Mandar a primeira no `src` e a última no `sck` do link do checkout e nos campos ocultos dos formulários. Não sobrescrever uma campanha por `direct` ou `referral`.
2. **Padronizar os links** com as cinco UTMs: `utm_source` (ig, yt, wpp, email, meta, google, site), `utm_medium` (organic, ads, grupo, email, bio), `utm_campaign` (nome único da operação), `utm_term` (onde: stories, bio, whatsapp), `utm_content` (quem ou qual peça). Ordem do `sck`: fonte|meio|campanha|term|content|id.
3. **Pop-up 545:** abrir o editor (`/wp-admin/post.php?post=545&action=elementor`), conferir **Ações após o envio** e mandar também os dados pro ActiveCampaign com a tag da operação. Verificar **Elementor → Envios** e exportar.
4. **Webhook da Hotmart pro ActiveCampaign:** criar o contato na compra aprovada, com tag `COMPROU.<operação>` e gravando `sck` e `src` nos campos de origem.
5. **ActiveCampaign:** criar campos de **primeira origem** (source, medium, campaign, term, content) e uma automação que preenche só quando estão vazios.
6. **GTM/GA4:** mandar o `marca_user` como `user_id` do GA4 e conferir qual ID de métrica é o correto (`G-S1B65J2F9H` × `G-VF47PJJ4YJ`).
7. **Nome da campanha:** escolher um nome por operação e usar em todos os links, formulários e tags.

## 4. Como sempre ter o último clique

- O último clique é o `sck` da Hotmart. Ele só é confiável se **todo link que leva ao checkout carrega UTM**. Hoje o que falha é o link sem UTM, e não o script.
- Cobrir todos os pontos de decisão: descrição e comentário fixado do YouTube (com `utm_term=yt-live` ou similar), mensagem e descrição do grupo de WhatsApp, cada email do ActiveCampaign, bio, stories, site.
- Checar toda semana a **porcentagem de vendas com `sck` vazio ou sem campanha** (meta: abaixo de 5%). Isso entra na "Visão geral" do relatório.

## 5. Pendências de outras frentes

- Perguntar aos 76 compradores como conheceram o Teorema (Leili decide como e quando enviar).
- Cruzar as 76 com **Elementor → Envios** quando houver acesso.
- Teste dos grupos de WhatsApp (lista de membros no WhatsApp Business) se der pra exportar.
