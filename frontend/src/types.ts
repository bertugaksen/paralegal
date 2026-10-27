export type WorkspaceMode = 'hub' | 'redactor' | 'converter';

export interface RedactionItem {
  id: string;
  category: string;
  value: string;
  page_number: number;
  rect: [number, number, number, number]; // [x0, y0, x1, y1]
  confidence: number;
  approved: boolean;
}

export interface PageMeta {
  page: number;
  width: number;
  height: number;
}

export interface PDFMeta {
  path: string;
  filename: string;
  total_pages: number;
  pages: PageMeta[];
  is_scanned?: boolean;
  has_text_layer?: boolean;
  total_chars?: number;
}

export interface FilterSettings {
  names: boolean;
  companies: boolean;
  dockets: boolean;
  tckn: boolean;
  vkn: boolean;
  iban: boolean;
  phone: boolean;
  plate: boolean;
  email: boolean;
  address: boolean;
  identity: boolean;
  property: boolean;
}

export interface ExcelAnalysis {
  row_count?: number;
  col_count?: number;
  [key: string]: any;
}

export interface FileSizeInfo {
  path: string;
  size_bytes: number;
  size_formatted: string;
}

