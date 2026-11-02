# Especificação de Design: Simplificação para 3 Níveis de Ocultação de Dados

**Data:** 2026-11-01  
**Status:** Proposto para aprovação  

---

## 1. Contexto e Motivação

Com a implementação da **Blindagem Anti-IA por Embaralhamento de Entropia** nos níveis de desfoque, os níveis estéticos (Rosto e Texto) tornaram-se matematicamente seguros contra reconstrução ou desofuscação por inteligência artificial.
O antigo Nível 3 (desfoque cego pesado de 28px) tornou-se redundante. Simplificar para **3 níveis** torna a interface mais clara, reduz carga de processamento e memória no canvas, e melhora a experiência do usuário.

---

## 2. Objetivos e Regras de Negócio

1. **3 Níveis de Ocultação (`RedactionLevel = 1 | 2 | 3`):**
   - **Nível 1 (Rosto):** Desfoque suave (8px) + micro-embaralhamento anti-IA (3px) + ruído suave (6).
   - **Nível 2 (Texto):** Desfoque atenuado (16px) + embaralhamento médio anti-IA (5px) + ruído médio (10).
   - **Nível 3 (Tarja Preta):** Tarja preta 100% opaca (`#000000`, absorve o antigo nível 4).

2. **Padrão Inicial (Default):**
   - O padrão da ferramenta passa a ser o **Nível 1 (Rosto)**, iniciando o fluxo naturalmente da esquerda para a direita.

3. **Compatibilidade Retroativa:**
   - Anotações legadas com `level === 4` ou `effect === 'blackout'` mapeiam para `level: 3`.
   - Anotações legadas com `level === 3` e `effect === 'blur'` mapeiam para `level: 2`.

4. **Canvas e Performance (`CanvasEditor.tsx`):**
   - O objeto `blurredBgCanvases` passa a gerar apenas os canvases `{ 1: ..., 2: ... }`, economizando CPU/GPU ao eliminar a criação do terceiro canvas de desfoque pesado.
   - O Nível 3 renderiza diretamente um retângulo ou traço sólido preto.

5. **Interface (`Toolbar.tsx`):**
   - O submenu flutuante de censura renderiza exatamente 3 botões de nível: `[Rosto]` `[Texto]` `[Tarja]` seguidos de `[Retângulo]` `[Pincel]`.

---

## 3. Abordagens Consideradas

- **Abordagem A (Adotada): Modelo Estrito 1..3 com Nível 1 como padrão.**
  - Tipagem forte `RedactionLevel = 1 | 2 | 3`.
  - Mapeamento transparente de retrocompatibilidade em `resolveRedactionLevel`.
  - Nível 1 selecionado ao abrir ou ativar a ferramenta pela primeira vez.
- **Abordagem B: Manter 4 níveis internamente e apenas ocultar o nível 3 na interface.**
  - Rejeitada por manter complexidade desnecessária, código morto e consumo inútil de canvas em background.
