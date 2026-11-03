import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  X,
  AlertOctagon,
  HardDrive,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { InspectionResult, formatBytes, MAX_CLIENT_PAGES, MAX_CLIENT_SIZE_BYTES } from '../services/clientPdfEngine';

export interface DesktopUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspection?: InspectionResult | null;
  title?: string;
  subtitle?: string;
  customMessage?: string;
  customReasons?: string[];
}

export const DesktopUpsellModal: React.FC<DesktopUpsellModalProps> = ({
  isOpen,
  onClose,
  inspection = null,
  title = 'Masaüstü Sürümü Gereklidir',
  subtitle = 'Adli Evrak Koruma Bildirimi',
  customMessage,
  customReasons,
}) => {
  // ESC tuşuna basıldığında modalı kapat
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const exceedsPages = inspection ? inspection.totalPages > MAX_CLIENT_PAGES : false;
  const exceedsSize = inspection ? inspection.totalSizeBytes > MAX_CLIENT_SIZE_BYTES : false;
  const reasonsList = customReasons || (inspection ? inspection.reasons : []);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#16171A]/70 backdrop-blur-xs select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upsell-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-xl bg-[#FFFFFF] border-2 border-[#16171A] brutal-shadow-lg p-6 sm:p-8 flex flex-col gap-6 text-[#16171A] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Bar: Başlık, Mühür Rozeti ve Kapat */}
          <div className="flex items-start justify-between border-b border-[rgba(22,23,26,0.12)] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#0E254A] text-white flex items-center justify-center border border-[#16171A] brutal-shadow-sm shrink-0">
                <AlertOctagon className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-widest uppercase text-[#5A5D66]">
                  {subtitle}
                </span>
                <h2
                  id="upsell-modal-title"
                  className="text-lg sm:text-xl font-black text-[#16171A] tracking-tight leading-snug"
                >
                  {title}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#5A5D66] hover:text-[#16171A] hover:bg-[#F3EFEA] border border-transparent hover:border-[#16171A] transition-colors"
              title="Kapat"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Gerekçe ve Hacim Analiz Kutusu */}
          <div className="bg-[#F3EFEA] border-l-4 border-[#0E254A] p-4 flex flex-col gap-2.5">
            <p className="text-xs font-bold text-[#16171A] leading-relaxed">
              {customMessage || 'Bu işlem tarayıcı bellek koruma sınırını (10 sayfa / 10 MB) aşmaktadır.'}
            </p>

            {reasonsList.length > 0 && (
              <ul className="text-xs text-[#5A5D66] space-y-1.5 list-disc list-inside">
                {reasonsList.map((reason, index) => (
                  <li key={index} className="leading-relaxed">
                    {reason}
                  </li>
                ))}
              </ul>
            )}

            {/* Sayısal Göstergeler */}
            {inspection && (
              <div className="grid grid-cols-2 gap-3 mt-2 pt-2.5 border-t border-[rgba(22,23,26,0.1)]">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#5A5D66] uppercase tracking-wider">
                    Tespit Edilen Sayfa
                  </span>
                  <span
                    className={`text-sm font-black font-mono ${
                      exceedsPages ? 'text-[#8B1E1E]' : 'text-[#16171A]'
                    }`}
                  >
                    {inspection.totalPages} Sayfa{' '}
                    <span className="text-[11px] font-normal text-[#5A5D66]">
                      (Tarayıcı Üst Sınırı: {MAX_CLIENT_PAGES})
                    </span>
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#5A5D66] uppercase tracking-wider">
                    Toplam Dosya Boyutu
                  </span>
                  <span
                    className={`text-sm font-black font-mono ${
                      exceedsSize ? 'text-[#8B1E1E]' : 'text-[#16171A]'
                    }`}
                  >
                    {formatBytes(inspection.totalSizeBytes)}{' '}
                    <span className="text-[11px] font-normal text-[#5A5D66]">
                      (Tarayıcı Üst Sınırı: {formatBytes(MAX_CLIENT_SIZE_BYTES)})
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Masaüstü Sürümü Avantajları (Hukuk Büroları İçin Kesintisiz İşlem) */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-black text-[#5A5D66] uppercase tracking-wider">
              Paralegal Masaüstü ile Sınırsız Çalışın
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-[#FFFFFF] border border-[rgba(22,23,26,0.15)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[#0E254A]">
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-bold">Sınırsız Kapasite</span>
                </div>
                <p className="text-[11px] text-[#5A5D66] leading-snug">
                  500+ sayfaya kadar ağır dava dosyalarını bellek sınırına takılmadan işleyin.
                </p>
              </div>

              <div className="p-2.5 bg-[#FFFFFF] border border-[rgba(22,23,26,0.15)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[#0E254A]">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-bold">%100 Yerel İcra</span>
                </div>
                <p className="text-[11px] text-[#5A5D66] leading-snug">
                  Dosyalarınız bilgisayarınızda kalır; ağ bağlantısı veya sunucu gerekmez.
                </p>
              </div>

              <div className="p-2.5 bg-[#FFFFFF] border border-[rgba(22,23,26,0.15)] flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-[#0E254A]">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-bold">Geniş Format</span>
                </div>
                <p className="text-[11px] text-[#5A5D66] leading-snug">
                  Outlook (.msg, .eml), Word, Excel ve TIFF belgelerini doğrudan dönüştürün.
                </p>
              </div>
            </div>
          </div>

          {/* Aksiyon Butonları */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-[rgba(22,23,26,0.12)]">
            <a
              href={(import.meta as any).env?.VITE_DESKTOP_DOWNLOAD_URL || '/downloads/Paralegal_Setup.exe'}
              download="Paralegal_Setup.exe"
              className="btn-primary-court w-full py-3.5 px-5 font-bold text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2.5 text-center brutal-shadow hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all"
            >
              <Download className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Paralegal Masaüstü Sürümünü İndir (Setup.exe)</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="btn-chancery w-full py-2.5 px-4 font-bold text-xs tracking-wider uppercase text-[#16171A] bg-[#FFFFFF] hover:bg-[#F3EFEA] text-center"
            >
              Kapat
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
