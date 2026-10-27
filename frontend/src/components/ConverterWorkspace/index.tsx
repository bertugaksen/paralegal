import React, { useState, useEffect, useMemo } from 'react';
import { useConverterState } from './hooks/useConverterState';

import {
  ArrowLeft,
  FileImage,
  FileSpreadsheet,
  FileText,
  Table,
  Sliders,
  Check,
  Trash2,
  FolderOpen,
  ArrowRight,
  Layers,
  FilePlus,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Shield,
  AlertCircle,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../api';
import { useToast } from '../../context/ToastContext';

interface ConverterWorkspaceProps {
  onBackToHub: () => void;
}

export const ConverterWorkspace: React.FC<ConverterWorkspaceProps> = ({ onBackToHub }) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);

  // Sürükle-Bırak Satır Yeniden Sıralama Durumu
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Dosya Boyutları Önbelleği
  const [fileSizes, setFileSizes] = useState<Record<string, { size_bytes: number; size_formatted: string }>>({});
  const [isLoadingSizes, setIsLoadingSizes] = useState<boolean>(false);

  const SUPPORTED_CONVERTER_EXTENSIONS = [
    '.docx', '.doc', '.xlsx', '.xls',
    '.tiff', '.tif', '.jpeg', '.jpg', '.png', '.bmp', '.webp', '.pdf'
  ];

  const handleDragOver = (e: React.DragEvent) => {
    // Dahili liste sıralaması sürükleniyorsa harici dosya alanını tetikleme
    if (draggedIndex !== null || e.dataTransfer.types.includes('application/x-paralegal-reorder')) {
      return;
    }
    if (e.dataTransfer.types && !Array.from(e.dataTransfer.types).includes('Files')) {
      return;
    }
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

  const handleDropFiles = async (e: React.DragEvent) => {
    if (draggedIndex !== null || e.dataTransfer.types.includes('application/x-paralegal-reorder')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const rawFiles = Array.from(files);
    const validFiles = rawFiles.filter((f) => {
      const lower = f.name.toLowerCase();
      return SUPPORTED_CONVERTER_EXTENSIONS.some((ext) => lower.endsWith(ext));
    });

    if (validFiles.length === 0) {
      toast.error('Lütfen geçerli formatta dosya bırakın (Word, Excel, TIFF, JPEG, PNG, WEBP, PDF).');
      return;
    }

    try {
      const paths = await Promise.all(validFiles.map((file) => api.uploadFile(file)));
      const cleanPaths = paths.filter((p): p is string => Boolean(p));
      if (cleanPaths.length > 0) {
        setSelectedPaths((prev) => Array.from(new Set([...prev, ...cleanPaths])));
        setResultMessage(null);
        toast.success(`${cleanPaths.length} adet dosya başarıyla eklendi.`);
      }
    } catch (err: any) {
      toast.error(`Dosyalar yüklenirken hata oluştu: ${err.message}`);
    }
  };
  const {
    selectedPaths, setSelectedPaths,
    rotations, setRotations,
    combineIntoOne, setCombineIntoOne,
    excelOrientation, setExcelOrientation,
    fitAllColumns, setFitAllColumns,
    repeatHeaderRow, setRepeatHeaderRow,
    targetDirectory, setTargetDirectory,
    isConverting, setIsConverting,
    resultMessage, setResultMessage
  } = useConverterState();

  const hasExcelFiles = selectedPaths.some((p) => /\.(xlsx|xls)$/i.test(p));

  // Dosya Boyutlarını Arka Plandan Çek
  useEffect(() => {
    if (selectedPaths.length === 0) {
      setFileSizes({});
      return;
    }

    const missingPaths = selectedPaths.filter((p) => !fileSizes[p]);
    if (missingPaths.length === 0) {
      return;
    }

    let isMounted = true;
    setIsLoadingSizes(true);
    api.getFileSizes(missingPaths)
      .then((results) => {
        if (!isMounted) return;
        setFileSizes((prev) => {
          const next = { ...prev };
          results.forEach((item) => {
            next[item.path] = {
              size_bytes: item.size_bytes,
              size_formatted: item.size_formatted,
            };
          });
          return next;
        });
      })
      .catch((err) => {
        console.error('Dosya boyutları yüklenemedi:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSizes(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPaths]);

  // Toplam Boyut ve UYAP Sınırı Hesaplama
  const totalSizeBytes = useMemo(() => {
    return selectedPaths.reduce((acc, p) => acc + (fileSizes[p]?.size_bytes || 0), 0);
  }, [selectedPaths, fileSizes]);

  const totalSizeMB = totalSizeBytes / (1024 * 1024);
  const formattedTotalMB = totalSizeMB >= 1
    ? `${totalSizeMB.toFixed(1)} MB`
    : totalSizeMB >= 0.05
      ? `${totalSizeMB.toFixed(2)} MB`
      : `${totalSizeMB.toFixed(1)} MB`;

  const isNearUyapLimit = totalSizeMB > 9.5;


  // Dosya Seçim Dialogu
  const handleSelectFiles = async () => {
    try {
      const paths = await api.chooseFiles();
      if (paths && paths.length > 0) {
        // Tekrarsız ekle
        const set = new Set([...selectedPaths, ...paths]);
        const updated = Array.from(set);
        setSelectedPaths(updated);
        setResultMessage(null);
      }
    } catch (err: any) {
      toast.error(`Dosya seçimi başarısız: ${err.message}`);
    }
  };

  // Listeden dosya kaldır
  const removeFile = (idx: number) => {
    const target = selectedPaths[idx];
    setSelectedPaths((prev) => prev.filter((_, i) => i !== idx));
    setRotations((prev) => {
      const copy = { ...prev };
      delete copy[target];
      return copy;
    });
  };

  // Sıralamayı Yukarı Taşı
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setSelectedPaths((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  // Sıralamayı Aşağı Taşı
  const moveDown = (idx: number) => {
    if (idx >= selectedPaths.length - 1) return;
    setSelectedPaths((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  // 90° Saat Yönünde Döndür
  const rotateFile = (path: string) => {
    setRotations((prev) => {
      const current = prev[path] || 0;
      const next = (current + 90) % 360;
      return { ...prev, [path]: next };
    });
  };

  // Dönüştürme İşlemi
  const handleConvert = async () => {
    if (selectedPaths.length === 0) return;

    // Hedef kayıt klasörü: Kullanıcı önceden belirlemediyse sor
    let chosenDir = targetDirectory;
    if (!chosenDir) {
      try {
        chosenDir = await api.chooseDirectory();
      } catch (err: any) {
        toast.error(`Klasör seçimi başarısız: ${err.message}`);
        return;
      }

      // Kullanıcı klasör seçim penceresini kapattı veya iptal ettiyse devam etme
      if (!chosenDir) {
        return;
      }
      setTargetDirectory(chosenDir);
    }

    setIsConverting(true);
    setResultMessage(null);

    try {
      const res = await api.convertImages(
        selectedPaths,
        combineIntoOne,
        rotations,
        chosenDir,
        {
          orientation: excelOrientation,
          fit_width: fitAllColumns,
          repeat_header: repeatHeaderRow,
        }
      );
      if (res.success) {
        setResultMessage({
          success: true,
          text: combineIntoOne
            ? `${selectedPaths.length} adet belge/tablo başarıyla tek bir UYAP PDF dosyasında birleştirildi.`
            : `${selectedPaths.length} adet belge/tablo ayrı ayrı UYAP PDF formatına dönüştürüldü.`,
          files: res.output_paths,
        });
      } else {
        setResultMessage({
          success: false,
          text: `Dönüştürme sırasında hatalar oluştu: ${res.errors.join(', ')}`,
          files: [],
        });
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `Hata oluştu: ${err.message}`,
        files: [],
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4EFEA] text-[#121316]">
      {/* Top Header */}
      <header className="h-16 border-b-2 border-[#121316] bg-[#FFFFFF] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHub}
            className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ana Menü</span>
          </button>
          <div className="h-5 w-[1.5px] bg-[#121316]/20" />
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#121316]" />
            <h2 className="font-black text-sm tracking-tight">Belge & Tablo Dönüştürücü</h2>
          </div>
        </div>

        {/* Üst bardaki mükerrer buton kaldırıldı, sadece liste varsa temizleme butonu durur */}
        <div className="flex items-center gap-3">
          {selectedPaths.length > 0 && (
            <button
              onClick={() => {
                setSelectedPaths([]);
                setRotations({});
              }}
              className="text-xs font-bold text-[#575A65] hover:text-[#121316] flex items-center gap-1 underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Listeyi Temizle</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between">
        {selectedPaths.length === 0 ? (
          /* Single Expansive Drag & Drop Zone (Boş Durum) */
          <div
            className="my-auto"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDropFiles}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleSelectFiles}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDropFiles}
              className={`brutal-card p-12 text-center bg-[#FFFFFF] cursor-pointer transition-all border-2 border-dashed ${
                isDragging
                  ? 'border-[#1E3A8A] bg-[#1E3A8A]/5 ring-4 ring-[#1E3A8A]/20'
                  : 'border-[#121316] hover:border-[#1E3A8A]'
              }`}
            >
              <div className={`w-20 h-20 border-2 flex items-center justify-center mx-auto mb-6 brutal-shadow-sm transition-colors ${
                isDragging ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-[#F4EFEA] border-[#121316] text-[#121316]'
              }`}>
                <FileSpreadsheet className="w-10 h-10" />
              </div>

              <h3 className="text-2xl font-black text-[#121316] mb-2">
                {isDragging ? 'Dosyaları Buraya Bırakın' : 'Dönüştürülecek dosyayı seçin.'}
              </h3>
              <p className="text-sm text-[#575A65] max-w-lg mx-auto mb-6 font-medium">
                Word (.docx, .doc), Excel (.xlsx, .xls) veya taranmış delil görsellerini (TIFF, JPEG, PNG, WEBP) seçin. Dosyaları buraya sürükleyip bırakabilir veya tıklayabilirsiniz.
              </p>

              <button className="brutal-btn py-3.5 px-8 bg-[#121316] text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-[#1E3A8A] transition-colors">
                <FolderOpen className="w-4 h-4" />
                <span>Bilgisayardan Dosya Seç</span>
              </button>
            </motion.div>
          </div>
        ) : (
          /* Selected Files Queue & Action Panel */
          <div className="space-y-6">
            {/* Top Config Card */}
            <div className="brutal-card p-5 bg-[#FFFFFF] flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase text-[#121316] block mb-1">
                  Dönüştürme Modu
                </span>
                <p className="text-xs text-[#575A65] font-medium">
                  {selectedPaths.length} adet dosya kuyrukta bekliyor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCombineIntoOne(true)}
                  className={`brutal-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${
                    combineIntoOne ? 'brutal-btn-primary' : 'bg-[#F4EFEA] text-[#121316]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Tek PDF Olarak Birleştir</span>
                </button>

                <button
                  onClick={() => setCombineIntoOne(false)}
                  className={`brutal-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${
                    !combineIntoOne ? 'brutal-btn-primary' : 'bg-[#F4EFEA] text-[#121316]'
                  }`}
                >
                  <FilePlus className="w-4 h-4" />
                  <span>Ayrı Ayrı PDF Yap</span>
                </button>
              </div>
            </div>

            {/* Kayıt Klasörü Seçim Kartı */}
            <div className="brutal-card p-4 bg-[#FFFFFF] border-2 border-[#121316] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-4 h-4 text-[#1E3A8A]" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-black uppercase text-[#121316] block">
                    Kayıt Edilecek Klasör / Dizin
                  </span>
                  <p className="text-xs text-[#575A65] font-medium truncate" title={targetDirectory || 'Henüz seçilmedi'}>
                    {targetDirectory ? (
                      <span className="font-mono text-[#121316] font-bold">{targetDirectory}</span>
                    ) : (
                      <span className="italic text-[#575A65]">Kayıt klasörü belirlenmedi (PDF Kaydet butonuna tıklandığında sorulacaktır)</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const dir = await api.chooseDirectory();
                      if (dir) setTargetDirectory(dir);
                    } catch (err: any) {
                      toast.error(`Klasör seçimi başarısız: ${err.message}`);
                    }
                  }}
                  className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] text-xs font-bold text-[#121316] hover:bg-[#121316] hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{targetDirectory ? 'Klasörü Değiştir' : 'Klasör Seç'}</span>
                </button>
                {targetDirectory && (
                  <button
                    type="button"
                    onClick={() => api.openDirectory(targetDirectory)}
                    className="brutal-btn px-2.5 py-1.5 bg-[#F4EFEA] text-xs font-bold text-[#575A65] hover:text-[#121316] hover:bg-[#121316]/10 transition-colors"
                    title="Klasörü Windows Gezgini'nde Aç"
                  >
                    Klasörü Aç
                  </button>
                )}
              </div>
            </div>

            {/* Excel Configuration Panel (Visible when Excel files exist in queue) */}
            {hasExcelFiles && (
              <div className="brutal-card p-5 bg-[#FFFFFF] border-2 border-[#121316]">
                <div className="flex items-center justify-between border-b-2 border-[#121316] pb-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-[#1E3A8A]" />
                    <span className="text-xs font-black uppercase text-[#121316]">
                      Excel UYAP Uyum ve Sığdırma Ayarları
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1E3A8A] text-white">
                    Sütun Bölünmesini Önler
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sayfa Yönlendirmesi */}
                  <div>
                    <label className="text-xs font-bold text-[#121316] block mb-2">
                      Sayfa Yönü (Orientation)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('auto')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'auto'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Tablonun sütun sayısına göre (≥6 sütun ise Yatay) otomatik belirler"
                      >
                        ⚡ Akıllı Otomatik
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('landscape')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'landscape'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Tüm tabloları yatay A4 (Landscape) sayfaya basar"
                      >
                        ↔ Yatay (Geniş Tablo)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('portrait')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'portrait'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Dikey A4 (Portrait) sayfaya basar"
                      >
                        ↕ Dikey
                      </button>
                    </div>
                  </div>

                  {/* Sığdırma & Başlık Seçenekleri */}
                  <div className="flex flex-col justify-center gap-2.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fitAllColumns}
                        onChange={(e) => setFitAllColumns(e.target.checked)}
                        className="w-4 h-4 accent-[#1E3A8A] rounded-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#121316]">
                        Tüm Sütunları Tek Sayfa Genişliğine Sığdır (Fit to Width)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={repeatHeaderRow}
                        onChange={(e) => setRepeatHeaderRow(e.target.checked)}
                        className="w-4 h-4 accent-[#1E3A8A] rounded-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#121316]">
                        Tablo Başlık Satırını Her Sayfada Yinele (Repeat Headers)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* List of files with Thumbnail, Rotate, and Reorder */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDropFiles}
              className={`brutal-card bg-[#FFFFFF] p-4 transition-all ${
                isDragging ? 'border-[#1E3A8A] ring-2 ring-[#1E3A8A]' : ''
              }`}
            >
              <div className="flex items-center justify-between border-b-2 border-[#121316] pb-2 mb-3">
                <span className="text-xs font-black uppercase text-[#121316]">
                  Dönüştürülecek Belgeler ({selectedPaths.length})
                </span>
                <span className="text-[11px] text-[#575A65] font-semibold">
                  Sıralamayı tutamaktan sürükleyerek veya oklarla düzenleyebilirsiniz
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {selectedPaths.map((filePath, index) => {
                  const fileName = filePath.split(/[/\\]/).pop() || filePath;
                  const ext = fileName.split('.').pop()?.toUpperCase() || '';
                  const isExcel = /\.(xlsx|xls)$/i.test(filePath);
                  const isWord = /\.(docx|doc)$/i.test(filePath);
                  const rot = rotations[filePath] || 0;
                  const sizeInfo = fileSizes[filePath];
                  const isItemDragged = draggedIndex === index;
                  const isItemOver = dragOverIndex === index;

                  return (
                    <div
                      key={filePath}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', String(index));
                        e.dataTransfer.setData('application/x-paralegal-reorder', String(index));
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverIndex !== index) {
                          setDragOverIndex(index);
                        }
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        if (dragOverIndex === index) {
                          setDragOverIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const rawIdx = e.dataTransfer.getData('application/x-paralegal-reorder') || e.dataTransfer.getData('text/plain');
                        const fromIdx = draggedIndex !== null ? draggedIndex : parseInt(rawIdx, 10);
                        if (!isNaN(fromIdx) && fromIdx !== index && fromIdx >= 0 && fromIdx < selectedPaths.length) {
                          setSelectedPaths((prev) => {
                            const next = [...prev];
                            const [moved] = next.splice(fromIdx, 1);
                            next.splice(index, 0, moved);
                            return next;
                          });
                        }
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedIndex(null);
                        setDragOverIndex(null);
                      }}
                      className={`p-3 border-2 flex items-center justify-between brutal-shadow-sm transition-all select-none ${
                        isItemDragged
                          ? 'opacity-40 border-dashed border-[#1E3A8A] bg-[#1E3A8A]/5 scale-[0.99]'
                          : isItemOver
                          ? 'border-[#1E3A8A] bg-[#1E3A8A]/10 ring-2 ring-[#1E3A8A]'
                          : 'border-[#121316] bg-[#FFFFFF] hover:border-[#1E3A8A]'
                      }`}
                    >
                      {/* Left: Grip Handle + Index badge + Thumbnail + Name & Badges */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                        {/* Sürükleme Tutamağı (Grip) */}
                        <div
                          className="cursor-grab active:cursor-grabbing text-[#575A65] hover:text-[#121316] p-1 -ml-1 transition-colors shrink-0"
                          title="Sıralamayı değiştirmek için sürükleyip bırakın"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Sıra Numarası Rozeti */}
                        <div className="w-7 h-7 bg-[#121316] text-white flex items-center justify-center text-xs font-black shrink-0">
                          {index + 1}
                        </div>

                        {/* Canlı Küçük Resim Önizlemesi (Thumbnail / Excel İkonu) */}
                        <div className="w-12 h-12 bg-[#F4EFEA] border border-[#121316] shrink-0 overflow-hidden flex items-center justify-center relative select-none">
                          {isWord ? (
                            <FileText className="w-6 h-6 text-[#1E3A8A]" />
                          ) : isExcel ? (
                            <FileSpreadsheet className="w-6 h-6 text-[#1E3A8A]" />
                          ) : (
                            <img
                              src={api.getImageThumbnailUrl(filePath, rot)}
                              alt={fileName}
                              className="w-full h-full object-cover pointer-events-none"
                              loading="lazy"
                              draggable={false}
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 border text-[10px] font-black ${
                              isWord || isExcel
                                ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                                : 'bg-[#F4EFEA] border-[#121316] text-[#121316]'
                            }`}>
                              {ext}
                            </span>

                            {/* Dosya Boyutu Rozeti */}
                            {sizeInfo ? (
                              <span
                                className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#F4EFEA] border border-[#121316] text-[#121316]"
                                title={`${sizeInfo.size_bytes.toLocaleString('tr-TR')} bayt`}
                              >
                                {sizeInfo.size_formatted}
                              </span>
                            ) : isLoadingSizes ? (
                              <span className="text-[10px] text-[#575A65] font-mono animate-pulse">
                                ...
                              </span>
                            ) : null}

                            {isExcel ? (
                              <span className="text-[10px] text-[#575A65] font-semibold">
                                {excelOrientation === 'auto' ? '⚡ Akıllı UYAP' : excelOrientation === 'landscape' ? '↔ Yatay' : '↕ Dikey'}
                              </span>
                            ) : (
                              rot > 0 && (
                                <span className="px-1.5 py-0.2 bg-[#1E3A8A] text-white text-[10px] font-black">
                                  {rot}°
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#121316] truncate" title={filePath}>
                            {fileName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions (Rotate, Move Up/Down, Remove) */}
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* 90° Sağa Döndür (Yalnızca görseller için) */}
                        {!isExcel && !isWord && (
                          <button
                            type="button"
                            onClick={() => rotateFile(filePath)}
                            className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white text-xs font-bold"
                            title="90° Sağa Döndür"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Yukarı Taşı */}
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveUp(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Yukarı Taşı"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Aşağı Taşı */}
                        <button
                          type="button"
                          disabled={index === selectedPaths.length - 1}
                          onClick={() => moveDown(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Aşağı Taşı"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Çıkar */}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#575A65] hover:bg-[#121316] hover:text-white transition-colors ml-1"
                          title="Listeden Çıkar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alt Çubuk: Özet, Toplam Boyut ve + Daha Fazla Ekle Butonu */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t-2 border-[#121316]/10 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#575A65] font-medium">
                    Toplam {selectedPaths.length} belge kuyrukta
                  </span>
                  <span className="text-xs text-[#121316]/30">•</span>
                  <span className="text-xs font-bold text-[#121316]">
                    Tahmini Toplam Boyut: <span className="font-mono">{formattedTotalMB}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSelectFiles}
                  className="brutal-btn px-4 py-2 bg-[#F4EFEA] text-xs font-bold text-[#121316] hover:bg-[#121316] hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>+ Daha Fazla Ekle</span>
                </button>
              </div>
            </div>

            {/* Sticky Action Dock */}
            <div className="brutal-card p-4 bg-[#FFFFFF] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-black text-[#121316] flex items-center gap-1.5">
                    <span>Tahmini Toplam Boyut:</span>
                    <span className="font-mono text-xs font-black bg-[#F4EFEA] px-2 py-0.5 border border-[#121316]">
                      {formattedTotalMB}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#575A65] font-medium mt-0.5">
                    Toplam {selectedPaths.length} belge dönüştürülmeye hazır.
                  </p>
                </div>

                {/* UYAP İkaz / Güvenlik Rozeti */}
                <div
                  className={`px-3 py-1.5 border-2 text-xs font-bold flex items-center gap-1.5 brutal-shadow-sm transition-colors ${
                    isNearUyapLimit
                      ? 'bg-[#FEF3C7] text-[#92400E] border-[#D97706]'
                      : 'bg-[#D1FAE5] text-[#065F46] border-[#059669]'
                  }`}
                >
                  {isNearUyapLimit ? (
                    <span>⚠️ 10 MB UYAP sınırına yakın; sistem otomatik olarak optimize edecektir.</span>
                  ) : (
                    <span>🛡️ UYAP 10 MB Sınırında Güvende</span>
                  )}
                </div>
              </div>

              <button
                disabled={isConverting}
                onClick={handleConvert}
                className="brutal-btn-primary py-3.5 px-8 font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <span>{isConverting ? 'Dönüştürülüyor...' : 'PDF Olarak Kaydet'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Results Alert (Clean Minimalist Contrast) */}
            <AnimatePresence>
              {resultMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="brutal-card p-5 bg-[#FFFFFF] border-2 border-[#121316]"
                >
                  <div className="flex items-start gap-3">
                    {resultMessage.success ? (
                      <Check className="w-5 h-5 text-[#1E3A8A] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#121316] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-black text-[#121316]">
                          {resultMessage.success ? 'Dönüştürme Tamamlandı!' : 'Hata Oluştu'}
                        </h4>
                        {resultMessage.success && targetDirectory && (
                          <button
                            type="button"
                            onClick={() => api.openDirectory(targetDirectory)}
                            className="brutal-btn px-2.5 py-1 bg-[#F4EFEA] text-xs font-bold text-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white flex items-center gap-1.5 transition-colors"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Klasörü Aç</span>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#575A65] font-medium mb-3">
                        {resultMessage.text}
                      </p>

                      {resultMessage.files.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-[#121316] block">
                            Oluşturulan Dosyalar:
                          </span>
                          {resultMessage.files.map((f) => (
                            <div
                              key={f}
                              className="text-xs font-mono bg-[#F4EFEA] border border-[#121316] px-2.5 py-1.5 select-all flex items-center justify-between gap-2"
                            >
                              <span className="truncate">{f}</span>
                              <button
                                type="button"
                                onClick={() => api.openDirectory(f)}
                                className="text-[11px] text-[#1E3A8A] hover:underline font-sans font-bold shrink-0"
                              >
                                Konumu Aç
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}


      </main>
    </div>
  );
};
