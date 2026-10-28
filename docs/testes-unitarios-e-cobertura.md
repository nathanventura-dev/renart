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

### 2.5. `tests/editorStore.test.ts` (Anotações, Fonte e Tamanho Contextual, Estilo por Bloco, Modo Auto, Multiseleção e Undo/Redo)
- **Objetivo:** Testar a integridade da lista de anotações no Canvas, a seleção contextual de família e tamanho de fonte para blocos de texto (`shouldShowTextControls`, `setFontFamily`, `setFontSize`), a customização independente por bloco, o modo `"Auto"` de espessura ao redimensionar, a multiseleção de blocos e a fidelidade do histórico.
- **Cenários Cobertos:**
  - Inserção de retângulo, círculo, linha/traço, flecha, texto e lupa.
  - Modificação independente de cor, espessura da linha, família de fonte (`fontFamily`) e tamanho de fonte (`fontSize`) apenas nos blocos selecionados (sem afetar os demais blocos da imagem).
  - Troca contextual da barra superior para exibir seletores de fonte e tamanho quando a ferramenta `text` está ativa ou quando há blocos `text` selecionados (`shouldShowTextControls`).
  - Opção `"Auto"` de espessura de linha por bloco (`autoStrokeWidth`) e aplicação automática para novos blocos adicionados quando `"Auto"` está ativo.
  - Multiseleção de blocos (`setSelectedIds`, `toggleSelectedId`, `updateAnnotations`) permitindo movimentar, redimensionar, excluir ou alterar cores e espessuras de vários blocos simultaneamente.
  - Execução de `undo` e `redo` revertendo e reaplicando ações individuais ou em lote com precisão.
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
- **Objetivo:** Validar a colagem de imagens (`Ctrl+V`), desseleção com `ESC`, exclusão do bloco selecionado com a tecla `Delete` (incluindo suporte a desfazer com `Ctrl+Z`), edição direta de texto inline sem modais, trava de movimentação/exclusão após salvar (`Ctrl+S`), isolamento independente de blocos e histórico Undo/Redo para cada print da galeria (`switchCapture`), cálculo de recorte em pixels reais da captura de tela (`calculateCropCoordinates`) e **rótulos de hover (`"Copiar"` / `"Exportar"`) e feedback `"Copiado"` nos ícones minimalistas da extrema direita** (`resolveToolbarActionFeedback`).
- **Comando:** `cmd.exe /c npm test tests/appFeatures.test.ts`

### 2.10. `tests/magnifierAndHover.test.ts` (Lupa Com Foco / Sem Foco, Rastro Fosco Estreito, Redimensionável nos Limites da Imagem e Sempre no Topo)
- **Objetivo:** Validar a matemática de ampliação real da lupa (tanto no modo `Sem foco` quanto no modo `Com foco`), a geometria do ponto focal único sem círculo externo e rastro fosco estreito (`calculateMagnifierFocusGeometry`, `clampFocusPointToImageBounds`), o redimensionamento livre da lupa respeitando os limites da imagem (`clampMagnifierToImageBounds`), a permanência da lupa sempre acima de todos os demais blocos (`sortAnnotationsWithMagnifiersOnTop`), a visualização de todos os blocos adicionados dentro da lente da lupa (`getMagnifierVisibleAnnotations`), o ajuste de zoom via arraste horizontal da coroa minimalista na parte inferior e o hover inteligente (`isTargetExistingAnnotation`).
- **Cenários Cobertos:**
  - Escala de zoom restrita aos passos de `0.5` (`1.0, 1.5, 2.0, 2.5, 3.0`), respeitando o mínimo de `1.0x` (tamanho original) e máximo de `3.0x`.
  - Arraste da coroa giratória para a direita aumentando o zoom e para a esquerda diminuindo o zoom em incrementos exatos de `0.5`.
  - Cálculo de deslocamento (`offsetX`, `offsetY`) e escala (`scaleX`, `scaleY`) do conteúdo recortado dentro da lente circular da lupa, tanto quando centrada na própria lupa (`Sem foco`) quanto quando apontada para um ponto focal remoto (`Com foco`).
  - Geometria do rastro levemente fosco mais estreito (`lensSpread = 42%` do raio) partindo apenas do ponto focal (`focusDotRadius = 5`, `hasOuterFocusCircle = false`, sem círculo ao redor) e restrição do ponto focal aos limites da imagem (`clampFocusPointToImageBounds`).
  - Exibição condicional da barra de zoom na parte inferior (`shouldShowZoomBar`) restrita exclusivamente ao momento em que o usuário está movimentando a coroa para alterar o zoom, e cálculo da barra de progresso (`calculateZoomBarProgress`).
  - Redimensionamento livre da lupa pelo `Transformer` (`shouldAttachTransformer('magnifier') === true`) com restrição automática de raio e posição aos limites da imagem (`clampMagnifierToImageBounds`).
  - Ordenação de camadas garantindo que a lupa permaneça sempre acima de todos os elementos (`sortAnnotationsWithMagnifiersOnTop`) e exposição de todos os blocos adicionados (`rect`, `ellipse`, `line`, `arrow`, `text`, `image`) para ampliação dentro da lente (`getMagnifierVisibleAnnotations`).
  - Redimensionamento proporcional de blocos de texto sem distorção em degraus de `FONT_SIZES` (`snapToFontSizeStep`, `calculateResizedFontSize`, `clampTextResizeBox`), travando estritamente nos limites mínimo (`12`) e máximo (`48`).
  - Reconhecimento automático de hover sobre blocos existentes (`cursor: 'move'` e ação `move-existing`) versus área livre do canvas (`cursor: 'crosshair'` e ação `create-new`) quando ferramentas de criação estão selecionadas.
- **Comando:** `cmd.exe /c npm test tests/magnifierAndHover.test.ts`

### 2.11. `tests/zoomAndCrop.test.ts` (Ajuste à Tela, Zoom Multiplataforma e Recorte com Translação de Anotações)
- **Objetivo:** Validar os cálculos de ajuste de tela (`calculateFitToScreenScale`), passos discretos e limites de zoom de 25% a 400% (`clampZoomLevel`, `getNextZoomStep`), formatação de percentuais (`formatZoomPercentage`), atalhos de teclado para Windows, Linux e macOS (`isZoomShortcut`), restrição geométrica da caixa de corte (`calculateCropBounds`) e translação/filtragem de anotações durante o recorte (`adjustAnnotationsForCrop`).
- **Cenários Cobertos:**
  - Imagens menores que o viewport mantêm 100% (1.0) nativo sem barras de rolagem.
  - Imagens 4K em viewports menores calculam escala proporcional reduzida (ex: 0.3) ficando 100% visíveis sem barras de rolagem iniciais.
  - Clamping estrito do zoom entre 25% (0.25) e 400% (4.0).
  - Passos lógicos de zoom in e zoom out respeitando os limites.
  - Reconhecimento dos atalhos `Ctrl +`, `Ctrl -`, `Ctrl 0` no Windows/Linux e `Cmd +`, `Cmd -`, `Cmd 0` no macOS.
  - Ajuste de limites do recorte restringindo à largura e altura da imagem com dimensão mínima de segurança.
  - Translação de anotações internas pelo deslocamento `-cropOffset` e descarte de anotações externas à área recortada.
- **Comando:** `cmd.exe /c npm test tests/zoomAndCrop.test.ts`

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
