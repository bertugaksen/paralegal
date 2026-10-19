import { FilterSettings, PDFMeta, RedactionItem } from './types';

const API_BASE = window.location.port === '3000' ? 'http://127.0.0.1:52410' : '';

export const api = {
  async health(): Promise<{ status: string; app: string; offline: boolean }> {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.json();
  },

  async chooseFile(type: 'pdf' | 'image' = 'pdf'): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/choose-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    const data = await res.json();
    return data.path;
  },

  async chooseFiles(): Promise<string[]> {
    const res = await fetch(`${API_BASE}/api/choose-files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    return data.paths || [];
  },

  async chooseSavePath(defaultName: string = 'anonimlestirildi.pdf'): Promise<string | null> {
    const res = await fetch(`${API_BASE}/api/choose-save-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ default_name: defaultName }),
    });
    const data = await res.json();
    return data.path;
  },

  async loadPDF(pdfPath: string): Promise<PDFMeta> {
    const res = await fetch(`${API_BASE}/api/load-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pdfPath }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'PDF yüklenemedi');
    }
    return res.json();
  },

  getPageImageUrl(pdfPath: string, pageNum: number, dpi: number = 140): string {
    return `${API_BASE}/api/pdf-page-image?path=${encodeURIComponent(pdfPath)}&page=${pageNum}&dpi=${dpi}&t=${Date.now()}`;
  },

  async scanPDF(
    pdfPath: string,
    filters: FilterSettings,
    customKeywords: string[] = []
  ): Promise<{ entities: RedactionItem[]; total: number }> {
    const res = await fetch(`${API_BASE}/api/scan-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pdfPath,
        filters,
        custom_keywords: customKeywords,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Tarama hatası');
    }
    return res.json();
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
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Arama hatası');
    }
    return res.json();
  },

  async applyRedactions(
    inputPath: string,
    outputPath: string,
    redactions: RedactionItem[],
    color: 'black' | 'white' = 'black',
    overlay: 'none' | 'redacted' = 'none'
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
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Redaksiyon uygulanamadı');
    }
    return res.json();
  },

  getImageThumbnailUrl(imgPath: string, rotation: number = 0): string {
    return `${API_BASE}/api/image-thumbnail?path=${encodeURIComponent(imgPath)}&rotation=${rotation}&t=${Date.now()}`;
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
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Dönüştürme hatası');
    }
    return res.json();
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
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Excel analizi başarısız');
    }
    return res.json();
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
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Excel dönüştürme hatası');
    }
    return res.json();
  },
};
