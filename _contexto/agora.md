<!-- quem alimenta: o /setup semeia; o /atualizar reescreve no fim de cada sessão. Lido em toda conversa (boot). Teto: 40 linhas; estourou, vira ponteiro pra arquivo próprio. -->
# Agora · onde paramos

Índice por cliente (reorganizado em 2026-09-24). O detalhe e as pendências de cada cliente moram no `andamento.md` da pasta dele; aqui fica só o resumo e o que está quente. Na barra lateral, cada cliente tem um grupo (mais "Leili · Agência" e "Pessoal") e cada conversa leva só o tema no título.

## Onde paramos

- **Teorema Militar** (cliente principal), detalhe em `clientes/teorema-militar/andamento.md`:
  - *Rastreamento (em 25/09, fechado quase tudo):* script do site com primeira e última origem e `sck` inteiro; script antigo do GTM pausado; pixel antigo do Meta fora do navegador e do servidor; GA4 antigo movido pra uma tag isolada (o site manda só pro GA4 novo); tag `03 | Purchase` do GA4 corrigida. **Trilha do lead, fase 1, no ar e testada**: histórico de origens no D1, primeira origem e trilha gravadas no ActiveCampaign (campos 34 a 40). **Conversão de compra do Google Ads criada** (importa o `purchase` do GA4 novo). Confirmado que a Hotmart manda toda compra ao Stape por um webhook único; decidido **nenhum pixel em nenhum produto da Hotmart** (parceiro aplica, planilha pronta). Faltam validar as vendas novas e o `purchase` do GA4 (28/09) e tirar os pixels dos produtos. Em 25/09 também: 140 leads com a origem quebrada corrigidos no ActiveCampaign e contatos de teste apagados.
  - *Relatórios:* `relatorio.teoremamilitar.com.br` no ar (EsPCEx 27, Barro Branco 2027, Histórico). Visão geral: versão 1 pronta, falta pôr no ar; boletos e reembolsos entram quando mexer nela.
  - *YouTube:* limpeza das descrições e troca de links em massa combinada, ainda não começou.
  - *Infra antiga:* Supabase `vendas-militares` provavelmente é o "Workspace Teorema" que o time está construindo (a Leili integra o relatório dela depois); `dados` é morto; o webhook do n8n morto foi desligado em 25/09.
- **Simone Fuzaro:** integração do Notion com as anamneses resolvida; sem pendência conhecida.
- **Lucas · Consórcio:** sem conversa ainda.
- **Éder · Respeita a Geografia** (ajuda pontual): sem conversa ainda.
- **Leili · Agência:** montando a própria agência (nome, marca) e a prospecção; pesquisa do nicho de impressão 3D B2B feita pra uma reunião.

## Pendências (só o que é da Leili ou do sistema; as do Teorema estão no andamento dele)

- Conectar o sistema a um repositório no GitHub (git já instalado e iniciado nesta pasta; falta criar o repositório em github.com/new e passar o link)
- Fechar identidade visual e tom de voz da Leili em `_contexto/marca/` (desde 2026-09-17)
- Gerar `bem-vindo.html` quando a marca estiver definida (desde 2026-09-17)
- Rodar `/mapear` pra criar skills do dia a dia (desde 2026-09-17)
- Criar a pasta de cada cliente que falta (Simone, Lucas, Éder) e a `agencia/` com `prospeccao/`, pelo `/novo-projeto`
- Decidir se o roteiro de rastreamento desta semana (diagnóstico, script, GTM, trilha, conferência) vira uma skill reutilizável pros outros clientes (oferecido em 2026-09-24, sem resposta)

## Quente agora

- **Só neste fim de semana (26 e 27/09) a Leili não vai trabalhar** (ela trabalha em fim de semana quando a demanda pede, então não é regra): tudo que precisa de 24 horas ou mais pra validar fica pra segunda, 28/09.
- 2026-09-28, 09h: tarefa agendada confere o `sck` e o `src` das vendas e deixa um recado com a contagem por dia pra a Leili comparar com o `purchase` do GA4 (a rotina não lê o GA4). Só roda com o app do Claude aberto; se estiver fechado, roda quando abrir.
- Segunda 28/09, o agente abre com: `purchase` do GA4 subiu? a conversão de compra do Google Ads (criada em 25/09) recebeu compras (e a Leili perguntou ao parceiro por que as PURCHASE foram removidas em março de 2026)? pixels de todos os produtos da Hotmart removidos pelo parceiro? designer avisado (a Leili fala por áudio)? explicar o GitHub pra ela (o que falta: criar o repositório privado em github.com/new e passar o link; onde ela acessa as coisas) e só depois rodar `/syncar`? mensagens pro Gustavo e pro time do Workspace (mandadas em 25/09) foram respondidas? A Leili cadastra ela mesma, na segunda, o webhook novo do relatório na Hotmart (Ferramentas → Webhook; o endereço com a chave se pede à conversa dos relatórios; o worker novo já está no ar desde 25/09 e recusa chave errada com 401)? n8n desligado há uma semana pode ser apagado? conversar com o time sobre RD, Pluga, Make e Montink nos webhooks?
- **28/09 (feito):** GA4 `purchase` corrigido no [CARTEIRO] (falta confirmar na 1ª venda real e desligar o log de saída do Stape); webhook da Hotmart do relatório cadastrado e recebendo; investimento do Meta puxado. Detalhe em `clientes/teorema-militar/andamento.md` (seções 1, 2 e 5, "28/09").
- **Segunda 28/09, a Leili pediu que o agente chame ela pra conversar sobre a análise base de leads × compradores** (frio compra depois? compensa comprar frio no lançamento?). Achados e pauta em `clientes/teorema-militar/analise-leads-x-compradores/notas.md`; próximo passo: puxar o investimento do Meta de 2023 pra cá e comparar com o faturamento da base.
- A trilha do lead foi aprovada e construída em 25/09; não há mais o que perguntar sobre ela além dos itens acima.
- EsPCEx 27: captação até 28/09, lembrete 22-29/09, vendas 29/09-11/10.
