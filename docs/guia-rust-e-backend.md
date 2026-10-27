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
