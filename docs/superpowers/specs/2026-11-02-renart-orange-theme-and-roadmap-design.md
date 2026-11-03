# Design Doc: RenArt Orange Theme Palette & Roadmap Dark/Light Mode

## Intent & Context
Alinhar a identidade cromática da interface do RenArt à paleta de cores oficial extraída do mascote da raposa-vermelha (`docs/assets/renart-mascot-*.jpg`), substituindo o azul de sistema legado (`#0071e3`) por tons quentes e harmônicos de laranja terracota. Além disso, documentar no `README.md` o suporte planejado a **Tema Claro e Escuro (Light / Dark Mode)** no roadmap de evolução da aplicação.

## Cores da Marca (Extraídas do Mascote)
- **`RENART_PRIMARY`**: `#d3551d` (RGB `211, 85, 29`) — Tom principal da pelagem da raposa para botões ativos, contornos de seleção, alças de rotação e bordas de destaque.
- **`RENART_PRIMARY_HOVER`**: `#e66a2d` — Tom ligeiramente mais luminoso para estados de hover em botões e itens de menu.
- **`RENART_PRIMARY_TINT`**: `rgba(211, 85, 29, 0.12)` — Fundo translúcido para botões selecionados na toolbar, bounding boxes e item ativo na galeria.
- **`RENART_PRIMARY_BORDER`**: `rgba(211, 85, 29, 0.3)` — Borda sutil de elementos selecionados e menus abertos.

## Modificações Propostas

### 1. Centralização do Tema em `src/theme/colors.ts`
Criar o módulo `src/theme/colors.ts` com:
```typescript
export const RENART_THEME = {
  primary: '#d3551d',
  primaryHover: '#e66a2d',
  primaryTint: 'rgba(211, 85, 29, 0.12)',
  primaryBorder: 'rgba(211, 85, 29, 0.3)',
  galleryActiveBg: 'rgba(211, 85, 29, 0.08)',
} as const;
```

### 2. Atualização dos Componentes
Substituir o azul `#0071e3` e derivados translúcidos em:
- `src/components/Toolbar.tsx`: Botões ativos, menus abertos (`openMenu === 'capture'`), toggles de formatação (`bold`, `italic`, `underline`, `strikethrough`) e paleta de cores.
- `src/components/CanvasEditor.tsx`: Traçado de seleção (`#d3551d`), anel da lupa, bounding box do Transformer, destaque de Smart Text sob o cursor e borda de texto em edição.
- `src/components/CaptureOverlay.tsx`: Retângulo de seleção de recorte e botões flutuantes.
- `src/components/GallerySidebar.tsx`: Borda ativa do item selecionado e texto de título.
- `src/App.tsx`: Gradiente de boas-vindas inicial.

### 3. Atualização do `README.md`
- No Roadmap de Desenvolvimento, expandir a **Fase 2 (Desktop Tauri v2 & Temas)** para incluir explicitamente:
  - Alternância nativa de **Tema Claro e Escuro (Light / Dark Mode)** integrada à paleta do mascote e às preferências do sistema operacional.
- Atualizar teste `tests/readmeStructure.test.ts` para validar a presença da nova entrada do Roadmap.

## Estratégia de Verificação e TDD
- Teste unitário para validar o módulo `src/theme/colors.ts` e exportações de cor.
- Teste unitário para validar a documentação de temas no `README.md`.
- Execução da suíte completa de testes (281+ testes), tipagem TypeScript (`tsc --noEmit`) e build de produção (`npm run build`).
