import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  FolderOpen,
  ShieldCheck,
  XCircle,
  X,
  FileText,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../api';
import { useRedactorState, DEFAULT_FILTERS, CATEGORY_NAMES, cloneRedactions } from './hooks/useRedactorState';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { ThumbnailStrip } from './components/ThumbnailStrip';
import { FilterSettings, PDFMeta, RedactionItem } from '../../types';
import { useToast } from '../../context/ToastContext';

interface RedactorWorkspaceProps {
  onBackToHub: () => void;
}

export const RedactorWorkspace: React.FC<RedactorWorkspaceProps> = ({ onBackToHub }) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [dismissScannedWarning, setDismissScannedWarning] = useState<boolean>(false);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set([0, 1, 2, 3]));
  const {
    pdfMeta, setPdfMeta, currentPage, setCurrentPage, zoom, setZoom, filters, setFilters,
    redactions, setRedactions, canUndo, canRedo, pushState, undo, redo, clearHistory,
    whitelist, setWhitelist, isScanning, setIsScanning,
    isSaving, setIsSaving, saveStatus, setSaveStatus, searchTerm, setSearchTerm,
    isSearching, setIsSearching, redactionColor, setRedactionColor, redactionOverlay,
    setRedactionOverlay, sidebarTab, setSidebarTab, dataScope, setDataScope,
    loadedPages, setLoadedPages, hoveredRedactionId, setHoveredRedactionId,
    selectedRedactionId, setSelectedRedactionId,
    drawToolActive, setDrawToolActive, drawingPage,
    setDrawingPage, isDrawing, setIsDrawing, normStart, setNormStart, normCurrent,
    setNormCurrent, showThumbnails, setShowThumbnails, isSidebarCollapsed, setIsSidebarCollapsed,
    showZoomBadge, setShowZoomBadge, zoomBadgeTimeoutRef, zoomRef,
    pageRefs, imageRefs, containerRef, redactionsRef
  } = useRedactorState();

  const wasDraggedRef = useRef<boolean>(false);
  const [showSpeedRunBadge, setShowSpeedRunBadge] = useState<boolean>(true);

  const selectedRedactionIdRef = useRef<string | null>(selectedRedactionId);
  useEffect(() => {
    selectedRedactionIdRef.current = selectedRedactionId;
  }, [selectedRedactionId]);

  const currentPageRef = useRef<number>(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  zoomRef.current = zoom;

  // Yeni belge yüklendiğinde adli güvenlik uyarısı kapatma durumunu sıfırla
  useEffect(() => {
    setDismissScannedWarning(false);
  }, [pdfMeta?.path]);

  // Odaklı PDF Yakınlaştırma (Touchpad Pinch & Ctrl+Wheel)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        const rect = container.getBoundingClientRect();
        const pivotX = e.clientX - rect.left;
        const pivotY = e.clientY - rect.top;

        const isTouchpad = Math.abs(e.deltaY) < 40;
        const zoomDelta = -e.deltaY * (isTouchpad ? 0.007 : 0.0025);

        const currentZoom = zoomRef.current;
        const nextZoom = Math.min(250, Math.max(35, Math.round(currentZoom * (1 + zoomDelta))));

        if (nextZoom !== currentZoom) {
          const ratio = nextZoom / currentZoom;
          setZoom(nextZoom);

          requestAnimationFrame(() => {
            container.scrollLeft = (container.scrollLeft + pivotX) * ratio - pivotX;
            container.scrollTop = (container.scrollTop + pivotY) * ratio - pivotY;
          });

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
    const availWidth = Math.max(200, container.clientWidth - 48);

    const targetIdx = Math.min(pageIdx, docMeta.pages.length - 1);
    const page = docMeta.pages[targetIdx] || docMeta.pages[0];
    const dpiScale = 140 / 72;
    const imgPixelWidth = page.width * dpiScale;

    const fitRatio = availWidth / imgPixelWidth;
    return Math.min(200, Math.max(35, Math.round(fitRatio * 100)));
  };

  const handleFitToWidth = (meta?: PDFMeta | null, pageIdx: number = 0) => {
    const fitZoom = getFitWidthZoom(meta, pageIdx);
    setZoom(fitZoom);

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
    if (Math.abs(zoom - fitZoom) <= 3) {
      setZoom(100);
    } else {
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

  // Kenar çubukları (ThumbnailStrip / Sidebar) daraltıldığında veya açıldığında genişliğe sığdırmayı pürüzsüz güncelle
  useEffect(() => {
    if (!pdfMeta) return;
    const timer = setTimeout(() => {
      const fitZoom = getFitWidthZoom(pdfMeta, currentPage);
      if (Math.abs(zoomRef.current - fitZoom) <= 5) {
        handleFitToWidth(pdfMeta, currentPage);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [showThumbnails, isSidebarCollapsed]);

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

  // Ekrana yakın sayfaları (±800px tampon bölge) tespit eden Viewport Virtualization Observer
  useEffect(() => {
    if (!pdfMeta || !containerRef.current) return;

    const container = containerRef.current;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        setVisiblePages((prev) => {
          let hasChanges = false;
          const next = new Set(prev);
          for (const entry of entries) {
            const pageIdxStr = entry.target.getAttribute('data-page-index');
            if (pageIdxStr !== null) {
              const idx = parseInt(pageIdxStr, 10);
              if (!isNaN(idx)) {
                if (entry.isIntersecting) {
                  if (!next.has(idx)) {
                    next.add(idx);
                    hasChanges = true;
                  }
                } else {
                  if (next.has(idx)) {
                    next.delete(idx);
                    hasChanges = true;
                  }
                }
              }
            }
          }
          return hasChanges ? next : prev;
        });
      },
      {
        root: container,
        rootMargin: '800px 0px 800px 0px',
        threshold: 0,
      }
    );

    pageRefs.current.forEach((el) => {
      if (el) visibilityObserver.observe(el);
    });

    return () => {
      visibilityObserver.disconnect();
    };
  }, [pdfMeta?.path, pdfMeta?.total_pages, zoom]);

  // Sayfanın görünür veya viewport'a yakın (yüklenebilir) bölgede olup olmadığını belirle
  const isPageNearViewport = (pageIdx: number): boolean => {
    // 1. Aktif sayfa ve ±3 komşu sayfa daima aktif (scroll gecikmelerini ve sıçramaları önler)
    if (Math.abs(pageIdx - currentPage) <= 3) return true;
    // 2. IntersectionObserver (800px dikey tampon) tarafından tespit edilen sayfalar
    return visiblePages.has(pageIdx);
  };

  // Drag & Drop Olayları
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = Array.from(files).find(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (!file) {
      toast.error('Lütfen geçerli bir PDF dosyası (.pdf) bırakın.');
      return;
    }

    try {
      const filePath = await api.uploadFile(file);
      if (filePath) {
        await loadDocument(filePath);
        toast.success(`"${file.name}" başarıyla yüklendi.`);
      }
    } catch (err: any) {
      toast.error(`Dosya yüklenemedi: ${err.message}`);
    }
  };

  // Dosya Seçme
  const handleSelectFile = async () => {
    try {
      const chosen = await api.chooseFile('pdf');
      if (chosen) {
        await loadDocument(chosen);
      }
    } catch (err: any) {
      toast.error(`Dosya açılamadı: ${err.message}`);
    }
  };

  const loadDocument = async (filePath: string) => {
    try {
      const meta = await api.loadPDF(filePath);
      setPdfMeta(meta);
      setCurrentPage(0);
      setRedactions([]);
      clearHistory();
      setSelectedRedactionId(null);
      setWhitelist([]);
      setSaveStatus(null);
      setLoadedPages({});
      setVisiblePages(new Set([0, 1, 2, 3]));
      pageRefs.current = [];
      imageRefs.current = [];
      setTimeout(() => {
        handleFitToWidth(meta, 0);
      }, 80);
      await triggerScan(meta.path, DEFAULT_FILTERS, []);
      clearHistory();
    } catch (err: any) {
      toast.error(`PDF okunamadı: ${err.message}`);
    }
  };

  // Otomatik Tarama
  const triggerScan = async (path: string, currentFilters: FilterSettings, currentWhitelist: string[]) => {
    setIsScanning(true);
    try {
      const res = await api.scanPDF(path, currentFilters);
      if (res.is_scanned !== undefined) {
        setPdfMeta((prev) => prev ? {
          ...prev,
          is_scanned: res.is_scanned,
          has_text_layer: res.has_text_layer,
          total_chars: res.total_chars,
        } : prev);
      }
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
        toast.info(`"${searchTerm}" belgede bulunamadı.`);
      } else {
        const existingIds = new Set(redactions.map((r) => r.id));
        const newItems = res.entities.filter((item) => !existingIds.has(item.id));
        if (newItems.length > 0) {
          pushState((prev) => [...prev, ...newItems]);
        }
        setSearchTerm('');
        setSidebarTab('data');
      }
    } catch (err: any) {
      toast.error(`Arama hatası: ${err.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Redaksiyon onayını aç/kapat
  const toggleRedaction = (id: string) => {
    pushState((prev) =>
      prev.map((r) => (r.id === id ? { ...r, approved: !r.approved } : r))
    );
  };

  // Redaksiyonu listeden tamamen sil
  const removeRedaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedRedactionId === id) {
      setSelectedRedactionId(null);
    }
    pushState((prev) => prev.filter((r) => r.id !== id));
  };

  // Beyaz Listeye Ekle (Tüm Belgede Yoksay)
  const addToWhitelist = (value: string, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    const clean = value.trim();
    if (!clean) return;

    if (!whitelist.includes(clean)) {
      const newWl = [...whitelist, clean];
      setWhitelist(newWl);
      pushState((prev) =>
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
    pushState((prev) => prev.map((r) => ({ ...r, approved: true })));
  };

  // Tüm Belgedeki Varlıkların Onayını Kaldır
  const unapproveAllAcrossDocument = () => {
    pushState((prev) => prev.map((r) => ({ ...r, approved: false })));
  };

  // Kategoriye Özel Toplu Onayla
  const approveCategory = (category: string) => {
    pushState((prev) =>
      prev.map((r) => {
        const matchesScope = dataScope === 'all_pages' || r.page_number === currentPage;
        const matchesCat = (r.category || 'MANUEL') === category;
        return matchesScope && matchesCat ? { ...r, approved: true } : r;
      })
    );
  };

  // Kategoriye Özel Toplu Onayı Kaldır
  const unapproveCategory = (category: string) => {
    pushState((prev) =>
      prev.map((r) => {
        const matchesScope = dataScope === 'all_pages' || r.page_number === currentPage;
        const matchesCat = (r.category || 'MANUEL') === category;
        return matchesScope && matchesCat ? { ...r, approved: false } : r;
      })
    );
  };

  // Belirli bir sayfa görseli üzerindeki normalize koordinatı hesapla (0.0 - 1.0 arası)
  const getImageCoords = (clientX: number, clientY: number, pageIdx: number) => {
    const img = imageRefs.current[pageIdx] || pageRefs.current[pageIdx];
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

  // Manuel Çizim Başlangıcı (Pointer Down)
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

        pushState((prev) => [...prev, newItem]);
        setSelectedRedactionId(newItem.id);
        setCurrentPage(targetPage);
      }
    }

    handlePointerCancel();
  };

  // Yeniden Boyutlandırma (Resize Handles) Başlatıcı
  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: RedactionItem,
    pageIdx: number,
    handle: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    if (drawToolActive || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    setSelectedRedactionId(item.id);

    const initialRect: [number, number, number, number] = [...item.rect];
    const initialSnapshot = cloneRedactions(redactionsRef.current);
    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const pageInfo = pdfMeta?.pages[pageIdx];
    if (!pageInfo) return;

    const imgElem = imageRefs.current[pageIdx];
    const dpiScale = 140 / 72;
    const cardWidth = Math.round(pageInfo.width * dpiScale * (zoomRef.current / 100));
    const cardHeight = Math.round(pageInfo.height * dpiScale * (zoomRef.current / 100));
    const imgWidth = imgElem?.clientWidth || cardWidth;
    const imgHeight = imgElem?.clientHeight || cardHeight;
    const scaleX = imgWidth / pageInfo.width;
    const scaleY = imgHeight / pageInfo.height;

    let currentRect = [...initialRect] as [number, number, number, number];

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        hasMoved = true;
      }

      if (!hasMoved) return;

      const deltaPdfX = dx / scaleX;
      const deltaPdfY = dy / scaleY;

      let [x0, y0, x1, y1] = initialRect;

      if (handle === 'se') {
        x1 = Math.min(pageInfo.width, Math.max(x0 + 4, x1 + deltaPdfX));
        y1 = Math.min(pageInfo.height, Math.max(y0 + 4, y1 + deltaPdfY));
      } else if (handle === 'sw') {
        x0 = Math.max(0, Math.min(x1 - 4, x0 + deltaPdfX));
        y1 = Math.min(pageInfo.height, Math.max(y0 + 4, y1 + deltaPdfY));
      } else if (handle === 'ne') {
        x1 = Math.min(pageInfo.width, Math.max(x0 + 4, x1 + deltaPdfX));
        y0 = Math.max(0, Math.min(y1 - 4, y0 + deltaPdfY));
      } else if (handle === 'nw') {
        x0 = Math.max(0, Math.min(x1 - 4, x0 + deltaPdfX));
        y0 = Math.max(0, Math.min(y1 - 4, y0 + deltaPdfY));
      }

      currentRect = [x0, y0, x1, y1];

      setRedactions((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, rect: currentRect } : r))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (hasMoved) {
        pushState(
          (prev) =>
            prev.map((r) => (r.id === item.id ? { ...r, rect: currentRect } : r)),
          initialSnapshot
        );
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Redaksiyon Kutusunu Taşıma (Drag & Move) Başlatıcı
  const handleBoxPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    item: RedactionItem,
    pageIdx: number
  ) => {
    if (drawToolActive || e.button !== 0) return;
    e.stopPropagation();

    wasDraggedRef.current = false;
    const initialRect: [number, number, number, number] = [...item.rect];
    const initialSnapshot = cloneRedactions(redactionsRef.current);
    const startX = e.clientX;
    const startY = e.clientY;
    let hasMoved = false;

    const pageInfo = pdfMeta?.pages[pageIdx];
    if (!pageInfo) return;

    const imgElem = imageRefs.current[pageIdx];
    const dpiScale = 140 / 72;
    const cardWidth = Math.round(pageInfo.width * dpiScale * (zoomRef.current / 100));
    const cardHeight = Math.round(pageInfo.height * dpiScale * (zoomRef.current / 100));
    const imgWidth = imgElem?.clientWidth || cardWidth;
    const imgHeight = imgElem?.clientHeight || cardHeight;
    const scaleX = imgWidth / pageInfo.width;
    const scaleY = imgHeight / pageInfo.height;

    const w = initialRect[2] - initialRect[0];
    const h = initialRect[3] - initialRect[1];

    let currentRect = [...initialRect] as [number, number, number, number];

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        hasMoved = true;
        wasDraggedRef.current = true;
      }

      if (!hasMoved) return;

      const deltaPdfX = dx / scaleX;
      const deltaPdfY = dy / scaleY;

      const x0 = Math.max(0, Math.min(pageInfo.width - w, initialRect[0] + deltaPdfX));
      const y0 = Math.max(0, Math.min(pageInfo.height - h, initialRect[1] + deltaPdfY));
      const x1 = x0 + w;
      const y1 = y0 + h;

      currentRect = [x0, y0, x1, y1];

      setRedactions((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, rect: currentRect } : r))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (hasMoved) {
        setSelectedRedactionId(item.id);
        pushState(
          (prev) =>
            prev.map((r) => (r.id === item.id ? { ...r, rect: currentRect } : r)),
          initialSnapshot
        );
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Klavye Kısayolları (ESC, Arrow Nudge 2pt, Delete/Backspace, Hızlı İnceleme Speed-Run)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Form alanlarında (input, textarea, select, contenteditable) yazı yazılırken kısayolları kesinlikle engelle
      const target = e.target as HTMLElement | null;
      const isInputActive = Boolean(
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)) ||
        (document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT' ||
            (document.activeElement as HTMLElement).isContentEditable))
      );

      if (isInputActive) {
        return;
      }

      // ESC: Çizimi veya seçimi iptal et
      if (e.key === 'Escape') {
        if (isDrawing) {
          handlePointerCancel();
        } else if (drawToolActive) {
          setDrawToolActive(false);
        } else if (selectedRedactionIdRef.current) {
          selectedRedactionIdRef.current = null;
          setSelectedRedactionId(null);
        }
        return;
      }

      // Kutu seçiliyken klavye yön tuşlarıyla (Arrow keys) kutuyu 2pt kaydırma (nudge) desteği
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) &&
        selectedRedactionIdRef.current &&
        !drawToolActive
      ) {
        const item = redactionsRef.current.find((r) => r.id === selectedRedactionIdRef.current);
        if (!item || !pdfMeta) return;

        const pageInfo = pdfMeta.pages[item.page_number];
        if (!pageInfo) return;

        e.preventDefault();

        const step = e.shiftKey ? 10 : 2; // 2pt standart, Shift ile 10pt
        let dx = 0;
        let dy = 0;

        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;

        const [x0, y0, x1, y1] = item.rect;
        const w = x1 - x0;
        const h = y1 - y0;

        const newX0 = Math.max(0, Math.min(pageInfo.width - w, x0 + dx));
        const newY0 = Math.max(0, Math.min(pageInfo.height - h, y0 + dy));
        const newX1 = newX0 + w;
        const newY1 = newY0 + h;

        pushState((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, rect: [newX0, newY0, newX1, newY1] } : r
          )
        );
        return;
      }

      // Seçili kutuyu klavyeden silme (Delete / Backspace)
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedRedactionIdRef.current &&
        !drawToolActive
      ) {
        e.preventDefault();
        const idToDelete = selectedRedactionIdRef.current;
        selectedRedactionIdRef.current = null;
        setSelectedRedactionId(null);
        pushState((prev) => prev.filter((r) => r.id !== idToDelete));
        return;
      }

      // Modifier tuş kombinasyonları (Ctrl/Cmd/Alt) sistem veya Undo/Redo tarafından yönetilir
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Çizim aracı aktifken veya PDF yokken hızlı inceleme kısayollarını çalıştırma
      if (drawToolActive || !pdfMeta) {
        return;
      }

      // Belgedeki tüm sansür kutularını sayfa ve dikey konuma göre sırala (Speed-Run Akışı)
      const getSortedRedactions = () => {
        return [...redactionsRef.current].sort((a, b) => {
          if (a.page_number !== b.page_number) return a.page_number - b.page_number;
          if (Math.abs(a.rect[1] - b.rect[1]) > 5) return a.rect[1] - b.rect[1];
          return a.rect[0] - b.rect[0];
        });
      };

      // [J] veya [Tab]: Bir sonraki sansür kutusuna odaklan, sayfayı kaydır ve vurgula
      const isNext = e.key === 'j' || e.key === 'J' || (e.key === 'Tab' && !e.shiftKey);
      if (isNext) {
        e.preventDefault();
        const sorted = getSortedRedactions();
        if (sorted.length === 0) return;

        const currentId = selectedRedactionIdRef.current;
        const currentIdx = sorted.findIndex((r) => r.id === currentId);

        let nextIdx = 0;
        if (currentIdx === -1) {
          const onPageIdx = sorted.findIndex((r) => r.page_number >= currentPageRef.current);
          nextIdx = onPageIdx !== -1 ? onPageIdx : 0;
        } else {
          nextIdx = (currentIdx + 1) % sorted.length;
        }

        const target = sorted[nextIdx];
        selectedRedactionIdRef.current = target.id;
        setSelectedRedactionId(target.id);
        scrollToPage(target.page_number);
        return;
      }

      // [K] veya [Shift+Tab]: Bir önceki sansür kutusuna odaklan ve sayfayı kaydır
      const isPrev = e.key === 'k' || e.key === 'K' || (e.key === 'Tab' && e.shiftKey);
      if (isPrev) {
        e.preventDefault();
        const sorted = getSortedRedactions();
        if (sorted.length === 0) return;

        const currentId = selectedRedactionIdRef.current;
        const currentIdx = sorted.findIndex((r) => r.id === currentId);

        let prevIdx = 0;
        if (currentIdx === -1) {
          const onPageIdx = sorted.findIndex((r) => r.page_number >= currentPageRef.current);
          prevIdx = onPageIdx > 0 ? onPageIdx - 1 : sorted.length - 1;
        } else {
          prevIdx = (currentIdx - 1 + sorted.length) % sorted.length;
        }

        const target = sorted[prevIdx];
        selectedRedactionIdRef.current = target.id;
        setSelectedRedactionId(target.id);
        scrollToPage(target.page_number);
        return;
      }

      // [Space] (Boşluk): Odaklanılmış kutunun onay durumunu tersine çevir
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const sorted = getSortedRedactions();
        if (sorted.length === 0) return;

        let currentId = selectedRedactionIdRef.current;
        if (!currentId) {
          const onPageIdx = sorted.findIndex((r) => r.page_number >= currentPageRef.current);
          const target = sorted[onPageIdx !== -1 ? onPageIdx : 0];
          currentId = target.id;
          selectedRedactionIdRef.current = target.id;
          setSelectedRedactionId(target.id);
          scrollToPage(target.page_number);
        }

        if (currentId) {
          toggleRedaction(currentId);
        }
        return;
      }

      // [W] veya [w]: Odaklanılmış kutudaki kelimeyi beyaz listeye ekle (Tüm belgede muaf tut)
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        const currentId = selectedRedactionIdRef.current;
        if (!currentId) {
          toast.info('Beyaz listeye eklemek için önce bir kutu seçin [J / K].');
          return;
        }

        const item = redactionsRef.current.find((r) => r.id === currentId);
        if (!item || !item.value || item.category === 'MANUEL') {
          if (item && item.category === 'MANUEL') {
            toast.info('Manuel çizilen bantlar kelime içermez. Kaldırmak için Delete tuşuna basın.');
          }
          return;
        }

        const cleanWord = item.value.trim();
        addToWhitelist(cleanWord);
        toast.success(`"${cleanWord}" beyaz listeye eklendi ve muaf tutuldu.`);

        const remaining = redactionsRef.current
          .filter((r) => !r.value.toLowerCase().includes(cleanWord.toLowerCase()))
          .sort((a, b) => {
            if (a.page_number !== b.page_number) return a.page_number - b.page_number;
            if (Math.abs(a.rect[1] - b.rect[1]) > 5) return a.rect[1] - b.rect[1];
            return a.rect[0] - b.rect[0];
          });

        if (remaining.length > 0) {
          const nextTarget = remaining.find((r) => r.page_number >= item.page_number) || remaining[0];
          selectedRedactionIdRef.current = nextTarget.id;
          setSelectedRedactionId(nextTarget.id);
          scrollToPage(nextTarget.page_number);
        } else {
          selectedRedactionIdRef.current = null;
          setSelectedRedactionId(null);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawing, drawToolActive, pdfMeta, pushState, setSelectedRedactionId, scrollToPage, toggleRedaction, addToWhitelist, toast]);

  // Global Klavye Kısayolları (Ctrl+Z: Geri Al, Ctrl+Y / Ctrl+Shift+Z: İleri Al)
  useEffect(() => {
    const handleUndoRedoKeyDown = (e: KeyboardEvent) => {
      // Form inputlarında arama yaparken inputun kendi Ctrl+Z'sini bozmamak için input odaklıyken engelle
      const target = e.target as HTMLElement | null;
      const isInputActive = Boolean(
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)) ||
        (document.activeElement &&
          (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA' ||
            document.activeElement.tagName === 'SELECT' ||
            (document.activeElement as HTMLElement).isContentEditable))
      );

      if (isInputActive) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;

      const key = e.key.toLowerCase();

      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleUndoRedoKeyDown);
    return () => window.removeEventListener('keydown', handleUndoRedoKeyDown);
  }, [undo, redo]);

  // Kalıcı Redaksiyonu Kaydet
  const handleSaveRedactedPDF = async () => {
    if (!pdfMeta) return;

    const approvedList = redactions.filter((r) => r.approved);
    if (approvedList.length === 0) {
      toast.warning('Lütfen en az bir sansürlenecek alan seçin.');
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
      toast.success('Belge başarıyla kaydedildi!');
    } catch (err: any) {
      toast.error(`Kaydetme hatası: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const totalApproved = redactions.filter((r) => r.approved).length;

  return (
    <div className="h-screen flex flex-col bg-[#F4EFEA] text-[#121316] overflow-hidden">
      {/* Top Navigation Bar */}
      <Toolbar
        onBackToHub={onBackToHub}
        pdfMeta={pdfMeta}
        currentPage={currentPage}
        totalApproved={totalApproved}
        zoom={zoom}
        isScanning={isScanning}
        isSaving={isSaving}
        drawToolActive={drawToolActive}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onPrevPage={() => scrollToPage(Math.max(0, currentPage - 1))}
        onNextPage={() => scrollToPage(Math.min(pdfMeta ? pdfMeta.total_pages - 1 : 0, currentPage + 1))}
        onScrollToCurrentPage={() => scrollToPage(currentPage)}
        onZoomIn={() => {
          setZoom((z) => Math.min(250, z + 10));
          setShowZoomBadge(true);
          if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
          zoomBadgeTimeoutRef.current = setTimeout(() => setShowZoomBadge(false), 1200);
        }}
        onZoomOut={() => {
          setZoom((z) => Math.max(35, z - 10));
          setShowZoomBadge(true);
          if (zoomBadgeTimeoutRef.current) clearTimeout(zoomBadgeTimeoutRef.current);
          zoomBadgeTimeoutRef.current = setTimeout(() => setShowZoomBadge(false), 1200);
        }}
        onToggleFitOrFull={handleToggleFitOrFull}
        onToggleDrawTool={() => setDrawToolActive(!drawToolActive)}
        onRescan={() => pdfMeta && triggerScan(pdfMeta.path, filters, whitelist)}
        onSave={handleSaveRedactedPDF}
        showThumbnails={showThumbnails}
        onToggleThumbnails={() => setShowThumbnails((prev) => !prev)}
      />

      {/* Adli Güvenlik Uyarı Banner'ı (Taranmış / Görsel Evrak) */}
      <AnimatePresence>
        {pdfMeta && (pdfMeta.is_scanned || pdfMeta.has_text_layer === false) && !dismissScannedWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#FEF08A] border-b-2 border-[#121316] px-4 py-2.5 z-20 shrink-0 brutal-shadow-sm select-none"
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-[#121316] font-bold leading-snug">
                <span>⚠️ Adli Güvenlik Uyarısı: Bu belgede dijital metin katmanı tespit edilemedi (Taranmış / Görsel Evrak). Otomatik KVKK taraması yapılamamıştır. Hassas verileri kapatmak için lütfen araç çubuğundaki 'Bant Çekme Modu'nu kullanın.</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!drawToolActive && (
                  <button
                    onClick={() => setDrawToolActive(true)}
                    className="brutal-btn px-2.5 py-1 bg-[#121316] text-white hover:bg-[#1E3A8A] text-xs font-bold shrink-0 transition-colors hidden sm:inline-flex items-center gap-1.5"
                    title="Bant Çekme Modu'nu Etkinleştir"
                  >
                    Bant Çekme Modu'nu Aç
                  </button>
                )}
                <button
                  onClick={() => setDismissScannedWarning(true)}
                  className="p-1 hover:bg-[#FDE047] rounded-sm border border-[#121316] bg-white text-[#121316] brutal-shadow-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer flex items-center justify-center"
                  title="Uyarıyı Kapat"
                  aria-label="Uyarıyı Kapat"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace Area */}
      {!pdfMeta ? (
        /* Single Expansive Drag & Drop Zone (Boş Durum) */
        <div
          className="flex-1 flex items-center justify-center p-8"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`max-w-2xl w-full brutal-card p-12 text-center bg-[#FFFFFF] cursor-pointer transition-all border-2 border-dashed ${
              isDragging
                ? 'border-[#1E3A8A] bg-[#1E3A8A]/5 ring-4 ring-[#1E3A8A]/20'
                : 'border-[#121316] hover:border-[#1E3A8A]'
            }`}
            onClick={handleSelectFile}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`w-20 h-20 border-2 flex items-center justify-center mx-auto mb-6 brutal-shadow-sm transition-colors ${
              isDragging ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-[#F4EFEA] border-[#121316] text-[#121316]'
            }`}>
              <Upload className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black text-[#121316] mb-2">
              {isDragging ? 'PDF Belgesini Buraya Bırakın' : 'Anonimleştirilecek PDF Belgesini Seçin'}
            </h3>
            <p className="text-sm text-[#575A65] max-w-md mx-auto mb-6 font-medium">
              Dava dilekçesi, delil listesi veya mahkeme kararını seçin. Dosyayı buraya sürükleyip bırakabilir veya tıklayabilirsiniz.
            </p>

            <button className="brutal-btn py-3.5 px-8 bg-[#121316] text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-[#1E3A8A] transition-colors">
              <FolderOpen className="w-4 h-4" />
              <span>Bilgisayarımdan Dosya Seç</span>
            </button>
          </motion.div>
        </div>
      ) : (
        /* Active Redaction Split Workspace */
        <div className="flex-1 flex overflow-hidden">
          {/* Sol: ThumbnailStrip (Sayfa Gezgini Şeridi) */}
          <AnimatePresence initial={false}>
            {showThumbnails && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 130, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden shrink-0 h-full flex"
              >
                <ThumbnailStrip
                  pdfMeta={pdfMeta}
                  currentPage={currentPage}
                  redactions={redactions}
                  onScrollToPage={scrollToPage}
                  onClose={() => setShowThumbnails(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center: PDF Continuous Vertical Scroll Canvas Viewer */}
          <div
            ref={containerRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedRedactionId(null);
              }
            }}
            className={`flex-1 bg-[#22242A] overflow-auto p-6 relative select-none transition-all ${
              drawToolActive ? 'cursor-crosshair' : 'cursor-default'
            } ${isDragging ? 'outline-4 outline-dashed outline-[#1E3A8A] -outline-offset-8' : ''}`}
          >
            <div className="flex flex-col items-center w-full">
              {pdfMeta.pages.map((pageInfo, pageIdx) => {
                const dpiScale = 140 / 72;
                const baseWidth = pageInfo.width * dpiScale;
                const baseHeight = pageInfo.height * dpiScale;
                const cardWidth = Math.round(baseWidth * (zoom / 100));
                const cardHeight = Math.round(baseHeight * (zoom / 100));
                const pageRedactions = redactions.filter((r) => r.page_number === pageIdx);
                const isNear = isPageNearViewport(pageIdx);

                return (
                  <div
                    key={`page_${pageIdx}`}
                    ref={(el) => {
                      pageRefs.current[pageIdx] = el;
                    }}
                    data-page-index={pageIdx}
                    className="relative brutal-card bg-white mx-auto shrink-0 select-none transition-all duration-75 mb-8 shadow-[0_4px_20px_rgba(0,0,0,0.35)] !shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                    style={{
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                    }}
                    onDoubleClick={() => !drawToolActive && handleToggleFitOrFull()}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) {
                        setSelectedRedactionId(null);
                      }
                    }}
                  >
                    {/* Sayfa Numarası Rozeti (Sol Üst) */}
                    <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-[#121316] text-[#F4EFEA] border border-white/20 text-[10px] font-mono font-bold select-none pointer-events-none brutal-shadow-sm">
                      Sayfa {pageIdx + 1} / {pdfMeta.total_pages}
                    </div>

                    {isNear ? (
                      <>
                        {/* Sayfa Yükleniyor Göstergesi */}
                        {!loadedPages[pageIdx] && (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#F4EFEA]/40 pointer-events-none z-0">
                            <div className="flex items-center gap-2 text-xs text-[#575A65] font-mono font-bold">
                              <span className="w-3.5 h-3.5 border-2 border-[#121316] border-t-transparent rounded-full animate-spin" />
                              <span>Sayfa {pageIdx + 1} yükleniyor...</span>
                            </div>
                          </div>
                        )}

                        {/* PDF Sayfa Görseli */}
                        <img
                          ref={(el) => {
                            imageRefs.current[pageIdx] = el;
                            if (el && el.complete && !loadedPages[pageIdx]) {
                              setLoadedPages((prev) => ({ ...prev, [pageIdx]: true }));
                            }
                          }}
                          src={api.getPageImageUrl(pdfMeta.path, pageIdx, 140)}
                          alt={`Sayfa ${pageIdx + 1}`}
                          loading="eager"
                          decoding="async"
                          onLoad={() => {
                            setLoadedPages((prev) => ({ ...prev, [pageIdx]: true }));
                          }}
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.retried) {
                              target.dataset.retried = 'true';
                              setTimeout(() => {
                                target.src = api.getPageImageUrl(pdfMeta.path, pageIdx, 140) + `&retry=${Date.now()}`;
                              }, 500);
                            }
                          }}
                          className="w-full h-full block pointer-events-none select-none relative z-0"
                          style={{ display: 'block', width: '100%', height: '100%' }}
                        />

                        {/* Redaksiyon Kutucukları Overlay - Her zaman üst katmanda (z-20) ve anında görünür */}
                        <div className="absolute inset-0 pointer-events-none z-20">
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
                                // Siyah Kutu (hover ile kelimeyi incelemek için hafif şeffaflaşır)
                                boxStyle = 'bg-[#121316] border-[#121316] shadow-sm hover:bg-[#121316]/70';
                                textStyle = 'text-white';
                              } else {
                                // Beyaz Kutu
                                boxStyle = 'bg-[#FFFFFF] border-2 border-[#121316] shadow-sm hover:bg-white/70';
                                textStyle = 'text-[#121316]';
                              }
                            } else {
                              boxStyle = 'bg-[#1E3A8A]/10 border-2 border-dashed border-[#1E3A8A] opacity-60 hover:opacity-100 hover:bg-[#1E3A8A]/25';
                              textStyle = 'text-[#1E3A8A]';
                            }

                            const isHovered = hoveredRedactionId === item.id;
                            const isSelected = selectedRedactionId === item.id;
                            const showHandles = !drawToolActive && (isSelected || isHovered);

                            return (
                              <div
                                key={item.id}
                                onMouseEnter={() => setHoveredRedactionId(item.id)}
                                onMouseLeave={() => setHoveredRedactionId(null)}
                                onPointerDown={(e) => handleBoxPointerDown(e, item, pageIdx)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (wasDraggedRef.current) {
                                    wasDraggedRef.current = false;
                                    return;
                                  }
                                  setSelectedRedactionId(item.id);
                                  toggleRedaction(item.id);
                                }}
                                title={`${catName}: ${item.value || '(Seçili Alan)'} (Taşımak için sürükleyin, durumu değiştirmek için tıklayın)`}
                                className={`group absolute pointer-events-auto transition-[background-color,border-color,box-shadow,opacity] flex items-center justify-center overflow-visible ${boxStyle} ${
                                  drawToolActive
                                    ? 'cursor-crosshair'
                                    : (isSelected || isHovered)
                                    ? 'cursor-move'
                                    : 'cursor-pointer'
                                } ${
                                  isSelected
                                    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-white shadow-[0_0_18px_rgba(245,158,11,0.75)] z-30 animate-pulse'
                                    : isHovered
                                    ? 'ring-2 ring-[#1E3A8A] ring-offset-1 z-30'
                                    : ''
                                }`}
                                style={{
                                  left: `${left}px`,
                                  top: `${top}px`,
                                  width: `${Math.max(width, 14)}px`,
                                  height: `${Math.max(height, 14)}px`,
                                }}
                              >
                                {item.approved ? (
                                  <span className={`text-[9px] font-black tracking-wider uppercase select-none truncate px-0.5 pointer-events-none ${textStyle}`}>
                                    {redactionOverlay === 'redacted' ? '[SANSÜRLENDİ]' : ''}
                                  </span>
                                ) : (
                                  <div className="w-1.5 h-1.5 bg-[#1E3A8A] rounded-full pointer-events-none" />
                                )}

                                {/* Uçan Önizleme Bilgi Kartı (Hover & Select Tooltip) */}
                                <div className={`transition-all duration-150 pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-[#121316] text-[#F4EFEA] text-[10px] font-bold px-2 py-1 rounded shadow-2xl whitespace-nowrap z-50 border border-white/20 flex items-center gap-1.5 ${
                                  isSelected || isHovered
                                    ? 'opacity-100 scale-100'
                                    : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
                                }`}>
                                  <span className="text-[9px] px-1 py-0.2 bg-[#1E3A8A] text-white font-mono rounded">
                                    {catName}
                                  </span>
                                  <span className="max-w-[200px] truncate">{item.value || '(Seçili Alan)'}</span>
                                  <span className={`text-[9px] font-mono font-bold ${item.approved ? 'text-emerald-400' : 'text-amber-300'}`}>
                                    ({item.approved ? 'Sansürlenecek' : 'Hariç'})
                                  </span>
                                  <span className="text-[9px] font-mono text-zinc-400 pl-1 border-l border-white/20">
                                    {Math.round(item.rect[2] - item.rect[0])}×{Math.round(item.rect[3] - item.rect[1])} pt
                                  </span>
                                </div>

                                {/* 4 Köşe Neo-Brutalist Boyutlandırma Tutamakları (Resize Handles) */}
                                {showHandles && (
                                  <>
                                    {/* Sol-Üst */}
                                    <div
                                      onPointerDown={(e) => handleResizePointerDown(e, item, pageIdx, 'nw')}
                                      title="Boyutlandır: Sol-Üst"
                                      className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center cursor-nwse-resize z-40 select-none group/handle touch-none"
                                    >
                                      <div className="w-[6px] h-[6px] bg-white border border-[#121316] shadow-[1px_1px_0px_#121316] group-hover/handle:scale-125 transition-transform" />
                                    </div>

                                    {/* Sağ-Üst */}
                                    <div
                                      onPointerDown={(e) => handleResizePointerDown(e, item, pageIdx, 'ne')}
                                      title="Boyutlandır: Sağ-Üst"
                                      className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center cursor-nesw-resize z-40 select-none group/handle touch-none"
                                    >
                                      <div className="w-[6px] h-[6px] bg-white border border-[#121316] shadow-[1px_1px_0px_#121316] group-hover/handle:scale-125 transition-transform" />
                                    </div>

                                    {/* Sol-Alt */}
                                    <div
                                      onPointerDown={(e) => handleResizePointerDown(e, item, pageIdx, 'sw')}
                                      title="Boyutlandır: Sol-Alt"
                                      className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center cursor-nesw-resize z-40 select-none group/handle touch-none"
                                    >
                                      <div className="w-[6px] h-[6px] bg-white border border-[#121316] shadow-[1px_1px_0px_#121316] group-hover/handle:scale-125 transition-transform" />
                                    </div>

                                    {/* Sağ-Alt */}
                                    <div
                                      onPointerDown={(e) => handleResizePointerDown(e, item, pageIdx, 'se')}
                                      title="Boyutlandır: Sağ-Alt"
                                      className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 flex items-center justify-center cursor-nwse-resize z-40 select-none group/handle touch-none"
                                    >
                                      <div className="w-[6px] h-[6px] bg-white border border-[#121316] shadow-[1px_1px_0px_#121316] group-hover/handle:scale-125 transition-transform" />
                                    </div>
                                  </>
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
                      </>
                    ) : (
                      /* Uzak Sayfa Hafif Placeholder (Lazy Load / Viewport Virtualization) */
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAF9] text-[#71717A] select-none p-6 border border-dashed border-[#D4D4D8]/60">
                        <div className="w-12 h-12 rounded border border-[#121316]/20 bg-[#F4EFEA] flex items-center justify-center mb-3 brutal-shadow-sm text-[#121316]">
                          <FileText className="w-6 h-6 stroke-[1.8]" />
                        </div>
                        <div className="text-sm font-black text-[#121316] mb-0.5">
                          Sayfa {pageIdx + 1}
                        </div>
                        <div className="text-[11px] font-mono text-[#71717A] mb-2">
                          {Math.round(pageInfo.width)} × {Math.round(pageInfo.height)} pt
                        </div>
                        {pageRedactions.length > 0 && (
                          <div className="mb-2 px-2 py-0.5 bg-[#FEF08A] text-[#121316] border border-[#121316] text-[10px] font-mono font-bold brutal-shadow-sm">
                            {pageRedactions.length} tespit edilen veri
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#A1A1AA] mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" />
                          <span>Kaydırıldığında yüklenir</span>
                        </div>
                      </div>
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
                  <span>%{Math.round(zoom)}</span>
                  <span className="text-[10px] text-[#A0A2AA] font-normal pl-1 border-l border-white/20">
                    {Math.abs(zoom - getFitWidthZoom()) <= 3 ? 'Genişliğe Sığdırıldı' : 'Sığdırmak için tıkla'}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hızlı Klavye İnceleme Modu ("Speed-Run / Tinder for Redactions") Rozeti */}
            <AnimatePresence>
              {showSpeedRunBadge ? (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 0.9, y: 0 }}
                  whileHover={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 15 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-6 left-8 z-40 bg-[#121316]/90 backdrop-blur-md text-[#F4EFEA] px-4 py-2 rounded-xl border border-white/20 shadow-2xl flex items-center gap-3 select-none text-xs transition-opacity"
                >
                  <div className="flex items-center gap-1.5 font-black text-amber-400 tracking-wide shrink-0">
                    <Zap className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
                    <span>Hızlı İnceleme:</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#E4E4E7]">
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/15 border border-white/30 rounded text-amber-300 shadow-sm">J</kbd>
                      <span className="text-zinc-300">Sonraki</span>
                    </span>
                    <span className="text-white/30">|</span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/15 border border-white/30 rounded text-amber-300 shadow-sm">K</kbd>
                      <span className="text-zinc-300">Önceki</span>
                    </span>
                    <span className="text-white/30">|</span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/15 border border-white/30 rounded text-amber-300 shadow-sm">Space</kbd>
                      <span className="text-zinc-300">Onayla/Kaldır</span>
                    </span>
                    <span className="text-white/30">|</span>
                    <span className="flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white/15 border border-white/30 rounded text-amber-300 shadow-sm">W</kbd>
                      <span className="text-zinc-300">Muaf Tut</span>
                    </span>
                  </div>

                  <button
                    onClick={() => setShowSpeedRunBadge(false)}
                    className="ml-1 p-1 text-white/50 hover:text-white hover:bg-white/15 rounded transition-colors cursor-pointer"
                    title="İpucunu Kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  whileHover={{ opacity: 1 }}
                  onClick={() => setShowSpeedRunBadge(true)}
                  className="absolute bottom-6 left-8 z-40 bg-[#121316]/80 backdrop-blur-sm text-[#A0A2AA] hover:text-white px-2.5 py-1.5 rounded-lg border border-white/15 shadow-lg text-[11px] font-mono flex items-center gap-1.5 cursor-pointer transition-all"
                  title="Hızlı İnceleme Kısayollarını Göster"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚡ Hızlı İnceleme [J, K, Space, W]</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Right Sidebar: Controls & Entity Management */}
          <Sidebar
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            dataScope={dataScope}
            setDataScope={setDataScope}
            currentPage={currentPage}
            pdfMeta={pdfMeta}
            redactions={redactions}
            whitelist={whitelist}
            filters={filters}
            setFilters={setFilters}
            redactionColor={redactionColor}
            setRedactionColor={setRedactionColor}
            redactionOverlay={redactionOverlay}
            setRedactionOverlay={setRedactionOverlay}
            isScanning={isScanning}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isSearching={isSearching}
            onSearch={handleSearchText}
            onApproveAll={approveAllAcrossDocument}
            onUnapproveAll={unapproveAllAcrossDocument}
            onSelectAllFilters={selectAllFilters}
            onDeselectAllFilters={deselectAllFilters}
            onToggleFilter={toggleFilter}
            onRescan={() => pdfMeta && triggerScan(pdfMeta.path, filters, whitelist)}
            onToggleRedactionApproval={toggleRedaction}
            onRemoveRedaction={removeRedaction}
            onAddToWhitelist={addToWhitelist}
            onRemoveFromWhitelist={removeFromWhitelist}
            onScrollToPage={scrollToPage}
            hoveredRedactionId={hoveredRedactionId}
            setHoveredRedactionId={setHoveredRedactionId}
            selectedRedactionId={selectedRedactionId}
            setSelectedRedactionId={setSelectedRedactionId}
            saveStatus={saveStatus}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            onApproveCategory={approveCategory}
            onUnapproveCategory={unapproveCategory}
          />
        </div>
      )}
    </div>
  );
};
