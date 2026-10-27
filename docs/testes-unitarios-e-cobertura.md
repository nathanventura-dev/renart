# Catálogo e Estratégia de Testes Unitários

**Projeto:** Ferramenta de Captura Multiplataforma  
**Abordagem:** Test-Driven Development (TDD)  

Este documento registra e detalha todas as suítes de testes unitários do projeto, explicando a finalidade de cada teste, os cenários cobertos (casos felizes e de exceção) e os comandos para executá-los e auditá-los.

---

## 1. Estratégia de Testes Unitários

Para garantir robustez, estabilidade e manutenibilidade sem regressões, os testes foram divididos em duas frentes complementares:

1. **Testes Unitários de Backend (Rust / Cargo Test):**
   - Validação matemática de limites e recortes de tela (`bounds check`, coordenadas negativas, estouro de tela).
   - Manipulação segura de buffers de imagem e conversão PNG.
   - Máquina de estados do contador de instâncias e protocolo IPC (garantindo que exatamente 2 instâncias possam coabitar e a 3ª seja rejeitada).
2. **Testes Unitários de Frontend (TypeScript / Vitest):**
   - Algoritmos de geometria (normalização de coordenadas quando o usuário arrasta o mouse da direita para a esquerda ou de baixo para cima).
   - Gerenciamento de estado do editor (adição de formas, setas, textos, lupa e pilha de Undo/Redo).
   - Política de galeria (limite rígido de 10 capturas, ordenação e descarte estrito FIFO).
   - Proporções e exportação de PDF e imagens.

---

## 2. Catálogo das Suítes de Teste

### 2.1. `tests/scaffold.test.ts` (Infraestrutura)
- **Objetivo:** Garantir que o ambiente possui todos os pacotes, scripts e dependências essenciais configurados (`konva`, `react-konva`, `jspdf`, `vitest`).
- **Comando:** `cmd.exe /c npm test tests/scaffold.test.ts`

### 2.2. `src-tauri/tests/capture_test.rs` (Recorte e Captura Nativa)
- **Objetivo:** Verificar a integridade dos cálculos de corte e validação de resolução de tela.
- **Cenários Cobertos:**
  - Recorte com coordenadas válidas dentro das dimensões do monitor.
  - Rejeição de recortes com largura ou altura zero.
  - Rejeição ou clamping de coordenadas negativas ou além da resolução máxima.
- **Comando:** `cargo test --test capture_test`

### 2.3. `src-tauri/tests/instance_test.rs` (Gerenciador de 2 Instâncias)
- **Objetivo:** Validar o limite estrito de 2 instâncias ativas.
- **Cenários Cobertos:**
  - 1ª instância registra-se com sucesso.
  - 2ª instância registra-se com sucesso.
  - 3ª tentativa recebe erro imediato `InstanceLimitExceeded` para focar a janela ativa e sair.
  - Fechamento de uma instância libera o slot para uma nova execução.
- **Comando:** `cargo test --test instance_test`

### 2.4. `tests/geometry.test.ts` (Geometria e Seleção de Região)
- **Objetivo:** Assegurar que qualquer movimento de seleção do mouse resulte em um retângulo positivo válido.
- **Cenários Cobertos:**
  - Arraste padrão (canto superior esquerdo para inferior direito).
  - Arraste invertido (inferior direito para superior esquerdo).
  - Arraste horizontal ou vertical invertido.
- **Comando:** `cmd.exe /c npm test tests/geometry.test.ts`

### 2.5. `tests/editorStore.test.ts` (Anotações e Histórico Undo/Redo)
- **Objetivo:** Testar a integridade da lista de anotações no Canvas e a fidelidade do histórico.
- **Cenários Cobertos:**
  - Inserção de retângulo, círculo, flecha, texto e lupa.
  - Modificação de cor e espessura.
  - Execução de `undo` revertendo o estado anterior com precisão.
  - Execução de `redo` reaplicando a ação desfeita.
- **Comando:** `cmd.exe /c npm test tests/editorStore.test.ts`

### 2.6. `tests/galleryStore.test.ts` (Galeria de 10 Capturas e FIFO)
- **Objetivo:** Garantir que nunca existam mais de 10 capturas em memória e que a mais antiga seja descartada.
- **Cenários Cobertos:**
  - Adição sequencial de 1 até 10 capturas.
  - Inclusão da 11ª captura descartando automaticamente a 1ª (FIFO).
  - Troca da captura ativa mantendo os dados da imagem selecionada.
  - Remoção manual de um item específico.
- **Comando:** `cmd.exe /c npm test tests/galleryStore.test.ts`

### 2.7. `tests/exportService.test.ts` (Proporções e Exportação)
- **Objetivo:** Validar a conversão matemática de pixels de tela para dimensões de páginas de PDF sem distorção.
- **Cenários Cobertos:**
  - Cálculo de orientação (retrato vs paisagem) baseado na proporção da tela.
  - Preservação da resolução e aspect ratio na geração do documento PDF.
- **Comando:** `cmd.exe /c npm test tests/exportService.test.ts`

### 2.8. `tests/integration.test.ts` (Fluxo Integrado)
- **Objetivo:** Testar a passagem da imagem capturada para a galeria e abertura imediata no editor com as ferramentas ativas.
- **Comando:** `cmd.exe /c npm test tests/integration.test.ts`

### 2.9. `tests/appFeatures.test.ts` (Funcionalidades Aprimoradas, Isolamento por Imagem e Captura Real)
- **Objetivo:** Validar a colagem de imagens (`Ctrl+V`), desseleção com `ESC`, exclusão do bloco selecionado com a tecla `Delete` (incluindo suporte a desfazer com `Ctrl+Z`), edição direta de texto inline sem modais, trava de movimentação/exclusão após salvar (`Ctrl+S`), **isolamento independente de blocos e histórico Undo/Redo para cada print da galeria** (`switchCapture`) e **cálculo de recorte em pixels reais da captura de tela** (`calculateCropCoordinates`).
- **Comando:** `cmd.exe /c npm test tests/appFeatures.test.ts`

### 2.10. `tests/magnifierAndHover.test.ts` (Lupa com Zoom Real, Coroa Minimalista Inferior e Hover Inteligente)
- **Objetivo:** Validar a matemática de ampliação real da lupa, o ajuste de zoom via arraste horizontal da coroa minimalista na parte inferior, a exibição temporária da barra de zoom apenas durante o movimento de ajuste, a exclusão da lupa do `Transformer` retangular para livre movimentação após o zoom e a troca automática de cursor/ação ao passar o mouse dentro ou fora de blocos existentes sem confundir a imagem de fundo (`isTargetExistingAnnotation`).
- **Cenários Cobertos:**
  - Escala de zoom restrita aos passos de `0.5` (`1.0, 1.5, 2.0, 2.5, 3.0`), respeitando o mínimo de `1.0x` (tamanho original) e máximo de `3.0x`.
  - Arraste da coroa giratória para a direita aumentando o zoom e para a esquerda diminuindo o zoom em incrementos exatos de `0.5`.
  - Cálculo de deslocamento (`offsetX`, `offsetY`) e escala (`scaleX`, `scaleY`) da imagem recortada dentro da lente circular da lupa.
  - Exibição condicional da barra de zoom na parte inferior (`shouldShowZoomBar`) restrita exclusivamente ao momento em que o usuário está movimentando a coroa para alterar o zoom, e cálculo da barra de progresso (`calculateZoomBarProgress`).
  - Exclusão da lupa (`shouldAttachTransformer('magnifier') === false`) do `Transformer` retangular para permitir livre movimentação antes e depois de aplicar zoom in/out.
  - Reconhecimento automático de hover sobre blocos existentes (`cursor: 'move'` e ação `move-existing`) versus área livre do canvas (`cursor: 'crosshair'` e ação `create-new`) quando ferramentas de criação estão selecionadas.
- **Comando:** `cmd.exe /c npm test tests/magnifierAndHover.test.ts`

---

## 3. Como Executar Todos os Testes

- **Todos os testes de frontend:**
  ```bash
  cmd.exe /c npm test
  ```
- **Todos os testes de backend (Rust):**
  ```bash
  cargo test
  ```
