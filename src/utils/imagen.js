// Achica una foto elegida del celular (las cámaras dan 3-8 MB) a un JPEG de
// hasta `maxLado` píxeles - suficiente para una miniatura de catálogo y mucho
// más liviana de subir y de mostrar. Si algo falla (formato raro, canvas
// bloqueado) devuelve el archivo original tal cual.
export function reducirImagen(archivo, maxLado = 1000, calidad = 0.85) {
  return new Promise((resolve) => {
    if (!archivo.type.startsWith('image/')) { resolve(archivo); return; }
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob ? new File([blob], 'producto.jpg', { type: 'image/jpeg' }) : archivo), 'image/jpeg', calidad);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(archivo); };
    img.src = url;
  });
}
