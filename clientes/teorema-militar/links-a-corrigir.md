# Links e marcações a corrigir (levantamento de 2026-09-21, vendas do Barro Branco)

Base: as 164 vendas do produto "TM - Full - Barro Branco - APMBB" (04/07 a 21/09/2026) e o `sck` que a Hotmart gravou em cada uma.

Padrão de UTM do Teorema (ordem do `sck`: fonte | meio | campanha | term | content):

- `utm_source` = onde o link está (`ig`, `yt`, `wpp`, `email`, `meta`, `google`)
- `utm_medium` = tipo (`organic`, `paid`, `grupo`, `email`, `bio`)
- `utm_campaign` = a operação, com um nome só
- `utm_term` = onde, dentro da fonte (`stories`, `bio`, `whatsapp`, `yt-cpl02`)
- `utm_content` = quem ou qual peça (`cesar`, nome do criativo)

## 1. Links do grupo de WhatsApp saem como Instagram (16 vendas)

- **O que aparece hoje:** `utm_source=ig&utm_medium=organic&utm_campaign=OP.BB.26&utm_term=whatsapp&utm_content=grupos`
- **Problema:** a fonte diz `ig`, mas o link é do grupo de WhatsApp. O relatório conta essas 16 vendas como Instagram. O Instagram de verdade foram só 13 (bio 7, stories 6).
- **Trocar por:** `utm_source=wpp&utm_medium=grupo&utm_campaign=OP.BB.26&utm_term=whatsapp&utm_content=grupos`
- **Exemplo completo:** `https://teoremamilitar.com.br/full/apmbb/?utm_source=wpp&utm_medium=grupo&utm_campaign=OP.BB.26&utm_term=whatsapp&utm_content=grupos`
- **Onde procurar:** mensagens fixadas e descrição dos grupos, mensagens programadas, respostas prontas.

## 2. Links de edições antigas ainda em uso (7 vendas)

Valores que apareceram no `sck` e de onde provavelmente vêm:

| no `sck` | vendas | provável origem |
|---|---|---|
| `OP.APMBB.24-YT_cpl4-org-undefined` | 2 | descrição de vídeo do YouTube (CPL 4 de 2024) |
| `yt-live \| org \| OP.BB.25` | 2 | YouTube ao vivo de 2025 |
| `bio \| org \| OP.BB.25` | 1 | link na bio |
| `site \| org \| OP.APMBB.24` | 1 | site |
| `OP.APMBB.24-WhatsAPP-org-undefined` | 1 | mensagem de WhatsApp de 2024 |

E mais uma venda com `youtube | organic | C.BB | descrição | JU9RtYl7QoA`: link na descrição do vídeo `JU9RtYl7QoA`.

- **O que fazer:** abrir a descrição e o comentário fixado desses vídeos (YouTube Studio → Conteúdo), a bio e o site, procurar `OP.APMBB.24`, `OP.BB.25` e `C.BB`, e trocar pelo link da campanha atual.
- **Se a ideia é deixar o link antigo de propósito** (pra medir o tráfego do vídeo antigo), então só anotar isso, pra a venda não ser lida como da campanha atual.

## 3. Google Ads: 36 vendas vêm como "Google" sem UTM

- **Sintoma:** `www.google.com | referral` (30), mais Bing, Yahoo e Brave. Uma pessoa que clica num anúncio de Pesquisa sem UTM aparece igual à busca orgânica.
- **Conferir se as campanhas de Pesquisa têm modelo de acompanhamento com UTM:**
  1. Google Ads → **Campanhas** → abrir a campanha de Pesquisa.
  2. **Configurações** (menu da esquerda).
  3. Abrir **Opções de URL da campanha**.
  4. Ver o campo **Modelo de acompanhamento**. Se estiver vazio ("Nenhuma opção definida"), não há UTM.
- **Modelo sugerido** (campanha de Pesquisa; não misturar com as campanhas de YouTube, que já mandam UTM no anúncio):
  `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign=OP.BB.26&utm_term={keyword}&utm_content={adgroupid}`
- **Cuidado:** manter o acompanhamento automático (`gclid`) ligado. E conferir antes se os anúncios já têm UTM na URL final, pra não duplicar.
- O menu muda de nome com frequência. Se algum passo não aparecer, mandar um print da tela.

## 4. Links do comercial e checkout aberto direto (48 vendas com `sck` vazio)

- **Sintoma:** nenhuma das 48 tem o cookie do site (`xcod`). 17 estão em ofertas usadas só 1 a 4 vezes, todas com `sck` vazio, e essas ofertas não estão mais na lista de ofertas ativas.
- **O que fazer:**
  1. Na Hotmart, produto → **Ofertas** (incluindo arquivadas): conferir os nomes das ofertas `q12d1nrn`, `tr16tism`, `1n361zxn`, `1gehe76x` (RENOV850JP), `05edp93z`, `1hg070bj`, `y6indht6`, `60xfbzrb`, `xxijwwd1`, `pj5k1sue`.
  2. Combinar com o comercial: todo link de checkout mandado direto leva `&sck=wpp|comercial|OP.BB.26|<vendedor>|direto`.
  3. Já existe `comercial_10249` (1 venda): alguém do comercial usa uma marcação, só que num formato diferente. Escolher um formato só.

## 5. Nome da campanha

- `OP.BB.26` (vendas) e `OP.BARROBRANCO.27` (link de captação). Escolher um nome por operação e usar em todos os links.
- No ActiveCampaign, a tag `OP.BARROBRANCO.27` (344) tem 0 contatos e a `OP.BB.26` (345) tem 753. Conferir qual a captação atual usa.

## 6. Depois de corrigir

- Voltar a rodar o levantamento de origens das vendas (mesmo método de 2026-09-21) e comparar: vendas com `sck` vazio, "Google sem UTM" e "ig com whatsapp".
- Meta: menos de 5% de vendas com `sck` vazio ou sem campanha.
