# Trilha do lead · desenho (proposta de 2026-09-23, ainda não construído)

Objetivo: guardar **todas** as origens de uma pessoa (anúncio, stories, YouTube, grupo...) sem sobrescrever
nada, sem intermediário de terceiro (Stape) e sem estourar o ActiveCampaign.

## Regra central

- **O histórico completo mora no banco D1 do Cloudflare do Teorema** (uma linha por toque, só acrescenta).
- **O ActiveCampaign recebe só um resumo**, nunca uma coluna por sessão.

## O que vai no ActiveCampaign (3 blocos, nunca mais que isso)

| bloco | como grava | campos |
|---|---|---|
| primeira origem | **grava uma vez, nunca sobrescreve** (o Worker só escreve se o campo está vazio) | fonte, meio, campanha, term, content, data |
| última origem | sobrescreve (é o que os campos UTM 27-32 já fazem hoje) | já existe |
| trilha | **acrescenta** no fim de um campo de texto, guardando os últimos ~10 toques (ex: `meta > ig-stories > yt-live`) | 1 campo novo |

Tag por operação continua como hoje (cada tag já tem a própria data).

## Fluxo

1. **Navegador** (o script "LE| Rastreamento – Captura de Origem" já grava first/last touch em cookie). Passa a
   enviar, a cada toque novo (fonte ou campanha diferente da anterior, ou 30 min depois do último), um aviso
   `POST /api/touch` com: id do visitante (`marca_user`), UTMs, referrer, página, `fbclid`/`gclid`, data.
   O endereço é uma rota do Worker **no domínio do próprio site** (o Teorema já tem uma rota assim, a da pesquisa).
2. **Worker** grava a linha na tabela `touches` do D1.
3. **Cadastro** (formulário): manda o id do visitante junto. O Worker liga visitante → email/telefone (com hash,
   como o `PHONE_SALT` que já existe) e preenche no ActiveCampaign os 3 blocos acima, respeitando a regra de cada um.
4. **Compra**: Hotmart (API já ligada) traz email/telefone + `sck`/`src`. O Worker cruza pelo hash e monta a
   jornada completa da venda: primeira origem, todos os toques, último antes da compra.
5. **Relatório online** mostra a jornada e as leituras (primeiro clique, último clique, todos os toques).
6. **Depois**: o mesmo Worker manda os eventos pro Meta (Conversions API) com `fbc`/`fbp`/`external_id`, e o Stape sai.

## Limites que precisam ficar claros

- Cookie é por navegador. Mesma pessoa no celular e no computador só se junta **quando se identifica** (email/telefone).
- **Safari/iPhone limita cookie criado por JavaScript a ~7 dias**, mesmo o script pedindo 180. Correção (fase 2): o
  Worker cria o cookie pelo servidor, no domínio do site.
- A Hotmart cita 30 caracteres como limite, mas guarda o `sck` completo (até 155 nas vendas do Meta). Por isso o `sck` segue completo (teto 200 no script); a trilha guarda o histórico de todos os toques, não só o último.
- O Worker também é um intermediário, mas é nosso, no domínio do Teorema, no plano gratuito.

## Estado (2026-09-25)

**Fase 1 construída, no ar e testada.** Diferenças do desenho: a tabela se chama `visitas` (com `visitantes` pra ligar o id ao hash do e-mail), a rota é `POST /api/visita` (o nome `touch` foi trocado por um neutro pra não cair em bloqueador), a identificação vai junto do aviso quando há e-mail no cookie `marca_email`, e o e-mail fica guardado só até a gravação no ActiveCampaign dar certo (no máximo 24 h). Detalhes e campos (ids 34 a 40) em `andamento.md`. Fase 2 (cruzar com a compra da Hotmart, relatório, cookie pelo servidor) ainda não começou; a fase 3 fica de fora (Stape mantido).

## Fases

1. Tabela `touches` no D1 + rota `/api/touch` + script enviando o aviso + campos de primeira origem e trilha no ActiveCampaign.
2. Identificação (visitante → email/telefone) + cruzamento com a Hotmart + relatório + cookie pelo servidor.
3. Conversions API direto do Worker, Stape desligado (depois de validar que os números batem).

Pendência que independe disto: tirar o pixel antigo das tags `01 | Meta | Events` e `03 | Meta | Purchase` do
container [CARTEIRO] do GTM (ver `checklist-rastreamento.md`).
