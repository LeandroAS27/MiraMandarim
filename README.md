# Quadro de Mandarim

> **Status: EM ANDAMENTO.** Este é o primeiro demo, feito para validar a experiência com a professora.

Quadro branco que abre por um link, sem login, com 250 palavras em chinês em post-its que podem ser arrastados livremente.

## ⚠️ Limitações do MVP (escolha consciente)

O produto final precisa de **tempo real**: um backend com WebSocket que sincroniza os movimentos entre a professora e os alunos em dispositivos diferentes. **Isso NÃO faz parte deste MVP.**

- O estado fica só no navegador de cada pessoa (localStorage). Cada um vê apenas o próprio quadro.
- Não há backend, servidor, WebSocket, banco de dados nem serviço externo.
- A interface mostra o aviso: "Demo: os movimentos ainda não são compartilhados entre dispositivos."
- A **lista de 250 palavras é PROVISÓRIA** (HSK 1 a 2, gerada para o demo) e será trocada pela lista da professora. Está em `src/data/palavras.json`, com um campo `_aviso` no topo.

O estado está atrás da interface `BoardStore` (`src/store/BoardStore.ts`: `getState`, `hasSaved`, `load`, `save`, `subscribe`, `applyMove`). Hoje ela é implementada com localStorage (`LocalStorageBoardStore`). Uma implementação com WebSocket entra depois sem reescrever a UI.

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm test         # testes (Vitest)
npm run build    # build estático em dist/
```

## Como usar

- Na raiz, "Criar quadro" gera um id curto e abre `/#/quadro/<id>`.
- Arraste os post-its; arraste o fundo (mouse) ou use o scroll/toque para navegar.
- A tradução aparece ao passar o mouse ou num toque longo.
- **Desfazer** (botão ou Ctrl/Cmd+Z): até 100 movimentos na memória.
- Toda vez que o link é aberto ou recarregado, o quadro começa na posição de origem (grade).
- **Salvar quadro** grava as posições no localStorage daquele link; **Abrir quadro salvo** (aparece quando existe um salvo) restaura.
- **Copiar link** copia o endereço do quadro.

## Como publicar na Vercel

O projeto é 100% estático.

1. Envie o repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório. O Vite é detectado automaticamente (build `npm run build`, saída `dist`).
3. Cada push na `main` gera um novo deploy.

Alternativa sem GitHub: `npx vercel` dentro da pasta do projeto. No Netlify vale o mesmo: build `npm run build`, publish `dist`. Como o quadro é identificado pelo hash da URL, não é preciso configurar rotas.

## Estrutura

```
src/
  data/palavras.json     lista provisória de 250 palavras
  store/                 BoardStore (interface) + LocalStorageBoardStore
  lib/                   histórico de desfazer, grade inicial, id do quadro
  hooks/useBoard.ts      junta store e histórico
  components/            Home, Board, Draggable, StickyNote, Toolbar
```

Desempenho: durante o arraste só o post-it ativo se move (transform); o estado global só muda ao soltar. O conteúdo de cada post-it é memoizado.

## Próximos passos

- Backend com WebSocket e quadro compartilhado de verdade (professora e alunos veem os mesmos movimentos).
- Trocar a lista provisória pela lista definitiva da professora.
- Validar com a professora a experiência em tablet e celular.
