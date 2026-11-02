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
  Eye,
  Maximize2
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
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
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
  isFocusMode = false,
  onToggleFocusMode,
}) => {
  return (
    <header className="h-13 w-full border-b border-[rgba(22,23,26,0.12)] bg-[#FFFFFF] px-2.5 sm:px-4 lg:px-5 flex items-center justify-between shrink-0 z-20 select-none shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      {/* Sol Bölüm: Geri Dönüş ve Belge Bilgi Alanı */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 mr-2 shrink">
        <button
          onClick={onBackToHub}
          className="h-8 px-2.5 sm:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 btn-chancery bg-[#FBFBFA] hover:bg-[#16171A] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          title="Ana Menüye Dön"
          aria-label="Ana Menüye Dön"
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Ana Menü</span>
        </button>

        {pdfMeta && (
          <>
            <div className="h-5 w-[1px] bg-[rgba(22,23,26,0.15)] shrink-0" />
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#0E254A] shrink-0" />
              <span
                className="font-bold text-xs sm:text-sm max-w-[90px] sm:max-w-[130px] md:max-w-[180px] lg:max-w-[220px] truncate cursor-help text-[#16171A]"
                title={`Belge: ${pdfMeta.filename}\nTam Yol: ${pdfMeta.path}`}
              >
                {pdfMeta.filename}
              </span>
              <span className="hidden xl:inline-flex h-5 px-1.5 shrink-0 whitespace-nowrap items-center justify-center text-[10px] bg-[#F3EFEA] border border-[rgba(22,23,26,0.15)] font-bold text-[#16171A] rounded-[2px]">
                {pdfMeta.total_pages} Sayfa
              </span>
              {onToggleThumbnails && (
                <button
                  onClick={onToggleThumbnails}
                  className={`h-7 px-2 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer border border-[#16171A] ${
                    showThumbnails
                      ? 'bg-[#0E254A] text-white shadow-sm'
                      : 'bg-[#FBFBFA] hover:bg-[#16171A] hover:text-white text-[#16171A]'
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
          {/* Zen Odak Modu Butonu */}
          {onToggleFocusMode && (
            <button
              onClick={onToggleFocusMode}
              className={`h-8 px-2 sm:px-2.5 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-[#16171A] ${
                isFocusMode
                  ? 'bg-[#0E254A] text-white'
                  : 'bg-[#FFFFFF] hover:bg-[#F3EFEA] text-[#16171A]'
              }`}
              title="Zen Odak Modunu Aç / Kapat (Kısayol: F)"
            >
              <Maximize2 className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden lg:inline">{isFocusMode ? 'Odaktan Çık' : 'Odak'}</span>
              <span className="kbd-cap">F</span>
            </button>
          )}

          {/* 1. Sayfa Gezinme Grubu */}
          <div className="h-8 flex items-center gap-0.5 bg-[#FBFBFA] border border-[#16171A] px-0.5 brutal-shadow-sm shrink-0">
            <button
              disabled={currentPage <= 0}
              onClick={onPrevPage}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Önceki Sayfa"
              aria-label="Önceki Sayfa"
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
            </button>
            <button
              onClick={onScrollToCurrentPage}
              className="h-6 text-xs font-bold px-1.5 min-w-[50px] whitespace-nowrap text-center hover:bg-[#16171A] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Geçerli Sayfa / Toplam Sayfa"
            >
              <span>{currentPage + 1} / {pdfMeta.total_pages}</span>
            </button>
            <button
              disabled={currentPage >= pdfMeta.total_pages - 1}
              onClick={onNextPage}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Sonraki Sayfa"
              aria-label="Sonraki Sayfa"
            >
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* 2. Yakınlaştırma (Zoom) Grubu */}
          <div className="h-8 flex items-center gap-0.5 bg-[#FBFBFA] border border-[#16171A] px-0.5 brutal-shadow-sm shrink-0">
            <button
              disabled={zoom <= 35}
              onClick={onZoomOut}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Uzaklaştır"
            >
              <ZoomOut className="w-3 h-3 shrink-0" />
            </button>
            <button
              onClick={onToggleFitOrFull}
              className="h-6 text-xs font-bold px-1 min-w-[40px] whitespace-nowrap text-center hover:bg-[#16171A] hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title="Tıkla: Sığdır / %100 Geçişi"
            >
              %{Math.round(zoom)}
            </button>
            <button
              disabled={zoom >= 250}
              onClick={onZoomIn}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Yakınlaştır"
            >
              <ZoomIn className="w-3 h-3 shrink-0" />
            </button>
          </div>

          {/* 3. Geri Al / İleri Al (Undo / Redo) */}
          <div className="h-8 flex items-center gap-0.5 bg-[#FBFBFA] border border-[#16171A] px-0.5 brutal-shadow-sm shrink-0">
            <button
              disabled={!canUndo}
              onClick={onUndo}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="Geri Al (Ctrl+Z)"
            >
              <RotateCcw className="w-3 h-3 shrink-0" />
            </button>
            <div className="h-3 w-[1px] bg-[rgba(22,23,26,0.15)] shrink-0" />
            <button
              disabled={!canRedo}
              onClick={onRedo}
              className="h-6 w-6 flex items-center justify-center hover:bg-[#16171A] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-inherit cursor-pointer transition-colors"
              title="İleri Al (Ctrl+Y)"
            >
              <RotateCw className="w-3 h-3 shrink-0" />
            </button>
          </div>

          {/* 4. Bant Çek Butonu */}
          <button
            onClick={onToggleDrawTool}
            className={`h-8 px-2.5 sm:px-3 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer border border-[#16171A] select-none ${
              drawToolActive
                ? 'bg-[#0E254A] text-white shadow-sm'
                : 'bg-white text-[#16171A] hover:bg-[#F3EFEA]'
            }`}
            title="Serbest Dikdörtgen Sansür Alanı Çiz (Kısayol: B)"
            aria-pressed={drawToolActive}
          >
            <Square
              className={`w-3.5 h-3.5 shrink-0 ${drawToolActive ? 'fill-white text-white' : 'text-[#16171A]'}`}
            />
            <span>Bant Çek</span>
            <span className={`kbd-cap ${drawToolActive ? 'bg-[#16171A] text-white border-white/30' : ''}`}>
              B
            </span>
          </button>

          {/* 5. Yeniden Tara */}
          <button
            onClick={onRescan}
            disabled={isScanning}
            className="h-8 px-2 sm:px-2.5 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 btn-chancery bg-[#FFFFFF] text-[#16171A] text-xs font-bold hover:bg-[#F3EFEA] cursor-pointer disabled:opacity-40"
            title="Filtrelerle Yeniden Tara"
          >
            <RefreshCw className={`w-3 h-3 shrink-0 ${isScanning ? 'animate-spin text-[#0E254A]' : ''}`} />
            <span className="hidden sm:inline">Tara</span>
          </button>

          {/* 6. Birincil CTA: Adli Mühürle / Kaydet */}
          <button
            onClick={onSave}
            disabled={isSaving || totalApproved === 0}
            className={`h-8 px-3 sm:px-3.5 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer border border-[#16171A] select-none transition-all ${
              totalApproved > 0 && !isSaving
                ? 'btn-seal'
                : 'bg-[#8B1E1E]/50 text-white/70 opacity-40 cursor-not-allowed'
            }`}
            title={
              totalApproved === 0
                ? 'Kaydetmek için en az bir sansürü onaylayın'
                : 'Onaylanan sansürlerle adli mühürleme ve PDF oluştur'
            }
          >
            {isSaving ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              </motion.div>
            ) : (
              <Save className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>
              {isSaving ? (
                'Mühürleniyor...'
              ) : (
                <>
                  <span>Mühürle & Kaydet</span>
                  <span className="ml-1 px-1 py-0.2 bg-white/25 text-white text-[10px] font-bold rounded">
                    {totalApproved}
                  </span>
                  <span className="kbd-cap ml-1 bg-white/20 text-white border-white/40">
                    Ctrl+S
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
