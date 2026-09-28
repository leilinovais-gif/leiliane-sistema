# Operação EsPCEx 27 · contexto

Fonte: conversa de 2026-09-18 com a Leili, mais leituras no ActiveCampaign, Meta, Google Ads, Hotmart e Drive.

## O lançamento

- Fórmula de lançamento: captação (2026-09-13 a 2026-09-28) → lembrete/live (2026-09-22 a 2026-09-29) → vendas (carrinho abre 2026-09-29 e fecha domingo 2026-10-11; a Hotmart entra nessa etapa). As etapas se sobrepõem no dia 29.
- Produto: TM - Full - EsPCEx. Nas vendas de 2025 o id na Hotmart era 1686920; conferir se é o mesmo em 2026.
- Mega (aquecimento gratuito, já encerrado): tag MEGA.ESPCEX.26 (id 342), 1.036 leads. Meta: R$ 4.134,59 sem imposto, R$ 4.707,23 com. Aparece só como investimento (topo e orçamento) e leads. Sem campanha do Mega no Google.

## Dados

- Tag da operação: OP.EsPCEx.27 (id 349). As tags OP.ESPCEX.26, .26.2 e .26.SET são de operações anteriores: ignorar.
- Campos do ActiveCampaign: 33 Data do último Engajamento (define o dia do lead), 27 source, 28 content, 29 medium, 30 campaign, 31 term. O telefone está no campo padrão do contato (o campo "WhatsAPP" quase não é usado).
- UTMs: `meta.ads` = Meta; `yt_ads` = YouTube Ads (vem do Google Ads); `direct/?utm_source=ig` = Instagram orgânico e `direct/?utm_source=youtube` = YouTube orgânico (o `direct/?` indica link com UTM montado errado; corrigir na fonte). O nome da campanha chega de 3 jeitos (nome completo, minúsculo com hífen, só `OP.ESPCEX.27`) e o relatório junta. Os criativos vêm em `utm_content` (`Cap_AdV_008`, `Cap_AdE_001`...).
- Meta: conta 277024930231617; campanhas `[GH] OP.ESPCEX.27 - CAPTAÇÃO - LEADS - CBO - PQ/PF [SET.26]`. Google Ads: conta 687-592-8792, mesmas campanhas com `PQ - SET.26`.
- Público: quente = PQ (pago) + orgânico; frio = PF. A origem do anúncio pago mostra o nome do público (`utm_medium` no Meta, `utm_term` no YouTube Ads). Lead sem nenhuma UTM vira "Sem UTM"; lead com UTM de campanha antiga (ESPCEX.26) conta pela origem que tem.

## Metas da captação

- 1.400 leads · verba total R$ 15.000 (com imposto do Meta, Mega incluído; sobram R$ 10.293 pra operação) · custo máximo por lead R$ 5,81 · 65% de público quente.
- Referência de vendas: EsPCEx 2025 vendeu 183 (R$ 183.431,98) de 2025-10-09 a 2025-10-19 investindo R$ 97 mil (ROAS ~1,9x). Barro Branco 2026: 753 leads, 144 vendas no total (101 na janela do carrinho), conversão do quente 11,13% e do frio 1,28%. Com R$ 15 mil, repetir 183 vendas exigiria ROAS de ~12x.

## No ar (2026-09-18)

- Relatório: `https://relatorio.teoremamilitar.com.br/espcex-27` (tela de entrada só com senha; cookie de 30 dias; 8 erros bloqueiam 15 minutos). Provisório: `https://relatorio-espcex27.teoremacloudflare.workers.dev/espcex-27`. Ligado a ActiveCampaign, Meta (token de leitura), Google Ads (script "Relatórios TM", de hora em hora), DevZapp e pesquisa. O código aceita Cloudflare Access (`ACCESS_TEAM`, `ACCESS_AUD`) se um dia ligarem.
- Pesquisa: formulário público em `https://teoremamilitar.com.br/espcex-27/pesquisa` (rota do Worker no site do Teorema; o ano vai no caminho), as mesmas 14 perguntas do Google Forms "[Operação] EsPCEx 26/27" (Drive, dono obirckconsultoria). Respostas no D1; o relatório mostra só totais e quantos leads responderam (pelo e-mail); respostas completas em `/api/espcex-27/pesquisa.csv` (senha). O tamanho dos campos de texto e a imagem do topo do formulário original não foram copiados; a linha de aviso de privacidade no rodapé é acréscimo, a validar com o Teorema.
- Grupo de WhatsApp: monitoração do DevZapp com webhook `…/api/whatsapp?op=espcex-27&k=<chave>` (URL pronta no `.env`, `DEVZAPP_WEBHOOK_URL`). Formato do aviso: `notification` (`GROUP_PARTICIPANT_INVITE`/`ADD`/`LEAVE`/`REMOVE`), `notificationParameters` (telefone de quem entrou ou saiu), `chatName`; `connectedPhone` é o número do próprio DevZapp e nunca conta como lead. Grupo monitorado: "Operação EsPCEX 2027". A Leili colocou no DevZapp só os grupos desta operação (confirmado em 2026-09-19), então o filtro por nome fica vazio. Quem já estava nos grupos antes da ligação (captação começou em 2026-09-13) não aparece nos avisos.
- Funil Meta (cliques no link → visualização de página → lead do pixel) e orçamento (total, gasto, saldo) aparecem no relatório. Também: filtro de datas (Hoje, Ontem, últimos 3 e 7 dias, personalizado; orçamento e metas seguem do total), meta diária de leads no quadro dos 1.400 (leads que faltam ÷ dias até 28/09) e quadro "Público" (quente, frio e sem classificação, com a meta de 65% de quente).
- Base do grupo de WhatsApp: 208 pessoas em 2026-09-19 (informada pela Leili), somadas às entradas do webhook.
- Aba "Histórico" (Leili, mensagem de 2026-09-21): lançamentos de 2021 a 2025 e o 2026 em branco pra preencher. Leads 1.943 / 1.841 / 3.819 / 5.187 / 5.421; público quente 1.719 / 2.749 / 1.464 e frio 2.100 / 2.438 / 3.957 (só de 2023 a 2025); total de vendas 263 / 178 / 232 / 261 / 180 (14%, 10%, 6%, 5% e 3% dos leads); também 1 a 4 CPL e vendas do primeiro dia. Os números ficam em `worker.js` (`OPERACOES` → `historico`). A Hotmart deu 183 vendas em 2025 (janela 09 a 19/10), contra 180 na planilha dela.

## O que existe nesta pasta

- `worker.js`: os relatórios online do Teorema (Cloudflare Worker, arquivo único, com a EsPCEx ao vivo, o Barro Branco como página pronta, o menu, as logos e o histórico; senha e chaves ficam nos segredos do Cloudflare, nunca no código).
- `google-ads-script.js`: script pra colar no Google Ads; envia custo e conversões de todas as campanhas da conta.
- `previa.html`, `previa-pesquisa.html` e `previa-entrada.html`: retratos de 2026-09-18 com dados reais; não atualizam sozinhos.
- `cloudflare-atalhos.md`: onde fica cada coisa no Cloudflare do Teorema e as tarefas de sempre.
