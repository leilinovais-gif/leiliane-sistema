# Base de leads × compradores (2023 a 2026) · notas

Conversa de 2026-09-25 (noite) com a Leili. Objetivo dela: mostrar pra gerência e pra equipe se comprar lead frio no lançamento compensa, porque o lead compra depois (no perpétuo), e avaliar se o caminho é aquisição contínua em vez de tanto frio no lançamento.

## Fontes

- Leads: planilhas mandadas pela Leili (Downloads, 25/09): OP.BB23, OP.ESPCEX.24, PLANO.ESPCEX.24, P.VIDA.24, OP.BB24, OP.ESPCEX.25, MAT.BAS.25, OP.BB.25, OP.ESPCEX.26, MAT.BAS.26 + os 26.116 contatos do ActiveCampaign (API, 25/09). Unificado em `dados/leads-unificados.csv`.
- Compradores: todas as vendas aprovadas/completas da Hotmart de 2023-01 a 2026-09 pela API (13.184 linhas; `dados/hotmart-vendas.csv`).
- `dados/` tem e-mail de pessoa: fica só nesta máquina (o `.gitignore` da pasta bloqueia). Scripts em `scripts/` (PowerShell; rodar na ordem puxa-ac, puxa-hm, junta-leads, escola, todo/produto/matriz).

## Regras usadas

- Pessoa = e-mail. Entrada = primeira captura com data (planilhas + Active cadastrado em 2026). Active migrado em abr/2026 não tem data real: fica fora das contas de tempo.
- **Só conta quem era lead antes de ser aluno** (regra da Leili): quem entrou na base no mesmo dia da compra ou depois de já ter comprado é aluno, não lead (975 pessoas fora).
- Frio = PF (lookalike, interesses, Advantage+, aberto); quente = PQ (envolvimento, engajamento, lista, visitantes, checkout) + orgânico. Classificação pela UTM (medium/term/campanha).
- Escola do lead = base em que entrou; escola da compra = nome do produto.

## Achados

- 35.962 leads; 1.881 compraram depois de virar lead (5,2%), R$ 2,1 mi.
- Curva da base (% que comprou até X dias, só quem teve X dias de base): 30d 2,2% · 90d 3,7% · 180d 4,8% · 1 ano 6,9% · 2 anos 10,5%.
- Frio: 30d 0,83% · 90d 1,21% · 180d 1,63% · 1 ano 2,28% · 2 anos 4,14%. Quente orgânico: 7,1% → 21,4%. PQ: 1,4% → 6,6%.
- **Corte honesto é 3 meses, não 30 dias**: a captação começa 40 a 50 dias antes do carrinho, então "depois de 30 dias" inclui compra no próprio lançamento. Depois de 3 meses: 35% dos compradores e R$ 695 mil (33%) da base; no frio, 36% dos compradores e R$ 152 mil (38%).
- Frio compra o curso do evento no ciclo (EsPCEx mediana 27 d, Barro Branco 31 d) e o resto do catálogo meses depois (ESA 68 d, Química 161 d, Física 188 d, AFA 128 d).
- Cursos sem operação própria (ESA, EFOMM, AFA, EEAr, Edition, Geografia, História): medianas de 3 meses a quase 1 ano; 70% a 90% compram depois de 30 dias. Tabela em `por-produto.csv`.
- Full EsPCEx (2.836 compradores): 32% eram lead antes, 2% alunos de outro curso, 11% entraram na base no dia/depois, 2% só no Active migrado, **52% em nenhuma base** (maioria sem `sck`; o resto YouTube, bio, site, Google, live, WhatsApp). Faltam bases de 2022 e e-mails diferentes não cruzam.
- ESA/EFOMM/AFA com poucos leads datados (só 2026): a Leili pode ter planilhas antigas dessas escolas.

## Pauta de segunda (2026-09-28), a Leili pediu pra o agente puxar a conversa

1. Puxar do Meta Ads o investimento de 2023 até hoje (conta 277024930231617 e outras que houver; por campanha, marcando PQ/PF) e, se der, do Google Ads. A Leili acha que foi menos de R$ 500 mil no total.
2. Comparar investimento × faturamento da base, cortando pela data de entrada do lead (e pelo frio à parte): quanto voltou em 3 meses, 1 ano e 2 anos.
3. Discutir com ela a tese: frio compensa no longo prazo, mas converte ~2% contra ~17% do quente orgânico e metade dos alunos vem do orgânico sem passar pela captação. Avaliar trocar parte do frio do lançamento por aquisição contínua.
4. Pedir as planilhas antigas que faltam (ESA, EFOMM, AFA, operações de 2022) e ver se incluímos.
5. Formato da entrega pra gerência/equipe (relatório HTML no padrão do Barro Branco ou outro).
