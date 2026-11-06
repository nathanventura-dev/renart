# Design Doc: Tema Claro e Escuro (Light / Dark Mode) do RenArt

## 1. Objetivo
Adicionar suporte a **Tema Claro e Escuro** na interface do RenArt, integrado à paleta laranja da raposa. O tema segue a preferência do sistema operacional por padrão e pode ser forçado manualmente pelo usuário, com a escolha persistida entre sessões. É um item da Fase 2 do roadmap.

## 2. Decisões Acordadas
- **Controle:** modo `system` (padrão), `light` ou `dark`. Um botão na toolbar alterna entre os três; a preferência é salva no `localStorage`.
- **Abordagem:** tokens de cor em JS + store de tema + hook `useTheme()`. Serve DOM e Konva com o mesmo mecanismo e é testável em Vitest sem navegador.
- **Referência visual do escuro:** a Ferramenta de Captura (Snipping Tool) do Windows 11 foi medida em dois prints, mas o chrome dela é azul-petróleo (matiz ~203°) e brigava com o laranja da raposa (~18°), quase complementares. Decisão posterior: **grafite neutro** (`#1e1e1e`) com o **laranja original** (`#d3551d`, hover `#e66a2d`) e texto branco sobre ele, igual ao tema claro. Tentativas de clarear/dessaturar o laranja foram descartadas.
- **Fundo da área de edição (escuro):** `#121212`.
- **Destaque:** laranja da raposa nos dois temas, no lugar do azul/verde do sistema.

## 3. Arquitetura

### 3.1 `src/theme/colors.ts`
- Mantém `RENART_THEME` (laranjas, compartilhados entre os temas).
- Define o tipo `ThemePalette` e exporta `LIGHT_PALETTE` e `DARK_PALETTE`, ambas com exatamente as mesmas chaves.

| Token | Claro | Escuro |
| :--- | :--- | :--- |
| `chrome` (toolbar, galeria) | `#ffffff` | `#1e1e1e` |
| `control` (botões) | `rgba(0,0,0,0.04)` | `#2b2b2b` |
| `popup` (menus, dropdowns) | `#f8fafc` | `#2a2a2a` |
| `border` | `#e5e5e7` | `#363636` |
| `textPrimary` | `#1e293b` | `#ffffff` |
| `textSecondary` | `#475569` | `#c5c5c5` |
| `textMuted` | `#86868b` | `#9a9a9a` |
| `workspace` (atrás da imagem) | `#e5e5e7` | `#121212` |

Os valores de `control` no escuro e de `textMuted` no escuro são pontos de partida; a validação visual do plano pode ajustá-los. Os tints laranja (`primaryTint`, `galleryActiveBg`) podem ganhar uma variante com mais opacidade no escuro para manter a leitura.

### 3.2 `src/state/themeStore.ts`
- `createThemeStore()` no mesmo estilo de `createGalleryStore` (`getState`, `subscribe`, setters).
- Estado: `preference: 'system' | 'light' | 'dark'` e `resolved: 'light' | 'dark'`.
- `resolved` é derivado: `system` lê `matchMedia('(prefers-color-scheme: dark)')`; `light`/`dark` ignoram o SO.
- Escuta mudanças do SO e só atualiza `resolved` quando a preferência é `system`.
- Persiste a preferência em `localStorage`; valor inválido ou ausente vira `system`.
- Sem `window`/`matchMedia` (testes, SSR), assume `light`.

### 3.3 `src/hooks/useTheme.ts`
- Usa `useSyncExternalStore` sobre o `themeStore`.
- Retorna `{ palette, resolved, preference, setPreference }`.

## 4. Escopo

### Muda (interface)
- `Toolbar.tsx`: superfícies, botões, dropdowns e novo botão de alternância (Sistema → Claro → Escuro).
- `GallerySidebar.tsx`: superfícies, bordas, textos.
- `App.tsx`: fundo e textos de placeholder.
- `CanvasEditor.tsx`: apenas o fundo ao redor da imagem (`workspace`) e a sombra da imagem.
- `index.html`: fundo e cor de texto iniciais seguem `prefers-color-scheme`, para evitar flash branco na abertura.

### Não muda (conteúdo)
- Imagem capturada, anotações, paleta de cores das ferramentas, redação e exportação. Os pixels exportados nunca dependem do tema.
- `CaptureOverlay.tsx`: já é escuro por natureza e permanece igual nos dois temas.

### Fora do escopo
Efeito Mica dinâmico, temas personalizados, transições animadas entre temas, sincronização do tema com a janela nativa do Tauri.

## 5. Tratamento de Erros e Casos Limite
- `localStorage` indisponível ou lançando erro: o store continua funcionando em memória, sem persistir.
- `matchMedia` ausente: tema `light`.
- Mudança do SO durante a sessão: reflete imediatamente apenas em modo `system`.

## 6. Testes
- **`themeColors`:** `LIGHT_PALETTE` e `DARK_PALETTE` têm as mesmas chaves; valores escuros principais batem com os medidos.
- **`themeStore`:** `system` segue o `matchMedia` mockado; `light`/`dark` o ignoram; persistência no `localStorage`; valor inválido vira `system`; mudança do SO só afeta o modo `system`; `localStorage` com erro não quebra.
- **Regressão de componentes:** teste que impede cores de superfície literais (`#ffffff`, `#e5e5e7`, `#86868b`, `#f8fafc`, `#475569`) nos componentes migrados, com lista explícita de exceções (cores de conteúdo/anotação).
- **Validação visual manual** no navegador (`npm run dev`, `http://127.0.0.1:1420/`), nos dois temas e ao trocar o tema do SO.

## 7. Atualização de Documentação
- README: marcar tema claro/escuro como entregue no roadmap da Fase 2 e documentar o botão de alternância.
