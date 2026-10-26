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
  RefreshCw,
  Eye,
  EyeOff
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
  previewMode: boolean;
  onTogglePreviewMode: () => void;
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
  previewMode,
  onTogglePreviewMode,
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
    <header className="h-16 w-full border-b-2 border-[#121316] bg-[#FFFFFF] px-3 sm:px-4 lg:px-5 flex items-center justify-between shrink-0 z-20 select-none overflow-x-auto no-scrollbar">
      {/* Sol Bölüm: Geri Dönüş ve Belge Bilgi Alanı */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 mr-2 min-w-0">
        <button
          onClick={onBackToHub}
          className="h-9 px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 brutal-btn bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          title="Ana Menüye Dön"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Ana Menü</span>
        </button>

        {pdfMeta && (
          <>
            <div className="h-5 w-[1.5px] bg-[#121316]/20 shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#121316] shrink-0" />
              <span
                className="font-extrabold text-xs sm:text-sm max-w-[110px] sm:max-w-[160px] md:max-w-[220px] truncate cursor-help text-[#121316]"
                title={`Belge: ${pdfMeta.filename}\nTam Yol: ${pdfMeta.path}`}
              >
                {pdfMeta.filename}
              </span>
              <span className="h-6 px-2 shrink-0 whitespace-nowrap inline-flex items-center justify-center text-[11px] bg-[#F4EFEA] border border-[#121316] font-bold text-[#121316]">
                {pdfMeta.total_pages} Sayfa
              </span>
            </div>
          </>
        )}
      </div>

      {/* Sağ Bölüm: Adli Kontrol ve Aksiyon Barı */}
      {pdfMeta && (
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-2.5 shrink-0">
          {/* 1. Sayfa Gezinme Grubu (Sabit 36px) */}
          <div className="h-9 flex items-center gap-0.5 bg-[#F4EFEA] border-2 border-[#121316] px-1 brutal-shadow-sm shrink-0">
            <button
              disabled={currentPage <= 0}
              onClick={onPrevPage}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Önceki Sayfaya Kaydır"
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={onScrollToCurrentPage}
              className="h-7 text-xs font-black px-2 min-w-[84px] whitespace-nowrap text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Şu anki sayfa / Toplam sayfa (Kaydırmak için tıkla)"
            >
              Sayfa {currentPage + 1} / {pdfMeta.total_pages}
            </button>
            <button
              disabled={currentPage >= pdfMeta.total_pages - 1}
              onClick={onNextPage}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Sonraki Sayfaya Kaydır"
            >
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>

          {/* 2. Yakınlaştırma (Zoom) Grubu (Sabit 36px) */}
          <div className="h-9 flex items-center gap-0.5 bg-[#F4EFEA] border-2 border-[#121316] px-1 brutal-shadow-sm shrink-0">
            <button
              disabled={zoom <= 35}
              onClick={onZoomOut}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="h-7 text-xs font-black px-1.5 min-w-[50px] whitespace-nowrap text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Tıkla: Sığdır / %100 Geçişi"
            >
              %{Math.round(zoom)}
            </button>
            <button
              disabled={zoom >= 250}
              onClick={onZoomIn}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-4 h-4 shrink-0" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="h-6 px-2 bg-[#FFFFFF] hover:bg-[#121316] hover:text-white border border-[#121316]/60 text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ml-0.5 whitespace-nowrap flex items-center justify-center"
              title="Genişliğe Sığdır / %100 arasında geçiş yap"
            >
              Sığdır
            </button>
          </div>

          {/* Önizleme Modu Toggle (Şeffaf / Tam Sansür) */}
          <button
            onClick={onTogglePreviewMode}
            className={`h-9 px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer brutal-btn ${
              previewMode
                ? 'bg-[#1E3A8A] text-[#FFFFFF] border-2 border-[#121316] shadow-[2px_2px_0px_0px_#121316]'
                : 'bg-[#FFFFFF] text-[#121316] hover:bg-[#F4EFEA]'
            }`}
            title={
              previewMode
                ? 'Şeffaf Önizleme Açık: Sansürlenecek metinler okunabilir durumda (Tam sansür görünümü için tıklayın)'
                : 'Tam Sansür Görünümü Açık: Çıktıdaki siyah/beyaz kutuları gösterir (Şeffaf önizleme için tıklayın)'
            }
          >
            {previewMode ? (
              <Eye className="w-3.5 h-3.5 shrink-0 text-[#FFFFFF]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 shrink-0 text-[#121316]" />
            )}
            <span>{previewMode ? 'Şeffaf Önizleme' : 'Sansür Önizleme'}</span>
            {previewMode && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] ml-0.5 animate-pulse" />
            )}
          </button>

          {/* 3. Bant Çek Butonu (Sabit Boyut, Sıfır Reflow, Görsel Durum Değişimi) */}
          <button
            onClick={onToggleDrawTool}
            className={`h-9 px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer brutal-btn ${
              drawToolActive
                ? 'bg-[#1E3A8A] text-[#FFFFFF] border-2 border-[#121316] shadow-[2px_2px_0px_0px_#121316]'
                : 'bg-[#FFFFFF] text-[#121316] hover:bg-[#F4EFEA]'
            }`}
            title={drawToolActive ? 'Bant Modu Aktif (Kapatmak için tıklayın)' : 'Belge üzerinde serbest dikdörtgen çizerek sansür alanı oluşturun'}
          >
            <Square className={`w-3.5 h-3.5 shrink-0 ${drawToolActive ? 'fill-current text-[#FFFFFF]' : 'text-[#121316]'}`} />
            <span>Bant Çek</span>
            {drawToolActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] ml-0.5 animate-pulse" />
            )}
          </button>

          {/* 4. Yeniden Tara (İkincil Aksiyon - Sabit 36px) */}
          <button
            onClick={onRescan}
            disabled={isScanning}
            className="h-9 px-2.5 sm:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 brutal-btn bg-[#FFFFFF] text-[#121316] text-xs font-bold hover:bg-[#F4EFEA] cursor-pointer"
            title="Filtrelerle Yeniden Tara"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Yeniden Tara</span>
          </button>

          {/* 5. Birincil CTA: Güvenli PDF Kaydet (Sabit 36px, Tek Satır Kilitli) */}
          <button
            onClick={onSave}
            disabled={isSaving || totalApproved === 0}
            className="h-9 px-3 sm:px-3.5 lg:px-4 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 brutal-btn-primary text-xs font-black cursor-pointer disabled:opacity-50"
            title="Onaylanan sansürlerle güvenli PDF oluştur"
          >
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <RefreshCw className="w-4 h-4 shrink-0" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4 shrink-0" />
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
