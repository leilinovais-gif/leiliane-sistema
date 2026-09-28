# Cloudflare do Teorema · onde fica cada coisa

Conta: "Teoremacloudflare…". Menu em português.

## Chegar rápido
- **Ctrl+K** em qualquer tela (ou "Pesquisa rápida" no alto do menu): digite `relatorio` e escolha o Worker.
- **Recentes**, no menu da esquerda, logo abaixo de "Página inicial da conta".
- **Favorito no navegador** (Ctrl+D) no Worker e no Console do banco.

## Onde fica
| o quê | caminho |
|---|---|
| Worker (código, botão "código") | Computação → Trabalhadores e Páginas → `relatorio-espcex27` |
| Senhas do Worker (`REPORT_PASSWORD`, `AC_API_KEY`, `META_ACCESS_TOKEN`…) | dentro do Worker → aba **configurações** → Variáveis e segredos |
| Domínio do relatório e rota do formulário | dentro do Worker → aba **Domínios** (botões "+ Domínio" e "+ rota") |
| Banco (limpar teste, ver tabelas) | Armazenamento e banco de dados → D1 SQL Database → `relatorio-espcex27-db` → aba **Console** |
| KV | Armazenamento e banco de dados → KV → `relatorio-espcex27-kv` |
| DNS do site do Teorema | Domínios → `teoremamilitar.com.br` → DNS → Registros |

## Endereços
- Relatório (com senha): `https://relatorio.teoremamilitar.com.br/espcex-27`
- Formulário da pesquisa (público): `https://teoremamilitar.com.br/espcex-27/pesquisa`
- Respostas em planilha (com senha): `https://relatorio.teoremamilitar.com.br/api/espcex-27/pesquisa.csv`
- Provisório: `https://relatorio-espcex27.teoremacloudflare.workers.dev/espcex-27`

## Tarefas de sempre
- **Editor do Worker (direto):** `https://dash.cloudflare.com/6e3cf1ac4bad0a037ee86886df62781f/workers/services/edit/relatorio-espcex27/production`. O agente não consegue colar código nesse editor (2026-09-21: cliques e teclas não chegam nele); quem cola é a Leili.
- **Atualizar o código:** Worker → botão **código** → clique no código → Ctrl+A → Ctrl+V → **Implantar**. (Eu deixo o código novo na área de transferência.)
- **Segredos que o Worker usa:** `REPORT_PASSWORD`, `AC_API_KEY`, `META_ACCESS_TOKEN`, `GOOGLE_INGEST_KEY`, `WHATSAPP_KEY`, `PHONE_SALT` e, desde 2026-09-21, `HOTMART_CLIENT_ID`, `HOTMART_CLIENT_SECRET`, `HOTMART_BASIC_TOKEN` (usadas pela Visão geral) e `BETA_PASSWORD` (senha de teste: quem entra com ela vê os recursos em teste). Pra acrescentar: Worker → configurações → Variáveis e segredos → Adicionar → tipo **Segredo**.
- **Trocar a senha do relatório:** Worker → configurações → Variáveis e segredos → `REPORT_PASSWORD` → editar → salvar. Trocar também no `.env`.
- **Limpar teste da pesquisa:** Console do banco: `DELETE FROM pesquisa WHERE op = 'espcex-27';`
- **Limpar entradas do grupo:** Console do banco: `DELETE FROM entradas WHERE op = 'espcex-27';`
