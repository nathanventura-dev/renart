# Especificação de Design: Menus Suspensos Horizontais da Barra de Ferramentas

**Data:** 29/10/2026  
**Status:** Proposto para aprovação  
**Arquivo de Referência Visual:** `ListaSuspensaHorizontal.png`  

---

## 1. Intenção e Motivação (*Why*)

Atualmente, na barra de ferramentas superior (`Toolbar`), as opções secundárias das ferramentas — tais como os modos da Lupa (`Sem foco` / `Com foco`), estilos de Flecha (`Padrão`, `Fina`, `Pontilhada`, `Curva` e `Inverter arco`), configurações de Texto (`Fonte` e `Tamanho`) e as 7 bolinhas de cores — são renderizadas *inline* diretamente no contêiner central da barra.

Essa abordagem causa dois problemas de usabilidade:
1. **Instabilidade visual de layout:** Ao alternar entre ferramentas, a barra estica ou encolhe horizontalmente, empurrando os controles adjacentes (desfazer/refazer, zoom, etc.).
2. **Poluição visual:** A presença permanente de várias opções na barra principal concorre visualmente com os ícones principais de anotação.

O objetivo deste design é unificar as opções secundárias em **menus suspensos horizontais flutuantes** posicionados diretamente abaixo do respectivo ícone na barra de ferramentas (`rente à toolbar`), abrindo ao clicar e fechando ao clicar novamente no botão ou fora do menu.

---

## 2. Metas, Não-Metas e Anti-Metas

### Metas (Goals)
- **Ícone da Paleta de Cores (`Palette`):**
  - Substituir a exibição permanente das 7 bolinhas de cores por um único botão com ícone de paleta de cores.
  - Ao clicar no botão da paleta, abrir um menu horizontal flutuante logo abaixo do ícone com as 7 cores para seleção.
- **Submenus para Ferramentas Específicas:**
  - **Flecha:** Menu suspenso horizontal com os 4 estilos (`Padrão`, `Fina`, `Pontilhada`, `Curva`) e o botão `Inverter arco` (visível quando o estilo curvo estiver ativo).
  - **Lupa:** Menu suspenso horizontal com as opções `Sem foco` e `Com foco`.
  - **Texto:** Menu suspenso horizontal contendo os seletores de `Família da Fonte` e `Tamanho da Fonte`.
- **Comportamento de Abertura e Fechamento:**
  - **Toggle ao clicar:** Clicar no botão abre o menu; clicar no mesmo botão com ele aberto fecha o menu.
  - **Fechamento ao clicar fora (*Click-outside*):** Clicar em qualquer ponto fora do menu aberto (canvas, outra ferramenta ou fundo) fecha o menu imediatamente.
  - **Exclusividade:** No máximo um menu suspenso aberto por vez. Abrir outro menu fecha o anterior.
- **Posicionamento e Estética:**
  - O menu flutua logo abaixo da barra (`top: calc(100% + 4px)`), centralizado sob o ícone gatilho.
  - Fundo branco (`#ffffff`), cantos arredondados (`border-radius: 8px`), borda suave (`1px solid #e5e5e7`) e sombra sutil (`box-shadow: 0 4px 12px rgba(0,0,0,0.12)`).
  - Altura compacta alinhada com o padrão da aplicação (`height: 36px` ou `28px` interno).

### Não-Metas (Non-Goals)
- Não alterar a lógica de aplicação das cores ou propriedades nos blocos selecionados ou nas novas anotações (a lógica de estado no `editorStore` permanece intacta).
- Não introduzir bibliotecas pesadas de terceiros (como Floating UI ou Radix); a implementação usa posicionamento CSS relativo/absoluto nativo e listener de clique.

### Anti-Metas (Anti-Goals)
- Não permitir que os menus flutuantes empurrem os elementos do canvas ou gerem barras de rolagem na janela.
- Não manter menus abertos quando o usuário inicia uma captura ou desenha no canvas.

---

## 3. Abordagens Consideradas

| Abordagem | Descrição | Trade-offs | Decisão |
|-----------|-----------|------------|---------|
| **1. Popovers Flutuantes Relativos em Componente Reutilizável** | Cada ícone envolvido em contêiner relativo com card horizontal suspenso renderizado via CSS nativo (`top: calc(100% + 4px)`). | Requer cálculo de alinhamento para não cortar nas bordas da janela. Zero dependências extras. | **Escolhida (aprovada pelo usuário)**: idêntica à referência visual `ListaSuspensaHorizontal.png` e ultra-leve. |
| **2. Sub-barra Horizontal Fixa (Sub-toolbar)** | Uma barra secundária completa fixa logo abaixo da barra superior. | Ocupa espaço vertical desnecessário sobre a imagem e não segue o modelo do balão flutuante compacto. | Descartada. |
| **3. Biblioteca Externa (ex: Floating UI / Radix)** | Usar bibliotecas externas via React Portal. | Aumenta o tamanho do bundle e complexidade sem ganho real para uma barra com layout fixo. | Descartada. |

---

## 4. Arquitetura da Solução e Decisões de Implementação

### 4.1. Componente Reutilizável `HorizontalFloatingMenu`
Em `src/components/Toolbar.tsx`:
```tsx
interface HorizontalFloatingMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'center' | 'left' | 'right';
}
```
- Renderizado com `position: absolute`, `top: calc(100% + 4px)`, `zIndex: 150`.
- Fundo `#ffffff`, borda `#e2e8f0`, `border-radius: 8px`, `padding: 4px 6px`.
- Layout interno: `display: flex; align-items: center; gap: 4px; white-space: nowrap;`.

### 4.2. Estado Centralizado de Menus Abertos
Na `Toolbar`:
```tsx
type OpenMenuType = 'palette' | 'arrow' | 'magnifier' | 'text' | null;
const [activeMenu, setActiveMenu] = useState<OpenMenuType>(null);
```
- Função `toggleMenu(menu: OpenMenuType)`: se já estiver aberto, fecha (`null`); caso contrário, abre o menu selecionado.
- Listener global no `document` para `mousedown`: se o clique não for dentro do container da ferramenta/menu ativo, fecha (`setActiveMenu(null)`).

### 4.3. Gatilhos de Ferramenta
1. **Paleta de Cores:**
   - Botão com ícone `Palette` (Lucide) ao lado da espessura do traço.
   - Exibe a cor atualmente selecionada através de um indicador sutil (ponto de cor ou borda colorida).
   - Ao abrir: exibe as 7 bolinhas de cores na horizontal. Ao clicar em uma cor, aplica e opcionalmente fecha o menu.
2. **Flecha:**
   - O botão de flecha ativa a ferramenta.
   - Um pequeno indicador/chevron ou clique com a ferramenta já ativa (ou botão dedicado de opções) abre o menu de estilos (`Padrão`, `Fina`, `Pontilhada`, `Curva` + `Inverter arco`).
3. **Lupa:**
   - Ao abrir o menu: exibe `Sem foco` e `Com foco`.
4. **Texto:**
   - Ao abrir o menu: exibe os selects de `Fonte` e `Tamanho` de forma horizontal e compacta.

---

## 5. Plano de Validação e Testes
- **Testes Unitários e de Componente (`tests/appFeatures.test.ts` / `tests/integration.test.ts`):**
  - Testar clique no botão da paleta abre e fecha o menu horizontal.
  - Testar clique fora fecha o menu suspenso.
  - Testar que a seleção de cor, estilo de flecha, modo de lupa e fonte/tamanho atualizam corretamente o estado.
- **Testes de Regressão:**
  - Garantir que todos os 118 testes existentes continuem passando sem quebras de layout ou de comportamento.
