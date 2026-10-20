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
import { api } from '../../api';
import { useRedactorState, DEFAULT_FILTERS, CATEGORY_NAMES } from './hooks/useRedactorState';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';

import { FilterSettings, PDFMeta, RedactionItem } from '../../types';

interface RedactorWorkspaceProps {
  onBackToHub: () => void;
}



export const RedactorWorkspace: React.FC<RedactorWorkspaceProps> = ({ onBackToHub }) => {
  const {
    pdfMeta, setPdfMeta, currentPage, setCurrentPage, zoom, setZoom, filters, setFilters,
    redactions, setRedactions, whitelist, setWhitelist, isScanning, setIsScanning,
    isSaving, setIsSaving, saveStatus, setSaveStatus, searchTerm, setSearchTerm,
    isSearching, setIsSearching, redactionColor, setRedactionColor, redactionOverlay,
    setRedactionOverlay, sidebarTab, setSidebarTab, dataScope, setDataScope,
    loadedPages, setLoadedPages, drawToolActive, setDrawToolActive, drawingPage,
    setDrawingPage, isDrawing, setIsDrawing, normStart, setNormStart, normCurrent,
    setNormCurrent, showZoomBadge, setShowZoomBadge, zoomBadgeTimeoutRef, zoomRef,
    pageRefs, imageRefs, containerRef
  } = useRedactorState();

  zoomRef.current = zoom;

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
      <Toolbar
        onBack={onBackToHub}
        onSelectFile={handleSelectFile}
        pdfMeta={pdfMeta}
        onSearch={handleSearchText}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        isSearching={isSearching}
        zoom={zoom}
        onZoomIn={() => setZoom(Math.min(zoom + 10, 200))}
        onZoomOut={() => setZoom(Math.max(zoom - 10, 20))}
        onFitWidth={() => handleFitToWidth()}
        drawToolActive={drawToolActive}
        onToggleDrawTool={() => setDrawToolActive(!drawToolActive)}
        onSave={handleSaveRedactedPDF}
        isSaving={isSaving}
        onToggleSidebar={() => {}}
        sidebarVisible={true}
      />

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
          onScan={() => {
            if (pdfMeta) {
              triggerScan(pdfMeta.path, filters, whitelist);
            }
          }}
          onSelectDirectory={() => api.chooseDirectory().then((res) => { if (res) api.openDirectory(res); })}
          saveStatus={saveStatus}
          toggleRedactionApproval={toggleRedaction}
          removeRedaction={(id) => removeRedaction(id, {} as any)}
          addToWhitelist={(val) => addToWhitelist(val, {} as any)}
          removeFromWhitelist={removeFromWhitelist}
        />
        </div>
      )}
    </div>
  );
};
