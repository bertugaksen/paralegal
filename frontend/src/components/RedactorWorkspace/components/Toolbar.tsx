import React from 'react';
import {
  ArrowLeft,
  FileText,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Save,
  Square,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { PDFMeta } from '../../../types';

interface ToolbarProps {
  onBackToHub: () => void;
  pdfMeta: PDFMeta | null;
  currentPage: number;
  totalApproved: number;
  zoom: number;
  isScanning: boolean;
  isSaving: boolean;
  drawToolActive: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onScrollToCurrentPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFitOrFull: () => void;
  onToggleDrawTool: () => void;
  onRescan: () => void;
  onSave: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onBackToHub,
  pdfMeta,
  currentPage,
  totalApproved,
  zoom,
  isScanning,
  isSaving,
  drawToolActive,
  onPrevPage,
  onNextPage,
  onScrollToCurrentPage,
  onZoomIn,
  onZoomOut,
  onToggleFitOrFull,
  onToggleDrawTool,
  onRescan,
  onSave,
}) => {
  return (
    <header className="h-16 border-b-2 border-[#121316] bg-[#FFFFFF] px-5 flex items-center justify-between shrink-0 z-20">
      {/* Sol Bölüm: Geri Dönüş ve Belge Bilgi Hapı */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBackToHub}
          className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Ana Menüye Dön"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Ana Menü</span>
        </button>

        <div className="h-5 w-[1.5px] bg-[#121316]/20" />

        {pdfMeta ? (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#121316]" />
            <span
              className="font-extrabold text-sm max-w-[220px] truncate cursor-help text-[#121316]"
              title={`Belge: ${pdfMeta.filename}\nTam Yol: ${pdfMeta.path}`}
            >
              {pdfMeta.filename}
            </span>
            <span className="text-[11px] px-2 py-0.5 bg-[#F4EFEA] border border-[#121316] font-bold text-[#121316]">
              {pdfMeta.total_pages} Sayfa
            </span>
          </div>
        ) : (
          <span className="font-bold text-sm text-[#575A65]">Henüz belge yüklenmedi</span>
        )}
      </div>

      {/* Sağ Bölüm: Adli Kontrol ve Aksiyon Barı */}
      {pdfMeta && (
        <div className="flex items-center gap-3">
          {/* 1. Sayfa Gezinme Grubu */}
          <div className="flex items-center gap-1 bg-[#F4EFEA] border-2 border-[#121316] p-0.5 brutal-shadow-sm">
            <button
              disabled={currentPage <= 0}
              onClick={onPrevPage}
              className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer"
              title="Önceki Sayfaya Kaydır"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onScrollToCurrentPage}
              className="text-xs font-black px-2 min-w-20 text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer"
              title="Şu anki sayfa / Toplam sayfa (Kaydırmak için tıkla)"
            >
              Sayfa {currentPage + 1} / {pdfMeta.total_pages}
            </button>
            <button
              disabled={currentPage >= pdfMeta.total_pages - 1}
              onClick={onNextPage}
              className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer"
              title="Sonraki Sayfaya Kaydır"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 2. Yakınlaştırma (Zoom) Grubu */}
          <div className="flex items-center gap-1 bg-[#F4EFEA] border-2 border-[#121316] p-0.5 brutal-shadow-sm">
            <button
              disabled={zoom <= 35}
              onClick={onZoomOut}
              className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="text-xs font-black px-1.5 min-w-12 text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer"
              title="Tıkla: Sığdır / %100 Geçişi"
            >
              %{Math.round(zoom)}
            </button>
            <button
              disabled={zoom >= 250}
              onClick={onZoomIn}
              className="p-1 hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="px-2 py-0.5 bg-[#FFFFFF] hover:bg-[#121316] hover:text-white border border-[#121316]/50 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ml-0.5"
              title="Genişliğe Sığdır / %100 arasında geçiş yap"
            >
              Sığdır
            </button>
          </div>

          {/* 3. Bant Çek Butonu */}
          <button
            onClick={onToggleDrawTool}
            className={`brutal-btn px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              drawToolActive ? 'brutal-btn-primary' : 'bg-[#FFFFFF] text-[#121316]'
            }`}
            title="Belge üzerinde fareyle serbest dikdörtgen çizerek sansür alanı oluşturun"
          >
            <Square className="w-3.5 h-3.5" />
            <span>{drawToolActive ? 'Bant Modu Açık' : 'Bant Çek'}</span>
          </button>

          {/* 4. Yeniden Tara (İkincil Aksiyon) */}
          <button
            onClick={onRescan}
            disabled={isScanning}
            className="brutal-btn px-3 py-1.5 bg-[#FFFFFF] text-[#121316] text-xs font-bold flex items-center gap-1.5 hover:bg-[#F4EFEA] cursor-pointer"
            title="Filtrelerle Yeniden Tara"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Yeniden Tara</span>
          </button>

          {/* 5. Birincil CTA: Güvenli PDF Kaydet */}
          <button
            onClick={onSave}
            disabled={isSaving || totalApproved === 0}
            className="brutal-btn-primary px-4 py-1.5 text-xs font-black flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <RefreshCw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving ? 'İşleniyor...' : `Güvenli PDF Kaydet (${totalApproved})`}
            </span>
          </button>
        </div>
      )}
    </header>
  );
};
