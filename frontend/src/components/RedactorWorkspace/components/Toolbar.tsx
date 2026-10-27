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
  RotateCcw,
  RotateCw,
  PanelLeft,
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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onScrollToCurrentPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleFitOrFull: () => void;
  onToggleDrawTool: () => void;
  onRescan: () => void;
  onSave: () => void;
  showThumbnails?: boolean;
  onToggleThumbnails?: () => void;
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPrevPage,
  onNextPage,
  onScrollToCurrentPage,
  onZoomIn,
  onZoomOut,
  onToggleFitOrFull,
  onToggleDrawTool,
  onRescan,
  onSave,
  showThumbnails,
  onToggleThumbnails,
}) => {
  return (
    <header className="h-16 w-full border-b-2 border-[#121316] bg-[#FFFFFF] px-2.5 sm:px-4 lg:px-5 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Sol Bölüm: Geri Dönüş ve Belge Bilgi Alanı */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 mr-2 shrink">
        <button
          onClick={onBackToHub}
          className="h-9 px-2.5 sm:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 brutal-btn bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          title="Ana Menüye Dön"
          aria-label="Ana Menüye Dön"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Ana Menü</span>
        </button>

        {pdfMeta && (
          <>
            <div className="h-5 w-[1.5px] bg-[#121316]/20 shrink-0" />
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#121316] shrink-0" />
              <span
                className="font-extrabold text-xs sm:text-sm max-w-[90px] sm:max-w-[130px] md:max-w-[180px] lg:max-w-[220px] truncate cursor-help text-[#121316]"
                title={`Belge: ${pdfMeta.filename}\nTam Yol: ${pdfMeta.path}`}
              >
                {pdfMeta.filename}
              </span>
              <span className="hidden xl:inline-flex h-6 px-2 shrink-0 whitespace-nowrap items-center justify-center text-[11px] bg-[#F4EFEA] border border-[#121316] font-bold text-[#121316]">
                {pdfMeta.total_pages} Sayfa
              </span>
              {onToggleThumbnails && (
                <button
                  onClick={onToggleThumbnails}
                  className={`h-7 px-2 sm:px-2.5 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 brutal-btn text-xs font-bold transition-all cursor-pointer ${
                    showThumbnails
                      ? 'bg-[#1E3A8A] text-white border-2 border-[#121316]'
                      : 'bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-[#121316]'
                  }`}
                  title={showThumbnails ? 'Sayfa Gezginini Gizle' : 'Sayfa Gezginini Göster'}
                  aria-label={showThumbnails ? 'Sayfa Gezginini Gizle' : 'Sayfa Gezginini Göster'}
                >
                  <PanelLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden md:inline">Sayfalar</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sağ Bölüm: Adli Kontrol ve Aksiyon Barı */}
      {pdfMeta && (
        <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0">
          {/* 1. Sayfa Gezinme Grubu */}
          <div className="h-9 flex items-center gap-0.5 bg-[#F4EFEA] border-2 border-[#121316] px-0.5 sm:px-1 brutal-shadow-sm shrink-0">
            <button
              disabled={currentPage <= 0}
              onClick={onPrevPage}
              className="h-7 w-6 sm:w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Önceki Sayfa"
              aria-label="Önceki Sayfa"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </button>
            <button
              onClick={onScrollToCurrentPage}
              className="h-7 text-xs font-black px-1.5 sm:px-2 min-w-[54px] sm:min-w-[68px] whitespace-nowrap text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Geçerli Sayfa / Toplam Sayfa (Kaydırmak için tıkla)"
              aria-label={`Sayfa ${currentPage + 1} / ${pdfMeta.total_pages}`}
            >
              <span className="hidden sm:inline mr-1">Sayfa</span>
              <span>{currentPage + 1} / {pdfMeta.total_pages}</span>
            </button>
            <button
              disabled={currentPage >= pdfMeta.total_pages - 1}
              onClick={onNextPage}
              className="h-7 w-6 sm:w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Sonraki Sayfa"
              aria-label="Sonraki Sayfa"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          </div>

          {/* 2. Yakınlaştırma (Zoom) Grubu - Sığdır butonu %{zoom} içine entegre */}
          <div className="h-9 flex items-center gap-0.5 bg-[#F4EFEA] border-2 border-[#121316] px-0.5 sm:px-1 brutal-shadow-sm shrink-0">
            <button
              disabled={zoom <= 35}
              onClick={onZoomOut}
              className="h-7 w-6 sm:w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Uzaklaştır"
              aria-label="Uzaklaştır"
            >
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="h-7 text-xs font-black px-1.5 min-w-[44px] sm:min-w-[48px] whitespace-nowrap text-center hover:bg-[#121316] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Tıkla: Sığdır / %100 Geçişi"
              aria-label={`Yakınlaştırma oranı: %${Math.round(zoom)}. Genişliğe sığdır veya yüzde yüz yap.`}
            >
              %{Math.round(zoom)}
            </button>
            <button
              disabled={zoom >= 250}
              onClick={onZoomIn}
              className="h-7 w-6 sm:w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Yakınlaştır"
              aria-label="Yakınlaştır"
            >
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            </button>
          </div>

          {/* 3. Geri Al / İleri Al (Undo / Redo) Grubu - Kompakt İkon Odaklı */}
          <div className="h-9 flex items-center gap-0.5 bg-[#F4EFEA] border-2 border-[#121316] px-1 brutal-shadow-sm shrink-0">
            <button
              disabled={!canUndo}
              onClick={onUndo}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer disabled:cursor-not-allowed transition-colors"
              title="Geri Al (Ctrl+Z)"
              aria-label="Geri Al (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            </button>
            <div className="h-4 w-[1px] bg-[#121316]/20 shrink-0" />
            <button
              disabled={!canRedo}
              onClick={onRedo}
              className="h-7 w-7 flex items-center justify-center hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer disabled:cursor-not-allowed transition-colors"
              title="İleri Al (Ctrl+Y)"
              aria-label="İleri Al (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* 4. Bant Çek Butonu - Dokunsal ve Şık Görsel Durum */}
          <button
            onClick={onToggleDrawTool}
            className={`h-9 px-2.5 sm:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer border-2 border-[#121316] select-none ${
              drawToolActive
                ? 'bg-[#1E3A8A] text-white shadow-[1px_1px_0px_0px_#121316] translate-x-[1px] translate-y-[1px] ring-1 ring-[#1E3A8A]'
                : 'bg-white text-[#121316] brutal-shadow-sm hover:bg-[#F4EFEA] hover:-translate-x-[0.5px] hover:-translate-y-[0.5px]'
            }`}
            title={drawToolActive ? 'Bant Modu Aktif (Kapatmak için tıklayın)' : 'Belge üzerinde serbest dikdörtgen çizerek sansür alanı oluşturun'}
            aria-pressed={drawToolActive}
          >
            <Square
              className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                drawToolActive ? 'fill-white text-white scale-105' : 'text-[#121316]'
              }`}
            />
            <span>Bant Çek</span>
            {drawToolActive && (
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-300" />
              </span>
            )}
          </button>

          {/* 5. Yeniden Tara (İkincil Aksiyon) */}
          <button
            onClick={onRescan}
            disabled={isScanning}
            className="h-9 px-2 sm:px-2.5 lg:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 brutal-btn bg-[#FFFFFF] text-[#121316] text-xs font-bold hover:bg-[#F4EFEA] cursor-pointer disabled:opacity-40"
            title="Filtrelerle Yeniden Tara"
            aria-label="Filtrelerle Yeniden Tara"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isScanning ? 'animate-spin text-[#1E3A8A]' : ''}`} />
            <span className="hidden sm:inline">Yeniden Tara</span>
            <span className="sm:hidden">Tara</span>
          </button>

          {/* 6. Birincil CTA: Güvenli PDF Kaydet (Hero Aksiyon - Daima Görünür) */}
          <button
            onClick={onSave}
            disabled={isSaving || totalApproved === 0}
            className={`h-9 px-3 sm:px-3.5 lg:px-4 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-black cursor-pointer border-2 border-[#121316] select-none transition-all ${
              totalApproved > 0 && !isSaving
                ? 'bg-[#1E3A8A] text-white shadow-[3px_3px_0px_0px_#121316] hover:bg-[#172554] hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[4px_4px_0px_0px_#121316] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1px_1px_0px_0px_#121316]'
                : 'bg-[#1E3A8A]/60 text-white/80 opacity-50 cursor-not-allowed shadow-[1px_1px_0px_0px_#121316]'
            }`}
            title={
              totalApproved === 0
                ? 'Kaydetmek için en az bir sansürü onaylayın'
                : 'Onaylanan sansürlerle güvenli PDF oluştur'
            }
            aria-label={`Güvenli PDF Kaydet, ${totalApproved} onaylı sansür`}
          >
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <RefreshCw className="w-4 h-4 shrink-0" />
              </motion.div>
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isSaving ? (
                'İşleniyor...'
              ) : (
                <>
                  <span className="hidden sm:inline">Güvenli </span>PDF Kaydet
                  <span className="ml-1 px-1.5 py-0.5 bg-white/20 text-white rounded text-[11px] font-black">
                    {totalApproved}
                  </span>
                </>
              )}
            </span>
          </button>
        </div>
      )}
    </header>
  );
};
