# Guia Explicativo do Backend em Rust

Este documento foi criado especialmente para explicar, passo a passo e em linguagem acessível, como o backend em **Rust** da nossa Ferramenta de Captura funciona, por que cada bloco de código foi escrito dessa forma e como ele se comunica com a interface visual.

---

## 1. Por que usamos Rust neste projeto?

Em aplicações desktop convencionais (como no Electron), a captura de tela costuma consumir muita memória e ter pequenos atrasos porque o JavaScript precisa lidar com buffers gigantes de pixels brutos. 

O **Rust** resolve isso com:
1. **Velocidade Nativa:** Executa diretamente no hardware sem intermediários.
2. **Zero Garbage Collection:** Não há pausas ou congelamentos de memória enquanto você seleciona a tela.
3. **Segurança de Memória:** O compilador impede erros clássicos de ponteiros nulos ou vazamentos de memória antes do programa rodar.

---

## 2. Estrutura dos Arquivos em `src-tauri/src/`

- **`lib.rs`**: O ponto de entrada principal que inicializa a aplicação Tauri, registra os plugins e expõe as funções Rust (chamadas de *Tauri Commands*) para que o JavaScript/React possa acioná-las.
- **`main.rs`**: O binário executável que inicia o loop de eventos no Windows/Mac/Linux.
- **`capture.rs`**: O motor de captura de tela e cópia imediata para a área de transferência.
- **`instance.rs`**: O controlador que garante que no máximo 2 instâncias do aplicativo fiquem abertas ao mesmo tempo.
- **`shortcuts.rs`**: O registrador de atalhos globais de teclado (ex: `Ctrl+Shift+S`).
- **`capture_session.rs`**: A sessão de captura multi-monitor: guarda o quadro congelado de cada monitor e expõe os comandos `begin_capture`, `get_overlay_frame`, `finish_capture`, `cancel_capture` e `set_overlay_mode`.
- **`permissions.rs`**: Consulta a permissão de Gravação de Tela do macOS (`screen_recording_allowed`) e converte a negativa no erro `screen-recording-denied`.

---

## 3. Dissecando o Módulo de Captura (`capture.rs`)

Vamos analisar cada trecho do código de captura:

### 3.1. Estrutura de Coordenadas (`RectBounds`)

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RectBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}
```
- **O que faz:** Define uma "estrutura" (como uma classe simples ou objeto) para representar uma caixa retangular com posição `x`, `y` e dimensões `width` (largura) e `height` (altura).
- **Por que usamos `#[derive(...)]`:** Em Rust, essa anotação ensina o compilador a gerar automaticamente funções úteis para este objeto, como converter para JSON (`Serialize/Deserialize`), permitir impressão para depuração (`Debug`) e comparar se dois retângulos são iguais (`PartialEq`).

---

### 3.2. Validação e Ajuste de Limites (`validate_bounds`)

```rust
pub fn validate_bounds(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    screen_width: u32,
    screen_height: u32,
) -> Result<RectBounds, String>
```
- **O que faz:** Recebe o retângulo que o usuário desenhou na tela e as dimensões reais do monitor, garantindo que o recorte seja válido.
- **Tratamento de Arraste Invertido e Coordenadas Negativas:** Se o usuário clicar e arrastar para fora da tela ou da direita para a esquerda, os valores podem vir negativos. Essa função ajusta automaticamente (`clamp`) para que o recorte fique perfeitamente preso às bordas do monitor:
  ```rust
  let clamped_w = std::cmp::min(adj_w, screen_width - adj_x);
  let clamped_h = std::cmp::min(adj_h, screen_height - adj_y);
  ```
- **O que é `Result<RectBounds, String>`:** Em Rust, em vez de disparar exceções que travam o programa (`try/catch`), funções retornam um `Result`. Se der certo, retorna `Ok(bounds)`. Se der erro (ex: o usuário selecionou uma área com largura zero), retorna `Err("mensagem explicativa")`.

---

### 3.3. Cópia Instantânea para a Área de Transferência (`copy_to_clipboard`)

```rust
pub fn copy_to_clipboard(png_bytes: &[u8]) -> Result<(), String>
```
- **O que faz:** Pega os bytes da imagem PNG capturada e a grava imediatamente na área de transferência do Windows, Mac ou Linux usando a biblioteca nativa `arboard`.
- **Por que isso foi implementado:** Atende diretamente à sua preferência: assim que você termina de arrastar o mouse na tela, o print já está disponível na memória. Você pode simplesmente dar `Ctrl+V` no WhatsApp, Slack, Word ou Discord imediatamente, sem precisar clicar em nenhum botão de salvar.

---

### 3.4. Captura Nativa de Baixo Nível (`capture_fullscreen` e `capture_region`)

```rust
let monitors = xcap::Monitor::all()
    .map_err(|e| format!("Erro ao listar monitores: {}", e))?;

let primary = monitors.into_iter().find(|m| m.is_primary())
    .ok_or_else(|| "Nenhum monitor primário encontrado".to_string())?;

let image = primary.capture_image()
    .map_err(|e| format!("Erro ao capturar tela: {}", e))?;
```
- **O que é `xcap`:** É a biblioteca nativa mais moderna e rápida para captura de tela multiplataforma em Rust. Ela lida automaticamente com as diferenças entre o subsistema gráfico do Windows (GDI/DirectX), do macOS (CoreGraphics) e do Linux (tanto o servidor X11 quanto o moderno Wayland com PipeWire).
- **O operador `?` no final das linhas:** Em Rust, o ponto de interrogação significa: *"tente executar esta operação; se ela falhar, saia imediatamente da função retornando o erro"*. Isso deixa o código limpo, sem dezenas de `if/else` aninhados.

---

### 3.5. O Comando Tauri para o Frontend (`tauri_capture_screen`)

```rust
#[tauri::command]
pub fn tauri_capture_screen(...) -> Result<String, String>
```
- **O que faz:** É a ponte oficial entre o Rust e o React.
- **Como o React chama isso:** No JavaScript, o React simplesmente executa:
  ```typescript
  import { invoke } from '@tauri-apps/api/core';
  const dataUrl = await invoke('tauri_capture_screen', { mode: 'region', x: 50, y: 50, w: 800, h: 600 });
  ```
- O Rust processa a captura em milissegundos, copia para o clipboard e devolve uma string no formato `"data:image/png;base64,..."` que o componente do React carrega diretamente no Canvas para anotações.


---

## 4. Captura Multi-Monitor (`capture_session.rs`)

Em vez de capturar só o monitor principal, o RenArt congela **todos** os monitores de uma vez e abre uma janela sem borda em cada tela para a seleção:

1. `begin_capture(mode)` valida o modo (`region` ou `fullscreen`), confere a permissão, esconde a janela principal (para ela não aparecer no quadro), captura cada monitor (`capture_monitor`) e guarda os quadros numa `CaptureSession`. Depois abre uma janela `capture-overlay-<id>` por monitor, na posição e no tamanho exatos da tela (`overlay_geometry`, que preserva coordenadas negativas de monitores à esquerda ou acima do principal).
2. Cada overlay pede o seu quadro com `get_overlay_frame(id)` e mostra a seleção (região) ou a câmera (tela inteira).
3. `finish_capture(id, selection)` converte a seleção em pixels físicos com `selection_to_physical`, usando a razão real `quadro / tamanho lógico` de cada eixo (por isso monitores Retina 2× e externos 1× convivem), recorta, copia para o clipboard, fecha os overlays, mostra a janela principal e emite o evento `capture-complete`.
4. `cancel_capture()` desfaz tudo e emite `capture-cancelled`. Uma nova captura aberta com outra em andamento substitui a anterior.

Os nomes dos eventos (`capture-complete`, `capture-cancelled`, `overlay-mode-changed`) e o código de erro `screen-recording-denied` existem iguais no Rust e em `src/services/captureService.ts`, e um teste garante que continuam iguais.

### 4.1. Desempenho e troca de monitor (correções após o primeiro teste manual)

- **Quadro sem codificação:** codificar PNG/JPEG de um monitor 4K levava de 1s a 5s em modo dev. Por isso `get_overlay_frame` devolve o quadro como **BMP cru** (`frame_to_bmp`, 24 bits, de cima para baixo) em uma resposta binária, sem base64. As dependências são compiladas otimizadas também no perfil de dev (`[profile.dev.package."*"] opt-level = 3`).
- **Overlays escondidos até ficarem prontos:** as janelas nascem com `visible(false)`; o overlay decodifica o quadro e chama `overlay_ready(id)`. Um temporizador de segurança de 3s mostra todos mesmo assim, para o app nunca ficar invisível.
- **O Rust acompanha o cursor:** o webview de uma janela sem foco não recebe eventos de mouse no macOS, então o cursor "não passava" de um monitor para o outro e a câmera só aparecia depois de clicar. Uma thread lê a posição global do cursor (~60Hz, `cursor_position`), descobre o monitor sob ele (`monitor_at`), emite `overlay-active-monitor` e passa o foco ao overlay daquele monitor. Com o botão do mouse pressionado o foco não muda, para não interromper um arrasto. Só no macOS.
- **Cursor de mira e câmera dependem só do Rust:** como o webview de uma janela sem foco não recebe movimento do mouse (nem `mouseleave`), o `cursor: crosshair` da página não era aplicado ao trocar de monitor e o hover local deixava a câmera presa no monitor anterior. Agora o rastreador define o cursor do sistema (`NSCursor`, na thread principal) a cada tick enquanto o modo é **Área**, e o `ScreenPicker` mostra a câmera apenas no monitor indicado pelo evento `overlay-active-monitor`. `set_overlay_mode` atualiza o modo da sessão para o rastreador saber qual cursor usar.
- **Cursor normal sobre a barra de opções:** forçar a mira em toda a tela fazia o cursor piscar entre seta e cruz sobre a barra (a página e o Rust disputavam o cursor). O overlay mede a barra (`[data-capture-ui]`) e informa o retângulo ao Rust (`set_overlay_ui_rect`). O rastreador só força a mira **fora** da barra (`should_force_crosshair`); sobre ela devolve o cursor à página, que usa seta na barra e mãozinha nos botões.

### 4.2. Captura de janela

- `list_windows` usa `xcap::Window::all()` (da frente para trás) e descarta o que não é janela de usuário (`is_capturable_window`: do próprio app, minimizadas, menores que 80×40, e apps como `Dock` e `Window Server`). A lista é tirada em `begin_capture` e guardada na sessão; se falhar, fica vazia e os outros modos seguem.
- No modo `window` o rastreador do cursor usa `window_at` (a janela do topo sob o ponto) e emite `overlay-hover-window` com `local_rects_for`: o retângulo da janela **recortado por monitor**, em coordenadas locais (uma janela entre dois monitores gera dois retângulos).
- O clique envia `Selection::Window { id }`. `resolve_window_capture` captura só aquela janela (`capture_window`, a imagem dela mesma) e, se isso falhar, recorta o quadro congelado no retângulo da janela. O resultado (`capture-complete`) leva o campo `kind` (`region`, `fullscreen` ou `window`) para o título da galeria.
- **Pré-visualização da janela:** `get_window_image(id)` captura a janela uma vez e guarda no cache da sessão (`window_image_with`: a captura roda fora do lock e só entra no cache se a sessão ainda for a mesma). Devolve os pixels **crus** (cabeçalho de 8 bytes com largura e altura + RGBA, `encode_rgba_blob`), sem codificar PNG. O evento de hover traz também o retângulo **completo** da janela (`full_*`, local ao monitor e sem recorte), para o overlay alinhar a imagem mesmo quando a janela sai da tela ou ocupa dois monitores. O clique reaproveita a imagem do cache, então o que é salvo é exatamente o que foi exibido.
- **Alfa pré-multiplicado:** o CoreGraphics entrega a janela com alfa pré-multiplicado e o `xcap` só troca BGRA por RGBA; `unpremultiply_alpha` converte para alfa direto (PNG e canvas esperam isso), evitando a franja escura nos cantos arredondados.

