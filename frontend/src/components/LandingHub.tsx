import React, { useState } from 'react';
import {
  ShieldCheck,
  FileImage,
  ArrowRight,
  Shield,
  Layers,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceMode } from '../types';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

interface LandingHubProps {
  onSelectMode: (mode: WorkspaceMode) => void;
  onOpenPdf: (pdfPath: string) => void;
  onOpenConverterWithFiles: (files: string[]) => void;
  onOpenMergerWithFiles: (files: string[]) => void;
}

export const LandingHub: React.FC<LandingHubProps> = ({
  onSelectMode,
  onOpenPdf,
  onOpenConverterWithFiles,
  onOpenMergerWithFiles,
}) => {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [detectedFiles, setDetectedFiles] = useState<string[]>([]);

  // Sürükle-bırak olayları
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const processFileList = async (files: File[]) => {
    if (files.length === 0) return;
    setIsProcessingFiles(true);
    try {
      const paths: string[] = [];
      for (const f of files) {
        try {
          const p = await api.uploadFile(f);
          if (p) paths.push(p);
        } catch (err) {
          console.error('Dosya yükleme hatası:', err);
        }
      }

      if (paths.length === 0) {
        toast({
          title: 'Dosya Alınamadı',
          description: 'Seçilen dosyalar işlenemedi.',
          type: 'error',
        });
        setIsProcessingFiles(false);
        return;
      }

      // Tek bir dosya durumu
      if (paths.length === 1) {
        const singlePath = paths[0];
        const lower = singlePath.toLowerCase();
        if (lower.endsWith('.pdf')) {
          onOpenPdf(singlePath);
          return;
        } else {
          onOpenConverterWithFiles([singlePath]);
          return;
        }
      }

      // Birden fazla dosya: Sıvı Niyet Kartını göster
      setDetectedFiles(paths);
    } catch {
      toast({
        title: 'Hata',
        description: 'Dosyalar yüklenirken bir problem oluştu.',
        type: 'error',
      });
    } finally {
      setIsProcessingFiles(false);
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files);
      await processFileList(filesArray);
    }
  };

  const handleSelectFilesClick = async () => {
    try {
      const chosen = await api.chooseFiles('converter');
      if (chosen && chosen.length > 0) {
        if (chosen.length === 1) {
          const lower = chosen[0].toLowerCase();
          if (lower.endsWith('.pdf')) {
            onOpenPdf(chosen[0]);
            return;
          } else {
            onOpenConverterWithFiles(chosen);
            return;
          }
        }
        setDetectedFiles(chosen);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Tespit edilen dosyaların dökümü
  const fileBreakdown = React.useMemo(() => {
    let pdfCount = 0;
    let excelCount = 0;
    let wordCount = 0;
    let imageCount = 0;
    let otherCount = 0;

    for (const f of detectedFiles) {
      const lower = f.toLowerCase();
      if (lower.endsWith('.pdf')) pdfCount++;
      else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) excelCount++;
      else if (lower.endsWith('.docx') || lower.endsWith('.doc')) wordCount++;
      else if (
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.jpeg') ||
        lower.endsWith('.tiff') ||
        lower.endsWith('.tif')
      )
        imageCount++;
      else otherCount++;
    }
    return { pdfCount, excelCount, wordCount, imageCount, otherCount, total: detectedFiles.length };
  }, [detectedFiles]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col justify-between p-6 sm:p-8 md:p-10 max-w-5xl xl:max-w-6xl mx-auto bg-[#FBFBFA] text-[#16171A] select-none transition-colors duration-150 ${
        isDragOver ? 'bg-[#F3EFEA]' : ''
      }`}
    >
      {/* Üst Başlık ve Adli Güvenlik Göstergesi */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between border-b border-[rgba(22,23,26,0.12)] pb-4 sm:pb-5 shrink-0"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#0E254A] text-[#FBFBFA] flex items-center justify-center font-black font-serif text-xl sm:text-2xl border border-[#16171A] brutal-shadow-sm shrink-0 tracking-tight select-none">P<span className="text-[#D4AF37] text-base leading-none">.</span></div>
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#16171A] leading-none">
              PARALEGAL.
            </h1>
            <p className="text-[11px] sm:text-xs text-[#5A5D66] font-medium mt-1">
              Avukatlar için.
            </p>
          </div>
        </div>

        {/* Sağ Üst Güvenlik Rozeti */}
        <div className="flex items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFFFFF] border border-[rgba(22,23,26,0.15)] text-xs font-bold text-[#16171A] brutal-shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#0E254A] shrink-0" />
            <span className="hidden xs:inline">Çevrimdışı Güvenlik</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </div>
        </div>
      </motion.div>

      {/* Ana Çalışma Alanı: Sıvı Dropzone + Hızlı Eylemler */}
      <div className="my-auto py-5 sm:py-7 w-full flex flex-col gap-6">
        {/* AKILLI BIRAKMA ALANI (AMBIENT INGESTION DROPZONE) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.05 }}
          className={`w-full rounded-none border-2 border-dashed p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-150 cursor-pointer ${
            isDragOver
              ? 'border-[#0E254A] bg-[#FFFFFF] brutal-shadow'
              : 'border-[rgba(22,23,26,0.22)] bg-[#FFFFFF] hover:border-[#16171A] brutal-shadow-sm'
          }`}
          onClick={handleSelectFilesClick}
        >
          <div className="w-12 h-12 rounded-full bg-[#F3EFEA] border border-[rgba(22,23,26,0.12)] flex items-center justify-center text-[#0E254A] mb-3">
            <UploadCloud className="w-6 h-6 stroke-[2]" />
          </div>

          <h2 className="text-lg sm:text-xl font-black text-[#16171A] tracking-tight">
            {isProcessingFiles
              ? 'Dosyalar Analiz Ediliyor...'
              : isDragOver
              ? 'Dosyaları Buraya Bırakın'
              : 'Dosyaları Buraya Bırakın veya Seçin'}
          </h2>

          <p className="text-xs text-[#5A5D66] mt-1.5 max-w-md font-medium leading-relaxed">
            Dosyalarınızı doğrudan sürükleyip bırakabilirsiniz. Sistem, dosya türünü algılayıp uygun işlemleri hazırlar.
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="kbd-cap">PDF</span>
            <span className="kbd-cap">DOCX</span>
            <span className="kbd-cap">XLSX</span>
            <span className="kbd-cap">TIFF</span>
            <span className="kbd-cap">MSG</span>
            <span className="kbd-cap">GÖRSEL</span>
          </div>
        </motion.div>

        {/* BİRDEN ÇOK DOSYA BIRAKILDIĞINDA AÇILAN SIVI NİYET KARTI */}
        <AnimatePresence>
          {detectedFiles.length > 1 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full bg-[#FFFFFF] border-2 border-[#16171A] brutal-shadow p-5 flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-[rgba(22,23,26,0.1)] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#0E254A] text-white flex items-center justify-center font-bold text-xs">
                    {fileBreakdown.total}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#16171A]">
                      Toplu Dava Evrakı Algılandı
                    </h3>
                    <p className="text-[11px] text-[#5A5D66]">
                      {[
                        fileBreakdown.pdfCount > 0 && `${fileBreakdown.pdfCount} PDF`,
                        fileBreakdown.excelCount > 0 && `${fileBreakdown.excelCount} Excel`,
                        fileBreakdown.wordCount > 0 && `${fileBreakdown.wordCount} Word`,
                        fileBreakdown.imageCount > 0 && `${fileBreakdown.imageCount} Görsel`,
                        fileBreakdown.otherCount > 0 && `${fileBreakdown.otherCount} Diğer`,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetectedFiles([]);
                  }}
                  className="p-1 hover:bg-[#F3EFEA] text-[#5A5D66] hover:text-[#16171A] transition-colors"
                  title="Listeyi Temizle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenMergerWithFiles(detectedFiles)}
                  className="btn-primary-court w-full sm:flex-1 py-3 px-4 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  <span>Tek Bir PDF Olarak Birleştir</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenConverterWithFiles(detectedFiles)}
                  className="btn-chancery bg-[#FFFFFF] text-[#16171A] w-full sm:flex-1 py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#F3EFEA]"
                >
                  <FileImage className="w-4 h-4 text-[#0E254A]" />
                  <span>Ayrı Ayrı PDF'lere Dönüştür</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MANUEL ÇALIŞMA ALANI SEÇENEKLERİ (3 KLASİK KART) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black text-[#5A5D66] uppercase tracking-wider">
              Veya Doğrudan Bir Araç Seçin
            </span>
            <div className="flex-1 h-[1px] bg-[rgba(22,23,26,0.1)]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
            {/* Kart 1: Belge Anonimleştir */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectMode('redactor')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectMode('redactor')}
              className="brutal-card-interactive p-4 sm:p-5 bg-[#FFFFFF] flex flex-col justify-between min-h-[160px] group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-[#F3EFEA] border border-[#16171A] flex items-center justify-center text-[#16171A] group-hover:bg-[#0E254A] group-hover:text-white transition-colors shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="kbd-cap">1</span>
                </div>
                <h3 className="text-base font-black text-[#16171A] mb-1 group-hover:text-[#0E254A] transition-colors">
                  Belge Anonimleştir
                </h3>
                <p className="text-[11px] text-[#5A5D66] leading-relaxed">
                  TCKN, isim ve kurum bilgilerini kalıcı olarak kazıyın.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-[#0E254A] gap-1 group-hover:translate-x-1 transition-transform">
                <span>Aç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Kart 2: Belge & Tablo Dönüştür */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectMode('converter')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectMode('converter')}
              className="brutal-card-interactive p-4 sm:p-5 bg-[#FFFFFF] flex flex-col justify-between min-h-[160px] group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-[#F3EFEA] border border-[#16171A] flex items-center justify-center text-[#16171A] group-hover:bg-[#0E254A] group-hover:text-white transition-colors shrink-0">
                    <FileImage className="w-5 h-5" />
                  </div>
                  <span className="kbd-cap">2</span>
                </div>
                <h3 className="text-base font-black text-[#16171A] mb-1 group-hover:text-[#0E254A] transition-colors">
                  Belge & Tablo Dönüştür
                </h3>
                <p className="text-[11px] text-[#5A5D66] leading-relaxed">
                  Word, Excel ve görselleri UYAP'ın boyut sınırıyla uyumlu olarak PDF'e çevirin.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-[#0E254A] gap-1 group-hover:translate-x-1 transition-transform">
                <span>Aç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Kart 3: PDF Birleştir */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectMode('merger')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectMode('merger')}
              className="brutal-card-interactive p-4 sm:p-5 bg-[#FFFFFF] flex flex-col justify-between min-h-[160px] group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-[#F3EFEA] border border-[#16171A] flex items-center justify-center text-[#16171A] group-hover:bg-[#0E254A] group-hover:text-white transition-colors shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="kbd-cap">3</span>
                </div>
                <h3 className="text-base font-black text-[#16171A] mb-1 group-hover:text-[#0E254A] transition-colors">
                  PDF Birleştir
                </h3>
                <p className="text-[11px] text-[#5A5D66] leading-relaxed">
                  Çoklu belgeleri sıralı ve yer imli tek PDF yapın.
                </p>
              </div>
              <div className="mt-3 flex items-center text-xs font-bold text-[#0E254A] gap-1 group-hover:translate-x-1 transition-transform">
                <span>Aç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
