# YouTube: limpeza de descrições e links de venda (canal Teorema Militar)

Combinado em 2026-09-24. Ainda não começou.

## Objetivo

Revisar os vídeos do canal do Teorema, trocar os links de venda errados ou velhos pelos certos e
arrumar as tags. Tudo em massa, pela API do YouTube, sem editar vídeo por vídeo.

## O que já se sabe

- Canal: Teorema Militar. A quantidade de vídeos ainda não foi levantada.
- A Leili tem acesso de admin no canal e pode passar pra acesso total, se precisar.
- YouTube ainda não está ligado no sistema (`_contexto/ferramentas.md`).

## Como vai ser

1. Ligar a API: criar um projeto no Google Cloud, ativar a YouTube Data API v3 e criar a credencial
   OAuth. A Leili faz login e autoriza uma vez. O agente guia cada clique, com os passos numerados.
2. Puxar todos os vídeos: título, descrição, tags e links que aparecem na descrição.
3. Montar uma planilha com um vídeo por linha e os links errados marcados.
4. A Leili define o link certo de cada grupo (EsPCEx, Barro Branco etc.).
5. Guardar uma cópia das descrições originais antes de mexer, pra dar pra desfazer.
6. Testar em 2 ou 3 vídeos, a Leili confere, e depois aplicar no resto.

## Limites

- A cota diária da API dá pra uns 200 vídeos editados por dia. Canal maior que isso vai em lotes.
- Pra atualizar a descrição, a API reenvia o título e a categoria do vídeo junto. O script precisa
  mandar os valores atuais pra não apagar nada.

## Sugestão pra decidir

Usar um link fixo do site que redireciona (ex.: `teoremamilitar.com.br/yt-espcex`) em vez do link de
venda direto. Quando a oferta mudar, troca só o destino, e os vídeos continuam certos. Com UTM por
vídeo (`utm_source=youtube&utm_content=<id do vídeo>`), dá pra saber qual vídeo gera venda.
