import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  FileImage,
  ArrowRight,
  Shield,
  Layers,
  UploadCloud,
  Check,
  X,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WorkspaceMode } from '../types';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import {
  inspectFiles,
  mergePdfsClientSide,
  convertImagesToPdfClientSide,
  downloadBlob,
  formatBytes,
  isPdfFile,
  isSupportedImageFile,
  InspectionResult,
  MAX_CLIENT_PAGES,
  MAX_CLIENT_SIZE_BYTES
} from '../services/clientPdfEngine';
import { isWebMode } from '../services/environment';
import { DesktopUpsellModal } from './DesktopUpsellModal';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isExecutingClientOp, setIsExecutingClientOp] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [clientOpStatus, setClientOpStatus] = useState<string | null>(null);
  const [showUpsellModal, setShowUpsellModal] = useState<boolean>(false);
  const [upsellConfig, setUpsellConfig] = useState<{
    title?: string;
    subtitle?: string;
    message?: string;
    reasons?: string[];
  }>({});

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

  // Dosyaları analiz et ve limit kontrolü yap
  const processFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingFiles(true);
    setClientOpStatus(null);

    try {
      const inspection = await inspectFiles(files);
      setInspectionResult(inspection);

      if (inspection.exceedsLimit) {
        // Tarayıcı bellek koruma sınırı aşıldı -> Masaüstü Yükseltme Modalı
        setUpsellConfig({});
        setShowUpsellModal(true);
        setStagedFiles([]);
      } else {
        // Sınırlar dahilinde (< 10 sayfa, < 10 MB, MSG yok) -> Tarayıcıda işlem için hazırla
        setStagedFiles(files);
      }
    } catch (err: unknown) {
      console.error('Evrak inceleme hatası:', err);
      toast({
        title: 'İnceleme Hatası',
        description: 'Dosyalar analiz edilirken beklenmeyen bir problem oluştu.',
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
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      await processFiles(filesArray);
    }
  };

  const handleSelectFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      await processFiles(filesArray);
    }
    // Aynı dosyaların yeniden seçilebilmesi için değeri sıfırla
    e.target.value = '';
  };

  // Hazırlanan dosyaların tür analizleri
  const areAllPdfs = stagedFiles.length > 0 && stagedFiles.every(isPdfFile);
  const areAllImages = stagedFiles.length > 0 && stagedFiles.every(isSupportedImageFile);
  const hasPdfs = stagedFiles.some(isPdfFile);
  const hasImages = stagedFiles.some(isSupportedImageFile);

  // 1-Tık Tarayıcı İçi PDF Birleştirme
  const handleClientMerge = async () => {
    if (stagedFiles.length === 0) return;
    setIsExecutingClientOp(true);
    setClientOpStatus(null);

    try {
      const pdfFiles = stagedFiles.filter(isPdfFile);
      if (pdfFiles.length === 0) {
        throw new Error('Birleştirilecek geçerli PDF dosyası bulunamadı.');
      }

      const result = await mergePdfsClientSide(pdfFiles);
      downloadBlob(result.blob, result.filename);

      const statusMsg = 'İşlem tarayıcınızda yerel ortamda tamamlandı.';
      setClientOpStatus(statusMsg);
      toast({
        title: 'İşlem Başarılı',
        description: statusMsg,
        type: 'success',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Birleştirme işlemi tamamlanamadı.';
      toast({
        title: 'Birleştirme Hatası',
        description: message,
        type: 'error',
      });
    } finally {
      setIsExecutingClientOp(false);
    }
  };

  // 1-Tık Tarayıcı İçi Görselden UYAP PDF'e Dönüştürme
  const handleClientConvertImages = async () => {
    if (stagedFiles.length === 0) return;
    setIsExecutingClientOp(true);
    setClientOpStatus(null);

    try {
      const imageFiles = stagedFiles.filter(isSupportedImageFile);
      if (imageFiles.length === 0) {
        throw new Error('Dönüştürülecek geçerli görsel dosyası bulunamadı.');
      }

      const result = await convertImagesToPdfClientSide(imageFiles);
      downloadBlob(result.blob, result.filename);

      const statusMsg = 'İşlem tarayıcınızda yerel ortamda tamamlandı.';
      setClientOpStatus(statusMsg);
      toast({
        title: 'İşlem Başarılı',
        description: statusMsg,
        type: 'success',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Dönüştürme işlemi tamamlanamadı.';
      toast({
        title: 'Dönüştürme Hatası',
        description: message,
        type: 'error',
      });
    } finally {
      setIsExecutingClientOp(false);
    }
  };

  // Listeyi temizleme
  const handleClearStaged = () => {
    setStagedFiles([]);
    setInspectionResult(null);
    setClientOpStatus(null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col justify-between p-6 sm:p-8 md:p-10 max-w-5xl xl:max-w-6xl mx-auto bg-[#FBFBFA] text-[#16171A] select-none transition-colors duration-150 ${
        isDragOver ? 'bg-[#F3EFEA]' : ''
      }`}
    >
      {/* Gizli Dosya Girişi */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.msg,.eml,.docx,.xlsx"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Üst Başlık ve Adli Güvenlik Göstergesi + Masaüstü İndirme Butonu */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between border-b border-[rgba(22,23,26,0.12)] pb-4 sm:pb-5 shrink-0"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#0E254A] text-[#FBFBFA] flex items-center justify-center font-black font-serif text-xl sm:text-2xl border border-[#16171A] brutal-shadow-sm shrink-0 tracking-tight select-none">
            P<span className="text-[#D4AF37] text-base leading-none">.</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#16171A] leading-none">
              PARALEGAL.
            </h1>
            <p className="text-[11px] sm:text-xs text-[#5A5D66] font-medium mt-1">
              Avukatlar için.
            </p>
          </div>
        </div>

        {/* Sağ Üst Eylemler: Masaüstü Kurulumu Butonu ve Çevrimdışı Güvenlik Rozeti */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href={(import.meta as any).env?.VITE_DESKTOP_DOWNLOAD_URL || '/downloads/Paralegal_Setup.exe'}
            download="Paralegal_Setup.exe"
            className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 bg-[#0E254A] hover:bg-[#163566] text-[#FBFBFA] border border-[#16171A] text-xs font-bold brutal-shadow-sm transition-all tracking-tight"
            title="Sınırsız yerel işlem için Windows masaüstü kurulumunu indirin"
          >
            <Download className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span className="hidden sm:inline">Masaüstü Sürümünü İndir (.exe)</span>
            <span className="sm:hidden">İndir (.exe)</span>
          </a>

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
            Dosyalarınızı doğrudan sürükleyip bırakabilir veya tıklayarak seçebilirsiniz. Sistem, dosya türünü algılayıp tarayıcı içi hızlı işlemleri hazırlar.
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

        {/* SINIRLAR DAHİLİNDEKİ DOSYALAR İÇİN TARAYICI İÇİ EYLEM PANELİ */}
        <AnimatePresence>
          {stagedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -8 }}
              transition={{ duration: 0.18 }}
              className="w-full bg-[#FFFFFF] border-2 border-[#16171A] brutal-shadow p-5 flex flex-col gap-4"
            >
              {/* Üst Başlık ve Analiz Özeti */}
              <div className="flex items-center justify-between border-b border-[rgba(22,23,26,0.1)] pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0E254A] text-white flex items-center justify-center font-bold text-xs border border-[#16171A] brutal-shadow-sm">
                    {stagedFiles.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#16171A]">
                      {areAllPdfs
                        ? stagedFiles.length === 1
                          ? 'PDF Belgesi İşleme Hazır'
                          : 'Birleştirilmeye Hazır PDF Evrakları'
                        : areAllImages
                        ? "UYAP PDF'e Dönüştürülecek Görseller"
                        : 'Adli Evraklar İşleme Hazır'}
                    </h3>
                    <p className="text-[11px] text-[#5A5D66]">
                      {stagedFiles.length} dosya
                      {inspectionResult && ` • Toplam ${inspectionResult.totalPages} sayfa`}
                      {inspectionResult && ` • ${formatBytes(inspectionResult.totalSizeBytes)}`}
                      {' • '}
                      <span className="text-emerald-700 font-bold">
                        Tarayıcı Bellek Sınırı Dahilinde (&lt;{MAX_CLIENT_PAGES} sayfa / &lt;{formatBytes(MAX_CLIENT_SIZE_BYTES)})
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearStaged();
                  }}
                  className="p-1 hover:bg-[#F3EFEA] text-[#5A5D66] hover:text-[#16171A] transition-colors"
                  title="Listeyi Temizle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* İşlem Durum Mesajı */}
              {clientOpStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#EBF7EE] border border-emerald-300 p-3 flex items-center justify-between text-xs font-bold text-emerald-950 brutal-shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{clientOpStatus}</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 uppercase tracking-widest font-mono">
                    UYAP UYUMLU
                  </span>
                </motion.div>
              )}

              {/* Hızlı Eylem Butonları */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* PDF'ler için Tarayıcıda Birleştir ve İndir */}
                {(areAllPdfs || hasPdfs) && (
                  <button
                    type="button"
                    disabled={isExecutingClientOp}
                    onClick={handleClientMerge}
                    className="btn-primary-court w-full sm:flex-1 py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Layers className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {isExecutingClientOp
                        ? 'Birleştiriliyor...'
                        : 'Tarayıcıda Birleştir ve İndir'}
                    </span>
                  </button>
                )}

                {/* Görseller için UYAP PDF'e Dönüştür ve İndir */}
                {(areAllImages || hasImages) && (
                  <button
                    type="button"
                    disabled={isExecutingClientOp}
                    onClick={handleClientConvertImages}
                    className="btn-primary-court w-full sm:flex-1 py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <FileImage className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      {isExecutingClientOp
                        ? 'Dönüştürülüyor...'
                        : "UYAP PDF'e Dönüştür ve İndir"}
                    </span>
                  </button>
                )}

                {/* Tek PDF durumunda Redaktör Açma Seçeneği */}
                {areAllPdfs && stagedFiles.length === 1 && (
                  <button
                    type="button"
                    disabled={isExecutingClientOp}
                    onClick={async () => {
                      if (isWebMode()) {
                        setInspectionResult(null);
                        setUpsellConfig({
                          title: 'Masaüstü Sürümü Gereklidir',
                          subtitle: 'KVKK & Adli Evrak Koruma Bildirimi',
                          message: 'Adli Belge Anonimleştirme (TCKN, isim, sicil no ve kurum bilgilerini kalıcı kazıma) motoru %100 yerel veri gizliliği ve güvenlik için Python masaüstü çekirdeği gerektirir.',
                          reasons: [
                            'Hassas hukuki evraklarınız buluta yüklenmeden yerel bilgisayarınızda taranır.',
                            'Yapay zeka ve adli mühür sertifikası masaüstü çekirdeğiyle oluşturulur.'
                          ]
                        });
                        setShowUpsellModal(true);
                        return;
                      }
                      try {
                        const path = await api.uploadFile(stagedFiles[0]);
                        if (path) onOpenPdf(path);
                      } catch {
                        handleClientMerge();
                      }
                    }}
                    className="btn-chancery bg-[#FFFFFF] text-[#16171A] w-full sm:flex-1 py-3 px-4 font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#F3EFEA]"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#0E254A]" />
                    <span>Redaktörde Aç (TCKN Kazı)</span>
                  </button>
                )}
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
              onClick={() => {
                if (isWebMode()) {
                  setInspectionResult(null);
                  setUpsellConfig({
                    title: 'Masaüstü Sürümü Gereklidir',
                    subtitle: 'KVKK & Adli Evrak Koruma Bildirimi',
                    message: 'Adli Belge Anonimleştirme (TCKN, isim, sicil no ve kurum bilgilerini kalıcı kazıma) motoru %100 yerel veri gizliliği ve güvenlik için Python masaüstü çekirdeği gerektirir.',
                    reasons: [
                      'Hassas hukuki evraklarınız buluta yüklenmeden yerel bilgisayarınızda taranır.',
                      'Yapay zeka ve adli mühür sertifikası masaüstü çekirdeğiyle oluşturulur.'
                    ]
                  });
                  setShowUpsellModal(true);
                } else {
                  onSelectMode('redactor');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (isWebMode()) {
                    setInspectionResult(null);
                    setUpsellConfig({
                      title: 'Masaüstü Sürümü Gereklidir',
                      subtitle: 'KVKK & Adli Evrak Koruma Bildirimi',
                      message: 'Adli Belge Anonimleştirme (TCKN, isim, sicil no ve kurum bilgilerini kalıcı kazıma) motoru %100 yerel veri gizliliği ve güvenlik için Python masaüstü çekirdeği gerektirir.',
                      reasons: [
                        'Hassas hukuki evraklarınız buluta yüklenmeden yerel bilgisayarınızda taranır.',
                        'Yapay zeka ve adli mühür sertifikası masaüstü çekirdeğiyle oluşturulur.'
                      ]
                    });
                    setShowUpsellModal(true);
                  } else {
                    onSelectMode('redactor');
                  }
                }
              }}
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

      {/* Alt Bilgi & Hukuki Mahremiyet Güvencesi (Dignified Chancery Assurance) */}
      <div className="pt-4 pb-1 border-t border-[rgba(22,23,26,0.08)] flex items-center justify-center shrink-0">
        <p className="text-[11px] sm:text-xs text-[#5A5D66] font-medium tracking-tight text-center select-none flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[#0E254A] shrink-0" />
          <span>Tüm işlemler tarayıcınızda yerel ortamda yürütülür; sunucuya hiçbir veri veya dosya aktarılmaz.</span>
        </p>
      </div>

      {/* Tarayıcı Sınırını Aşan Durumlar İçin Masaüstü Yükseltme Modalı */}
      <DesktopUpsellModal
        isOpen={showUpsellModal}
        onClose={() => {
          setShowUpsellModal(false);
          setUpsellConfig({});
        }}
        inspection={inspectionResult}
        title={upsellConfig.title}
        subtitle={upsellConfig.subtitle}
        customMessage={upsellConfig.message}
        customReasons={upsellConfig.reasons}
      />
    </div>
  );
};
