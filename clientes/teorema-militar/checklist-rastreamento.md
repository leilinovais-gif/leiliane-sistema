# Checklist · corrigir o rastreamento (criado 2026-09-22)

Organiza o que ficou combinado depois do diagnóstico do Barro Branco. Meta: hoje ~29% das vendas
ficam sem nenhuma leitura de origem; em ago-set/2025, com o rastreamento bem ajustado, esse número
era 11-13%. É esse o patamar a mirar.

## Quem faz o quê

| item | responsável | status |
|---|---|---|
| Corrigir o script do site (guardar primeira origem, nunca sobrescrever com "direct"/"referral") | o agente | **feito e testado em produção (2026-09-22)** — script "LE\| Rastreamento – Captura de Origem" no Elementor → Elementos Personalizados → Código; script antigo conflitante ("UTM passthrough") movido pra lixeira |
| Links do grupo de WhatsApp (saem como `ig`, deveriam ser `wpp`) | Leili | a fazer |
| Links antigos ainda circulando (`OP.APMBB.24`, `OP.BB.25`) — YouTube, bio, site | Leili | a fazer |
| Nome de campanha único por operação (`OP.BB.26` × `OP.BARROBRANCO.27`) | Leili | a fazer |
| Modelo de acompanhamento no Google Ads de Pesquisa (item 5) | Leili | a fazer |
| Combinar `sck` fixo com o comercial pros links de checkout direto | Leili + comercial | a fazer |
| `sck` vazio em 48 vendas: causa e correção | Hotmart | **respondido em 2026-09-24:** sem falha no checkout; sem origem = parâmetro não chegou; `sck` desconfigurado = script antigo do GTM. O "limite de 30" não corta nada (dados: 56 de 116 vendas passam de 30, até 155) |
| Pausar o script antigo (tag `01.0 \| transfer`, HTML personalizado) no GTM [NAVEGADOR] `GTM-NW4BBML` | Leili (guiada pelo agente) | **feito e publicado em 2026-09-24**, conferido no site (URL limpa) |
| Script novo: ignorar `utm_source=direct`/`referral` como campanha e mandar o `sck` inteiro (teto 200) | o agente | **feito e no ar em 2026-09-24**, conferido no site |
| Renomear campanhas, conjuntos e anúncios pros nomes curtos | Leili | **cancelado em 2026-09-24:** o relatório lê operação, público e etapa pelo nome atual, e a Hotmart aceita o `sck` completo. Planilha `operacao-espcex-27/nomes-curtos-campanhas.xlsx` sem uso |
| Observar as vendas novas (`sck` inteiro, underlines, `src`, sem origem, `direct`) | o agente | a fazer por volta de 2026-09-28 |
| Confirmar o `utm_medium` do Google Ads | Leili | **feito em 2026-09-24:** está no Sufixo do URL final (`utm_medium=paid`), junto de `utm_id={campaignid}-{adgroupid}-{creative}`; nada falta |
| Pop-up de matrícula (Elementor 545) sair do site | desenvolvedor | a fazer — Leili decidiu remover |
| Projeto Supabase `dados` (Power BI antigo, morto desde set/2025) | Leili | decidir se exclui (não é urgente) |
| Projeto Supabase `vendas-militares` (`HotmartSale`, `BoletoRecovery`, `ChatMessage`...) | Leili | **confirmar o que é e se ainda deve rodar** — sistema ativo, ninguém sabia que existia |
| Tirar o pixel antigo do Meta (771981546872163, "[ANTIGO] Teorema MKT") do GTM **[NAVEGADOR]** (4 tags Facebook Pixel) | Leili, guiada pelo agente | **feito e publicado em 2026-09-24**, conferido no site (só o pixel novo carrega) |
| Desconectar a propriedade antiga do GA4 (`G-VF47PJJ4YJ`, "Site Teorema Militar – GA4") da Tag do Google | Leili, guiada pelo agente | **feito em 2026-09-25 (00h)**: "0 conectadas"; falta conferir que o site parou de mandar e que a antiga zerou (o agente confere) |
| Hotmart: tirar o pixel (Facebook, GA4 antigo e Google Ads) de todos os produtos; a compra vai só pelo webhook pro Stape (conferido em 2026-09-25) | Leili, pedindo pro parceiro | a fazer; padrão e passo a passo em `auditoria-pixels-hotmart.xlsx`, começando pelos 5 maiores |
| Hotmart: desligar o webhook do n8n morto | Leili | **desligado em 2026-09-25**; apagar depois de uma semana |
| GA4 novo: marcar `generate_lead` como evento principal e criar grupo de canais personalizado | Leili, guiada pelo agente | opcional, 2026-09-25 |
| Trilha do lead, fase 1 (Worker, campos 34 a 40 do ActiveCampaign e script do site) | o agente e a Leili | **feito, no ar e testado em 2026-09-25** (contato de teste gravado em 3 s); contatos de teste 100500 e 100501 apagados em 2026-09-25; falta avisar o designer (a Leili fala por áudio) |
| Desconectar o destino antigo do GA4 da Tag do Google (movido pra a tag "GA4 antigo (desativado)") | Leili | **feito e conferido em 2026-09-25**: o site manda só pro `G-S1B65J2F9H` |
| Conversão de compra no Google Ads (uma só, importada do GA4 novo) e conferir o `purchase` do GA4 (11 contra 225 vendas antes da correção da tag `03 \| Purchase`) | Leili e o agente | **conversão criada em 2026-09-25** (importa o `purchase` do GA4 novo, Ação principal, "Todas", clique 90 dias); validar na segunda 2026-09-28 se o `purchase` do GA4 subiu e se a conversão recebe |
| Tirar o pixel antigo do GTM **[CARTEIRO]** (`01 \| Meta \| Events` e `03 \| Meta \| Purchase`: deixar só `{{prm - meta_pixel_id_see}}` e desmarcar múltiplos pixels) | Leili, guiada pelo agente | **feito e publicado em 2026-09-25**: pela API do Meta, o pixel antigo ficou sem evento do servidor depois das 12h07 |
| Confirmar no Ads Manager se os anúncios têm "Parâmetros de URL" (UTM) configurados | Leili | **feito em 2026-09-24:** `utm_source=meta.ads&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}` |

## Referências

- Lista detalhada de links a trocar, com exemplo de cada um: `clientes/teorema-militar/links-a-corrigir.md`
- Diagnóstico completo do rastreamento: `clientes/teorema-militar/rastreamento-origem-das-vendas.md`
- Relatório pra reunião com a Hotmart: `clientes/teorema-militar/barro-branco-2026/leitura-de-origem-barro-branco.pdf`
