/**
 * Réduit une photo prise au téléphone (souvent plusieurs Mo) avant l'envoi :
 * JPEG, côté le plus long ≤ maxSize px. Une photo de 4 Mo tombe vers 40–80 Ko.
 */
export async function shrinkImage(file: File, maxSize = 480, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponible');
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('conversion impossible'))), 'image/jpeg', quality),
    );
  } finally {
    bitmap.close();
  }
}
