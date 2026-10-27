import { useState, useRef, useCallback, useEffect } from 'react';
import { FilterSettings, PDFMeta, RedactionItem } from '../../../types';

export const DEFAULT_FILTERS: FilterSettings = {
  names: true, companies: true, dockets: true, tckn: true,
  vkn: true, iban: true, phone: true, plate: true,
  email: true, address: true, identity: true, property: true,
};

export const CATEGORY_NAMES: Record<string, string> = {
  TCKN: 'TCKN',
  VKN: 'Vergi No',
  TARAF_ISMI: 'Kişi Adı',
  KURUM_SIRKET: 'Şirket/Kurum',
  SIRKET_UNVANI: 'Şirket/Kurum',
  DOSYA_NO: 'Dosya No',
  IBAN: 'Banka/IBAN',
  TELEFON: 'Telefon',
  PLAKA: 'Plaka',
  E_POSTA: 'E-Posta',
  EPOSTA: 'E-Posta',
  ADRES: 'Adres',
  KIMLIK_BELGESI: 'Kimlik/Pasaport',
  KIMLIK_BILGISI: 'Kimlik/Pasaport',
  MALVARLIGI_ARAC: 'Araç Bilgisi',
  TASINMAZ: 'Tapu / Taşınmaz',
  OZEL_KELIME: 'Özel Arama',
  MANUEL: 'Manuel',
};

export const getCategoryLabel = (category: string): string => {
  if (category === 'IBAN') return 'Banka/IBAN';
  if (category === 'MANUEL') return 'Manuel';
  if (category === 'SIRKET_UNVANI') return 'Şirket/Kurum';
  if (category === 'EPOSTA') return 'E-Posta';
  if (category === 'KIMLIK_BILGISI') return 'Kimlik/Pasaport';
  if (category === 'TASINMAZ') return 'Tapu / Taşınmaz';
  return CATEGORY_NAMES[category] || category;
};

const MAX_HISTORY = 30;

export const cloneRedactions = (items: RedactionItem[]): RedactionItem[] => {
  return items.map((item) => ({
    ...item,
    rect: [...item.rect] as [number, number, number, number],
  }));
};

export function useRedactorState() {
  const [pdfMeta, setPdfMeta] = useState<PDFMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
  const [redactions, setRedactions] = useState<RedactionItem[]>([]);
  const [history, setHistory] = useState<RedactionItem[][]>([]);
  const [future, setFuture] = useState<RedactionItem[][]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [redactionColor, setRedactionColor] = useState<'black' | 'white'>('black');
  const [redactionOverlay, setRedactionOverlay] = useState<'none' | 'redacted'>('none');
  const [sidebarTab, setSidebarTab] = useState<'data' | 'settings'>('data');
  const [dataScope, setDataScope] = useState<'current_page' | 'all_pages'>('current_page');
  const [loadedPages, setLoadedPages] = useState<Record<number, boolean>>({});

  const [hoveredRedactionId, setHoveredRedactionId] = useState<string | null>(null);
  const [selectedRedactionId, setSelectedRedactionId] = useState<string | null>(null);
  const [drawToolActive, setDrawToolActive] = useState<boolean>(false);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [normStart, setNormStart] = useState<{ x: number; y: number } | null>(null);
  const [normCurrent, setNormCurrent] = useState<{ x: number; y: number } | null>(null);

  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [showZoomBadge, setShowZoomBadge] = useState<boolean>(false);
  const zoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef<number>(zoom);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const redactionsRef = useRef<RedactionItem[]>(redactions);
  const historyRef = useRef<RedactionItem[][]>(history);
  const futureRef = useRef<RedactionItem[][]>(future);

  historyRef.current = history;
  futureRef.current = future;

  useEffect(() => {
    redactionsRef.current = redactions;
  }, [redactions]);

  // Yeni bir durum kaydetme (Ctrl+Z için geçmişe ekler)
  const pushState = useCallback((
    newRedactionsOrFn: RedactionItem[] | ((prev: RedactionItem[]) => RedactionItem[]),
    previousOverride?: RedactionItem[]
  ) => {
    const current = previousOverride || redactionsRef.current;
    const next = typeof newRedactionsOrFn === 'function' ? newRedactionsOrFn(current) : newRedactionsOrFn;

    let newHistory = [...historyRef.current, cloneRedactions(current)];
    if (newHistory.length > MAX_HISTORY) {
      newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
    }
    historyRef.current = newHistory;
    setHistory(newHistory);

    futureRef.current = [];
    setFuture([]);

    const nextCloned = cloneRedactions(next);
    redactionsRef.current = nextCloned;
    setRedactions(nextCloned);
  }, []);

  // Geri Al (Undo / Ctrl+Z)
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;

    const newHistory = [...historyRef.current];
    const previous = newHistory.pop()!;
    historyRef.current = newHistory;
    setHistory(newHistory);

    const current = redactionsRef.current;
    const newFuture = [...futureRef.current, cloneRedactions(current)];
    futureRef.current = newFuture;
    setFuture(newFuture);

    const restored = cloneRedactions(previous);
    redactionsRef.current = restored;
    setRedactions(restored);
  }, []);

  // İleri Al (Redo / Ctrl+Y / Ctrl+Shift+Z)
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    const newFuture = [...futureRef.current];
    const next = newFuture.pop()!;
    futureRef.current = newFuture;
    setFuture(newFuture);

    const current = redactionsRef.current;
    let newHistory = [...historyRef.current, cloneRedactions(current)];
    if (newHistory.length > MAX_HISTORY) {
      newHistory = newHistory.slice(newHistory.length - MAX_HISTORY);
    }
    historyRef.current = newHistory;
    setHistory(newHistory);

    const restored = cloneRedactions(next);
    redactionsRef.current = restored;
    setRedactions(restored);
  }, []);

  // Geçmişi Temizle (Yeni dosya yüklendiğinde vb.)
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    futureRef.current = [];
    setHistory([]);
    setFuture([]);
  }, []);

  const handleFitToWidth = useCallback((meta?: PDFMeta | null, pageIdx: number = 0) => {
    const targetMeta = meta || pdfMeta;
    if (!targetMeta || !targetMeta.pages[pageIdx]) return;

    if (containerRef.current && imageRefs.current[pageIdx]) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const imgNaturalWidth = imageRefs.current[pageIdx]?.naturalWidth || targetMeta.pages[pageIdx].width;

      if (imgNaturalWidth > 0) {
        let newZoom = (containerWidth / imgNaturalWidth) * 100;
        if (newZoom > 200) newZoom = 200;
        if (newZoom < 20) newZoom = 20;
        setZoom(newZoom);
      }
    }
  }, [pdfMeta]);

  return {
    pdfMeta, setPdfMeta, currentPage, setCurrentPage,
    zoom, setZoom, filters, setFilters, redactions, setRedactions,
    history, future, canUndo: history.length > 0, canRedo: future.length > 0,
    pushState, setRedactionsWithHistory: pushState, undo, redo, clearHistory,
    whitelist, setWhitelist, isScanning, setIsScanning, isSaving, setIsSaving,
    saveStatus, setSaveStatus, searchTerm, setSearchTerm, isSearching, setIsSearching,
    redactionColor, setRedactionColor, redactionOverlay, setRedactionOverlay,
    sidebarTab, setSidebarTab, dataScope, setDataScope, loadedPages, setLoadedPages,
    hoveredRedactionId, setHoveredRedactionId,
    selectedRedactionId, setSelectedRedactionId,
    drawToolActive, setDrawToolActive, drawingPage, setDrawingPage,
    isDrawing, setIsDrawing, normStart, setNormStart, normCurrent, setNormCurrent,
    showThumbnails, setShowThumbnails, isSidebarCollapsed, setIsSidebarCollapsed,
    showZoomBadge, setShowZoomBadge, zoomBadgeTimeoutRef, zoomRef,
    pageRefs, imageRefs, containerRef, handleFitToWidth, redactionsRef
  };
}
