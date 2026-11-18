// 사진을 서버가 받는 형태(data:image/jpeg;base64,...)로 바꿔요.
// 휴대폰 사진은 10MB가 넘기 쉬워서 긴 변 1280px JPEG로 줄여 보내요 (서버 한도 6MB).

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('사진을 열 수 없어요. JPG나 PNG 사진으로 다시 골라 주세요.'));
    img.src = src;
  });
}

function toJpeg(img: CanvasImageSource, w: number, h: number, quality: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이 브라우저에서는 사진을 줄일 수 없어요.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function fileToJpeg(file: File, maxSide = 1280, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요.');
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    return toJpeg(img, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale), quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function svgToJpeg(svg: string, w = 800, h = 600): Promise<string> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    return toJpeg(img, w, h, 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
