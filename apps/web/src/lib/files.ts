// Downloads, file picking and local persistence. Everything here is
// best-effort: a blocked download or storage must never break editing.

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename);
}

/** Rasterise an SVG string to a PNG blob. */
export async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}

/** A short file name from the first words of the text. */
export function fileStem(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join('-');
  return words.replace(/[\\/:*?"<>|]/g, '') || 'midad';
}

const STORAGE_KEY = 'midad:document';
const LANG_KEY = 'midad:lang';

export const storage = {
  loadDocument(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  saveDocument(json: string) {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* storage full or blocked: editing continues */
    }
  },
  loadLang(): string | null {
    try {
      return localStorage.getItem(LANG_KEY);
    } catch {
      return null;
    }
  },
  saveLang(lang: string) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
  },
};
