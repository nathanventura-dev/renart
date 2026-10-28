# Flecha Curva com 3 Pontos de Ajuste (Cauda, Arco e Ponta) Design Document

## 1. Contexto e Motivação
Atualmente, as flechas curvas no aplicativo utilizam a caixa delimitadora retangular padrão do *Transformer* do Konva. Embora funcione bem para formas geométricas rígidas, essa abordagem limita a usabilidade da flecha curva, pois não permite ajustar a intensidade e a direção da curvatura manualmente nem mirar a ponta da flecha diretamente em um elemento de interesse da imagem.

Para proporcionar uma experiência profissional e fluida (inspirada em ferramentas como Figma, Miro e Keynote), a flecha curva selecionada passará a exibir **3 âncoras circulares interativas dedicadas**, permitindo controle total da cauda, do ápice do arco e da ponta.

---

## 2. Objetivos e Requisitos

### 2.1 Objetivos (Goals)
1. **Supressão do Transformer retangular na flecha curva:** Quando uma flecha curva (`arrowStyle === 'curved'`) estiver selecionada individualmente, o retângulo com 8 alças do Transformer não deve ser exibido para ela.
2. **Três Âncoras Circulares Interativas:**
   - **Âncora 1 (Cauda - Início):** Controla o ponto de origem `(points[0], points[1])`, permitindo encurtar, esticar e reposicionar a base.
   - **Âncora 2 (Arco - Ponto Médio):** Controla o ápice da curva `(points[2], points[3])`, permitindo ao usuário empurrar ou puxar a curvatura para qualquer lado (suave, pronunciada, côncava ou convexa).
   - **Âncora 3 (Ponta - Cabeça):** Controla o alvo `(points[4], points[5])`, permitindo mirar exatamente no pixel desejado com precisão cirúrgica.
3. **Arrasto em Tempo Real e Feedback Visual:**
   - O movimento de qualquer âncora atualiza o traçado da flecha curva instantaneamente (`60fps`) sem atrasos.
   - Ao soltar a âncora (`dragEnd`), a alteração é gravada na anotação com registro no histórico de **Desfazer/Refazer (Undo/Redo)**.
4. **Respeito às Barreiras da Imagem:**
   - Cada âncora possui restrição rígida de movimento (`clampToBounds`), impedindo que a cauda, a curva ou a ponta ultrapassem os limites da imagem de fundo (`0 <= x <= imgW`, `0 <= y <= imgH`).
5. **Movimentação do Elemento Inteiro:**
   - Clicar e arrastar qualquer parte da linha/corpo da flecha continua movendo a flecha inteira pelo canvas, mantendo sua curvatura e tamanho relativos intactos.
6. **Design Visual das Âncoras:**
   - Círculos brancos (`#ffffff`) com contorno azul macOS (`#0071e3`, 2px de espessura), sombra suave para contraste sobre qualquer fundo, raio visual de 5.5px e área de clique expandida (hitStrokeWidth de 14px) para fácil toque com mouse/trackpad.
   - Cursores interativos: `crosshair` para ponta e cauda; `grab` / `grabbing` para o vértice do arco.

### 2.2 Não-Objetivos (Non-Goals)
- Não alterar o comportamento das outras ferramentas e flechas retas (`standard`, `thin`, `dashed`), que continuam utilizando o Transformer retangular proporcional existente.
- Não introduzir pontos de controle bézier com tangentes duplas complexas (cúbicas); o modelo de 3 pontos com interpolação `tension: 0.4` do Konva é simples, performático e exatamente o que o usuário solicitou.

---

## 3. Abordagens Consideradas

- **Abordagem 1: Três Âncoras Dedicadas na Flecha Curva (Escolhida)**
  Desativa a caixa retangular na flecha curva e exibe 3 pontos circulares sobre a cauda, arco e ponta.
  *Por que foi escolhida:* É a mais limpa, ergonômica e alinhada com as melhores ferramentas de design vetorial, atendendo cirurgicamente ao pedido do usuário.

- **Abordagem 2: Modelo Híbrido (Caixa do Transformer + Ponto de Curvatura)**
  Manter o Transformer e adicionar 1 ponto flutuante no meio.
  *Por que foi descartada:* A caixa retangular compete visualmente com as âncoras da flecha, causando cliques acidentais e comportamentos conflitantes ao girar.

- **Abordagem 3: Sistema de Âncoras para Todas as Flechas**
  Aplicar âncoras em todas as flechas (2 pontos nas retas, 3 na curva).
  *Por que foi descartada:* Extrapola o escopo do usuário e altera o comportamento das flechas retas que já foram validadas e aprovadas.

---

## 4. Arquitetura e Implementação

1. **Condição no Transformer:**
   No `useEffect` de acoplamento do Transformer em [`CanvasEditor.tsx`](file:///C:/Code/ferramenta-captura/src/components/CanvasEditor.tsx), se o nó selecionado for uma anotação `arrow` com `arrowStyle === 'curved'`, ele não é acoplado ao Transformer (`nodes = []`).
2. **Componente/Camada de Âncoras da Flecha Curva (`CurvedArrowAnchors`):**
   Renderizado condicionalmente quando `ann.arrowStyle === 'curved'` estiver selecionada e o editor não estiver bloqueado (`!isLocked`).
   - Âncora 0 (Cauda): `(ann.x + points[0], ann.y + points[1])`.
   - Âncora 1 (Arco): `(ann.x + points[2], ann.y + points[3])`.
   - Âncora 2 (Ponta): `(ann.x + points[4], ann.y + points[5])`.
   - Cada nó `Circle` escuta `onDragMove` e `onDragEnd` para sincronizar os pontos da flecha.
3. **Integração com Undo/Redo:**
   O início do arrasto (`onDragStart`) ou o fim (`onDragEnd`) aciona `onUpdateAnnotation` que persiste o estado e grava o snapshot na pilha de histórico.
