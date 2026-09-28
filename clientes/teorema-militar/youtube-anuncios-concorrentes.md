# YouTube: bloquear concorrente nos nossos vídeos e anunciar nos vídeos deles

Pesquisado em 2026-09-21 (Ajuda do Google Ads e do YouTube, mais artigos de terceiros). O que é confirmado pela ajuda oficial está marcado como **oficial**. O que vem de blog ou de fórum está marcado como **a confirmar**.

## Parte A · Impedir que concorrente anuncie nos nossos vídeos (e nos vídeos dos clientes)

O que dá pra fazer, com o limite de cada opção:

- **Bloquear pelo site do anunciante** (oficial). Serve pra concorrente conhecido. Limite de 500 URLs. Vale só pra anúncio na **página do vídeo**: não afeta Shorts nem feeds. Só bloqueia anúncio vendido pelo AdSense for YouTube.
- **Bloquear por categoria** (oficial). Até 200 categorias gerais. Barra também outros anunciantes do mesmo ramo.
- **Desligar a monetização** do vídeo (oficial). Sem monetização não entra anúncio nenhum, e o vídeo não pode ser usado como posicionamento.
- **Não dá pra bloquear** quem mira o público que assistiu (segmento personalizado). Isso é do lado do anunciante.

Passo a passo (repetir em **cada canal**: o seu, o de cada cliente):

1. Entrar no **YouTube Studio** com um usuário que tenha permissão no canal (dono ou gerente).
2. Menu da esquerda: **Configurações → Ad categories** (também aparece em **Ganhar → Anúncios na página de exibição → Ad categories**; o nome pode estar em português, algo como "Categorias de anúncios").
3. Aba **URLs**: colar os sites dos concorrentes, separados por vírgula → **BLOQUEAR** → **SALVAR**.
4. Se quiser, aba **Categorias gerais**: buscar a categoria → **BLOQUEAR** → **SALVAR**.
5. Esperar até 24 horas.
6. Alternativa pelo AdSense: **Brand safety → (produto YouTube) → Controles de bloqueio → URLs de anunciantes**. Canal ligado a rede multicanal (MCN) não consegue por aqui: precisa pedir pra rede.

Como descobrir **quais sites bloquear**:

1. Abrir os vídeos do canal numa **janela anônima**, sem estar logada, e anotar quem anuncia.
2. Pesquisar o nome do concorrente na **Central de Transparência de Anúncios do Google** (adstransparency.google.com): ela mostra o que ele anuncia e o domínio.
3. Bloquear o domínio de cada um (com e sem `www`, se tiver dúvida).

Cuidados:

- O bloqueio só vale a partir do momento em que é salvo. Não é retroativo.
- Concorrente pode trocar de domínio: revisar a lista de vez em quando.
- O YouTube recomenda usar bloqueio com moderação, porque tirar anunciantes reduz o leilão e pode baixar a receita.
- Conferir com cada cliente se ele quer isso, já que é mexer no canal dele.

## Parte B · Anunciar nos vídeos e canais de concorrentes

O que a pesquisa achou:

- **Oficial:** a campanha de vídeo de ação foi trocada pela **Demand Gen**, e a ajuda do Google **não lista** posicionamento direto em canais ou vídeos do YouTube pra Demand Gen. Só cita "exclusões de posicionamento" (conteúdo que você não quer). Quem usava posicionamento é orientado a usar público-alvo, segmentos semelhantes (lookalike) e exclusões.
- **A confirmar:** alguns blogs de 2026 dizem que a Demand Gen aceita posicionamento por canal ou vídeo. Não achei isso na ajuda oficial nem na conta da Leili: as telas dela (grupo de anúncios da Demand Gen) mostram só Canais, Público-alvo e Segmentação otimizada.
- **Oficial:** o menu **Públicos-alvo, palavras-chave e conteúdo → Conteúdo → Canais** existe pra campanha de vídeo. É preciso adicionar **no mínimo 10 canais ou vídeos** do YouTube pra poder salvar.
- Os tipos **Alcance de vídeo** e **Visualizações de vídeo** ainda existem, criados pelo objetivo **Reconhecimento e consideração**. Eles focam em alcance e visualização, não em lead ou venda. Não confirmei que cada um aceita posicionamento (a Ajuda diz que o menu vale pra campanha de vídeo).

Três caminhos, do mais garantido pro mais incerto:

### Caminho 1 · Segmento personalizado na Demand Gen (já em andamento)

1. Segmento criado com a URL do canal do concorrente em "pessoas que navegam em sites semelhantes a".
2. Adicionar mais URLs (canais e vídeos do concorrente).
3. No grupo de anúncios da Demand Gen: **Público-alvo → Adicionar um público-alvo →** escolher o segmento.
4. Desmarcar **Usar a segmentação otimizada**.
5. Em **Canais**, escolher **Quero escolher** e deixar só o YouTube.
6. Duplicar o grupo de anúncios antes, pra não perder o remarketing (público "All Users of Site Teorema Militar").

Limite: o Google mira quem consome conteúdo **parecido**, não garante aparecer no vídeo exato.

### Caminho 2 · Testar o posicionamento por canal na Demand Gen (a confirmar)

1. No grupo de anúncios, procurar seção **Conteúdo** ou **Posicionamentos**. Se não aparecer, é porque o recurso não existe na conta. Parar aqui.
2. Se existir: **Posicionamentos → YouTube → Canais/Vídeos**, com no mínimo 10 itens.

### Caminho 3 · Campanha de vídeo por Reconhecimento (posicionamento de verdade)

1. **Nova campanha → objetivo Reconhecimento e consideração → tipo Vídeo** (Alcance ou Visualizações).
2. No grupo de anúncios: **Públicos-alvo, palavras-chave e conteúdo → Conteúdo → Canais**.
3. Adicionar no mínimo 10 canais ou vídeos do YouTube dos concorrentes.
4. Usar como destino a página de captura ou o vídeo do cliente.

Limite: é campanha de alcance. Não otimiza lead nem venda como a Demand Gen.

Regras que valem nos três:

- O vídeo do concorrente só recebe o anúncio se ele for **monetizado** e o canal não bloquear o nosso site.
- O anúncio é sempre o **nosso** vídeo. Não se usa vídeo de terceiro nem se manda o clique pra ele.
- Não citar o nome ou a marca do concorrente no texto do anúncio (política de marca do Google Ads).
- Revisar a lista de canais a cada trimestre: canal muda de tema.

## Pra decidir amanhã

1. Cada cliente aceita mexer no canal dele (Parte A)?
2. Fazemos o teste do Caminho 3 pra ver se dá posicionamento no vídeo do concorrente, aceitando que é campanha de alcance?
3. Quais são os 10 ou mais canais e vídeos de concorrentes (é a lista mínima pra qualquer posicionamento)?

## Fontes

- Ajuda do YouTube, bloqueio de anúncios: https://support.google.com/youtube/answer/172795?hl=en
- Ajuda do Google Ads, Demand Gen: https://support.google.com/google-ads/answer/13695777?hl=en
- Ajuda do Google Ads, campanhas de vídeo de ação → Demand Gen: https://support.google.com/google-ads/answer/15110871?hl=en
- Ajuda do Google Ads, segmentação de campanhas de vídeo (pt-BR): https://support.google.com/google-ads/answer/7131506?hl=pt-BR
- Segmentos personalizados: https://support.google.com/google-ads/answer/9805516
- Vireo Video, bloquear concorrente: https://www.vireovideo.com/how-to-block-competitors-from-running-ads-on-your-youtube-channel/
- ClickedOn, opções de segmentação em vídeo 2026: https://clickedon.co/insights/google-ads-video-targeting-options
- Strike Social, Alcance × Visualizações × Demand Gen: https://strikesocial.com/blog/youtube-video-reach-campaign-vs-video-view-campaign-vs-video-action-campaign-demand-gen/
