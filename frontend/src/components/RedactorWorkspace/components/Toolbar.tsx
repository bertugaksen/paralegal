import React from 'react';
import { ArrowLeft, Upload, FileText, Search, ZoomOut, ZoomIn, Square, Save, Filter, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { PDFMeta } from '../../../types';

interface ToolbarProps {
  onBack: () => void;
  onSelectFile: () => void;
  pdfMeta: PDFMeta | null;
  onSearch: (term: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  drawToolActive: boolean;
  onToggleDrawTool: () => void;
  onSave: () => void;
  isSaving: boolean;
  onToggleSidebar: () => void;
  sidebarVisible: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onBack, onSelectFile, pdfMeta, onSearch, searchTerm, setSearchTerm,
  isSearching, zoom, onZoomIn, onZoomOut, onFitWidth,
  drawToolActive, onToggleDrawTool, onSave, isSaving,
  onToggleSidebar, sidebarVisible
}) => {
  return (
    <header className="h-[72px] bg-white border-b-2 border-[#121316] flex items-center justify-between px-6 shrink-0 relative z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-[#F4EFEA] text-[#121316] transition-colors border-2 border-transparent hover:border-[#121316] cursor-pointer"
          title="Ana Menüye Dön"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="h-8 w-0.5 bg-[#121316]/10"></div>
        <button
          onClick={onSelectFile}
          className="flex items-center gap-2 px-4 py-2 bg-[#121316] text-white hover:bg-[#1E3A8A] transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-bold tracking-wide">Belge Seç</span>
        </button>
        {pdfMeta && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F4EFEA] border-2 border-[#121316]">
            <FileText className="w-4 h-4 text-[#1E3A8A]" />
            <span className="text-sm font-bold text-[#121316] max-w-[200px] truncate" title={pdfMeta.filename}>
              {pdfMeta.filename}
            </span>
            <span className="text-xs font-bold text-[#575A65] border-l-2 border-[#121316]/20 pl-2">
              {pdfMeta.total_pages} Sayfa
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        {pdfMeta && (
          <form onSubmit={(e) => { e.preventDefault(); onSearch(searchTerm); }} className="flex gap-1.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#575A65]" />
              <input
                type="text"
                placeholder="Özel kelime ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-[#F4EFEA] border-2 border-[#121316] text-sm font-bold text-[#121316] placeholder:text-[#575A65] placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] w-64"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchTerm.trim()}
              className="px-4 py-2 bg-[#121316] text-white hover:bg-[#1E3A8A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm cursor-pointer"
            >
              Bul
            </button>
          </form>
        )}

        <div className="flex items-center gap-1 bg-[#F4EFEA] p-1 border-2 border-[#121316]">
          <button onClick={onZoomOut} className="p-1.5 hover:bg-white text-[#121316] transition-colors cursor-pointer"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={onFitWidth} className="px-2 text-xs font-bold text-[#121316] hover:bg-white cursor-pointer w-12 text-center" title="Sayfayı Sığdır">{Math.round(zoom)}%</button>
          <button onClick={onZoomIn} className="p-1.5 hover:bg-white text-[#121316] transition-colors cursor-pointer"><ZoomIn className="w-4 h-4" /></button>
        </div>

        <button
          onClick={onToggleDrawTool}
          className={`flex items-center gap-2 px-3 py-2 border-2 transition-colors cursor-pointer ${drawToolActive ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white' : 'bg-white border-[#121316] text-[#121316] hover:bg-[#F4EFEA]'}`}
          title="Manuel Sansür Bandı Çek (Klavye Kısayolu: M)"
        >
          <Square className="w-4 h-4" />
          <span className="text-sm font-bold">Alan Seç</span>
        </button>

        {pdfMeta && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-[#121316] text-white hover:bg-[#1E3A8A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}><RefreshCw className="w-4 h-4" /></motion.div> : <Save className="w-4 h-4" />}
            <span className="text-sm font-bold tracking-wide">{isSaving ? 'İşleniyor...' : 'Kalıcı Sansürle & Kaydet'}</span>
          </button>
        )}

        <button
          onClick={onToggleSidebar}
          className={`p-2 transition-colors border-2 ${sidebarVisible ? 'bg-[#121316] text-white border-[#121316]' : 'bg-white text-[#121316] border-[#121316] hover:bg-[#F4EFEA]'} cursor-pointer`}
          title="Paneli Gizle/Göster"
        >
          <Filter className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
