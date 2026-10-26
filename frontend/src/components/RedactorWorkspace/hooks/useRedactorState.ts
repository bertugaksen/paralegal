import { useState, useRef, useCallback } from 'react';
import { FilterSettings, PDFMeta, RedactionItem } from '../../../types';

export const DEFAULT_FILTERS: FilterSettings = {
  names: true, companies: true, dockets: true, tckn: true,
  vkn: true, iban: true, phone: true, plate: true,
  email: true, address: true, identity: true, property: true,
};

export const CATEGORY_NAMES: Record<string, string> = {
  TCKN: 'TCKN', VKN: 'Vergi No', TARAF_ISMI: 'Kişi Adı',
  KURUM_SIRKET: 'Şirket/Kurum', DOSYA_NO: 'Dosya No',
  IBAN: 'IBAN', TELEFON: 'Telefon', PLAKA: 'Plaka',
  E_POSTA: 'E-Posta', ADRES: 'Adres', KIMLIK_BELGESI: 'Kimlik/Pasaport',
  MALVARLIGI_ARAC: 'Araç Bilgisi', OZEL_KELIME: 'Özel Arama', MANUEL: 'Manuel Seçim',
};

export function useRedactorState() {
  const [pdfMeta, setPdfMeta] = useState<PDFMeta | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(100);
  const [filters, setFilters] = useState<FilterSettings>(DEFAULT_FILTERS);
  const [redactions, setRedactions] = useState<RedactionItem[]>([]);
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

  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [hoveredRedactionId, setHoveredRedactionId] = useState<string | null>(null);
  const [drawToolActive, setDrawToolActive] = useState<boolean>(false);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [normStart, setNormStart] = useState<{ x: number; y: number } | null>(null);
  const [normCurrent, setNormCurrent] = useState<{ x: number; y: number } | null>(null);

  const [showZoomBadge, setShowZoomBadge] = useState<boolean>(false);
  const zoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef<number>(zoom);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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
    whitelist, setWhitelist, isScanning, setIsScanning, isSaving, setIsSaving,
    saveStatus, setSaveStatus, searchTerm, setSearchTerm, isSearching, setIsSearching,
    redactionColor, setRedactionColor, redactionOverlay, setRedactionOverlay,
    sidebarTab, setSidebarTab, dataScope, setDataScope, loadedPages, setLoadedPages,
    previewMode, setPreviewMode, hoveredRedactionId, setHoveredRedactionId,
    drawToolActive, setDrawToolActive, drawingPage, setDrawingPage,
    isDrawing, setIsDrawing, normStart, setNormStart, normCurrent, setNormCurrent,
    showZoomBadge, setShowZoomBadge, zoomBadgeTimeoutRef, zoomRef,
    pageRefs, imageRefs, containerRef
  };
}
