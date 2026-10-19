import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  Filter,
  FolderOpen,
  RefreshCw,
  Square,
  ShieldOff,
  ShieldCheck,
  CheckCheck,
  XCircle,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { FilterSettings, PDFMeta, RedactionItem } from '../types';

interface RedactorWorkspaceProps {
  onBackToHub: () => void;
}

const DEFAULT_FILTERS: FilterSettings = {
  names: true,
  companies: true,
  dockets: true,
  tckn: true,
  vkn: true,
  iban: true,
  phone: true,
  plate: true,
  email: true,
  address: true,
  identity: true,
  property: true,
};

const CATEGORY_NAMES: Record<string, string> = {
  TCKN: 'TCKN',
  VKN: 'Vergi No',
  TARAF_ISMI: 'Kişi Adı',
  KISI_ADI: 'Kişi Adı',
  SIRKET_UNVANI: 'Şirket Unvanı',
  DOSYA_NO: 'Dosya No',
  IBAN: 'IBAN',
  TELEFON: 'Telefon',
  PLAKA: 'Plaka',
  EPOSTA: 'E-Posta',
  ADRES: 'Adres',
  KIMLIK_BILGISI: 'Kimlik / Aile',
  TASINMAZ: 'Tapu / Taşınmaz',
  OZEL_KELIME: 'Özel Arama',
  MANUEL: 'Manuel Seçim',
};

export const RedactorWorkspace: React.FC<RedactorWorkspaceProps> = ({ onBackToHub }) => {
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

  // Manuel Bant Çekme Aracı Modu (Açık Araç Çubuğu Butonu)
  const [drawToolActive, setDrawToolActive] = useState<boolean>(false);
  const [drawingPage, setDrawingPage] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [normStart, setNormStart] = useState<{ x: number; y: number } | null>(null);
  const [normCurrent, setNormCurrent] = useState<{ x: number; y: number } | null>(null);

  // Yüzen Zoom HUD Rozeti Durumu
  const [showZoomBadge, setShowZoomBadge] = useState<boolean>(false);
  const zoomBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef<number>(zoom);
  zoomRef.current = zoom;

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Odaklı PDF Yakınlaştırma (Touchpad Pinch & Ctrl+Wheel)
  // Yalnızca PDF sayfasını imleç odaklı büyütür/küçültür; uygulama arayüzünü asla bozmaz.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Touchpad pinch-to-zoom veya Ctrl + Wheel
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const rect = container.getBoundingClientRect();
        const pivotX = e.clientX - rect.left;
        const pivotY = e.clientY - rect.top;

        // Touchpad küçük sürekli float üretirken (1-10), fare tekerleği 50-100 adımlarla gelir
        const isTouchpad = Math.abs(e.deltaY) < 40;
        const zoomDelta = -e.deltaY * (isTouchpad ? 0.007 : 0.0025);

        const currentZoom = zoomRef.current;
        const nextZoom = Math.min(250, Math.max(50, Math.round(currentZoom * (1 + zoomDelta))));

        if (nextZoom !== currentZoom) {
          const ratio = nextZoom / currentZoom;
          setZoom(nextZoom);

          // İmleç altındaki noktanın kaymasını önle (Focal-Point Zoom Anchoring)
          requestAnimationFrame(() => {
            container.scrollLeft = (container.scrollLeft + pivotX) * ratio - pivotX;
            container.scrollTop = (container.scrollTop + pivotY) * ratio - pivotY;
          });

          // Yüzen Zoom Rozetini Göster
          setShowZoomBadge(true);
          if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
          zoomBadgeTimeoutRef.current = setTimeout(() => {
            setShowZoomBadge(false);
          }, 1200);
        }
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
    };
  }, []);

  // Belgeyi konteyner genişliğine tam sığdıran zoom değerini hesapla (Fit to Width)
  const getFitWidthZoom = (meta?: PDFMeta | null, pageIdx: number = 0): number => {
    const docMeta = meta || pdfMeta;
    if (!docMeta || !containerRef.current || !docMeta.pages || docMeta.pages.length === 0) return 100;

    const container = containerRef.current;
    // Konteyner kullanılabilir genişliği (p-6 padding = 24px sol + 24px sağ = 48px boşluk)
    const availWidth = Math.max(200, container.clientWidth - 48);

    const targetIdx = Math.min(pageIdx, docMeta.pages.length - 1);
    const page = docMeta.pages[targetIdx] || docMeta.pages[0];
    const dpiScale = 140 / 72;
    const imgPixelWidth = page.width * dpiScale;

    // Yalnızca yatay genişliği esas alarak % zoom hesapla
    const fitRatio = availWidth / imgPixelWidth;
    return Math.min(200, Math.max(35, Math.round(fitRatio * 100)));
  };

  const handleFitToWidth = (meta?: PDFMeta | null, pageIdx: number = 0) => {
    const fitZoom = getFitWidthZoom(meta, pageIdx);
    setZoom(fitZoom);

    // Scroll'u yatayda sıfırla
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollLeft = 0;
      }
    });

    setShowZoomBadge(true);
    if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
    zoomBadgeTimeoutRef.current = setTimeout(() => {
      setShowZoomBadge(false);
    }, 1200);
  };

  // Sayfaya pürüzsüz kaydırma (Smooth Scroll to Page)
  const scrollToPage = (pageIdx: number) => {
    if (!pdfMeta || pageIdx < 0 || pageIdx >= pdfMeta.total_pages) return;
    setCurrentPage(pageIdx);
    const target = pageRefs.current[pageIdx];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Çift tıklama veya Sığdır butonu: Genişliğe Sığdır <-> %100 arasında pürüzsüz geçiş
  const handleToggleFitOrFull = () => {
    const fitZoom = getFitWidthZoom();
    // Eğer şu anki zoom genişliğe sığdır değerine yakınsa (±3), %100'e geç
    if (Math.abs(zoom - fitZoom) <= 3) {
      setZoom(100);
    } else {
      // Değilse genişliğe tam sığdır
      setZoom(fitZoom);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = 0;
        }
      });
    }

    setShowZoomBadge(true);
    if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
    zoomBadgeTimeoutRef.current = setTimeout(() => {
      setShowZoomBadge(false);
    }, 1200);
  };

  // Yeni bir PDF açıldığında sayfayı otomatik olarak yatay genişliğe tam sığdır (Fit to Width)
  useEffect(() => {
    if (!pdfMeta) return;

    const timer = setTimeout(() => {
      handleFitToWidth(pdfMeta, 0);
    }, 80);

    const handleResize = () => {
      const fitZoom = getFitWidthZoom(pdfMeta, currentPage);
      if (Math.abs(zoomRef.current - fitZoom) <= 5) {
        handleFitToWidth(pdfMeta, currentPage);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [pdfMeta?.path]);

  // Dikey Akış Sırasında Ekranda Görünen Sayfayı Tespit Eden Scroll Spy (IntersectionObserver)
  useEffect(() => {
    if (!pdfMeta || !containerRef.current) return;

    const container = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        }

        if (bestEntry) {
          const pageIdxStr = bestEntry.target.getAttribute('data-page-index');
          if (pageIdxStr !== null) {
            const idx = parseInt(pageIdxStr, 10);
            if (!isNaN(idx)) {
              setCurrentPage(idx);
            }
          }
        }
      },
      {
        root: container,
        threshold: [0.15, 0.35, 0.55, 0.75],
      }
    );

    pageRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [pdfMeta?.path, pdfMeta?.total_pages, zoom]);

  // Dosya Seçme
  const handleSelectFile = async () => {
    try {
      const chosen = await api.chooseFile('pdf');
      if (chosen) {
        await loadDocument(chosen);
      }
    } catch (err: any) {
      alert(`Dosya açılamadı: ${err.message}`);
    }
  };

  const loadDocument = async (filePath: string) => {
    try {
      const meta = await api.loadPDF(filePath);
      setPdfMeta(meta);
      setCurrentPage(0);
      setRedactions([]);
      setWhitelist([]);
      setSaveStatus(null);
      setLoadedPages({});
      pageRefs.current = [];
      imageRefs.current = [];
      setTimeout(() => {
        handleFitToWidth(meta, 0);
      }, 80);
      await triggerScan(meta.path, DEFAULT_FILTERS, []);
    } catch (err: any) {
      alert(`PDF okunamadı: ${err.message}`);
    }
  };

  // Otomatik Tarama
  const triggerScan = async (path: string, currentFilters: FilterSettings, currentWhitelist: string[]) => {
    setIsScanning(true);
    try {
      const res = await api.scanPDF(path, currentFilters);
      // Beyaz listedeki kelimeleri hariç tut
      const filtered = res.entities.filter((item) => {
        const val = item.value.toLowerCase().trim();
        return !currentWhitelist.some((wl) => val.includes(wl.toLowerCase().trim()));
      });
      setRedactions(filtered);
    } catch (err: any) {
      console.error('Tarama hatası:', err);
    } finally {
      setIsScanning(false);
    }
  };

  // Filtre Değişimi
  const toggleFilter = (key: keyof FilterSettings) => {
    const updated = { ...filters, [key]: !filters[key] };
    setFilters(updated);
    if (pdfMeta) {
      triggerScan(pdfMeta.path, updated, whitelist);
    }
  };

  // Özel Kelime Arama
  const handleSearchText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || !pdfMeta) return;

    setIsSearching(true);
    try {
      const res = await api.searchText(pdfMeta.path, searchTerm.trim());
      if (res.entities.length === 0) {
        alert(`"${searchTerm}" belgede bulunamadı.`);
      } else {
        const existingIds = new Set(redactions.map((r) => r.id));
        const newItems = res.entities.filter((item) => !existingIds.has(item.id));
        setRedactions((prev) => [...prev, ...newItems]);
        setSearchTerm('');
        setSidebarTab('data');
      }
    } catch (err: any) {
      alert(`Arama hatası: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Redaksiyon onayını aç/kapat
  const toggleRedaction = (id: string) => {
    setRedactions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r))
    );
  };

  // Redaksiyonu listeden tamamen sil
  const removeRedaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRedactions((prev) => prev.filter((r) => r.id !== id));
  };

  // Beyaz Listeye Ekle (Tüm Belgede Yoksay)
  const addToWhitelist = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = value.trim();
    if (!clean) return;

    if (!whitelist.includes(clean)) {
      const newWl = [...whitelist, clean];
      setWhitelist(newWl);
      // Belgedeki bu kelimeyle eşleşen tüm varlıkları kaldır
      setRedactions((prev) =>
        prev.filter((r) => !r.value.toLowerCase().includes(clean.toLowerCase()))
      );
    }
  };

  // Beyaz Listeden Çıkar (Muafiyeti İptal Et ve Yeniden Tara)
  const removeFromWhitelist = (word: string) => {
    const updated = whitelist.filter((w) => w !== word);
    setWhitelist(updated);
    if (pdfMeta) {
      triggerScan(pdfMeta.path, filters, updated);
    }
  };

  // Tüm KVKK Filtrelerini Aç
  const selectAllFilters = () => {
    const allOn: FilterSettings = { ...DEFAULT_FILTERS };
    setFilters(allOn);
    if (pdfMeta) triggerScan(pdfMeta.path, allOn, whitelist);
  };

  // Tüm KVKK Filtrelerini Kapat
  const deselectAllFilters = () => {
    const allOff: FilterSettings = {
      names: false,
      companies: false,
      dockets: false,
      tckn: false,
      vkn: false,
      iban: false,
      phone: false,
      plate: false,
      email: false,
      address: false,
      identity: false,
      property: false,
    };
    setFilters(allOff);
    if (pdfMeta) triggerScan(pdfMeta.path, allOff, whitelist);
  };

  // Tüm Belgedeki Varlıkları Onayla (Global Bulk Approve)
  const approveAllAcrossDocument = () => {
    setRedactions((prev) => prev.map((r) => ({ ...r, approved: true })));
  };

  // Tüm Belgedeki Varlıkların Onayını Kaldır
  const unapproveAllAcrossDocument = () => {
    setRedactions((prev) => prev.map((r) => ({ ...r, approved: false })));
  };

  // Belirli bir sayfa görseli üzerindeki normalize koordinatı hesapla (0.0 - 1.0 arası)
  // Zoom, CSS scale, DPI ve scroll fark etmeksizin imleç ile %100 birebir eşleşir
  const getImageCoords = (clientX: number, clientY: number, pageIdx: number) => {
    const img = imageRefs.current[pageIdx];
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    return { normX, normY };
  };

  // Manuel Çizim İptali
  const handlePointerCancel = () => {
    setIsDrawing(false);
    setDrawingPage(null);
    setNormStart(null);
    setNormCurrent(null);
  };

  // Manuel Çizim Başlangıcı (Pointer Down) - Tıklanan sayfaya özel (Yalnızca Sol Tık)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, pageIdx: number) => {
    if (!drawToolActive || e.button !== 0) return;
    const coords = getImageCoords(e.clientX, e.clientY, pageIdx);
    if (!coords) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawingPage(pageIdx);
    setIsDrawing(true);
    setNormStart({ x: coords.normX, y: coords.normY });
    setNormCurrent({ x: coords.normX, y: coords.normY });
  };

  // Manuel Çizim Hareketi (Pointer Move)
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || drawingPage === null || !normStart) return;
    const coords = getImageCoords(e.clientX, e.clientY, drawingPage);
    if (!coords) return;

    setNormCurrent({ x: coords.normX, y: coords.normY });
  };

  // Manuel Çizim Tamamlandı (Pointer Up)
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || drawingPage === null || !normStart || !normCurrent || !pdfMeta) {
      handlePointerCancel();
      return;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    const targetPage = drawingPage;
    const pageInfo = pdfMeta.pages[targetPage];
    if (pageInfo) {
      const pdfX0 = Math.min(normStart.x, normCurrent.x) * pageInfo.width;
      const pdfY0 = Math.min(normStart.y, normCurrent.y) * pageInfo.height;
      const pdfX1 = Math.max(normStart.x, normCurrent.x) * pageInfo.width;
      const pdfY1 = Math.max(normStart.y, normCurrent.y) * pageInfo.height;

      // Minimum 4x4 pt boyut şartı (kazara tıklamalarda boş kutu açılmasını engeller)
      if (pdfX1 - pdfX0 > 4 && pdfY1 - pdfY0 > 4) {
        const newItem: RedactionItem = {
          id: `manual_${targetPage}_${Math.round(pdfX0)}_${Math.round(pdfY0)}_${Date.now()}`,
          category: 'MANUEL',
          value: 'Manuel Seçim (Bant)',
          page_number: targetPage,
          rect: [pdfX0, pdfY0, pdfX1, pdfY1],
          confidence: 1.0,
          approved: true,
        };

        setRedactions((prev) => [...prev, newItem]);
        setCurrentPage(targetPage);
      }
    }

    handlePointerCancel();
  };

  // Klavye ESC Kısayolu: Çizim yapılıyorsa iptal et, yapılmıyorsa Bant Modundan çık
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDrawing) {
          handlePointerCancel();
        } else if (drawToolActive) {
          setDrawToolActive(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, drawToolActive]);

  // Kalıcı Redaksiyonu Kaydet
  const handleSaveRedactedPDF = async () => {
    if (!pdfMeta) return;

    const approvedList = redactions.filter((r) => r.approved);
    if (approvedList.length === 0) {
      alert('Lütfen en az bir sansürlenecek alan seçin.');
      return;
    }

    const defaultOut = `${pdfMeta.filename.replace(/\.pdf$/i, '')}_anonimlestirildi.pdf`;
    const savePath = await api.chooseSavePath(defaultOut);
    if (!savePath) return;

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await api.applyRedactions(
        pdfMeta.path,
        savePath,
        approvedList,
        redactionColor,
        redactionOverlay
      );
      setSaveStatus(`Başarıyla kaydedildi: ${result.output_path} (${result.redactions_applied || result.total_redactions} alan sansürlendi)`);
    } catch (err: any) {
      alert(`Kaydetme hatası: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const currentPageRedactions = redactions.filter((r) => r.page_number === currentPage);
  const totalApproved = redactions.filter((r) => r.approved).length;
  const displayedRedactions = dataScope === 'current_page' ? currentPageRedactions : redactions;

  return (
    <div className="h-screen flex flex-col bg-[#F4EFEA] text-[#121316] overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b-2 border-[#121316] bg-[#FFFFFF] px-5 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHub}
            className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ana Menü</span>
          </button>

          <div className="h-5 w-[1.5px] bg-[#121316]/20" />

          {pdfMeta ? (
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#121316]" />
              {/* Başlık Taşmasını Önleyen max-w ve Ellipsis */}
              <span
                className="font-extrabold text-sm max-w-[220px] truncate cursor-help"
                title={`Belge: ${pdfMeta.filename}\nTam Yol: ${pdfMeta.path}`}
              >
                {pdfMeta.filename}
              </span>
              <span className="text-[11px] px-2 py-0.5 bg-[#F4EFEA] border border-[#121316] font-bold">
                {pdfMeta.total_pages} Sayfa
              </span>
            </div>
          ) : (
            <span className="font-bold text-sm text-[#575A65]">Henüz belge yüklenmedi</span>
          )}
        </div>

        {pdfMeta && (
          <div className="flex items-center gap-3">
            {/* Sayfa Gezinme ve Kesintisiz Dikey Akış Kontrolü */}
            <div className="flex items-center gap-1 bg-[#F4EFEA] border-2 border-[#121316] p-0.5 brutal-shadow-sm">
              <button
                disabled={currentPage <= 0}
                onClick={() => scrollToPage(Math.max(0, currentPage - 1))}
                className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer"
                title="Önceki Sayfaya Kaydır"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollToPage(currentPage)}
                className="text-xs font-black px-2 min-w-16 text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer"
                title="Şu anki sayfa / Toplam sayfa (Kaydırmak için tıkla)"
              >
                {currentPage + 1} / {pdfMeta.total_pages}
              </button>
              <button
                disabled={currentPage >= pdfMeta.total_pages - 1}
                onClick={() => scrollToPage(Math.min(pdfMeta.total_pages - 1, currentPage + 1))}
                className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer"
                title="Sonraki Sayfaya Kaydır"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Yakınlaştırma (Zoom) */}
            <div className="flex items-center gap-1 bg-[#F4EFEA] border-2 border-[#121316] p-0.5 brutal-shadow-sm">
              <button
                disabled={zoom <= 35}
                onClick={() => {
                  setZoom((z) => Math.max(35, z - 10));
                  setShowZoomBadge(true);
                  if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
                  zoomBadgeTimeoutRef.current = setTimeout(() => setShowZoomBadge(false), 1200);
                }}
                className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer"
                title="Uzaklaştır"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleFitOrFull}
                className="text-xs font-black px-1.5 min-w-12 text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer"
                title="Tıkla: Sığdır / %100 Geçişi"
              >
                %{zoom}
              </button>
              <button
                disabled={zoom >= 250}
                onClick={() => {
                  setZoom((z) => Math.min(250, z + 10));
                  setShowZoomBadge(true);
                  if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
                  zoomBadgeTimeoutRef.current = setTimeout(() => setShowZoomBadge(false), 1200);
                }}
                className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer"
                title="Yakınlaştır"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleToggleFitOrFull}
                className="px-2 py-0.5 bg-[#FFFFFF] hover:bg-[#121316] hover:text-white border border-[#121316]/50 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ml-0.5"
                title="Genişliğe Sığdır / %100 arasında geçiş yap"
              >
                Sığdır
              </button>
            </div>

            {/* Bant Çek (Serbest Çizim) Butonu */}
            <button
              onClick={() => setDrawToolActive(!drawToolActive)}
              className={`brutal-btn px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all ${
                drawToolActive ? 'brutal-btn-primary' : 'bg-[#FFFFFF] text-[#121316]'
              }`}
              title="Belge üzerinde fareyle serbest dikdörtgen çizerek sansür alanı oluşturun"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{drawToolActive ? 'Bant Modu Açık' : 'Bant Çek'}</span>
            </button>

            {/* Yeniden Tara (İkincil Aksiyon: Nötr Siyah/Beyaz) */}
            <button
              onClick={() => pdfMeta && triggerScan(pdfMeta.path, filters, whitelist)}
              disabled={isScanning}
              className="brutal-btn px-3 py-1.5 bg-[#FFFFFF] text-xs font-bold flex items-center gap-1.5 hover:bg-[#F4EFEA]"
              title="Filtrelerle Yeniden Tara"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>Yeniden Tara</span>
            </button>

            {/* Güvenli PDF Kaydet (Birincil CTA: Hukuk Laciverti #1E3A8A) */}
            <button
              onClick={handleSaveRedactedPDF}
              disabled={isSaving || totalApproved === 0}
              className="brutal-btn-primary px-4 py-1.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving ? 'İşleniyor...' : `Güvenli PDF Kaydet (${totalApproved})`}
              </span>
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Area */}
      {!pdfMeta ? (
        /* Single Expansive Drag & Drop Zone (Boş Durum) */
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl w-full brutal-card p-12 text-center bg-[#FFFFFF] cursor-pointer hover:border-[#1E3A8A] transition-colors border-2 border-dashed border-[#121316]"
            onClick={handleSelectFile}
          >
            <div className="w-20 h-20 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center mx-auto mb-6 brutal-shadow-sm">
              <Upload className="w-10 h-10 text-[#121316]" />
            </div>

            <h3 className="text-2xl font-black text-[#121316] mb-2">
              Anonimleştirilecek PDF Belgesini Seçin
            </h3>
            <p className="text-sm text-[#575A65] max-w-md mx-auto mb-6 font-medium">
              Dava dilekçesi, delil listesi veya mahkeme kararını seçin. Dosyayı buraya sürükleyip bırakabilir veya tıklayabilirsiniz.
            </p>

            <button className="brutal-btn py-3.5 px-8 bg-[#121316] text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-[#1E3A8A] transition-colors">
              <FolderOpen className="w-4 h-4" />
              <span>Bilgisayarımdan Dosya Seç</span>
            </button>

            <p className="text-xs text-[#575A65] mt-8 flex items-center justify-center gap-1.5 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#121316]" />
              <span>Belgeleriniz bilgisayarınızdan asla ayrılmaz, %100 yerel işlenir.</span>
            </p>
          </motion.div>
        </div>
      ) : (
        /* Active Redaction Split Workspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Center: PDF Continuous Vertical Scroll Canvas Viewer */}
          <div
            ref={containerRef}
            className={`flex-1 bg-[#121316] overflow-auto p-6 relative select-none ${
              drawToolActive ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <div className="flex flex-col items-center w-full">
              {pdfMeta.pages.map((pageInfo, pageIdx) => {
                const dpiScale = 140 / 72;
                const baseWidth = pageInfo.width * dpiScale;
                const baseHeight = pageInfo.height * dpiScale;
                const cardWidth = Math.round(baseWidth * (zoom / 100));
                const cardHeight = Math.round(baseHeight * (zoom / 100));
                const pageRedactions = redactions.filter((r) => r.page_number === pageIdx);

                return (
                  <div
                    key={`page_${pageIdx}`}
                    ref={(el) => {
                      pageRefs.current[pageIdx] = el;
                    }}
                    data-page-index={pageIdx}
                    className="relative brutal-card bg-white mx-auto shrink-0 select-none transition-all duration-75 mb-8"
                    style={{
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                    }}
                    onDoubleClick={() => !drawToolActive && handleToggleFitOrFull()}
                  >
                    {/* Sayfa Numarası Rozeti (Sol Üst) */}
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[#121316] text-[#F4EFEA] border border-white/20 text-[10px] font-mono font-bold select-none pointer-events-none brutal-shadow-sm">
                      Sayfa {pageIdx + 1} / {pdfMeta.total_pages}
                    </div>

                    {/* PDF Sayfa Görseli */}
                    <img
                      ref={(el) => {
                        imageRefs.current[pageIdx] = el;
                      }}
                      src={api.getPageImageUrl(pdfMeta.path, pageIdx, 140)}
                      alt={`Sayfa ${pageIdx + 1}`}
                      loading={pageIdx < 2 ? 'eager' : 'lazy'}
                      onLoad={() => {
                        setLoadedPages((prev) => ({ ...prev, [pageIdx]: true }));
                      }}
                      className="w-full h-full block pointer-events-none select-none"
                      style={{ display: 'block', width: '100%', height: '100%' }}
                    />

                    {/* Redaksiyon Kutucukları Overlay */}
                    {loadedPages[pageIdx] && (
                      <div className="absolute inset-0 pointer-events-none">
                        {pageRedactions.map((item) => {
                          const imgElem = imageRefs.current[pageIdx];
                          const imgWidth = imgElem?.clientWidth || cardWidth;
                          const imgHeight = imgElem?.clientHeight || cardHeight;

                          const scaleX = imgWidth / pageInfo.width;
                          const scaleY = imgHeight / pageInfo.height;

                          const left = item.rect[0] * scaleX;
                          const top = item.rect[1] * scaleY;
                          const width = (item.rect[2] - item.rect[0]) * scaleX;
                          const height = (item.rect[3] - item.rect[1]) * scaleY;

                          const catName = CATEGORY_NAMES[item.category] || item.category;

                          let boxStyle = '';
                          let textStyle = '';

                          if (item.approved) {
                            if (redactionColor === 'black') {
                              boxStyle = 'bg-[#121316] border-[#121316] shadow-sm';
                              textStyle = 'text-white';
                            } else {
                              boxStyle = 'bg-[#FFFFFF] border-2 border-[#121316] shadow-sm';
                              textStyle = 'text-[#121316]';
                            }
                          } else {
                            boxStyle = 'bg-[#1E3A8A]/10 border-2 border-dashed border-[#1E3A8A] opacity-60 hover:opacity-100';
                            textStyle = 'text-[#1E3A8A]';
                          }

                          return (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRedaction(item.id);
                              }}
                              title={`${catName}: ${item.value} (Tıklayarak durumu değiştir)`}
                              className={`absolute pointer-events-auto cursor-pointer transition-all flex items-center justify-center overflow-hidden ${boxStyle}`}
                              style={{
                                left: `${left}px`,
                                top: `${top}px`,
                                width: `${Math.max(width, 14)}px`,
                                height: `${Math.max(height, 14)}px`,
                              }}
                            >
                              {item.approved ? (
                                <span className={`text-[9px] font-black tracking-wider uppercase select-none ${textStyle}`}>
                                  {redactionOverlay === 'redacted' ? '[SANSÜRLENDİ]' : ''}
                                </span>
                              ) : (
                                <div className="w-1.5 h-1.5 bg-[#1E3A8A] rounded-full" />
                              )}
                            </div>
                          );
                        })}

                        {/* Manuel Çizim Sırasındaki Canlı Önizleme Kutusu (Bu Sayfada) */}
                        {isDrawing && drawingPage === pageIdx && normStart && normCurrent && (
                          <div
                            className="absolute border-2 border-[#1E3A8A] bg-[#1E3A8A]/30 pointer-events-none z-20 shadow-sm"
                            style={{
                              left: `${Math.min(normStart.x, normCurrent.x) * (imageRefs.current[pageIdx]?.clientWidth || cardWidth)}px`,
                              top: `${Math.min(normStart.y, normCurrent.y) * (imageRefs.current[pageIdx]?.clientHeight || cardHeight)}px`,
                              width: `${Math.abs(normCurrent.x - normStart.x) * (imageRefs.current[pageIdx]?.clientWidth || cardWidth)}px`,
                              height: `${Math.abs(normCurrent.y - normStart.y) * (imageRefs.current[pageIdx]?.clientHeight || cardHeight)}px`,
                            }}
                          >
                            <div className="absolute -top-5 left-0 bg-[#1E3A8A] text-white text-[9px] font-black px-1.5 py-0.5 whitespace-nowrap shadow-sm flex items-center gap-1">
                              <span>BANT</span>
                              <span className="opacity-75 font-mono">
                                {Math.round(Math.abs(normCurrent.x - normStart.x) * pageInfo.width)}×{Math.round(Math.abs(normCurrent.y - normStart.y) * pageInfo.height)} pt
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bant Çekme Aracı Aktifken Bu Sayfayı Kapsayan Çizim Katmanı */}
                    {drawToolActive && (
                      <div
                        className="absolute inset-0 z-30 cursor-crosshair select-none touch-none bg-transparent"
                        onPointerDown={(e) => handlePointerDown(e, pageIdx)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Yüzen Bant Çekme Modu Bilgilendirme Rozeti */}
            <AnimatePresence>
              {drawToolActive && (
                <motion.div
                  initial={{ opacity: 0, y: -20, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, y: -20, x: '-50%' }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-4 left-1/2 z-40 bg-[#121316] text-[#F4EFEA] px-4 py-2 border-2 border-[#1E3A8A] shadow-2xl text-xs font-bold flex items-center gap-3 select-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1E3A8A] animate-pulse" />
                    <span className="font-black text-white">Bant Çekme Modu Aktif</span>
                  </div>
                  <span className="text-[#A0A2AA] text-[11px] hidden sm:inline">
                    Kapatmak istediğiniz alanı fareyle sürükleyerek çizin
                  </span>
                  <span className="text-[10px] bg-white/10 px-1.5 py-0.5 font-mono text-[#F4EFEA]">
                    ESC: İptal
                  </span>
                  <button
                    onClick={() => setDrawToolActive(false)}
                    className="ml-1 p-0.5 text-white/70 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                    title="Modu Kapat"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Yüzen Zoom HUD Rozeti (%100 Odaklı ve Sıfırlanabilir) */}
            <AnimatePresence>
              {showZoomBadge && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 10 }}
                  transition={{ duration: 0.15 }}
                  onClick={handleToggleFitOrFull}
                  className="absolute bottom-6 right-8 z-40 bg-[#121316] text-[#F4EFEA] px-3.5 py-1.5 rounded-full border border-white/20 shadow-xl text-xs font-black tracking-wider flex items-center gap-2 cursor-pointer hover:bg-[#1E3A8A] transition-colors select-none"
                  title="Genişliğe Sığdır / %100 arasında geçiş için tıklayın"
                >
                  <span className="w-2 h-2 rounded-full bg-[#1E3A8A]" />
                  <span>%{zoom}</span>
                  <span className="text-[10px] text-[#A0A2AA] font-normal pl-1 border-l border-white/20">
                    {Math.abs(zoom - getFitWidthZoom()) <= 3 ? 'Genişliğe Sığdırıldı' : 'Sığdırmak için tıkla'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar: Controls & Entity Management */}
          <aside className="w-96 border-l-2 border-[#121316] bg-[#FFFFFF] flex flex-col shrink-0 z-10">
            {/* Top Segmented Tab Switcher */}
            <div className="flex border-b-2 border-[#121316] bg-[#FFFFFF] shrink-0">
              <button
                onClick={() => setSidebarTab('data')}
                className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-r-2 border-[#121316] transition-all cursor-pointer ${
                  sidebarTab === 'data'
                    ? 'bg-[#F4EFEA] text-[#121316] border-b-4 border-b-[#1E3A8A]'
                    : 'bg-[#FFFFFF] text-[#575A65] hover:bg-[#F4EFEA]/50 hover:text-[#121316]'
                }`}
              >
                <FileText className="w-4 h-4 text-[#1E3A8A]" />
                <span>Bu Sayfadaki Veriler</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full transition-colors ${
                    sidebarTab === 'data'
                      ? 'bg-[#1E3A8A] text-white'
                      : 'bg-[#121316]/10 text-[#121316]'
                  }`}
                >
                  {currentPageRedactions.length}
                </span>
              </button>

              <button
                onClick={() => setSidebarTab('settings')}
                className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  sidebarTab === 'settings'
                    ? 'bg-[#F4EFEA] text-[#121316] border-b-4 border-b-[#1E3A8A]'
                    : 'bg-[#FFFFFF] text-[#575A65] hover:bg-[#F4EFEA]/50 hover:text-[#121316]'
                }`}
              >
                <Sliders className="w-4 h-4 text-[#121316]" />
                <span>Filtreler & Ayarlar</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#121316]/10 text-[#121316] rounded-full">
                  {Object.values(filters).filter(Boolean).length}/12
                </span>
              </button>
            </div>

            {/* TAB 1: VERİ LİSTESİ (Birincil Çalışma Alanı - %85 Dikey Alan) */}
            {sidebarTab === 'data' && (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {/* Kompakt Arama Barı */}
                <div className="p-3 border-b-2 border-[#121316] bg-[#F4EFEA] shrink-0">
                  <form onSubmit={handleSearchText} className="flex gap-1.5">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#575A65]" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Kişi, unvan veya kelime ara..."
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border-2 border-[#121316] text-xs font-bold text-[#121316] focus:outline-none placeholder:text-[#575A65]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSearching || !searchTerm.trim()}
                      className="brutal-btn px-3 py-1.5 bg-[#121316] text-white text-xs font-black shrink-0 hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
                    >
                      {isSearching ? '...' : 'Bul & Kapat'}
                    </button>
                  </form>
                </div>

                {/* Toplu Eylemler ve Muafiyet Rozeti Barı */}
                <div className="p-2 border-b-2 border-[#121316] bg-[#FFFFFF] flex items-center justify-between gap-2 shrink-0">
                  <button
                    onClick={approveAllAcrossDocument}
                    className="brutal-btn flex-1 py-1.5 px-2 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Tüm belgedeki varlıkları tek tıkla sansürlemeye dahil et"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tümünü Sansürle</span>
                  </button>
                  <button
                    onClick={unapproveAllAcrossDocument}
                    className="brutal-btn flex-1 py-1.5 px-2 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Tüm belgedeki onayları kaldır"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Tümünü Kaldır</span>
                  </button>
                  {whitelist.length > 0 && (
                    <button
                      onClick={() => setSidebarTab('settings')}
                      className="text-[10px] font-black px-2 py-1.5 bg-[#F4EFEA] border-2 border-[#121316] text-[#1E3A8A] cursor-pointer hover:bg-[#1E3A8A] hover:text-white transition-colors shrink-0"
                      title="Muaf tutulan kelimeleri görüntülemek ve düzenlemek için tıklayın"
                    >
                      {whitelist.length} Muaf
                    </button>
                  )}
                </div>

                {/* Scope Seçici: Bu Sayfa vs Tüm Belge */}
                <div className="px-3 py-1.5 border-b border-[#121316] bg-[#F4EFEA] flex items-center justify-between text-xs font-bold shrink-0">
                  <span className="text-[10px] font-black uppercase text-[#121316]">
                    KAPSAM:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDataScope('current_page')}
                      className={`px-2 py-0.5 text-[10px] font-black border transition-colors cursor-pointer ${
                        dataScope === 'current_page'
                          ? 'bg-[#121316] text-white border-[#121316]'
                          : 'bg-[#FFFFFF] text-[#575A65] border-[#121316]/30 hover:text-[#121316]'
                      }`}
                      title="Yalnızca şu an görüntülenen sayfadaki verileri listele"
                    >
                      Sayfa {currentPage + 1} ({currentPageRedactions.length})
                    </button>
                    <button
                      onClick={() => setDataScope('all_pages')}
                      className={`px-2 py-0.5 text-[10px] font-black border transition-colors cursor-pointer ${
                        dataScope === 'all_pages'
                          ? 'bg-[#121316] text-white border-[#121316]'
                          : 'bg-[#FFFFFF] text-[#575A65] border-[#121316]/30 hover:text-[#121316]'
                      }`}
                      title="Belgenin tamamındaki verileri listele"
                    >
                      Tüm Belge ({redactions.length})
                    </button>
                  </div>
                </div>

                {/* Genişletilmiş Dikey Veri Akışı */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {displayedRedactions.length === 0 ? (
                    <div className="text-center py-16 px-4 text-xs text-[#575A65] font-medium flex flex-col items-center">
                      <div className="w-12 h-12 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center mb-3">
                        <FileText className="w-6 h-6 text-[#121316]" />
                      </div>
                      <p className="font-bold text-[#121316] mb-1">
                        {dataScope === 'current_page'
                          ? `Sayfa ${currentPage + 1}'de tespit edilen veri bulunmuyor.`
                          : 'Belgede tespit edilen hassas veri bulunmuyor.'}
                      </p>
                      <p className="text-[11px] text-[#575A65] max-w-xs">
                        Yukarıdaki <strong>"Bant Çek"</strong> butonuna basıp fareyle sürükleyerek istediğiniz alanı serbestçe kapatabilirsiniz.
                      </p>
                    </div>
                  ) : (
                    displayedRedactions.map((item) => {
                      const catName = CATEGORY_NAMES[item.category] || item.category;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            toggleRedaction(item.id);
                            if (dataScope === 'all_pages') {
                              scrollToPage(item.page_number);
                            }
                          }}
                          className={`p-2.5 border-2 transition-all cursor-pointer flex items-center justify-between ${
                            item.approved
                              ? 'border-[#121316] bg-[#FFFFFF] brutal-shadow-sm'
                              : 'border-dashed border-[#121316]/40 bg-[#F4EFEA] opacity-60 hover:opacity-100'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              {dataScope === 'all_pages' && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 bg-[#121316] text-[#F4EFEA] border border-[#121316]">
                                  S.{item.page_number + 1}
                                </span>
                              )}
                              <span className="text-[10px] font-black px-1.5 py-0.2 border border-[#121316] bg-[#F4EFEA] text-[#121316]">
                                {catName}
                              </span>
                              <span className="text-[10px] text-[#575A65] font-bold">
                                %{Math.round(item.confidence * 100)} Güven
                              </span>
                            </div>
                            <p className="text-xs font-bold text-[#121316] truncate" title={item.value}>
                              {item.value}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Beyaz Listeye Al (Tüm Belgede Yoksay) */}
                            <button
                              onClick={(e) => addToWhitelist(item.value, e)}
                              className="p-1 hover:text-[#1E3A8A] text-[#575A65] hover:bg-[#F4EFEA] rounded cursor-pointer"
                              title="Bu kelimeyi tüm belgede yoksay (Büro unvanı / antet için Muaf Tut)"
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                            </button>

                            {/* Listeden Çıkar */}
                            <button
                              onClick={(e) => removeRedaction(item.id, e)}
                              className="p-1 hover:text-[#121316] text-[#575A65] hover:bg-[#F4EFEA] rounded cursor-pointer"
                              title="Bu sayfadaki alanı sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Onay İmi */}
                            <div
                              className={`w-5 h-5 flex items-center justify-center border-2 border-[#121316] ${
                                item.approved ? 'bg-[#1E3A8A] text-white' : 'bg-white'
                              }`}
                            >
                              {item.approved && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: FİLTRELER & AYARLAR (Yapılandırma Alanı) */}
            {sidebarTab === 'settings' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#FFFFFF]">
                {/* KVKK Filtreleri Grubu */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>KVKK Algılama Filtreleri</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={selectAllFilters}
                        className="text-[10px] font-black text-[#1E3A8A] hover:underline cursor-pointer"
                      >
                        Tümünü Seç
                      </button>
                      <span className="text-xs text-[#575A65]">|</span>
                      <button
                        onClick={deselectAllFilters}
                        className="text-[10px] font-black text-[#575A65] hover:text-[#121316] hover:underline cursor-pointer"
                      >
                        Temizle
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        ['tckn', 'TCKN'],
                        ['vkn', 'Vergi No (VKN)'],
                        ['names', 'Kişi İsimleri'],
                        ['companies', 'Şirket Unvanları'],
                        ['dockets', 'Dosya No / Esas'],
                        ['address', 'Adres Bilgileri'],
                        ['identity', 'Kimlik / Aile'],
                        ['iban', 'IBAN'],
                        ['phone', 'Telefon'],
                        ['plate', 'Plaka'],
                        ['property', 'Tapu / Taşınmaz'],
                        ['email', 'E-Posta'],
                      ] as const
                    ).map(([key, label]) => {
                      const isActive = filters[key];
                      return (
                        <button
                          key={key}
                          onClick={() => toggleFilter(key)}
                          className={`brutal-btn text-xs py-2 px-2.5 font-bold flex items-center justify-between transition-all cursor-pointer ${
                            isActive
                              ? 'brutal-btn-primary'
                              : 'bg-[#F4EFEA] text-[#121316] hover:bg-[#EAE3DC]'
                          }`}
                        >
                          <span>{label}</span>
                          {isActive ? (
                            <Check className="w-3.5 h-3.5 text-white" />
                          ) : (
                            <div className="w-3 h-3 border border-[#121316]/40" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      if (pdfMeta) {
                        triggerScan(pdfMeta.path, filters, whitelist);
                        setSidebarTab('data');
                      }
                    }}
                    disabled={isScanning}
                    className="w-full mt-2.5 brutal-btn py-2 bg-[#121316] text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-[#1E3A8A] transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>{isScanning ? 'Taranıyor...' : 'Filtrelerle Yeniden Tara'}</span>
                  </button>
                </div>

                {/* Sansür Görünüm Ayarları */}
                <div className="pt-4 border-t-2 border-[#121316]">
                  <span className="block text-xs font-black uppercase text-[#121316] mb-2.5">
                    Sansür Görünüm Ayarları
                  </span>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setRedactionColor('black')}
                      className={`brutal-btn flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                        redactionColor === 'black' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 bg-[#121316] border border-white" />
                      <span>Siyah Kutu</span>
                    </button>
                    <button
                      onClick={() => setRedactionColor('white')}
                      className={`brutal-btn flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                        redactionColor === 'white' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 bg-white border border-[#121316]" />
                      <span>Beyaz Kutu</span>
                    </button>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setRedactionOverlay('none')}
                      className={`brutal-btn flex-1 py-1.5 px-2 text-xs font-bold cursor-pointer ${
                        redactionOverlay === 'none' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                      }`}
                    >
                      Düz Dolgu
                    </button>
                    <button
                      onClick={() => setRedactionOverlay('redacted')}
                      className={`brutal-btn flex-1 py-1.5 px-2 text-xs font-bold cursor-pointer ${
                        redactionOverlay === 'redacted' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                      }`}
                    >
                      [SANSÜRLENDİ] Metni
                    </button>
                  </div>

                  {/* Canlı Görünüm Önizlemesi */}
                  <div className="p-2.5 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#575A65]">Görünüm Önizleme:</span>
                    <div
                      className={`px-3 py-1 text-[10px] font-black uppercase border ${
                        redactionColor === 'black'
                          ? 'bg-[#121316] text-white border-[#121316]'
                          : 'bg-white text-[#121316] border-[#121316]'
                      }`}
                    >
                      {redactionOverlay === 'redacted' ? '[SANSÜRLENDİ]' : '█████████'}
                    </div>
                  </div>
                </div>

                {/* Whitelist / Muafiyetler Yönetimi */}
                <div className="pt-4 border-t-2 border-[#121316]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
                      <span>Muaf Tutulanlar (Beyaz Liste)</span>
                    </span>
                    <span className="text-[11px] font-bold text-[#575A65]">
                      {whitelist.length} Kelime
                    </span>
                  </div>

                  {whitelist.length === 0 ? (
                    <p className="text-xs text-[#575A65] bg-[#F4EFEA] p-3 border-2 border-dashed border-[#121316]/30 leading-relaxed">
                      Henüz muaf tutulan kelime yok. Veri listesindeki kalkan (🛡️) butonuna basarak büro unvanı veya vekil ismini tüm belgede sansürden muaf tutabilirsiniz.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {whitelist.map((word) => (
                        <div
                          key={word}
                          className="flex items-center justify-between p-2 bg-[#F4EFEA] border-2 border-[#121316] text-xs font-bold text-[#121316]"
                        >
                          <span className="truncate pr-2 font-mono">{word}</span>
                          <button
                            onClick={() => removeFromWhitelist(word)}
                            className="p-1 hover:text-white hover:bg-[#121316] text-[#575A65] transition-colors cursor-pointer"
                            title="Muafiyeti kaldır ve yeniden tara"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status bar */}
            {saveStatus && (
              <div className="p-3 bg-[#FFFFFF] border-t-2 border-[#121316] text-xs font-bold text-[#121316] flex items-start gap-2 shrink-0">
                <Check className="w-4 h-4 text-[#1E3A8A] shrink-0 mt-0.5" />
                <span className="break-all">{saveStatus}</span>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};
