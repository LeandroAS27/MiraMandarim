# Quadro de Mandarim

> **Status: EM ANDAMENTO.** Fases 2 (tempo real) e 3 (salas, admin, quadros salvos e palavras extras) implementadas e testadas com Vitest, mas **ainda não validadas em produção**. Veja "O que ainda não foi testado".

Quadro branco compartilhado em tempo real. Um banco com as palavras de HSK 1, 2 e 3 (padrão HSK 3.0) fica ao lado do quadro: a pessoa arrasta cópias dos cartões para o quadro, forma frases e vê o resultado num painel embaixo. A professora (**admin**) cria a sala e manda o **link de aluno**; os **alunos** entram por ele, sem login, e todos veem os mesmos cartões, o cursor e o nome uns dos outros.

## Nomenclatura

| Termo | Significa |
| --- | --- |
| **Sala** | um quadro compartilhado, identificado por um **código de sala** longo e aleatório |
| **Link de admin** | código da sala + **token secreto de admin**. É o link da professora |
| **Link de aluno** | só o código da sala, sem token |
| **admin** | a professora. Papel decidido **só no servidor**, pelo token |
| **aluno** | qualquer pessoa que entra sem token de admin |

> ⚠️ **O link de admin nunca deve ser enviado aos alunos.** Quem o tem controla a sala, os quadros salvos e as palavras extras da professora. Mande aos alunos só o botão **"Copiar link dos alunos"**.

## Como funciona

- **Front:** React + TypeScript + Vite + dnd-kit (`src/`). O estado do quadro fica atrás da interface `BoardStore`; a implementação em uso é `RealtimeBoardStore` (WebSocket).
- **Backend:** um Cloudflare Worker (`worker/index.ts`) com dois tipos de **Durable Object** (SQLite, plano grátis):
  - `QUADRO` (`QuadroDurableObject`): **um por sala**. Usa a **WebSocket Hibernation API** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`). Guarda o quadro ao vivo, o hash do dono e as sessões de aluno.
  - `PROFESSORA` (`ProfessoraDurableObject`): **um por admin**, nomeado pelo SHA-256 do token dela (calculado no servidor). Guarda o que vale para **todas as salas dela**: os quadros salvos e as palavras extras.
- O mesmo Worker serve o front (`dist/`) como assets (`assets.directory`, `not_found_handling: single-page-application`, `run_worker_first: ["/api/*"]`).
- As regras do servidor são funções puras em `src/shared/`, testadas sem o runtime da Cloudflare.

## Criar sala, links e sessões

### Criar sala

1. Na tela inicial, a professora digita a **chave de criação** (só ela tem) e clica em **Criar sala**.
2. O servidor gera um **código de sala** novo e, na primeira vez, o **token de admin**. Os dois são aleatórios e **assinados** com o segredo do servidor (HMAC-SHA256), então o Worker reconhece o que emitiu sem acordar nenhum Durable Object.
3. A professora entra na sala já como admin. Nas próximas vezes, o token guardado no navegador dispensa a chave de criação, e todas as salas valem para a mesma admin.

### Minhas salas (escolher e nomear)

- A tela inicial, para quem tem sessão de admin, mostra **Minhas salas**: cada sala com seu nome (padrão "Sala 1", "Sala 2"…), a data de criação e os botões **Entrar** e **Renomear** (até 40 caracteres, sem HTML). **Criar sala** acrescenta mais uma à lista.
- **Arquivar** tira a sala da lista principal (ela vai para "Arquivadas", com **Desarquivar**). É só organização: o link de aluno **continua funcionando**. Só as salas ativas contam para o limite de 100.
- **Excluir** apaga de verdade, com um cartão de confirmação em que é preciso **digitar o nome da sala** (como no GitHub): a sala apaga tudo o que guarda (quadro, sessões de aluno, dono), **desconecta quem estiver nela** e passa a responder "Sala não encontrada" (o front mostra o aviso e não fica reconectando). O link de aluno deixa de funcionar e não há como desfazer. Quadros salvos e palavras extras **não** são afetados (pertencem à admin, não à sala). Teto total de 300 salas no registro, arquivadas incluídas.
- Dentro de uma sala, o botão **Minhas salas** da barra volta a essa lista.
- A lista fica no Durable Object `PROFESSORA` (uma chave, até 100 salas) e só quem tem o token de admin a lê ou renomeia (`POST /api/salas/lista` e `POST /api/salas/nome`).
- Salas criadas antes desta versão não aparecem na lista; abra-as pelo link de admin ou crie uma nova.

### Os dois botões da admin

Na barra, só a admin vê:

- **Copiar link dos alunos:** o link com o código da sala, sem token. É o que se manda à turma.
- **Copiar meu link (admin):** o link com o token, com aviso para não enviar aos alunos. Serve de backup (outro computador, navegador limpo).

Quem entra pelo link de aluno **não vê nenhum desses botões**. O token de admin **nunca** é enviado ao navegador de aluno (nem em `snapshot`, `presence`, `cursor` ou qualquer outra mensagem; há teste para isso). Ele sai do servidor uma única vez, para quem acabou de criá-lo.

### Sessão da admin

- O token fica no `localStorage` da admin. Ao **abrir o site**, ela volta direto para a última sala, sem colar o link.
- O link de admin (`#/quadro/<codigo>?token=<token>`) continua valendo: ao abri-lo, o navegador guarda a sessão e **tira o token da barra de endereço**.
- **Sair** apaga a sessão de admin deste navegador (o nome continua). Para voltar, é preciso do link de admin. **Não há recuperação do token:** quem perder o token e o link perde o controle.
- O token vai **dentro da mensagem `join`** do WebSocket, nunca na URL (URLs aparecem em logs).
- Se a professora abrir um link de aluno da própria sala no mesmo navegador, ela entra como admin (o token guardado vale). Para testar como aluno, use uma janela anônima.

### Sessão do aluno (4 horas)

- Ao entrar, o servidor emite uma **sessão de aluno com validade de 4 horas**, contada a partir da primeira entrada (reentrar não a estende). O navegador guarda o id da sessão; o servidor guarda só o **hash** dele e a validade.
- A expiração é conferida **no servidor**, com o relógio dele, na entrada e **a cada mensagem**. Vencida (ou desconhecida), o servidor fecha a conexão (código 4003) e o aluno volta para a tela de nome, com o aviso de sessão expirada.
- Os links continuam **permanentes**: depois de expirar, o aluno entra de novo pelo mesmo link, confirmando o nome.
- Admin não tem expiração (a sessão dela é o token).

### Salas e abuso

- A criação de sala exige a **chave de criação** (segredo do servidor) ou um token de admin válido. Sem isso, ninguém cria sala.
- O código de sala é assinado: o Worker recusa códigos que ele nunca emitiu **antes de tocar em qualquer Durable Object**, então inventar códigos não custa requisições de Durable Object. Uma sala que não foi criada responde com o código de fechamento 4004 ("sala não encontrada") e o front não fica reconectando.
- Limites que continuam: a chave de criação pode ser tentada por força bruta (use uma frase longa) e ainda não há limitação de requisições por IP. Outra forma de autenticação poderá substituir a chave no futuro.

## Ações da admin

Só a admin vê e pode usar. O servidor **rejeita** essas mensagens quando vêm de um aluno e responde com `error` (`sem_permissao`).

- **Limpar quadro:** esvazia o quadro de todos (post-its **e desenhos**), com **confirmação** (não há desfazer).
- **Caneta, apagador e "Apagar todos os desenhos":** a lousa de desenho (seção abaixo).
- **Salvar quadro:** pede um **nome** (ex.: "Aula 3 - verbos") e guarda o quadro atual. Um nome que já existe é substituído. Máximo de 50 quadros, nome de até 40 caracteres.
- **Abrir quadro salvo:** lista os quadros da admin (todos, de qualquer sala dela). **Abrir** troca o quadro de todos os conectados (com confirmação se já houver cartões); **Excluir** apaga o quadro salvo (com confirmação).
- **Adicionar palavra:** abre o formulário de palavras extras (abaixo).

Os quadros salvos pertencem à admin (Durable Object `PROFESSORA`), não à sala.

### O quadro ao vivo e a aula seguinte

O quadro ao vivo é gravado no Durable Object da sala (ao soltar um cartão, adicionar, remover, limpar ou abrir um quadro salvo; nunca a cada passo do arrasto). Abrir o mesmo link na aula seguinte mostra o quadro como ficou. Quem entra no meio da aula recebe um `snapshot` com o estado atual.

## Caneta e apagador (só a admin)

A admin escreve na lousa com uma caneta; os **alunos só veem** os desenhos, em tempo real. A caneta, as cores, o apagador e o botão de apagar tudo **só aparecem para quem o servidor reconheceu como `admin`**, e o servidor rejeita (com `error`) qualquer mensagem de desenho vinda de um aluno.

**Como usar** (na **paleta flutuante** embaixo da lousa, no estilo do Freeform do iPad: uma pílula só com ícones, visível só para a admin):

- **Mover** (ícone de seta; padrão ao entrar): arrasta os post-its, como sempre. A camada de desenho **não captura o ponteiro** (`pointer-events: none`).
- **Caneta** (ícone de lápis, com uma bolinha da cor atual): tocar nela escolhe a caneta; **tocar de novo abre as cinco cores** numa pílula acima da paleta. Desenha na lousa, com mouse, caneta stylus ou toque (Pointer Events; o navegador não rola nem dá zoom no lugar do traço). As **cinco cores** são: preto `#1A1A1A`, vermelho `#C62828`, azul `#1565C0`, verde `#2E7D32` e laranja `#E65100` (definidas em `src/theme/tracos.ts`, todas com contraste ≥ 3:1 contra o fundo; o laranja sugerido inicialmente, `#EF6C00`, dava só 2,65:1). Espessura fixa de **4 px em coordenadas do quadro**, então o traço acompanha zoom e scroll como os post-its. Um clique sem arrastar faz um ponto.
- **Apagador** (ícone de borracha): tocar (ou passar por cima de) um traço **apaga aquele traço inteiro**, não pixel a pixel.
- **Apagar todos os desenhos** (ícone de lixeira, desligado quando não há traços): esvazia todos os traços, para todos, com **cartão de confirmação**. Os post-its não são afetados.
- Na caneta e no apagador o **arraste de post-its fica desligado**, inclusive o do banco de palavras. **Esc** volta ao modo Mover. O modo é só local (não vai ao servidor nem às preferências).
- Com dois dedos (pinça), o traço em andamento é cancelado para o zoom funcionar.

**Limites** (conferidos no cliente e no servidor): só as 5 cores; espessura só a permitida (hoje 4); **até 400 pontos por traço** (depois da simplificação) e **até 300 traços por quadro**; pontos têm de ser números finitos (coordenadas fora do quadro são ajustadas para dentro). Passou disso, o servidor responde `error` (`mensagem_invalida` ou `limite`).

**Salvar, abrir e limpar:** os traços entram no **snapshot** de quem conecta no meio da aula; entram **ao salvar um quadro com nome** e **voltam ao abrir** o quadro salvo, para todos os conectados; **Limpar quadro** também os apaga. Quadros salvos antes da caneta abrem sem traços.

**Cota do plano grátis:** só a admin desenha, então o custo é pequeno. O traço vai **inteiro, uma única vez, quando ela solta o ponteiro**, já simplificado (Ramer-Douglas-Peucker; nunca ponto a ponto). A **prévia ao vivo** (os alunos veem o traço aparecendo) é enviada no máximo a cada ~200 ms e fica **só em memória** no servidor (nunca em `ctx.storage`); some quando o traço final chega, ou sozinha após 3 s sem novidade. Grava-se **só**: traço finalizado, apagar um traço, apagar todos (e limpar/abrir quadro salvo). Cursor, prévia e pontos soltos nunca gravam.

## Palavras extras

- Só a admin adiciona: hanzi, pinyin, tradução e **classe gramatical** (lista fechada, a mesma das cores dos cartões), todos obrigatórios. Limites: hanzi 12, pinyin 40 e tradução 60 caracteres; sem `<` nem `>` (nada de HTML: tudo é texto puro). **Validação no navegador e no servidor.**
- A palavra entra no banco com o selo **"E"** no lugar do selo de HSK, com a cor da classe, e ganha o filtro **Extras** ao lado de Todos, HSK 1, HSK 2 e HSK 3.
- Ficam no **dicionário da admin** (`PROFESSORA`, um único registro, até 300 palavras) e aparecem em **todas as salas dela**, separadas das 978 originais (a lista original nunca é alterada). Quem entra na sala (aluno ou admin) recebe as extras no `snapshot`.
- A admin pode **editar** e **excluir** uma palavra extra. Excluir tira os cartões dela da sala atual; em outras salas e quadros salvos, o cartão de uma palavra que não existe mais simplesmente não aparece (e é descartado ao abrir um quadro salvo).
- **Como a palavra chega às outras salas (sem gastar requisição à toa):** as extras pertencem à professora, não à sala, e vivem no servidor (`PROFESSORA`), então não somem ao fechar o navegador, trocar de computador ou limpar o cache. Cada sala guarda só uma **cópia na memória** (`ExtrasCache`). Uma sala que ninguém usa **hiberna e não gasta nada**; ao hibernar, a cópia some. Quando alguém entra nela, a sala acorda e **busca a lista uma única vez**: por isso a palavra criada em outra sala aparece assim que se entra nesta, sem nenhum aviso entre salas. Enquanto a sala está acordada, as entradas seguintes reaproveitam a cópia (**nunca uma consulta por aluno**, por cursor ou por movimento); só a **admin**, ao entrar, força uma busca nova. Na sala onde a admin cria, edita ou exclui, a mudança vale **na hora** para todos os conectados.
- O aluno nunca fala com o `PROFESSORA`: quem busca é a sala, e ela repassa as extras no `snapshot`.
- **Limite conhecido:** quem já está conectado numa *outra* sala, no momento exato da edição, só vê a palavra nova quando a sala dele hibernar e acordar (segundos a minutos depois) ou quando ele reconectar. Como a professora usa uma sala por vez, isso foi aceito para não acordar salas paradas.

## Nome, cursores e papéis na tela

- Antes de entrar, aparece **"Como você quer aparecer?"** (1 a 24 caracteres). O nome fica no `localStorage`; clicar no próprio nome na barra troca. O servidor valida o nome de novo e o trata como texto.
- **Cursores ao vivo:** cada pessoa vê o cursor das outras com o nome, em coordenadas do quadro (vale com pan e zoom diferentes). Envio a cada ~200 ms e só se mudou; o movimento é suavizado; parado por ~10 s o cursor desbota; ao desconectar, some. Cursores não são gravados.
- **Estilo por papel** (`src/theme/presence.ts`): admin com cor fixa (dourado) e ícone ★; alunos com ícone ● e cores claras sorteadas pelo `clientId`. Contraste ≥ 7:1 (testado). Na lista de online, a admin aparece como "(admin)".
- **Arrasto ao vivo:** os outros veem o cartão andar (a cada ~200 ms, só em memória); a posição final é gravada ao soltar.
- A conexão reconecta sozinha com backoff exponencial (0,5 s → 15 s, com sorteio).

## Preferências locais

Mostrar/esconder **pinyin**, **tradução**, **legenda**, **fixar frase** e **fixar a barra de ferramentas** são **individuais**: valem só na tela de quem mudou, ficam no `localStorage` (`miro-mandarim:prefs`) e **nunca** são enviadas pelo WebSocket nem sincronizadas (há teste para isso). O mesmo vale para o zoom.

## Protocolo JSON

Toda mensagem tem `type` e `clientId`. O `clientId` é gerado a cada carregamento da página (duas abas = duas pessoas) e o servidor confere que cada mensagem vem com o mesmo da conexão. `Pos` = `{ x, y }` (0–2700 × 0–1900). `Instance` = `{ instanceId, palavraId, pos }`. Limites: 64 000 caracteres por mensagem, 400 cartões no quadro.

**Navegador → servidor**

| type | campos | quem pode |
| --- | --- | --- |
| `join` | `nome`, `token?` (admin), `sessao?` (aluno) | todos; também troca o nome |
| `move` | `instanceId`, `to`, `final` | todos |
| `move_many` | `moves: [{ instanceId, to }]` (grupo solto; até 400 cartões) | todos |
| `add` | `instances` | todos |
| `remove` | `instanceIds` | todos |
| `cursor` | `x`, `y` | todos |
| `reset` | `to: "empty"` | só admin |
| `save` | `nome` | só admin |
| `listSaved` | — | só admin |
| `open` | `id` do quadro salvo | só admin |
| `deleteSaved` | `id` | só admin |
| `addPalavra` | `palavra: { hanzi, pinyin, traducao, classe }` | só admin |
| `editPalavra` | `id`, `palavra` | só admin |
| `removePalavra` | `id` | só admin |
| `stroke_add` | `stroke: { id, cor, w, pts }` (traço completo, ao soltar) | só admin |
| `stroke_remove` | `id` do traço | só admin |
| `strokes_clear` | — | só admin |
| `stroke_preview` | `stroke` parcial (só repassada, nunca gravada) | só admin |

**Servidor → navegador**

| type | para quem | campos |
| --- | --- | --- |
| `snapshot` | quem entrou | `papel`, `cor`, `state`, `strokes`, `palavras` (extras), `sessao?` (`{ id?, expiraEm }`, só alunos) |
| `presence` | todos | `users: [{ clientId, nome, papel, cor }]` |
| `move`, `add`, `remove`, `cursor` | os outros | os mesmos campos da mensagem original |
| `reset` | todos | `to` (`"empty"` ou `"saved"`), `state`, `strokes` |
| `move_many` | os outros | `moves` |
| `stroke_add`, `stroke_preview` | os outros | `stroke` |
| `stroke_remove` | os outros | `id` |
| `strokes_clear` | os outros | — |
| `palavras` | todos | `items`: lista completa das palavras extras |
| `saved` | quem salvou | `meta: { id, nome, em, total }` |
| `savedList` | quem pediu | `items: [{ id, nome, em, total }]` |
| `leave` | os outros | — |
| `error` | quem enviou | `code` (`mensagem_invalida`, `sem_permissao`, `sem_entrada`, `limite`, `client_id_em_uso`, `sessao_expirada`, `nao_encontrado`), `message` |

**Traço (`stroke`):** `{ id, cor, w, pts }`. `id`: 4 a 40 caracteres `A-Z a-z 0-9 _ -`. `cor`: `"preto"`, `"vermelho"`, `"azul"`, `"verde"` ou `"laranja"` (o hexadecimal fica só no front). `w`: espessura (hoje só `4`). `pts`: lista achatada `[x0, y0, x1, y1, …]` em inteiros dentro do quadro, de 2 a 400 pontos.

Códigos de fechamento do WebSocket (o front **não** reconecta): 4000 (outra aba assumiu o `clientId`), 4002 (`clientId` recusado), 4003 (sessão de aluno expirada), 4004 (sala inexistente).

Rotas HTTP: `POST /api/salas` com `{ chave?, token? }` → `{ codigo, token? }` (o `token` só vem quando é emitido pela primeira vez); `POST /api/salas/lista` com `{ token }` → `{ salas }`; `POST /api/salas/nome` com `{ token, codigo, nome }`, `POST /api/salas/arquivar` com `{ token, codigo, arquivada }` e `POST /api/salas/excluir` com `{ token, codigo }` → `{ salas }`.

## Como rodar

### Comandos que você executa (passo a passo)

1. **Conta e Node.** Conta gratuita em <https://dash.cloudflare.com/sign-up>. Confira o Node.js (`node --version`; o projeto foi feito com Node 24).

2. **Dependências e build:**

   ```bash
   npm install
   npm run build
   ```

3. **Login na Cloudflare** (uma vez):

   ```bash
   npx wrangler login
   ```

4. **Chave de criação para rodar localmente.** Crie o arquivo `.dev.vars` na raiz (ele está no `.gitignore`; **nunca** o publique) com uma frase longa só sua:

   ```
   CHAVE_CRIACAO=troque-por-uma-frase-longa-so-sua
   ```

   Depois rode `npx wrangler dev` (ou `npm run dev`) e abra <http://localhost:8787>. Digite a chave, clique em **Criar sala**, use **Copiar link dos alunos** e abra numa janela anônima.

5. **Chave de criação em produção** (uma vez, antes de publicar; o comando pede o valor, que não fica em nenhum arquivo):

   ```bash
   npx wrangler secret put CHAVE_CRIACAO
   ```

6. **Publicar** (só quando você decidir):

   ```bash
   npm run deploy
   ```

   (faz o build e o `wrangler deploy`). Na primeira vez o Wrangler pode pedir um subdomínio `workers.dev`. Esta versão cria o Durable Object novo `PROFESSORA`. **Salas criadas antes desta versão deixam de funcionar** (o código delas não tem assinatura): crie salas novas.

Não coloque a chave de criação, tokens ou senhas em código, README ou commits.

### Outros comandos

```bash
npm test         # testes (Vitest)
npm run build    # tsc (front e Worker) + vite build
```

## Limites do plano grátis da Cloudflare

Segundo a [página de preços dos Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/):

- **100 mil requisições de Durable Object por dia.** Cada mensagem WebSocket **recebida** conta com razão de **20 por 1**. Mensagens **enviadas** não são cobradas.
- **100 mil escritas de linha por dia**, 5 milhões de leituras e **5 GB** de armazenamento.
- 13 000 GB-s de duração por dia; um objeto ocioso, elegível para hibernar, não paga duração.
- A cota diária **zera às 00:00 UTC (21h em Brasília)**. O plano **Workers Paid** custa **US$ 5 por mês**.

### O que grava no armazenamento

Só estas ações escrevem (uma linha por chave): soltar/adicionar/remover cartão e limpar (sala), traço finalizado, apagar um traço e apagar todos os desenhos (sala; a lista de traços é uma única chave, com até ~1,5 MB no pior caso, abaixo do limite de 8 MB por linha dos Durable Objects com SQLite), salvar quadro com traços (os traços ficam numa chave à parte, `tracos-quadro:<id>`, para a listagem dos quadros não lê-los), abrir quadro salvo (sala), salvar ou excluir quadro salvo (`PROFESSORA`), adicionar/editar/excluir palavra extra (`PROFESSORA`), criar sala (1 linha) e **cada aluno novo** (1 linha da sessão). **Nunca** gravam: cursor, arrasto, presença e preferências locais.

### Estimativa: aula de 30 alunos (60 min)

Premissas: cada pessoa move o mouse sobre o quadro em 30% do tempo, cursor a no máximo 5 envios por segundo.

| Origem | Contam como requisições |
| --- | --- |
| Cursores: 30 × 5 × 0,3 × 3 600 s ≈ 162 000 mensagens ÷ 20 | **~8 100** |
| Arrasto ao vivo: ~20 arrastos de 3 s por pessoa ≈ 9 000 mensagens ÷ 20 | ~450 |
| Entradas (a sala busca o dicionário da admin **uma vez por acordar**, não por aluno), adds, drops, presença | < 100 |
| Caneta da admin: ~200 traços numa aula ≈ 200 mensagens finais + ~3 000 de prévia (≤ 5 por segundo, só enquanto desenha) ÷ 20 | ~160 |
| **Total** | **~8 900 (≈ 9% das 100 mil)** |

- **Pior caso** (todos movendo o cursor o tempo todo): ≈ 27 000 requisições (**≈ 27%**), ou seja, ~3 aulas por dia.
- **Escritas:** ~30 alunos × 20 ações + 30 sessões ≈ **630 por aula** (< 1%).
- Estimativa por conta, não medição. Considera só os Durable Objects; o Worker de entrada tem cota própria, não estimada aqui.

## Pendências e limites conhecidos

- **Conflitos:** vale a última mensagem que chega ao servidor (sem fusão).
- **Sem rede:** enquanto desconectado, as mudanças locais não são enviadas; ao reconectar, o `snapshot` substitui o estado local.
- **Sem desfazer:** o desfazer foi removido. Por isso Limpar, Abrir quadro salvo e Excluir pedem confirmação.
- **Sem recuperação de token:** quem perde o token e o link de admin perde o acesso à conta de admin (salas, quadros salvos, palavras extras).
- **O link de admin é a conta inteira:** o mesmo token vale em todas as salas da admin. Se vazar, trate como perdido.
- **Expiração do aluno:** vale na entrada e a cada mensagem; um aluno parado só recebendo é desconectado no próximo broadcast. Quem tem o link de aluno pode entrar de novo e ganhar outra sessão.
- A criação de sala só é protegida pela chave de criação (sem limitação por IP). O quadro de uma sala **não expira**.

## O que ainda não foi testado

- **`wrangler dev` e `wrangler deploy` desta versão ainda não foram executados.** As regras (papéis, sessões, quadros salvos, palavras extras, protocolo, store com WebSocket falso) têm testes; os Durable Objects em si (Hibernation API, `serializeAttachment`, `ctx.storage`, chamadas RPC da sala para `PROFESSORA`, o `POST /api/salas` e o fechamento 4004 pelo Worker) só foram escritos conforme a documentação e precisam ser validados rodando.
- Dois navegadores na mesma sala, sessão de aluno vencendo de verdade (4 horas), reconexão e hibernação reais.
- Toque real em celular (segurar para arrastar, pinça) e os formulários/janelas novos no celular.
- **Caneta com stylus e com toque reais** (rejeição de palma, pressão, `touch-action` em cada navegador) e o desempenho com 300 traços longos; os testes cobrem a lógica, o servidor, o store e a camada em jsdom, não o hardware.

## Como usar o quadro

### Banco de palavras (cópias)

- A coluna ao lado (no celular, uma gaveta embaixo) é um **banco**: arrastar uma palavra para o quadro cria uma **cópia**, e a palavra continua no banco. Cada cópia tem um `instanceId` próprio.
- Para remover uma cópia: arraste-a de volta para o banco, ou clique no **×** (ou selecione e aperte Delete). Para **duplicar** um cartão que já está na lousa, clique no **⧉** (ao lado do ×) ou aperte **Ctrl+D** com o cartão selecionado: nasce uma cópia da mesma palavra, um pouco deslocada. Todos podem remover e duplicar. No toque o × e o ⧉ ficam sempre visíveis.
- **Selecionar vários cartões e mover juntos** (todos podem, professora e alunos). A seleção é só sua: não vai ao servidor nem aparece para os outros, só o resultado (os cartões movidos).
  - **Modo Selecionar** (ícone de retângulo tracejado na paleta flutuante, com a contagem de cartões selecionados): **arraste um retângulo** no fundo da lousa e todos os cartões que ele tocar são selecionados, ou **toque nos cartões** um a um (liga e desliga), como se estivesse juntando post-it por post-it. No celular o toque no fundo desenha o retângulo em vez de rolar a tela.
  - **No computador, sem trocar de modo:** **Ctrl/Cmd/Shift + clique** num cartão liga ou desliga ele na seleção, e **Shift + arrastar** no fundo desenha o retângulo (somando ao que já estava selecionado, se segurar Ctrl/Cmd/Shift desde o começo).
  - **Mover o grupo:** arraste qualquer cartão selecionado; todos andam juntos, **mantendo a distância entre si**, e o grupo para na borda do quadro sem se deformar. Arrastar um cartão que não está selecionado move só ele. Soltar o grupo no banco de palavras remove todos.
  - **Duplicar e apagar o grupo:** com cartões selecionados aparece, acima da paleta, a pílula "N selecionados" com **Duplicar**, **Apagar** (pede confirmação) e **×** (soltar a seleção). No computador: **Ctrl/Cmd+D** duplica e **Delete/Backspace** apaga; o **⧉** e o **×** de um cartão que está no grupo valem para o grupo todo. As cópias mantêm o desenho do grupo (um pouco abaixo e à direita) e a seleção passa a elas, prontas para arrastar. Duplicar vai numa única mensagem (`add`) e apagar também (`remove` com vários ids).
  - **Soltar a seleção:** clique no fundo, ou **Esc** (que também volta ao modo Mover). Cartões que outra pessoa remover saem da seleção sozinhos.
  - Custo: o grupo vai numa **única mensagem** (`move_many`) e o servidor grava **uma vez**, não uma por cartão.
- **Quem fica por cima:** a ordem dos cartões no estado é a ordem de empilhamento, **igual para professora, alunos e depois de recarregar**: o último cartão ou grupo solto fica por cima (cartões novos e cópias também). Antes, cada tela decidia o empilhamento só localmente, e um grupo solto sobre outros cartões aparecia por cima para quem o moveu e por baixo para os outros. Durante o arrasto (prévia) a ordem não muda; só ao soltar.
- **Busca:** por hanzi, pinyin (com ou sem tom, ex.: `ni`, `nǐ`) ou tradução (com ou sem acento).
- **Filtro:** Todos, HSK 1, HSK 2, HSK 3 ou **Extras**. Cada cartão tem um selo no canto superior direito: **1**, **2** ou **3** nas originais, **E** nas extras.

### Pinyin, tradução e cores

- **Pinyin** e **Tradução** (ligados por padrão) mostram ou escondem o texto nos cartões. A tradução aparece ao passar o mouse; **no celular, com um toque rápido**.
- **Cor por classe gramatical** (`src/theme/classes.ts`). O botão **Legenda** abre e fecha a legenda.

### Barra de ferramentas

A barra do topo fica **escondida**: só uma aba pequena aparece ("Ferramentas · N online", com o estado da conexão). Ela abre ao **passar o mouse** (no celular, ao tocar na aba) e fica aberta enquanto houver um menu aberto. O ícone de **pin** na aba **fixa** a barra aberta (preferência sua).

Para não ficar carregada, a barra mostra à vista só **Palavras**, **Pinyin** e **Tradução**; o resto mora em menus:

- **Quadro** (só admin): Salvar quadro…, Abrir quadro salvo…, Adicionar palavra… e Limpar quadro (com confirmação).
- **Compartilhar** (só admin): Copiar link dos alunos e Copiar meu link (admin), com o aviso de que ele não vai aos alunos.
- **Mais** (todos): Legenda das cores e Fixar painel da frase (liga/desliga); para a admin, também Minhas salas e Sair.

A caneta e o apagador não ficam na barra: estão na paleta flutuante (seção "Caneta e apagador").

### Frase formada

O painel **Frase** fica recolhido numa faixa no rodapé e sobe ao passar o mouse (no celular, ao tocar). **Fixar frase** mantém o painel aberto. O quadro termina **acima** do painel, então a frase nunca cobre as palavras da lousa.

Cada **frase** tem hanzi, pinyin e a **tradução palavra por palavra** (sem tradução automática). Regra de ordem, só pela posição:

1. Cartões com quase a mesma altura (até 53 px de diferença, a partir do cartão mais alto) formam uma **linha**, lida da esquerda para a direita.
2. Na mesma linha, um **vão maior que 72 px** entre dois cartões vizinhos separa em **outra frase**: palavras distantes não se misturam.
3. Em linhas diferentes, a **de cima vem primeiro**.

### Zoom, celular e tablet

- **−**, **%** (volta a 100%) e **+** no canto inferior direito, de 40% a 200%; **Ctrl/Cmd + roda** (ou pinça no trackpad) e pinça com dois dedos no celular. O zoom é só visual e individual.
- As barras de rolagem do quadro ficam escondidas; dá para arrastar o fundo, usar a roda/trackpad ou o dedo.
- Abaixo de 700 px de largura, o banco vira uma gaveta embaixo (começa fechada). No toque, arrastar um cartão começa ao **segurar um instante** (200 ms).

## Estrutura

```
wrangler.jsonc                  assets + Durable Objects QUADRO e PROFESSORA (SQLite)
worker/
  index.ts                      POST /api/salas e /api/quadro/:codigo/ws (confere a assinatura)
  env.ts                        bindings e segredo (CHAVE_CRIACAO)
  QuadroDurableObject.ts        um por sala: Hibernation API, papéis, sessões, presença
  ProfessoraDurableObject.ts    um por admin: quadros salvos e palavras extras
src/
  shared/                       usado no front E no servidor
    protocol.ts                 tipos, parse e validação das mensagens
    room.ts                     regras do quadro e do papel (funções puras)
    acoes.ts                    ações da admin (quadros salvos, palavras extras)
    professora.ts               lógica do que a admin guarda (sobre um Kv abstrato)
    palavras.ts, texto.ts       validação das palavras extras e de textos
    sessoes.ts                  sessão de aluno de 4 horas
    chaves.ts                   códigos e tokens assinados (HMAC)
    nome.ts                     validação do nome
  theme/                        classes.ts (cores gramaticais), presence.ts (cursores)
  store/                        BoardStore (interface), RealtimeBoardStore,
                                LocalStorageBoardStore (MVP), BoardController,
                                preferences, session (nome, admin, sessão de aluno)
  lib/                          busca, frase, zoom, throttle, backoff, ids, api, palavrasView
  hooks/                        useBoard, usePreferences, useMediaQuery
  components/                   Home, NameGate, Board, Tray, Toolbar, PresenceBar, Cursors,
                                Draggable, StickyNote, Legend, SentencePanel,
                                QuadrosSalvos, PalavrasExtras
  data/palavras.json            978 palavras originais (HSK 3.0, níveis 1 a 3), com hsk e classe
dist/                           saída do vite build (servida pelo Worker)
```

## ⚠️ Pendências para a professora revisar

### Lista de palavras

- A lista segue o **HSK 3.0, edição 2026**, níveis 1 a 3: **978 palavras** (HSK 1 = 294, HSK 2 = 197, HSK 3 = 487 palavras novas em cada nível). A fonte é o projeto público [`drkameleon/complete-hsk-vocabulary`](https://github.com/drkameleon/complete-hsk-vocabulary) (licença MIT; os níveis "newest-1" a "newest-3"; a mesma fonte traz também o HSK 3.0 de 2021 e o antigo 2.0). **A professora precisa confirmar que esta é a edição que ela usa**: a de 2021 tem outras listas (506/750/953 palavras nos níveis 1 a 3).
- A lista anterior era o **HSK 2.0** (150 palavras em cada um dos níveis 1 e 2). **284 dos ids antigos continuam na lista, com a mesma palavra**, então salas e quadros salvos que as usam não mudam (só o nível pode ter mudado, ex.: várias do antigo HSK 2 viraram HSK 1). **16 ids antigos saíram**: 13 palavras que não estão nos níveis 1 a 3 do padrão novo (北京, 火车站, 没, 小姐, 白, 唱歌, 打篮球, 第一, 服务员, 公共汽车, 黑, 红, 羊肉) e 3 homógrafos que a nova lista traz como um cartão só (长 cháng/zhǎng, 还 hái/huán, 得 de/děi; ficou o id do primeiro, com as duas leituras e os dois significados). Cartões dessas 16 que já estavam em quadros deixam de aparecer (não quebram nada).
- As **traduções em português** das 694 palavras novas foram escritas por nós a partir dos significados em inglês, e as das 284 antigas foram mantidas. Todas são **provisórias**. Também são provisórias as **classes gramaticais** das palavras novas, derivadas da classe indicada na fonte.
- O **pinyin** vem da fonte, sem espaços e com apóstrofo quando preciso (ex.: xī'ān). Quando a fonte traz duas leituras (ex.: 只 zhǐ/zhī, 教 jiāo/jiào), o cartão mostra as duas, com a mais comum primeiro (ajuste manual nossa, a revisar).
- A lista nova traz formas como "女孩儿", "一点儿" e "聊天儿" (com erhua) como cartões próprios, e expressões como 不好意思 e 怎么办.
- Palavras de aula que não estão nos níveis 1 a 3 podem ser acrescentadas pela admin como **palavras extras**.

### Classes gramaticais (provisórias)

O campo `classe` de cada palavra foi atribuído por nós, e **a professora precisa revisar**. Palavras com mais de uma classe usam a mais comum no nível HSK delas:

| Palavra | Classe usada | Outras possíveis |
| --- | --- | --- |
| 在 | verbo | preposição, advérbio |
| 到 | verbo | preposição |
| 给 | verbo | preposição |
| 会, 能, 可以, 要, 想 | verbo | verbo modal |
| 还 hái | advérbio | conjunção |
| 就, 再, 最 | advérbio | — |
| 没有 | verbo | advérbio (a antiga entrada 没 saiu da lista) |
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
- Trocar a chave de criação por outra forma de autenticação, com limitação de requisições.
- Recuperação do token de admin; expirar salas antigas.
- Agrupar os envios de cursor no servidor (menos tráfego em turmas grandes).

### Confirmações

As ações destrutivas (Sair, Limpar quadro, Excluir sala, quadro salvo ou palavra extra, Abrir quadro salvo sobre um quadro com cartões) usam um **cartão de confirmação do próprio app**, não a janela do navegador. Ele fecha com Esc ou clicando fora, o foco começa em "Cancelar" e, na exclusão de sala, o botão só libera depois de digitar o nome.

## Créditos e licenças

A lista de palavras (hanzi, pinyin e níveis HSK) deriva de [`drkameleon/complete-hsk-vocabulary`](https://github.com/drkameleon/complete-hsk-vocabulary), licença MIT, Copyright (c) 2026 Yanis Zafirópulos. Essa fonte, por sua vez, cita como origens: elkmovie/hsk30 (listas HSK 3.0), clem109/hsk-vocabulary (HSK 2.0), CC-CEDICT (significados em inglês, que usamos só como apoio para escrever as traduções em português) e outros projetos listados no README dela.
