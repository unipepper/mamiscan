/**
 * Base64 data URL을 max 480px (긴 쪽), JPEG quality 0.65로 압축해 반환
 * 목표 크기: 30~45KB
 */
export async function compressThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 720;
      let { width, height } = img;

      if (width > height) {
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      } else {
        if (height > MAX) { width = Math.round(width * MAX / height); height = MAX; }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.65));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Base64 data URL → Blob 변환 (Supabase Storage 업로드용)
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(data);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}
