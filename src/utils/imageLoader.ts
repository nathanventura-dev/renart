/**
 * Carrega uma imagem e chama `onLoad` quando terminar. Devolve `cancel`: depois de cancelar,
 * um `onload` atrasado é ignorado (evita aplicar o resultado de uma imagem já substituída).
 */
export function loadImage(
  src: string,
  onLoad: (img: HTMLImageElement) => void,
  createImage: () => HTMLImageElement = () => new window.Image()
): () => void {
  let cancelled = false;
  const img = createImage();
  img.onload = () => {
    if (cancelled) return;
    onLoad(img);
  };
  img.src = src;
  return () => {
    cancelled = true;
    img.onload = null;
  };
}
