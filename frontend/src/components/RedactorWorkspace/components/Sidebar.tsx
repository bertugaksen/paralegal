import React from 'react';
import {
  Search, ShieldCheck, Square, ShieldOff, CheckCheck, Trash2, Check, XCircle, Sliders, FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FilterSettings, RedactionItem } from '../../../types';
import { CATEGORY_NAMES } from '../hooks/useRedactorState';

interface SidebarProps {
  sidebarTab: 'data' | 'settings';
  setSidebarTab: (tab: 'data' | 'settings') => void;
  dataScope: 'current_page' | 'all_pages';
  setDataScope: (scope: 'current_page' | 'all_pages') => void;
  currentPage: number;
  pdfMeta: any;
  redactions: RedactionItem[];
  whitelist: string[];
  filters: FilterSettings;
  setFilters: (f: any) => void;
  redactionColor: 'black' | 'white';
  setRedactionColor: (c: 'black' | 'white') => void;
  redactionOverlay: 'none' | 'redacted';
  setRedactionOverlay: (o: 'none' | 'redacted') => void;
  isScanning: boolean;
  onScan: () => void;
  onSelectDirectory: () => void;
  saveStatus: string | null;
  toggleRedactionApproval: (id: string) => void;
  removeRedaction: (id: string) => void;
  addToWhitelist: (value: string) => void;
  removeFromWhitelist: (value: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarTab, setSidebarTab, dataScope, setDataScope, currentPage, pdfMeta, redactions, whitelist,
  filters, setFilters, redactionColor, setRedactionColor, redactionOverlay, setRedactionOverlay,
  isScanning, onScan, onSelectDirectory, saveStatus, toggleRedactionApproval, removeRedaction,
  addToWhitelist, removeFromWhitelist
}) => {
  const visibleRedactions = dataScope === 'current_page'
    ? redactions.filter((r) => r.page_number === currentPage)
    : redactions;
  const approvedCount = visibleRedactions.filter((r) => r.approved).length;

  return (
    <div className="w-80 bg-white border-l-2 border-[#121316] flex flex-col shrink-0 relative z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.02)]">
      {/* Tabs */}
      <div className="flex bg-[#F4EFEA] border-b-2 border-[#121316] shrink-0 p-1 gap-1">
        <button
          onClick={() => setSidebarTab('data')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider transition-colors border-2 ${
            sidebarTab === 'data' ? 'bg-[#121316] text-white border-[#121316]' : 'bg-transparent text-[#575A65] border-transparent hover:border-[#121316]/20 hover:text-[#121316]'
          } cursor-pointer`}
        >
          Bulunan Veriler
        </button>
        <button
          onClick={() => setSidebarTab('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase tracking-wider transition-colors border-2 ${
            sidebarTab === 'settings' ? 'bg-[#121316] text-white border-[#121316]' : 'bg-transparent text-[#575A65] border-transparent hover:border-[#121316]/20 hover:text-[#121316]'
          } cursor-pointer`}
        >
          <Sliders className="w-3.5 h-3.5" /> Ayarlar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {sidebarTab === 'data' ? (
          <div className="flex flex-col h-full">
            {/* Action Bar */}
            <div className="p-4 bg-white border-b-2 border-[#121316] shrink-0 sticky top-0 z-10">
              <button
                onClick={onScan}
                disabled={isScanning || !pdfMeta}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#1E3A8A] text-white hover:bg-[#121316] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isScanning ? <Search className="w-4 h-4 animate-pulse" /> : <ShieldCheck className="w-4 h-4" />}
                <span className="text-sm font-bold tracking-wide">
                  {isScanning ? 'Tarama Sürüyor...' : 'Akıllı KVKK Taraması'}
                </span>
              </button>

              <div className="flex mt-3 border-2 border-[#121316] p-1 bg-[#F4EFEA] rounded-none">
                <button
                  onClick={() => setDataScope('current_page')}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                    dataScope === 'current_page' ? 'bg-[#121316] text-white' : 'text-[#575A65] hover:text-[#121316]'
                  }`}
                >
                  Bu Sayfa
                </button>
                <button
                  onClick={() => setDataScope('all_pages')}
                  className={`flex-1 py-1.5 text-[11px] font-bold uppercase transition-colors cursor-pointer ${
                    dataScope === 'all_pages' ? 'bg-[#121316] text-white' : 'text-[#575A65] hover:text-[#121316]'
                  }`}
                >
                  Tüm Belge
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#575A65]">
                <span>Toplam Tespit: <strong className="text-[#121316]">{visibleRedactions.length}</strong></span>
                <span>Onaylı: <strong className="text-[#1E3A8A]">{approvedCount}</strong></span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8F7F4]">
              <AnimatePresence>
                {visibleRedactions.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-3 border-2 transition-colors group ${
                      item.approved ? 'bg-white border-[#121316]' : 'bg-[#F4EFEA] border-[#121316]/20'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-[#1E3A8A]/10 text-[#1E3A8A] text-[10px] font-black uppercase tracking-wider">
                          {CATEGORY_NAMES[item.category] || item.category}
                        </span>
                        {item.category === 'MANUEL' && <Square className="w-3 h-3 text-[#575A65]" />}
                      </div>
                      <span className="text-[10px] font-bold text-[#575A65] bg-white px-1.5 py-0.5 border border-[#121316]/10">
                        Sayfa {item.page_number + 1}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-[#121316] break-words mb-3 leading-tight select-all">
                      {item.value || '(Bölge Seçimi)'}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t-2 border-[#121316]/5">
                      <button
                        onClick={() => toggleRedactionApproval(item.id)}
                        className={`flex items-center gap-1.5 px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                          item.approved ? 'text-[#1E3A8A] hover:text-[#121316]' : 'text-[#575A65] hover:text-[#121316]'
                        }`}
                      >
                        {item.approved ? <CheckCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        {item.approved ? 'Onaylı' : 'Reddedildi'}
                      </button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.value && (
                          <button
                            onClick={() => addToWhitelist(item.value)}
                            className="p-1.5 hover:bg-[#1E3A8A] hover:text-white text-[#575A65] transition-colors cursor-pointer"
                            title="Bu kelimeyi muaf tut (Beyaz Liste)"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => removeRedaction(item.id)}
                          className="p-1.5 hover:bg-[#E53E3E] hover:text-white text-[#575A65] transition-colors cursor-pointer"
                          title="Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-8 bg-[#F8F7F4] min-h-full">
            {/* Filters */}
            <div>
              <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5 mb-4">
                <Search className="w-3.5 h-3.5 text-[#1E3A8A]" /> Aranan Veri Tipleri
              </span>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(CATEGORY_NAMES).filter(([k]) => k !== 'OZEL_KELIME' && k !== 'MANUEL').map(([key, label]) => {
                  const filterKey = key.toLowerCase();
                  if (filterKey in filters) {
                    return (
                      <label key={key} className="flex items-center gap-2 cursor-pointer group">
                        <div className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                          filters[filterKey as keyof FilterSettings] ? 'bg-[#121316] border-[#121316]' : 'bg-white border-[#121316]/30 group-hover:border-[#121316]'
                        }`}>
                          {filters[filterKey as keyof FilterSettings] && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[11px] font-bold text-[#575A65] group-hover:text-[#121316] transition-colors">
                          {label}
                        </span>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={filters[filterKey as keyof FilterSettings]}
                          onChange={(e) => setFilters({ ...filters, [filterKey]: e.target.checked })}
                        />
                      </label>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            {/* Appearance */}
            <div className="pt-6 border-t-2 border-[#121316]/10">
              <span className="text-xs font-black uppercase text-[#121316] mb-4 block">Sansür Görünümü</span>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setRedactionColor('black')}
                  className={`py-2 text-xs font-bold border-2 transition-colors cursor-pointer ${
                    redactionColor === 'black' ? 'bg-[#121316] text-white border-[#121316]' : 'bg-white text-[#121316] border-[#121316]/20'
                  }`}
                >Siyah</button>
                <button
                  onClick={() => setRedactionColor('white')}
                  className={`py-2 text-xs font-bold border-2 transition-colors cursor-pointer ${
                    redactionColor === 'white' ? 'bg-white text-[#121316] border-[#121316]' : 'bg-[#F4EFEA] text-[#121316] border-[#121316]/20'
                  }`}
                >Beyaz</button>
              </div>
            </div>

            {/* Whitelist */}
            <div className="pt-6 border-t-2 border-[#121316]/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A8A]" /> Beyaz Liste
                </span>
                <span className="text-[11px] font-bold text-[#575A65]">{whitelist.length} Kelime</span>
              </div>
              {whitelist.length === 0 ? (
                <p className="text-[11px] text-[#575A65] p-3 bg-[#F4EFEA] border-2 border-dashed border-[#121316]/20">Henüz muaf kelime yok.</p>
              ) : (
                <div className="space-y-1.5">
                  {whitelist.map((w) => (
                    <div key={w} className="flex items-center justify-between p-2 bg-white border-2 border-[#121316] text-xs font-bold">
                      <span className="truncate pr-2 font-mono">{w}</span>
                      <button onClick={() => removeFromWhitelist(w)} className="p-1 hover:text-white hover:bg-[#121316] text-[#575A65]"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Batch mode - Explorer */}
            <div className="pt-6 border-t-2 border-[#121316]/10">
              <button onClick={onSelectDirectory} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-[#121316] text-[#121316] hover:bg-[#F4EFEA] transition-colors cursor-pointer text-xs font-bold">
                <FolderOpen className="w-4 h-4" /> Klasör Seç & Aç
              </button>
            </div>
          </div>
        )}
      </div>

      {saveStatus && (
        <div className="p-3 bg-white border-t-2 border-[#121316] text-[11px] font-bold text-[#121316] flex items-start gap-2 shrink-0">
          <Check className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0 mt-0.5" />
          <span className="break-all">{saveStatus}</span>
        </div>
      )}
    </div>
  );
};
