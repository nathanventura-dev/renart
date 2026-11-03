/**
 * Determina se um clique no vazio do canvas deve apenas desselecionar/fechar edições existentes
 * em vez de criar um novo elemento.
 *
 * @param hasSelection Se há pelo menos um elemento selecionado no momento
 * @param isEditingText Se o editor inline de texto está aberto
 * @param isAltPressed Se a tecla Alt está sendo pressionada pelo usuário
 */
export function shouldDeselectOnEmptyClick(
  hasSelection: boolean,
  isEditingText: boolean,
  isAltPressed: boolean
): boolean {
  if (isAltPressed) return false;
  return hasSelection || isEditingText;
}
