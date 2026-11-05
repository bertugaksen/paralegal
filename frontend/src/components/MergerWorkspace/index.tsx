import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Layers,
  FileText,
  Check,
  Trash2,
  FolderOpen,
  ArrowRight,
  Plus,
  ChevronUp,
  ChevronDown,
  Shield,
  AlertCircle,
  GripVertical,
  BookmarkCheck,
  FileCheck2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../../api';
import { useToast } from '../../context/ToastContext';
import { PDFInfo } from '../../types';
import { isWebMode } from '../../services/environment';
import { mergePdfsClientSide, downloadBlob, formatBytes } from '../../services/clientPdfEngine';
import { PDFDocument } from 'pdf-lib';
import { DesktopUpsellModal } from '../DesktopUpsellModal';

interface MergerWorkspaceProps {
  onBackToHub: () => void;
  onOpenInRedactor?: (filePath: string) => void;
  initialFiles?: string[];
}

export const MergerWorkspace: React.FC<MergerWorkspaceProps> = ({
  onBackToHub,
  onOpenInRedactor,
  initialFiles,
}) => {
  const { toast } = useToast();

  const [selectedPaths, setSelectedPaths] = useState<string[]>(initialFiles || []);
  const [pdfInfos, setPdfInfos] = useState<Record<string, PDFInfo>>({});
  const [isLoadingInfo, setIsLoadingInfo] = useState<boolean>(false);

  // Birleştirme Ayarları
  const [addBookmarks, setAddBookmarks] = useState<boolean>(true);
  const [outputDir, setOutputDir] = useState<string | null>(null);

  // İşlem Durumu
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeProgress, setMergeProgress] = useState<string>('');
  const [mergedResult, setMergedResult] = useState<{
    output_path: string;
    total_pages: number;
    file_count: number;
    size_formatted: string;
  } | null>(null);

  // Sürükle & Bırak Durumları
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const clientFilesMap = React.useRef<Map<string, File>>(new Map());
  const [showUpsellModal, setShowUpsellModal] = useState<boolean>(false);

  // Web ortamında seçilen File nesnelerini işleme
  const handleProcessClientFiles = async (files: File[]) => {
    const pdfFiles = files.filter(
      (f) => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf'
    );
    if (pdfFiles.length === 0) {
      toast({
        title: 'Geçersiz Dosya Formatı',
        description: 'Yalnızca .pdf uzantılı dosyalar birleştirilebilir.',
        type: 'warning',
      });
      return;
    }

    setIsLoadingInfo(true);
    for (const file of pdfFiles) {
      clientFilesMap.current.set(file.name, file);
      try {
        const buf = await file.arrayBuffer();
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = doc.getPageCount();
        setPdfInfos((prev) => ({
          ...prev,
          [file.name]: {
            path: file.name,
            filename: file.name,
            page_count: pages,
            is_encrypted: false,
            size_bytes: file.size,
            size_formatted: formatBytes(file.size),
            has_toc: false,
          },
        }));
      } catch {
        setPdfInfos((prev) => ({
          ...prev,
          [file.name]: {
            path: file.name,
            filename: file.name,
            page_count: 1,
            is_encrypted: false,
            size_bytes: file.size,
            size_formatted: formatBytes(file.size),
            has_toc: false,
          },
        }));
      }
    }
    setIsLoadingInfo(false);

    setSelectedPaths((prev) => {
      const set = new Set(prev);
      const toAdd = pdfFiles.map((f) => f.name).filter((n) => !set.has(n));
      return [...prev, ...toAdd];
    });

    toast({
      title: 'PDF Eklendi',
      description: `${pdfFiles.length} adet PDF belgesi listeye eklendi.`,
      type: 'success',
    });
  };

  // Seçilen PDF'lerin bilgilerini (sayfa sayısı, boyut) çek
  useEffect(() => {
    const fetchInfos = async () => {
      const missingPaths = selectedPaths.filter((p) => !pdfInfos[p]);
      if (missingPaths.length === 0) return;

      setIsLoadingInfo(true);
      try {
        const newInfos: Record<string, PDFInfo> = {};
        for (const p of missingPaths) {
          try {
            const info = await api.getPdfInfo(p);
            newInfos[p] = info;
          } catch {
            // fallback
            newInfos[p] = {
              path: p,
              filename: p.split(/[/\\]/).pop() || p,
              page_count: 1,
              size_bytes: 0,
              size_formatted: 'Bilinmiyor',
            };
          }
        }
        setPdfInfos((prev) => ({ ...prev, ...newInfos }));
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchInfos();
  }, [selectedPaths]);

  // Toplam sayfa sayısı ve dosya boyutu hesaplama
  const stats = useMemo(() => {
    let totalPages = 0;
    let totalBytes = 0;

    for (const p of selectedPaths) {
      const info = pdfInfos[p];
      if (info) {
        totalPages += info.page_count || 0;
        totalBytes += info.size_bytes || 0;
      }
    }

    // Format total size
    let sizeFormatted = '0 B';
    if (totalBytes > 0) {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = totalBytes;
      let unitIdx = 0;
      while (size >= 1024 && unitIdx < units.length - 1) {
        size /= 1024;
        unitIdx++;
      }
      sizeFormatted = `${size.toFixed(1)} ${units[unitIdx]}`;
    }

    return { totalPages, totalBytes, sizeFormatted };
  }, [selectedPaths, pdfInfos]);

  // Dosya Ekleme Diyalogu
  const handleAddPdfs = async () => {
    if (isWebMode()) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const chosen = await api.choosePdfs();
      if (chosen && chosen.length > 0) {
        setSelectedPaths((prev) => {
          const set = new Set(prev);
          const toAdd = chosen.filter((p) => !set.has(p));
          return [...prev, ...toAdd];
        });
      }
    } catch {
      toast({
        title: 'Dosya Seçilemedi',
        description: 'PDF dosyaları seçilirken bir hata oluştu.',
        type: 'error',
      });
    }
  };

  // Harici Sürükle-Bırak Olayları
  const handleDragOver = (e: React.DragEvent) => {
    if (draggedIndex !== null || e.dataTransfer.types.includes('application/x-paralegal-reorder')) {
      return;
    }
    if (e.dataTransfer.types && !Array.from(e.dataTransfer.types).includes('Files')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragging) setIsDragging(true);
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

    if (draggedIndex !== null || e.dataTransfer.types.includes('application/x-paralegal-reorder')) {
      return;
    }

    const files = Array.from(e.dataTransfer.files || []) as File[];
    if (isWebMode()) {
      await handleProcessClientFiles(files);
      return;
    }
    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      toast({
        title: 'Geçersiz Dosya Formatı',
        description: 'Yalnızca .pdf uzantılı dosyalar birleştirilebilir.',
        type: 'warning',
      });
      return;
    }

    try {
      const uploadPromises = pdfFiles.map((file) => api.uploadFile(file));
      const paths = await Promise.all(uploadPromises);
      setSelectedPaths((prev) => {
        const set = new Set(prev);
        const toAdd = paths.filter((p) => !set.has(p));
        return [...prev, ...toAdd];
      });
      toast({
        title: 'PDF Eklendi',
        description: `${paths.length} adet PDF belgesi listeye eklendi.`,
        type: 'success',
      });
    } catch {
      toast({
        title: 'Yükleme Hatası',
        description: 'Sürüklenen dosyalar yüklenirken bir hata oluştu.',
        type: 'error',
      });
    }
  };

  // Sıralama kontrolleri
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setSelectedPaths((prev) => {
      const next = [...prev];
      const temp = next[idx - 1];
      next[idx - 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const moveDown = (idx: number) => {
    if (idx >= selectedPaths.length - 1) return;
    setSelectedPaths((prev) => {
      const next = [...prev];
      const temp = next[idx + 1];
      next[idx + 1] = next[idx];
      next[idx] = temp;
      return next;
    });
  };

  const removeFile = (idx: number) => {
    setSelectedPaths((prev) => prev.filter((_, i) => i !== idx));
  };

  // Klasör seçimi
  const handleChooseOutputDir = async () => {
    try {
      const chosen = await api.chooseDirectory();
      if (chosen) {
        setOutputDir(chosen);
      }
    } catch {
      toast({
        title: 'Klasör Seçilemedi',
        description: 'Hedef dizin belirlenemedi.',
        type: 'error',
      });
    }
  };

  // Birleştirme İşlemini Başlat
  const handleExecuteMerge = async () => {
    if (selectedPaths.length < 2) {
      toast({
        title: 'Yetersiz Dosya',
        description: 'Birleştirme işlemi için en az 2 PDF belgesi seçmelisiniz.',
        type: 'warning',
      });
      return;
    }

    setIsMerging(true);

    if (isWebMode()) {
      setMergeProgress('Dava dosyası tarayıcınızda hazırlanıyor...');
      try {
        const orderedFiles = selectedPaths
          .map((p) => clientFilesMap.current.get(p))
          .filter((f): f is File => !!f);

        if (orderedFiles.length < 2) {
          throw new Error('Dosyalar tarayıcı hafızasında bulunamadı. Lütfen dosyaları tekrar seçin.');
        }

        const firstStem = (selectedPaths[0] || 'dosya').replace(/\.pdf$/i, '');
        const outFilename = `${firstStem}_birlestirilmis.pdf`;
        const result = await mergePdfsClientSide(orderedFiles, addBookmarks, outFilename);
        downloadBlob(result.blob, result.filename);

        setMergedResult({
          output_path: result.filename,
          total_pages: result.totalPages,
          file_count: orderedFiles.length,
          size_formatted: formatBytes(result.sizeBytes),
        });

        toast({
          title: 'Birleştirme Tamamlandı',
          description: `${orderedFiles.length} adet PDF başarıyla birleştirildi ve indirildi (${result.totalPages} sayfa).`,
          type: 'success',
        });
      } catch (e: any) {
        toast({
          title: 'Birleştirme Hatası',
          description: e.message || 'PDF dosyaları birleştirilirken beklenmeyen bir hata oluştu.',
          type: 'error',
        });
      } finally {
        setIsMerging(false);
        setMergeProgress('');
      }
      return;
    }

    setMergeProgress('Dava dosyası hazırlanıyor ve sayfalar taranıyor...');

    try {
      // Hedef çıktı yolu belirle
      let targetOutputPath: string | undefined = undefined;
      if (outputDir) {
        const firstStem = (selectedPaths[0].split(/[\/\\]/).pop() || 'dosya').replace(/\.pdf$/i, '');
        targetOutputPath = `${outputDir}\\${firstStem}_birlestirilmis.pdf`;
      }

      const result = await api.mergePdfs(selectedPaths, targetOutputPath, addBookmarks);

      setMergedResult({
        output_path: result.output_path,
        total_pages: result.total_pages,
        file_count: result.file_count,
        size_formatted: result.size_formatted,
      });

      toast({
        title: 'Birleştirme Tamamlandı',
        description: `${result.file_count} adet PDF başarıyla birleştirildi (${result.total_pages} sayfa).`,
        type: 'success',
      });
    } catch (e: any) {
      toast({
        title: 'Birleştirme Hatası',
        description: e.message || 'PDF dosyaları birleştirilirken beklenmeyen bir hata oluştu.',
        type: 'error',
      });
    } finally {
      setIsMerging(false);
      setMergeProgress('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4EFEA] text-[#121316]">
      {/* Gizli Tarayıcı Dosya Seçici */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (e) => {
          if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files) as File[];
            await handleProcessClientFiles(filesArray);
            e.target.value = '';
          }
        }}
      />

      {/* Üst Navigasyon Çubuğu */}
      <header className="h-16 border-b-2 border-[#121316] bg-[#FFFFFF] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBackToHub}
            className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ana Menü</span>
          </button>
          <div className="h-5 w-[1.5px] bg-[#121316]/20" />
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#121316]" />
            <h2 className="font-black text-sm tracking-tight">PDF Birleştirici</h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedPaths.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedPaths([]);
                setPdfInfos({});
                clientFilesMap.current.clear();
              }}
              className="text-xs font-bold text-[#575A65] hover:text-[#121316] flex items-center gap-1 underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Listeyi Temizle</span>
            </button>
          )}
        </div>
      </header>

      {/* Ana Çalışma Alanı */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between">
        {selectedPaths.length === 0 ? (
          /* Single Expansive Drag & Drop Zone (Boş Durum) */
          <div
            className="my-auto"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleAddPdfs}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`brutal-card p-12 text-center bg-[#FFFFFF] cursor-pointer transition-all border-2 border-dashed ${
                isDragging
                  ? 'border-[#1E3A8A] bg-[#1E3A8A]/5 ring-4 ring-[#1E3A8A]/20'
                  : 'border-[#121316] hover:border-[#1E3A8A]'
              }`}
            >
              <div className={`w-20 h-20 border-2 flex items-center justify-center mx-auto mb-6 brutal-shadow-sm transition-colors ${
                isDragging ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]' : 'bg-[#F4EFEA] border-[#121316] text-[#121316]'
              }`}>
                <Layers className="w-10 h-10" />
              </div>

              <h3 className="text-2xl font-black text-[#121316] mb-2">
                {isDragging ? 'Dosyaları Buraya Bırakın' : 'Birleştirilecek PDF belgelerini seçin.'}
              </h3>
              <p className="text-sm text-[#575A65] max-w-lg mx-auto mb-6 font-medium">
                Bilgisayarınızda kayıtlı olan veya Paralegal ile dönüştürdüğünüz tüm .pdf dosyalarını seçin. Dosyaları buraya sürükleyip bırakabilir veya tıklayabilirsiniz.
              </p>

              <button
                type="button"
                className="brutal-btn py-3.5 px-8 bg-[#121316] text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-[#1E3A8A] transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Bilgisayardan Dosya Seç</span>
              </button>
            </motion.div>
          </div>
        ) : (
          /* Dolu Durum: Dosya Listesi, Sıralama ve Seçenekler */
          <div className="space-y-6">
            {/* Üst Özet ve Butonlar Çubuğu */}
            <div className="p-4 bg-[#FFFFFF] border-2 border-[#121316] brutal-shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="px-2.5 py-1 bg-[#121316] text-white text-xs font-black">
                  {selectedPaths.length} Dosya Seçildi
                </span>
                <span className="px-2.5 py-1 bg-[#F4EFEA] border border-[#121316] text-xs font-black">
                  {stats.totalPages} Toplam Sayfa
                </span>
                <span className="px-2.5 py-1 bg-[#F4EFEA] border border-[#121316] text-xs font-mono font-bold">
                  {stats.sizeFormatted}
                </span>
                {isLoadingInfo && (
                  <span className="text-xs text-[#575A65] font-semibold animate-pulse">
                    Bilgiler taranıyor...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddPdfs}
                  className="brutal-btn h-8 px-3 bg-[#121316] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#1E3A8A] whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Daha Fazla PDF Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPaths([]);
                    setPdfInfos({});
                  }}
                  className="brutal-btn h-8 px-3 bg-[#F4EFEA] text-red-600 border-red-600 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-red-600 hover:text-white whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Tümünü Kaldır</span>
                </button>
              </div>
            </div>

            {/* Gelişmiş Birleştirme Seçenekleri */}
            <div className="p-4 bg-[#FFFFFF] border-2 border-[#121316] brutal-shadow-sm">
              <div className="flex items-center justify-between mb-3 border-b border-[#121316]/10 pb-2">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-[#1E3A8A]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#121316]">
                    Dava Dosyası Mizanpaj Seçenekleri
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5">
                  UYAP 10 MB Koruma Aktif
                </span>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={addBookmarks}
                  onChange={(e) => setAddBookmarks(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#1E3A8A] rounded-none cursor-pointer"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#121316] group-hover:text-[#1E3A8A] transition-colors">
                    Otomatik İçindekiler / Yer İmleri (Bookmarks Fihristi) Oluştur
                  </span>
                  <span className="text-[11px] text-[#575A65] font-medium leading-relaxed">
                    Her belgenin dosya adını hiyerarşik yer imi olarak kaydeder. PDF açıldığında mahkeme heyeti veya avukatlar sol fihristten belgelere anında tıklar.
                  </span>
                </div>
              </label>
            </div>

            {/* Dosya Sıralama Listesi */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black uppercase tracking-wider text-[#121316]">
                  Dosya Birleştirme Sırası ({selectedPaths.length})
                </span>
                <span className="text-[11px] text-[#575A65] font-semibold">
                  Sıralamayı tutamaktan sürükleyerek veya sağdaki oklarla değiştirebilirsiniz
                </span>
              </div>

              <div className="space-y-2">
                {selectedPaths.map((filePath, index) => {
                  const fileName = filePath.split(/[/\\]/).pop() || filePath;
                  const info = pdfInfos[filePath];
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
                        if (dragOverIndex !== index) setDragOverIndex(index);
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        if (dragOverIndex === index) setDragOverIndex(null);
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
                      className={`p-3.5 border-2 bg-[#FFFFFF] flex items-center justify-between brutal-shadow-sm transition-all select-none ${
                        isItemDragged
                          ? 'opacity-40 border-dashed border-[#1E3A8A] bg-[#1E3A8A]/5 scale-[0.99]'
                          : isItemOver
                          ? 'border-[#1E3A8A] bg-[#1E3A8A]/10 ring-2 ring-[#1E3A8A]'
                          : 'border-[#121316] hover:border-[#1E3A8A]'
                      }`}
                    >
                      {/* Sol: Tutamak, Sıra No, İkon ve Bilgiler */}
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                        <div
                          className="cursor-grab active:cursor-grabbing text-[#575A65] hover:text-[#121316] p-1 -ml-1 transition-colors shrink-0"
                          title="Sıralamayı değiştirmek için sürükleyip bırakın"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="w-7 h-7 bg-[#121316] text-white flex items-center justify-center text-xs font-black shrink-0 font-mono">
                          {index + 1}
                        </div>

                        <div className="w-10 h-10 bg-[#F4EFEA] border border-[#121316] flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-[#1E3A8A]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="px-1.5 py-0.2 bg-[#121316] text-white border border-[#121316] text-[10px] font-black font-mono">
                              PDF
                            </span>

                            {info && (
                              <>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#F4EFEA] border border-[#121316] text-[#121316]">
                                  {info.page_count} Sayfa
                                </span>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#F4EFEA] border border-[#121316] text-[#121316]">
                                  {info.size_formatted}
                                </span>
                              </>
                            )}

                            {info?.is_encrypted && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-red-100 text-red-700 border border-red-300">
                                Şifreli Belge
                              </span>
                            )}
                          </div>

                          <p className="text-xs font-bold text-[#121316] truncate" title={filePath}>
                            {fileName}
                          </p>
                          <p className="text-[10px] text-[#575A65] truncate font-mono" title={filePath}>
                            {filePath}
                          </p>
                        </div>
                      </div>

                      {/* Sağ: Eylemler (Yukarı, Aşağı, Kaldır) */}
                      <div className="flex items-center gap-1 shrink-0" onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white text-xs disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Yukarı Taşı"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => moveDown(index)}
                          disabled={index === selectedPaths.length - 1}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white text-xs disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Aşağı Taşı"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-red-600 hover:bg-red-600 hover:text-white text-xs"
                          title="Listeden Kaldır"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Yapışkan Alt Eylem Paneli (Sticky Bottom Dock) */}
      {selectedPaths.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t-2 border-[#121316] p-4 brutal-shadow">
          <div className="max-w-5xl xl:max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
            {/* Sol: Hedef Klasör */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleChooseOutputDir}
                className="brutal-btn px-3 py-2 bg-[#F4EFEA] text-[#121316] text-xs font-bold flex items-center gap-1.5 hover:bg-[#121316] hover:text-white"
              >
                <FolderOpen className="w-4 h-4" />
                <span>Kayıt Klasörü: {outputDir ? 'Özel' : 'Kaynak Dizin'}</span>
              </button>

              {outputDir && (
                <span className="text-[11px] font-mono text-[#575A65] truncate max-w-xs" title={outputDir}>
                  {outputDir}
                </span>
              )}
            </div>

            {/* Sağ: İlerleme veya Birleştirme Butonu */}
            <div className="flex items-center gap-3">
              {isMerging ? (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#121316] text-white text-xs font-bold">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{mergeProgress || 'Birleştiriliyor...'}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleExecuteMerge}
                  disabled={selectedPaths.length < 2}
                  className="brutal-btn px-6 py-3 bg-[#121316] text-white font-black text-sm flex items-center gap-2 hover:bg-[#1E3A8A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  <span>PDF'leri Birleştir ({selectedPaths.length} Belge)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Başarı Modalı */}
      <AnimatePresence>
        {mergedResult && (
          <div className="fixed inset-0 z-50 bg-[#121316]/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-[#FFFFFF] border-2 border-[#121316] brutal-shadow p-6 sm:p-8"
            >
              <div className="w-12 h-12 bg-emerald-100 border-2 border-emerald-600 text-emerald-700 flex items-center justify-center mb-4">
                <FileCheck2 className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-black text-[#121316] mb-2 tracking-tight">
                Dava Dosyası Başarıyla Birleştirildi!
              </h3>

              <p className="text-xs text-[#575A65] mb-4 font-medium">
                Tüm belgeler seçtiğiniz sırada, tıklanabilir yer imleriyle ve UYAP uyumlu formatta tek bir dosyada birleştirildi.
              </p>

              {/* Bilgi Kutusu */}
              <div className="p-3 bg-[#F4EFEA] border border-[#121316] mb-6 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-[#575A65]">Dosya Sayısı:</span>
                  <span className="font-bold text-[#121316]">{mergedResult.file_count} adet PDF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#575A65]">Toplam Sayfa:</span>
                  <span className="font-bold text-[#121316]">{mergedResult.total_pages} sayfa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#575A65]">Dosya Boyutu:</span>
                  <span className="font-bold text-[#121316]">{mergedResult.size_formatted}</span>
                </div>
                <div className="pt-1.5 border-t border-[#121316]/10 text-[11px] truncate text-[#121316]" title={mergedResult.output_path}>
                  {mergedResult.output_path}
                </div>
              </div>

              {/* Aksiyon Butonları */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                {!isWebMode() ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.openDirectory(mergedResult.output_path);
                      } catch {
                        toast({
                          title: 'Klasör Açılamadı',
                          description: 'Dosya konumu açılamadı.',
                          type: 'error',
                        });
                      }
                    }}
                    className="brutal-btn flex-1 py-2.5 px-3 bg-[#121316] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#1E3A8A]"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Klasörde Göster</span>
                  </button>
                ) : (
                  <div className="flex-1 py-2.5 px-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>İndirilenlere Kaydedildi</span>
                  </div>
                )}

                {onOpenInRedactor && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isWebMode()) {
                        setShowUpsellModal(true);
                        return;
                      }
                      const target = mergedResult.output_path;
                      setMergedResult(null);
                      onOpenInRedactor(target);
                    }}
                    className="brutal-btn flex-1 py-2.5 px-3 bg-[#F4EFEA] text-[#121316] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#121316] hover:text-white"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    <span>Bu Dosyayı Sansürle</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMergedResult(null)}
                  className="brutal-btn py-2.5 px-4 bg-[#F4EFEA] text-[#575A65] text-xs font-bold hover:bg-[#121316] hover:text-white"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Web Ortamında Masaüstü Yükseltme Modalı */}
      <DesktopUpsellModal
        isOpen={showUpsellModal}
        onClose={() => setShowUpsellModal(false)}
        title="Masaüstü Sürümü Gereklidir"
        subtitle="KVKK & Adli Evrak Koruma Bildirimi"
        customMessage="Adli Belge Anonimleştirme (TCKN, isim, sicil no ve kurum bilgilerini kalıcı kazıma) motoru %100 yerel veri gizliliği ve güvenlik için Python masaüstü çekirdeği gerektirir."
        customReasons={[
          "Hassas hukuki evraklarınız buluta yüklenmeden yerel bilgisayarınızda taranır.",
          "Yapay zeka ve adli mühür sertifikası masaüstü çekirdeğiyle oluşturulur."
        ]}
      />
    </div>
  );
};
