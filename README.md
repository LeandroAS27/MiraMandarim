# Quadro de Mandarim

> **Status: EM ANDAMENTO.** Este é um demo, feito para validar a experiência com a professora.

Quadro branco que abre por um link, sem login. Um banco com as palavras de HSK 1 e HSK 2 fica ao lado do quadro: a pessoa arrasta cópias dos cartões para o quadro, forma frases e vê o resultado num painel embaixo.

## ⚠️ Limitações do MVP (escolha consciente)

O produto final precisa de **tempo real**: um backend com WebSocket que sincroniza os movimentos entre a professora e os alunos em dispositivos diferentes. **Isso NÃO faz parte deste MVP.**

- O estado fica só no navegador de cada pessoa (localStorage). Cada um vê apenas o próprio quadro.
- Não há backend, servidor, WebSocket, banco de dados nem serviço externo.
- A interface mostra o aviso: "Demo: os movimentos ainda não são compartilhados entre dispositivos."
- A **lista de palavras é PROVISÓRIA** e será trocada pela lista da professora (ver "Pendências para a professora revisar").

O estado do quadro está atrás da interface `BoardStore` (`src/store/BoardStore.ts`: `getState`, `hasSaved`, `load`, `save`, `subscribe`, `applyMove`). Hoje ela é implementada com localStorage (`LocalStorageBoardStore`). Uma implementação com WebSocket entra depois sem reescrever a UI.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes (Vitest)
npm run build    # build estático em dist/
```

## Como usar

- Na raiz, "Criar quadro" gera um id curto e abre `/#/quadro/<id>`.
- O quadro começa **vazio**. Toda vez que o link é aberto ou recarregado, ele volta a esse estado.

### Banco de palavras (cópias)

- A coluna ao lado (no celular, uma gaveta embaixo) é um **banco**: arrastar uma palavra dela para o quadro cria uma **cópia**, e a palavra continua no banco. Dá para puxar a mesma palavra quantas vezes quiser.
- Cada cópia no quadro tem um `instanceId` próprio, separado do `id` da palavra.
- Para remover uma cópia: arraste-a de volta para o banco, ou passe o mouse e clique no **×** (ou selecione e aperte Delete). No toque o × fica sempre visível.
- **Busca** no banco: por hanzi, pinyin (com ou sem tom, ex.: `ni`, `nǐ`) ou tradução (com ou sem acento).
- **Filtro de nível:** Todos, HSK 1 ou HSK 2. Cada cartão tem um selo pequeno "1" ou "2" no canto superior direito (tooltip "HSK 1" / "HSK 2").
- **Desfazer** (botão ou Ctrl/Cmd+Z): até 100 passos. Criar, mover e remover cópias entram no histórico (remover é um passo só).
- **Limpar quadro** remove todas as cópias de uma vez (o botão fica desativado com o quadro vazio). É um único passo do desfazer: Ctrl/Cmd+Z traz tudo de volta. Não pede confirmação, justamente por ser desfazível.
- **Salvar quadro** grava as cópias e suas posições no localStorage daquele link; **Abrir quadro salvo** (aparece quando existe um salvo) restaura. O reset ao abrir o link continua sendo o padrão.
- **Copiar link** copia o endereço do quadro.

### Pinyin, tradução e cores

- Botões **Pinyin** e **Tradução** (ligados por padrão) mostram ou escondem o texto em todos os cartões de uma vez. A tradução aparece ao passar o mouse; **no celular, com um toque rápido** no cartão. Desligar "Tradução" desliga também esse hover/toque.
- A escolha fica salva no localStorage como preferência do usuário (chave `miro-mandarim:prefs`), **separada do quadro**: o reset do quadro não mexe nela.
- **Cor por classe gramatical:** cada cartão é pintado pela classe da palavra. As cores ficam num único arquivo, `src/theme/classes.ts`. O botão **Legenda** abre e fecha a legenda de cores.

### Frase formada

O painel **Frase** fica recolhido numa faixa fina no rodapé. Ele sobe quando o mouse passa na faixa; no celular ou tablet, abre com um toque nela. O botão **Fixar frase** mantém o painel sempre aberto (preferência salva).

Ele mostra o hanzi, o pinyin e a **tradução palavra por palavra** (a junção das traduções de cada cartão, sem tradução automática nem API externa).

**Regra de ordem da frase:** todos os cartões do quadro entram numa única frase, lida só pela posição.

1. Cartões com quase a mesma altura formam uma **linha** (até 53 px de diferença para baixo, contados a partir do cartão mais alto da linha).
2. Dentro da linha, a ordem é **da esquerda para a direita**.
3. Em linhas diferentes, a **de cima vem primeiro**.

Cópias da mesma palavra aparecem de novo na frase.

### Zoom do quadro

- Controles **−**, **%** (clique para voltar a 100%) e **+** no canto inferior direito, de 40% a 200%.
- **Ctrl/Cmd + roda do mouse** (ou pinça no trackpad) aproxima e afasta em torno do ponteiro. No celular, **pinça com dois dedos**.
- O zoom é só visual: as posições dos cartões ficam em coordenadas do quadro, então a frase, o salvar e o desfazer não dependem dele. O zoom não é salvo e volta a 100% ao abrir o link.

### Celular e tablet

- Abaixo de 700 px de largura, o banco vira uma gaveta embaixo (começa fechada) e a barra de ferramentas vira uma faixa que rola na horizontal.
- No toque, arrastar um cartão começa ao **segurar um instante** (200 ms); antes disso, o dedo rola a lista ou o quadro normalmente.
- Foi testado o layout em tela de 375 px e o arraste com mouse. O toque real (segurar para arrastar, toque rápido para ver a tradução, pinça para o zoom) **ainda não foi testado em aparelho**.

## Como publicar na Vercel

O projeto é 100% estático.

1. Envie o repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório. O Vite é detectado automaticamente (build `npm run build`, saída `dist`).
3. Cada push na `main` gera um novo deploy.

Alternativa sem GitHub: `npx vercel` dentro da pasta do projeto. No Netlify vale o mesmo: build `npm run build`, publish `dist`. Como o quadro é identificado pelo hash da URL, não é preciso configurar rotas.

## Estrutura

```
src/
  data/palavras.json       300 palavras (HSK 1 e 2), com hsk e classe (provisório)
  theme/classes.ts         cores por classe gramatical
  store/                   BoardStore (interface), LocalStorageBoardStore,
                           BoardController (criar/mover/remover + desfazer), preferences
  lib/                     histórico, busca, frase, limites do quadro, ids
  hooks/                   useBoard, usePreferences, useMediaQuery
  components/              Home, Board, Tray (banco), Draggable, StickyNote,
                           Toolbar, Legend, SentencePanel
```

O estado do quadro é o conjunto de **cópias** (`instanceId → { palavraId, pos }`). O banco sempre tem todas as palavras.

Desempenho: durante o arraste só o `DragOverlay` se move; o estado global só muda ao soltar. Cada cartão é memoizado e só recebe props simples (palavra, `showPinyin`, `showTraducao`).

## ⚠️ Pendências para a professora revisar

### Lista de palavras

- A lista tem **300 palavras: HSK 1 (150) e HSK 2 (150), no padrão HSK 2.0**, tiradas de uma lista pública (`github.com/clem109/hsk-vocabulary`) e conferidas contra a lista anterior do projeto. Não foi comparada com uma fonte oficial do Hanban/HSK.
- As **traduções em português** foram escritas por nós e são **provisórias**.
- Algumas entradas do HSK 2.0 são frases ou formas compostas (ex.: 打电话, 打篮球, 火车站); homógrafos com leituras diferentes aparecem como entradas separadas (长 cháng/zhǎng, 还 hái/huán, 得 de/děi).
- O pinyin vem da lista pública, sem espaços entre sílabas e em forma de dicionário (sem mudança de tom por sândi, ex.: 不客气 = bùkèqi).
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

- Backend com WebSocket e quadro compartilhado de verdade (professora e alunos veem os mesmos movimentos).
- Trocar a lista provisória pela lista definitiva da professora e revisar as classes gramaticais.
- Validar com a professora a experiência em tablet e celular.
