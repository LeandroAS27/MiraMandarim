# Quadro de Mandarim

> **Status: EM ANDAMENTO.** Fase 2 (tempo real) implementada e ainda **não validada em produção**. Veja "O que ainda não foi testado".

Quadro branco que abre por um link, sem login. Um banco com as palavras de HSK 1 e HSK 2 fica ao lado do quadro: a pessoa arrasta cópias dos cartões para o quadro, forma frases e vê o resultado num painel embaixo. Agora o quadro é **compartilhado em tempo real**: professora e alunos mexem nos mesmos cartões e veem o cursor e o nome uns dos outros.

## Como funciona (fase 2)

- **Front:** React + TypeScript + Vite + dnd-kit (pasta `src/`). O estado do quadro continua atrás da interface `BoardStore`; a implementação em uso é `RealtimeBoardStore` (WebSocket). O `LocalStorageBoardStore` continua no código (testes e modo só-navegador), mas não é mais o padrão.
- **Backend:** um Cloudflare Worker (`worker/index.ts`) recebe `/api/quadro/:id/ws` e repassa para um **Durable Object por quadro** (`worker/QuadroDurableObject.ts`), que usa a **WebSocket Hibernation API** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`). O estado fica em `ctx.storage` (SQLite). Sem banco separado, sem VPS.
- O mesmo Worker serve o front (`dist/`) como assets (`wrangler.jsonc`: `assets.directory`, `not_found_handling: single-page-application`, `run_worker_first: ["/api/*"]`).
- As regras do servidor ficam em funções puras (`src/shared/`), testadas com Vitest sem o runtime da Cloudflare.

### Quadro e aula seguinte

O quadro ao vivo é **gravado no Durable Object** (no soltar um cartão, ao adicionar, remover e limpar). Por isso o link continua com o quadro como ficou: **abrir o mesmo link na aula seguinte mostra o quadro da aula anterior**. Quem entra no meio da aula recebe um `snapshot` com o estado atual.

- **Salvar quadro** (professora) guarda um *ponto de restauração* para a turma toda.
- **Abrir quadro salvo** (professora) troca o quadro de todos pelo último salvo.
- **Limpar quadro** (professora) esvazia o quadro de todos. O desfazer dela traz tudo de volta.
- Para começar uma aula do zero, a professora usa "Limpar quadro" ou cria um quadro novo.

### Nome, papéis e cursores

- Ao abrir o link, antes de entrar, aparece **"Como você quer aparecer?"** (1 a 24 caracteres, sem espaços nas pontas). Só depois disso o WebSocket conecta. O nome é guardado no `localStorage` deste navegador e **clicar no próprio nome na barra** abre a tela para trocar. Nomes repetidos são permitidos: o `clientId` identifica a conexão. O servidor valida o nome de novo e o trata sempre como texto.
- **Dois papéis, decididos só no servidor:**
  - **professora:** conexão com token válido. Só ela pode `save` e `reset` (Salvar, Abrir salvo, Limpar). Um aluno que tentar recebe `error`.
  - **aluno:** qualquer conexão sem token (ou com token errado).
- **Token da professora:** quem usa "Criar quadro" ganha um id longo e aleatório (24 caracteres) e um token guardado no navegador dela. Na primeira conexão com token, o servidor grava só o **hash SHA-256** dele; depois disso só o mesmo token é professora. Sem segredo para configurar no Worker.
  - A barra tem **Copiar link** (alunos, sem token) e **Copiar link da professora** (`#/quadro/<id>?token=<token>`, para abrir em outro aparelho: o token é guardado no navegador e sai da barra de endereço). **Guarde o link da professora:** quem perder o token perde o controle daquele quadro.
- **Cursores ao vivo:** cada pessoa vê o cursor das outras com o nome. O seu próprio não é redesenhado. A posição vai em **coordenadas do quadro**, então vale com pan e zoom diferentes em cada aparelho. Envio no máximo a cada ~200 ms e só se mudou; quem recebe suaviza o movimento. Parado por ~10 s, o cursor desbota; ao desconectar, some na hora. Cursores não são gravados.
- **Estilo por papel** (arquivo único de tokens: `src/theme/presence.ts`): professora com cor fixa (dourado) e ícone ★; alunos com ícone ● e cores claras diferentes (paleta fixa, sorteada pelo `clientId`). Texto escuro sobre todas as cores, contraste ≥ 7:1 (testado).
- **Arrasto ao vivo:** ao arrastar um cartão do quadro, os outros o veem andar (envio a cada ~200 ms, só em memória). A posição final é gravada ao soltar.
- A barra mostra quem está **online** (nome e papel) e o estado da conexão (Ao vivo / Reconectando / Desconectado). A conexão reconecta sozinha com backoff exponencial (0,5 s → 15 s, com sorteio).

### Desfazer em quadro compartilhado

O desfazer (Ctrl/Cmd+Z, até 100 passos) é **local**: cada pessoa desfaz só os próprios passos, e o desfazer vira mensagens normais para a turma. Se outra pessoa já tiver removido o cartão, o servidor ignora o passo.

## Protocolo JSON

Toda mensagem tem `type` e `clientId`. O `clientId` é gerado pelo navegador a cada carregamento da página (duas abas = duas pessoas) e o servidor confere que cada mensagem vem com o mesmo da conexão. `Pos` = `{ x, y }` em coordenadas do quadro (0–2700 × 0–1900). `Instance` = `{ instanceId, palavraId, pos }`. Limites: 64 000 caracteres por mensagem, 400 cartões no quadro.

**Navegador → servidor**

| type | campos | quem pode |
| --- | --- | --- |
| `join` | `nome` (1–24 caracteres) | todos; também troca o nome |
| `move` | `instanceId`, `to: Pos`, `final: boolean` (`false` durante o arrasto, `true` ao soltar) | todos |
| `add` | `instances: Instance[]` | todos |
| `remove` | `instanceIds: string[]` | todos |
| `cursor` | `x`, `y` | todos |
| `save` | — | só professora |
| `reset` | `to: "empty" \| "saved"` (padrão `"empty"`) | só professora |

**Servidor → navegador**

| type | clientId | campos |
| --- | --- | --- |
| `snapshot` | o seu | `papel`, `cor`, `state` (`{instanceId: Instance}`), `hasSaved` |
| `presence` | `"server"` | `users: [{ clientId, nome, papel, cor }]` |
| `move`, `add`, `remove`, `cursor` | quem fez | os mesmos campos da mensagem original (não voltam para quem enviou) |
| `saved` | professora | `at` (ms) — vale para todos |
| `reset` | professora | `to`, `state` (novo quadro) — vale para todos |
| `leave` | quem saiu | — |
| `error` | o seu | `code` (`mensagem_invalida`, `sem_permissao`, `sem_entrada`, `sem_salvo`, `limite`, `client_id_em_uso`), `message` |

`reset` com `to: "saved"` é extensão do nosso contrato (não é da Cloudflare): serve para "Abrir quadro salvo".

## Como rodar

### Comandos que você executa (passo a passo)

1. **Conta e Node.** Crie uma conta gratuita em <https://dash.cloudflare.com/sign-up>. Confira o Node.js:

   ```bash
   node --version
   ```

   (precisa ser uma versão atual; o projeto foi feito com Node 24). Se não tiver, instale em <https://nodejs.org>.

2. **Dependências e build:**

   ```bash
   npm install
   npm run build
   ```

   O build roda `tsc` no front, `tsc` no Worker e `vite build` (gera `dist/`).

3. **Login na Cloudflare** (só uma vez):

   ```bash
   npx wrangler login
   ```

   O navegador abre para você autorizar. Se aparecer só uma URL no terminal, copie e cole no navegador.

4. **Rodar localmente** (depois do build):

   ```bash
   npx wrangler dev
   ```

   (ou `npm run dev`, que faz o build e roda o `wrangler dev`). Abra <http://localhost:8787>. Você deve ver a home; "Criar quadro" abre o quadro e pede seu nome. Abra o **mesmo link em dois navegadores** (ou uma janela anônima, para ter outro nome): cada um vê o cartão do outro andando e o cursor com o nome. O link sem token é o de aluno; "Copiar link da professora" dá o de professora.

   Mudou o front? Rode `npm run build` de novo e recarregue (o Worker serve o `dist/`).

5. **Publicar** (só quando você decidir):

   ```bash
   npx wrangler deploy
   ```

   Na primeira vez o Wrangler pode pedir para você configurar um subdomínio `workers.dev`. O endereço final fica no formato `<worker>.<subdominio>.workers.dev`.

### Outros comandos

```bash
npm test         # testes (Vitest)
npm run build    # tsc (front e Worker) + vite build
npm run deploy   # build + wrangler deploy
```

## Limites do plano grátis da Cloudflare

Segundo a [página de preços dos Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/):

- **100 mil requisições de Durable Object por dia.** Cada mensagem WebSocket **recebida** pelo servidor conta com razão de **20 por 1** (100 mensagens = 5 requisições). Mensagens **enviadas** pelo servidor não são cobradas.
- **100 mil escritas de linha (SQLite) por dia**, 5 milhões de leituras por dia e **5 GB** de armazenamento no total. Cada `put()` conta.
- 13 000 GB-s de duração por dia; um objeto ocioso, elegível para hibernar, não paga duração.
- Passou da cota: as operações daquele tipo falham até a cota zerar. A cota diária **zera às 00:00 UTC (21h em Brasília)**.
- O plano pago, **Workers Paid, custa US$ 5 por mês** e amplia esses limites.

### Estimativa: aula de 30 alunos (60 min)

Premissas: cada pessoa move o mouse sobre o quadro em 30% do tempo e o cursor sai no máximo 5 vezes por segundo (throttle de 200 ms).

| Origem | Mensagens recebidas | Contam como requisições (÷ 20) |
| --- | --- | --- |
| Cursores: 30 × 5 × 0,3 × 3 600 s | ~162 000 | **~8 100** |
| Arrasto ao vivo: ~20 arrastos de 3 s por pessoa | ~9 000 | ~450 |
| Entradas, adds, drops, presença | poucas centenas | < 50 |
| **Total** | | **~8 600 (≈ 9% das 100 mil)** |

- **Pior caso** (todos movendo o cursor o tempo todo): 30 × 5 × 3 600 = 540 000 mensagens ≈ 27 000 requisições (**≈ 27%**). Dá para **3 aulas assim por dia** no plano grátis no pior caso, e mais de 10 nas condições acima.
- **Escritas:** um `put` por soltar/adicionar/remover (e um por salvar/limpar): ~30 alunos × 20 ações ≈ **600 por aula** (< 1% das 100 mil). O arrasto e os cursores **não gravam**.
- O que cresce com a turma é o *broadcast* (cada mensagem vira até 29 envios), mas isso não é cobrado como requisição; é só CPU do objeto.
- Isto é uma estimativa por conta, não uma medição. Esta conta considera só a página de preços dos Durable Objects; o Worker de entrada tem a própria cota de requisições, que não foi estimada aqui.

## Pendências e limites conhecidos

- **Conflitos:** vale a última mensagem que chega ao servidor (sem fusão). Dois alunos movendo o mesmo cartão ao mesmo tempo: o cartão fica com quem soltou por último.
- **Sem rede:** enquanto desconectado, as mudanças locais não são enviadas; ao reconectar, o `snapshot` do servidor substitui o estado local.
- **Sem proteção contra abuso** além do tamanho da mensagem, do limite de 400 cartões e da conferência de origem (`Origin`) da conexão. Quem sabe o id do quadro (24 caracteres aleatórios) consegue entrar como aluno.
- **Token:** o primeiro token enviado a um quadro novo vira o da professora. Sem ele não há como recuperar o controle (não há login).
- O quadro **não expira**: fica gravado no Durable Object até alguém limpar.

## O que ainda não foi testado

- **`wrangler dev` e `wrangler deploy` ainda não foram executados.** O front, o protocolo, as regras do servidor, o throttle e o `RealtimeBoardStore` (com WebSocket falso) têm testes; o Durable Object em si (Hibernation API, `serializeAttachment`, gravação em `ctx.storage`) só foi escrito conforme a documentação e precisa ser validado rodando.
- Dois navegadores no mesmo quadro, cursores, reconexão e a hibernação real.
- Toque real em celular (segurar para arrastar, pinça) e o arrasto ao vivo no celular.

## Como usar o quadro

- Na raiz, "Criar quadro" gera um id longo e abre `/#/quadro/<id>`.
- Para compartilhar com os alunos, use **Copiar link**.

### Banco de palavras (cópias)

- A coluna ao lado (no celular, uma gaveta embaixo) é um **banco**: arrastar uma palavra dela para o quadro cria uma **cópia**, e a palavra continua no banco. Dá para puxar a mesma palavra quantas vezes quiser.
- Cada cópia no quadro tem um `instanceId` próprio, separado do `id` da palavra.
- Para remover uma cópia: arraste-a de volta para o banco, ou passe o mouse e clique no **×** (ou selecione e aperte Delete). No toque o × fica sempre visível.
- **Busca** no banco: por hanzi, pinyin (com ou sem tom, ex.: `ni`, `nǐ`) ou tradução (com ou sem acento).
- **Filtro de nível:** Todos, HSK 1 ou HSK 2. Cada cartão tem um selo pequeno "1" ou "2" no canto superior direito.
- **Desfazer** (botão ou Ctrl/Cmd+Z): até 100 passos, só dos seus próprios passos.

### Pinyin, tradução e cores

- Botões **Pinyin** e **Tradução** (ligados por padrão) mostram ou escondem o texto em todos os cartões. A tradução aparece ao passar o mouse; **no celular, com um toque rápido**.
- A escolha fica no localStorage (chave `miro-mandarim:prefs`) e vale só para você: não é compartilhada com a turma.
- **Cor por classe gramatical:** cada cartão é pintado pela classe da palavra. As cores ficam em `src/theme/classes.ts`. O botão **Legenda** abre e fecha a legenda.

### Frase formada

O painel **Frase** fica recolhido numa faixa fina no rodapé. Ele sobe quando o mouse passa na faixa; no celular ou tablet, abre com um toque nela. **Fixar frase** mantém o painel aberto (preferência sua).

Cada **linha do quadro é uma frase**, com hanzi, pinyin e a **tradução palavra por palavra** daquela linha (sem tradução automática). O painel é calculado no navegador de cada pessoa a partir do quadro compartilhado.

**Regra de ordem da frase:** os cartões são lidos só pela posição.

1. Cartões com quase a mesma altura formam uma **linha** (até 53 px de diferença para baixo, a partir do cartão mais alto da linha).
2. Dentro da linha, a ordem é **da esquerda para a direita**.
3. Em linhas diferentes, a **de cima vem primeiro**, e cada linha é uma frase separada.

### Zoom do quadro

- Controles **−**, **%** (clique para voltar a 100%) e **+** no canto inferior direito, de 40% a 200%.
- **Ctrl/Cmd + roda do mouse** (ou pinça no trackpad) aproxima e afasta em torno do ponteiro. No celular, **pinça com dois dedos**.
- O zoom é só visual e individual: as posições ficam em coordenadas do quadro, então a frase, os cursores e o desfazer não dependem dele.

### Celular e tablet

- Abaixo de 700 px de largura, o banco vira uma gaveta embaixo (começa fechada) e a barra de ferramentas vira uma faixa que rola na horizontal.
- No toque, arrastar um cartão começa ao **segurar um instante** (200 ms); antes disso, o dedo rola a lista ou o quadro.

## Estrutura

```
wrangler.jsonc                  assets + Durable Object QUADRO (SQLite)
worker/
  index.ts                      porta de entrada: /api/quadro/:id/ws → getByName(id)
  QuadroDurableObject.ts        Hibernation API, estado, papéis, presença
src/
  shared/                       usado no front E no servidor
    protocol.ts                 tipos, parse e validação das mensagens
    room.ts                     regras do quadro e do papel (funções puras)
    nome.ts                     validação do nome
  theme/                        classes.ts (cores gramaticais), presence.ts (cursores)
  store/                        BoardStore (interface), RealtimeBoardStore,
                                LocalStorageBoardStore, BoardController (desfazer),
                                preferences, session (nome e token)
  lib/                          histórico, busca, frase, zoom, throttle, backoff, ids
  hooks/                        useBoard, usePreferences, useMediaQuery
  components/                   Home, NameGate, Board, Tray, Toolbar, PresenceBar,
                                Cursors, Draggable, StickyNote, Legend, SentencePanel
  data/palavras.json            300 palavras (HSK 1 e 2), com hsk e classe (provisório)
dist/                           saída do vite build (servida pelo Worker)
```

Desempenho: durante o arrasto só o `DragOverlay` se move localmente; o estado só muda ao soltar. Os cursores ficam numa camada isolada (`Cursors`), que re-renderiza sozinha a cada mensagem, sem tocar no resto do quadro.

## ⚠️ Pendências para a professora revisar

### Lista de palavras

- A lista tem **300 palavras: HSK 1 (150) e HSK 2 (150), no padrão HSK 2.0**, tiradas de uma lista pública (`github.com/clem109/hsk-vocabulary`). Não foi comparada com uma fonte oficial do Hanban/HSK.
- As **traduções em português** foram escritas por nós e são **provisórias**.
- Algumas entradas do HSK 2.0 são frases ou formas compostas (ex.: 打电话, 打篮球, 火车站); homógrafos com leituras diferentes aparecem como entradas separadas (长 cháng/zhǎng, 还 hái/huán, 得 de/děi).
- O pinyin vem da lista pública, sem espaços entre sílabas e em forma de dicionário (sem sândi tonal, ex.: 不客气 = bùkèqi).
- Palavras comuns de aula que **não** estão no HSK 1–2 (por exemplo 你们, 他们, 这儿, 那儿, 为什么) ficaram de fora.

### Classes gramaticais (provisórias)

O campo `classe` de cada palavra foi atribuído por nós, e **a professora precisa revisar**. Palavras que podem ter mais de uma classe usam a mais comum no nível HSK delas. Escolhas a conferir:

| Palavra | Classe usada | Outras possíveis |
| --- | --- | --- |
| 在 | verbo | preposição, advérbio |
| 到 | verbo | preposição |
| 给 | verbo | preposição |
| 会, 能, 可以, 要, 想 | verbo | verbo modal |
| 还 hái | advérbio | conjunção |
| 就, 再, 最 | advérbio | — |
| 没 | advérbio | verbo |
| 可能 | advérbio | verbo, adjetivo |
| 别 | advérbio | verbo (separar) |
| 好 | adjetivo | advérbio |
| 号 | substantivo | classificador |
| 分钟, 小时 | substantivo | classificador |
| 点, 岁, 块, 元 | classificador | substantivo |
| 运动, 旅游, 考试, 准备, 介绍, 回答 | verbo | substantivo |
| 每 | pronome | determinante |
| 为 | preposição | verbo |
| 比, 从, 向, 离 | preposição | verbo |
| 喂, 再见, 谢谢, 对不起, 不客气, 没关系 | outro | expressões fixas |

## Próximos passos

- Validar o fluxo completo com a professora e uma turma pequena (dois a três aparelhos) antes de uma aula real.
- Trocar a lista provisória pela lista definitiva da professora e revisar as classes gramaticais.
- Possíveis melhorias: agrupar os envios de cursor no servidor (reduz o tráfego com turmas grandes), expirar quadros antigos, recuperar o controle de um quadro sem o token.
