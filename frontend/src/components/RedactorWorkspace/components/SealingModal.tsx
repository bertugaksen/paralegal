import React, { useState } from 'react';
import { Shield, Check, X, FileText, AlertTriangle, Stamp, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PDFMeta, RedactionItem } from '../../../types';
import { getCategoryLabel } from '../hooks/useRedactorState';

interface SealingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfMeta: PDFMeta | null;
  redactions: RedactionItem[];
  onConfirmSeal: (attachCertificate: boolean) => void;
  isSaving: boolean;
}

export const SealingModal: React.FC<SealingModalProps> = ({
  isOpen,
  onClose,
  pdfMeta,
  redactions,
  onConfirmSeal,
  isSaving,
}) => {
  const [attachCertificate, setAttachCertificate] = useState(true);

  if (!isOpen || !pdfMeta) return null;

  const approvedItems = redactions.filter((r) => r.approved);

  // Kategori dökümü
  const categoryCounts: Record<string, number> = {};
  for (const item of approvedItems) {
    const cat = getCategoryLabel(item.category || 'MANUEL');
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const protocolId = `PL-${new Date().getFullYear()}/${Math.floor(10000 + Math.random() * 90000)}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#16171A]/50 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#FFFFFF] border-2 border-[#16171A] brutal-shadow flex flex-col overflow-hidden"
      >
        {/* Protokol Başlığı */}
        <div className="bg-[#0E254A] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#16171A]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#8B1E1E] text-white flex items-center justify-center font-bold text-xs rounded-none border border-white/30">
              <Stamp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-black tracking-tight uppercase">
                Adli Mühürleme & Tasdik Protokolü
              </h2>
              <p className="text-[10px] text-white/70 font-mono">
                Tutanak No: {protocolId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tutanak Detay Gövdesi */}
        <div className="p-5 space-y-4 bg-[#FBFBFA]">
          {/* Belge Özeti */}
          <div className="p-3 bg-white border border-[rgba(22,23,26,0.12)] space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#5A5D66]">Belge Adı:</span>
              <span className="font-bold text-[#16171A] max-w-[280px] truncate" title={pdfMeta.filename}>
                {pdfMeta.filename}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A5D66]">Toplam Sayfa:</span>
              <span className="font-bold text-[#16171A]">{pdfMeta.total_pages} Sayfa</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#5A5D66]">Kalıcı İmha Kalemi:</span>
              <span className="font-bold text-[#8B1E1E]">{approvedItems.length} Varlık</span>
            </div>
          </div>

          {/* İmha Edilecek Kategori Dökümü */}
          <div>
            <span className="text-[11px] font-bold text-[#5A5D66] uppercase block mb-1.5">
              İmha Edilecek Veri Dökümü:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(categoryCounts).map(([cat, count]) => (
                <span
                  key={cat}
                  className="px-2 py-0.5 bg-white border border-[#16171A] text-[11px] font-mono font-bold text-[#16171A] flex items-center gap-1"
                >
                  <span>{cat}:</span>
                  <span className="text-[#0E254A] font-black">{count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Adli Güvenlik Taahhüdü */}
          <div className="p-3 bg-[#F3EFEA] border-l-3 border-[#0E254A] text-[11px] text-[#16171A] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[#0E254A]">
              <Lock className="w-3.5 h-3.5" />
              <span>Geri Dönüşsüz Adli Kazıma Standardı</span>
            </div>
            <p className="text-[10px] text-[#5A5D66] leading-relaxed">
              Bu işlem, PDF içerisindeki seçili glif, yazı tipi ve pikselleri fiziksel olarak dosya kodundan siler (True Redaction). Hiçbir üçüncü parti yazılımla geri getirilemez.
            </p>
          </div>

          {/* Resmi KVKK İmha Beratı Seçeneği */}
          <label className="flex items-start gap-2.5 p-3 bg-white border border-[rgba(22,23,26,0.15)] cursor-pointer hover:border-[#0E254A] transition-colors">
            <input
              type="checkbox"
              checked={attachCertificate}
              onChange={(e) => setAttachCertificate(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#0E254A] cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-[#16171A] block">
                Belgenin Sonuna Resmi "Adli KVKK İmha Beratı" Sayfası Ekle
              </span>
              <span className="text-[10px] text-[#5A5D66] block mt-0.5">
                Mahkemeye ve karşı tarafa delil olarak sunulabilir; SHA-256 parmak izi, imha tarihi ve yasal uyumluluk tasdiki içerir.
              </span>
            </div>
          </label>
        </div>

        {/* Aksiyon Barı */}
        <div className="p-4 bg-white border-t border-[rgba(22,23,26,0.12)] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 border border-[#16171A] bg-white text-xs font-bold text-[#16171A] hover:bg-[#F3EFEA] transition-colors cursor-pointer"
          >
            İptal
          </button>

          <button
            type="button"
            disabled={isSaving || approvedItems.length === 0}
            onClick={() => onConfirmSeal(attachCertificate)}
            className="btn-seal px-5 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Stamp className="w-4 h-4" />
            <span>{isSaving ? 'Mühürleniyor...' : 'RESMİ ADLİ MÜHRÜ BAS VE KAYDET'}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
