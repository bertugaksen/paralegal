import { FilterSettings, PDFMeta, RedactionItem, FileSizeInfo, PDFInfo } from './types';

const API_BASE = window.location.port === '3000' ? 'http://127.0.0.1:52410' : '';

async function safeJson<T = any>(res: Response, defaultError: string = 'İşlem başarısız'): Promise<T> {
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    let msg = defaultError;
    if (text && text.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.error) msg = parsed.error;
      } catch {
        msg = `${defaultError} (${res.status})`;
      }
    } else {
      msg = `${defaultError} (${res.status})`;
    }
    throw new Error(msg);
  }
  if (!text || !text.trim()) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export const api = {
  async health(): Promise<{ status: string; app: string; offline: boolean }> {
    const res = await fetch(`${API_BASE}/api/health`);
    return safeJson(res, 'Sunucuya bağlanılamadı');
  },

  async uploadFile(file: File): Promise<string> {
    // 1. Masaüstü/WebEngine ortamında doğrudan dosya yolu varsa doğrudan kullan
    const directPath = (file as any).path;
    if (directPath && typeof directPath === 'string' && directPath.trim().length > 0) {
      return directPath;
    }

    // 2. Tarayıcı/web sandbox ortamında dosya içeriğini Base64 olarak oku ve backend'e yükle
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch(`${API_BASE}/api/upload-file`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              data: base64Data,
            }),
          });
          const data = await safeJson(res, 'Dosya yükleme başarısız oldu');
          const targetPath = data.path || data.filePath;
          if (!targetPath) {
            throw new Error('Dosya yolu alınamadı');
          }
          resolve(targetPath);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsDataURL(file);
    });
  },

  async cleanTempUploads(maxAgeSeconds: number = 0): Promise<{ success: boolean; deleted_count: number }> {
    const res = await fetch(`${API_BASE}/api/clean-temp-uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_age_seconds: maxAgeSeconds }),
    });
    return safeJson(res, 'Geçici dosyalar temizlenemedi');
  },

  async chooseFile(type: 'pdf' | 'image' = 'pdf'): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/choose-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await safeJson(res, 'Dosya seçici açılamadı');
    return data.path || null;
  },

  async chooseFiles(fileType: string = 'converter'): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/choose-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_type: fileType }),
    });
    const data = await safeJson(res, 'Dosya seçici açılamadı');
    return data.paths || [];
  },

  async choosePdfs(): Promise<string[]> {
    return this.chooseFiles('pdf');
  },

  async chooseSavePath(defaultName: string = 'anonimlestirildi.pdf'): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/choose-save-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_name: defaultName }),
    });
    const data = await safeJson(res, 'Kayıt yolu seçilemedi');
    return data.path || null;
  },

  async chooseDirectory(): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/choose-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await safeJson(res, 'Klasör seçilemedi');
    return data.path || null;
  },

  async openDirectory(path: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/open-directory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    await safeJson(res, 'Klasör açılamadı');
  },

  async loadPDF(pdfPath: string): Promise<PDFMeta> {
    const res = await fetch(`${API_BASE}/api/load-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pdfPath }),
    });
    return safeJson(res, 'PDF yüklenemedi');
  },

  getPageImageUrl(pdfPath: string, pageNum: number, dpi: number = 140): string {
    return `${API_BASE}/api/pdf-page-image?path=${encodeURIComponent(pdfPath)}&page=${pageNum}&dpi=${dpi}`;
  },

  async scanPDF(
    pdfPath: string,
    filters: FilterSettings,
    customKeywords: string[] = []
  ): Promise<{
    entities: RedactionItem[];
    total: number;
    is_scanned?: boolean;
    has_text_layer?: boolean;
    total_chars?: number;
  }> {
    const res = await fetch(`${API_BASE}/api/scan-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pdfPath,
        filters,
        custom_keywords: customKeywords,
      }),
    });
    return safeJson(res, 'Tarama hatası');
  },

  async searchText(
    pdfPath: string,
    text: string
  ): Promise<{ entities: RedactionItem[]; total: number }> {
    const res = await fetch(`${API_BASE}/api/search-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pdfPath, text }),
    });
    return safeJson(res, 'Arama hatası');
  },

  async applyRedactions(
    inputPath: string,
    outputPath: string,
    redactions: RedactionItem[],
    color: 'black' | 'white' = 'black',
    overlay: 'none' | 'redacted' = 'none',
    attachCertificate: boolean = false
  ): Promise<any> {
    const res = await fetch(`${API_BASE}/api/apply-redactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_path: inputPath,
        output_path: outputPath,
        redactions,
        color,
        overlay,
        attach_certificate: attachCertificate,
      }),
    });
    return safeJson(res, 'Redaksiyon uygulanamadı');
  },

  getImageThumbnailUrl(imgPath: string, rotation: number = 0): string {
    return `${API_BASE}/api/image-thumbnail?path=${encodeURIComponent(imgPath)}&rotation=${rotation}`;
  },

  async convertImages(
    inputPaths: string[],
    combine: boolean,
    rotations?: Record<string, number>,
    outputDir?: string,
    excelOptions?: {
      orientation?: 'auto' | 'landscape' | 'portrait';
      fit_width?: boolean;
      repeat_header?: boolean;
    }
  ): Promise<{ success: boolean; output_paths: string[]; errors: string[] }> {
    const res = await fetch(`${API_BASE}/api/convert-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_paths: inputPaths,
        combine,
        rotations: rotations || {},
        output_dir: outputDir,
        excel_options: excelOptions || {},
      }),
    });
    return safeJson(res, 'Dönüştürme hatası');
  },

  async analyzeExcel(excelPath: string): Promise<{
    sheet_count: number;
    sheets: Array<{ name: string; max_row: number; max_col: number; recommended_orientation: string }>;
    overall_recommended_orientation: 'landscape' | 'portrait';
  }> {
    const res = await fetch(`${API_BASE}/api/analyze-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: excelPath }),
    });
    return safeJson(res, 'Excel analizi başarısız');
  },

  async convertExcel(
    inputPath: string,
    outputPath?: string,
    orientation: 'auto' | 'landscape' | 'portrait' = 'auto',
    fitWidth: boolean = true,
    repeatHeader: boolean = true
  ): Promise<{ success: boolean; output_path: string }> {
    const res = await fetch(`${API_BASE}/api/convert-excel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_path: inputPath,
        output_path: outputPath,
        orientation,
        fit_width: fitWidth,
        repeat_header: repeatHeader,
      }),
    });
    return safeJson(res, 'Excel dönüştürme hatası');
  },

  async convertWord(
    inputPath: string,
    outputPath?: string
  ): Promise<{ success: boolean; output_path: string }> {
    const res = await fetch(`${API_BASE}/api/convert-word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_path: inputPath,
        output_path: outputPath,
      }),
    });
    return safeJson(res, 'Word dönüştürme hatası');
  },

  async convertMsg(
    inputPath: string,
    outputPath?: string
  ): Promise<{ success: boolean; output_path: string }> {
    const res = await fetch(`${API_BASE}/api/convert-msg`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_path: inputPath,
        output_path: outputPath,
      }),
    });
    return safeJson(res, 'E-posta dönüştürme hatası');
  },

  async convertEmail(
    inputPath: string,
    outputPath?: string
  ): Promise<{ success: boolean; output_path: string }> {
    return this.convertMsg(inputPath, outputPath);
  },

  async mergePdfs(
    inputPaths: string[],
    outputPath?: string,
    addBookmarks: boolean = true
  ): Promise<{ success: boolean; output_path: string; total_pages: number; file_count: number; size_bytes: number; size_formatted: string }> {
    const res = await fetch(`${API_BASE}/api/merge-pdfs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_paths: inputPaths,
        output_path: outputPath,
        add_bookmarks: addBookmarks,
      }),
    });
    return safeJson(res, 'PDF birleştirme hatası');
  },

  async getPdfInfo(path: string): Promise<PDFInfo> {
    const res = await fetch(`${API_BASE}/api/pdf-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    return safeJson(res, 'PDF bilgisi alınamadı');
  },

  async getFileSizes(paths: string[]): Promise<FileSizeInfo[]> {
    if (!paths || paths.length === 0) {
      return [];
    }
    const res = await fetch(`${API_BASE}/api/file-sizes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths }),
    });
    const data = await safeJson(res, 'Dosya boyutları alınamadı');
    return Array.isArray(data) ? data : (data.files || []);
  },
};

export const getFileSizes = api.getFileSizes;
