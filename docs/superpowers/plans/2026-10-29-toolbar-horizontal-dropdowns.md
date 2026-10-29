# Menus Suspensos Horizontais da Barra de Ferramentas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar menus suspensos horizontais flutuantes (`rente à toolbar`) logo abaixo dos ícones da barra de ferramentas para a Paleta de Cores, Estilos de Flechas, Modos de Lupa e Configurações de Texto, substituindo os controles que esticavam a barra inline.

**Architecture:** 
1. Criação de um componente auxiliar reutilizável `HorizontalFloatingMenu` em `src/components/Toolbar.tsx` posicionado com `position: absolute; top: calc(100% + 4px)`.
2. Gestão unificada de estado `openMenu: 'palette' | 'arrow' | 'magnifier' | 'text' | null` com comportamento toggle (abrir/fechar no clique) e fechamento automático ao clicar fora (*click-outside*).
3. Substituição das 7 bolinhas de cores por um botão com ícone `Palette` do `lucide-react` que abre a lista suspensa horizontal das cores.
4. Migração das opções de Flecha (`Padrão`, `Fina`, `Pontilhada`, `Curva`, `Inverter arco`), Lupa (`Sem foco`, `Com foco`) e Texto (`Fonte` e `Tamanho`) para seus respectivos menus suspensos horizontais, mantendo a barra de ferramentas central enxuta, com tamanho estável e esteticamente idêntica à referência visual `ListaSuspensaHorizontal.png`.

**Tech Stack:** React 19, TypeScript, Lucide React, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-29-toolbar-horizontal-dropdowns-design.md`

## Global Constraints
- Sem bibliotecas externas adicionais (nada de Radix, Floating UI, etc.).
- Preservar todas as 118 suítes de testes unitários e de integração passando.
- Mensagens de commit e documentação sempre em português.
- Menus suspensos devem flutuar com `zIndex: 200` acima do canvas e respeitar os limites visíveis da janela.

## Review Focus
- Clicar no ícone da paleta abre a lista horizontal; clicar nele novamente fecha a lista.
- Clicar fora em qualquer área (canvas, outra ferramenta ou fundo) fecha qualquer menu suspenso aberto.
- Abrir um menu enquanto outro está aberto fecha automaticamente o anterior (exclusividade).
- A seleção de cor, estilo de flecha, modo de lupa ou fonte/tamanho atualiza imediatamente o estado e os blocos selecionados.
- A barra central de ferramentas mantém largura e alinhamento estáveis sem saltos visuais.

---

### Task 1: Componente Reutilizável `HorizontalFloatingMenu` e Menu da Paleta de Cores

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Test: `tests/toolbarMenus.test.ts`

**Interfaces:**
- Produces:
  - `HorizontalFloatingMenu`: Componente flutuante com suporte a clique externo e alinhamento horizontal.
  - Ícone e botão de gatilho da Paleta de Cores (`Palette` de `lucide-react`) exibindo a cor ativa.
  - `openMenu`: estado `'palette' | 'arrow' | 'magnifier' | 'text' | null`.

- [ ] **Step 1: Escrever testes unitários que falham em `tests/toolbarMenus.test.ts`**:
  - Testar que o botão da paleta de cores é renderizado na barra superior.
  - Testar que, inicialmente, a lista suspensa de cores NÃO está visível no DOM.
  - Testar que, ao clicar no botão da paleta, o menu horizontal suspenso abre e exibe as 7 cores.
  - Testar que clicar novamente no botão da paleta fecha o menu (toggle).
  - Testar que clicar fora do menu fecha o menu da paleta.
  - Testar que selecionar uma cor chama `onSelectColor` com o valor hexadecimal correto.

- [ ] **Step 2: Executar teste para verificar falha (RED)**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`
  - Esperado: FAIL pois o botão da paleta e o menu ainda não existem.

- [ ] **Step 3: Implementar `HorizontalFloatingMenu` e o menu da Paleta em `src/components/Toolbar.tsx`**:
  - Importar ícone `Palette` de `lucide-react`.
  - Implementar componente `HorizontalFloatingMenu`.
  - Criar estado `openMenu` e hook de `mousedown` para fechamento externo.
  - Substituir as 7 bolinhas de cores pelo botão da paleta que abre o menu horizontal com as cores.

- [ ] **Step 4: Executar testes para verificar aprovação (GREEN)**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`
  - Esperado: PASS em todos os testes.

- [ ] **Step 5: Commit**:
  - `git add src/components/Toolbar.tsx tests/toolbarMenus.test.ts`
  - `git commit -m "feat(toolbar): implementar menu suspenso horizontal para a paleta de cores"`

---

### Task 2: Submenus Suspensos Horizontais para Flecha, Lupa e Bloco de Texto

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `tests/toolbarMenus.test.ts`

**Interfaces:**
- Produces:
  - Submenu da Flecha: 4 estilos (`Padrão`, `Fina`, `Pontilhada`, `Curva`) e botão `Inverter arco` no popover horizontal.
  - Submenu da Lupa: opções `Sem foco` e `Com foco` no popover horizontal.
  - Submenu do Texto: seletores de `Fonte` e `Tamanho` no popover horizontal.

- [ ] **Step 1: Escrever testes unitários para os submenus de Flecha, Lupa e Texto em `tests/toolbarMenus.test.ts`**:
  - Testar que clicar na ferramenta de flecha ou no seu indicador abre o submenu com os 4 estilos e opção de inverter quando curva.
  - Testar que clicar na ferramenta de lupa abre o submenu com `Sem foco` e `Com foco`.
  - Testar que clicar na ferramenta de texto abre o submenu com os selects de família de fonte e tamanho.
  - Testar que abrir a Lupa fecha o menu da Paleta se estiver aberto (exclusividade).

- [ ] **Step 2: Executar testes para verificar falha (RED)**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`
  - Esperado: FAIL nos novos testes de submenus.

- [ ] **Step 3: Integrar os submenus de Flecha, Lupa e Texto no `Toolbar.tsx`**:
  - Encapsular os botões de Flecha, Lupa e Texto com `position: relative`.
  - Adicionar suporte para abrir seus respectivos `HorizontalFloatingMenu`.
  - Mover os seletores inline de estilos de flecha, modos de lupa e fontes para dentro dos respectivos menus suspensos.

- [ ] **Step 4: Executar testes para verificar aprovação (GREEN)**:
  - Comando: `npm.cmd test tests/toolbarMenus.test.ts`
  - Esperado: PASS.

- [ ] **Step 5: Commit**:
  - `git add src/components/Toolbar.tsx tests/toolbarMenus.test.ts`
  - `git commit -m "feat(toolbar): adicionar submenus suspensos para flecha, lupa e texto"`

---

### Task 3: Limpeza de Código, Compatibilidade de Testes e Validação Completa

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `tests/appFeatures.test.ts`
- Modify: `tests/integration.test.ts`

- [ ] **Step 1: Ajustar testes legados em `tests/appFeatures.test.ts` e `tests/integration.test.ts`**:
  - Adaptar qualquer teste que buscava botões inline diretamente para considerar a abertura via menu suspenso ou interação da toolbar.
  - Verificar que o `strokeWidth` permanece acessível ao lado da paleta de cores.

- [ ] **Step 2: Executar toda a suíte de testes do projeto**:
  - Comando: `npm.cmd test`
  - Esperado: PASS em todos os 118+ testes.

- [ ] **Step 3: Executar checagem de tipos e compilação de produção**:
  - Comando: `npx.cmd tsc --noEmit` e `npm.cmd run build`
  - Esperado: 0 erros de TypeScript e build concluído com sucesso.

- [ ] **Step 4: Commit**:
  - `git add src/components/Toolbar.tsx tests/appFeatures.test.ts tests/integration.test.ts`
  - `git commit -m "refactor(toolbar): limpar controles inline antigos e unificar testes com menus suspensos"`
