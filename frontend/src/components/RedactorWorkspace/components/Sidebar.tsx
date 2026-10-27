import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Sliders,
  Search,
  CheckCheck,
  XCircle,
  ShieldOff,
  Trash2,
  Check,
  Filter,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  PanelRightClose
} from 'lucide-react';
import { FilterSettings, RedactionItem, PDFMeta } from '../../../types';
import { CATEGORY_NAMES, getCategoryLabel } from '../hooks/useRedactorState';

interface SidebarProps {
  sidebarTab: 'data' | 'settings';
  setSidebarTab: (tab: 'data' | 'settings') => void;
  dataScope: 'current_page' | 'all_pages';
  setDataScope: (scope: 'current_page' | 'all_pages') => void;
  currentPage: number;
  pdfMeta: PDFMeta | null;
  redactions: RedactionItem[];
  whitelist: string[];
  filters: FilterSettings;
  setFilters: React.Dispatch<React.SetStateAction<FilterSettings>>;
  redactionColor: 'black' | 'white';
  setRedactionColor: (c: 'black' | 'white') => void;
  redactionOverlay: 'none' | 'redacted';
  setRedactionOverlay: (o: 'none' | 'redacted') => void;
  isScanning: boolean;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
  onSearch: (e: React.FormEvent) => void;
  onApproveAll: () => void;
  onUnapproveAll: () => void;
  onSelectAllFilters: () => void;
  onDeselectAllFilters: () => void;
  onToggleFilter: (key: keyof FilterSettings) => void;
  onRescan: () => void;
  onToggleRedactionApproval: (id: string) => void;
  onRemoveRedaction: (id: string, e: React.MouseEvent) => void;
  onAddToWhitelist: (value: string, e: React.MouseEvent) => void;
  onRemoveFromWhitelist: (value: string) => void;
  onScrollToPage: (pageIdx: number) => void;
  hoveredRedactionId?: string | null;
  setHoveredRedactionId?: (id: string | null) => void;
  selectedRedactionId?: string | null;
  setSelectedRedactionId?: (id: string | null) => void;
  saveStatus?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onApproveCategory?: (category: string) => void;
  onUnapproveCategory?: (category: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarTab,
  setSidebarTab,
  dataScope,
  setDataScope,
  currentPage,
  pdfMeta,
  redactions,
  whitelist,
  filters,
  redactionColor,
  setRedactionColor,
  redactionOverlay,
  setRedactionOverlay,
  isScanning,
  searchTerm,
  setSearchTerm,
  isSearching,
  onSearch,
  onApproveAll,
  onUnapproveAll,
  onSelectAllFilters,
  onDeselectAllFilters,
  onToggleFilter,
  onRescan,
  onToggleRedactionApproval,
  onRemoveRedaction,
  onAddToWhitelist,
  onRemoveFromWhitelist,
  onScrollToPage,
  hoveredRedactionId,
  setHoveredRedactionId,
  selectedRedactionId,
  setSelectedRedactionId,
  saveStatus,
  isCollapsed = false,
  onToggleCollapse,
  onApproveCategory,
  onUnapproveCategory,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'ALL' | string>('ALL');

  const currentPageRedactions = redactions.filter((r) => r.page_number === currentPage);
  const scopeRedactions = dataScope === 'current_page' ? currentPageRedactions : redactions;

  // Dinamik Kategori İstatistikleri (Yalnızca en az 1 adet bulunan kategoriler)
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of scopeRedactions) {
      const cat = r.category || 'MANUEL';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const sortedCategories = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return { counts, sortedCategories, total: scopeRedactions.length };
  }, [scopeRedactions]);

  // Kapsam değiştiğinde veya liste güncellendiğinde, seçili kategori scope içinde yoksa 'ALL' durumuna dön
  useEffect(() => {
    if (selectedCategoryFilter !== 'ALL' && !categoryStats.counts[selectedCategoryFilter]) {
      setSelectedCategoryFilter('ALL');
    }
  }, [categoryStats.counts, selectedCategoryFilter]);

  // Liste filtrelemesi: hem dataScope hem de selectedCategoryFilter kontrolünden geçer
  const displayedRedactions = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') {
      return scopeRedactions;
    }
    return scopeRedactions.filter((r) => (r.category || 'MANUEL') === selectedCategoryFilter);
  }, [scopeRedactions, selectedCategoryFilter]);

  const handleApproveCategory = (category: string) => {
    if (onApproveCategory) {
      onApproveCategory(category);
    } else {
      displayedRedactions.forEach((item) => {
        if (!item.approved) onToggleRedactionApproval(item.id);
      });
    }
  };

  const handleUnapproveCategory = (category: string) => {
    if (onUnapproveCategory) {
      onUnapproveCategory(category);
    } else {
      displayedRedactions.forEach((item) => {
        if (item.approved) onToggleRedactionApproval(item.id);
      });
    }
  };

  // Katlanmış / Daraltılmış Mod (Küçük Ekranlar & Geniş PDF Görünümü)
  if (isCollapsed) {
    const totalApproved = redactions.filter((r) => r.approved).length;
    return (
      <aside className="w-12 border-l-2 border-[#121316] bg-[#FFFFFF] flex flex-col items-center py-3 shrink-0 z-10 select-none justify-between transition-all duration-200">
        <div className="flex flex-col items-center w-full gap-2">
          {/* Genişletme Oku */}
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 brutal-btn bg-[#F4EFEA] hover:bg-[#1E3A8A] hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#121316]"
            title="Kenar Çubuğunu Genişlet"
            aria-label="Kenar Çubuğunu Genişlet"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="w-6 h-[1.5px] bg-[#121316]/20 my-1" />

          {/* Veri Listesi Sekme Butonu */}
          <button
            onClick={() => {
              setSidebarTab('data');
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-8 h-8 flex items-center justify-center border-2 border-[#121316] transition-colors relative cursor-pointer ${
              sidebarTab === 'data'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'bg-[#FFFFFF] text-[#121316] hover:bg-[#F4EFEA]'
            }`}
            title={`Veri Listesi (${currentPageRedactions.length} bu sayfada / ${redactions.length} toplam)`}
          >
            <FileText className="w-4 h-4" />
            {totalApproved > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 text-white text-[8px] font-mono font-bold rounded-full flex items-center justify-center">
                {totalApproved > 99 ? '99+' : totalApproved}
              </span>
            )}
          </button>

          {/* Filtreler & Ayarlar Butonu */}
          <button
            onClick={() => {
              setSidebarTab('settings');
              if (onToggleCollapse) onToggleCollapse();
            }}
            className={`w-8 h-8 flex items-center justify-center border-2 border-[#121316] transition-colors cursor-pointer ${
              sidebarTab === 'settings'
                ? 'bg-[#1E3A8A] text-white shadow-sm'
                : 'bg-[#FFFFFF] text-[#121316] hover:bg-[#F4EFEA]'
            }`}
            title="Filtreler & Ayarlar (Genişlet)"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Dikey Sekme Etiketi */}
        <div className="my-auto py-4 select-none pointer-events-none">
          <span
            className="text-[10px] font-mono font-black uppercase text-[#575A65] tracking-widest whitespace-nowrap block"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {sidebarTab === 'data' ? 'VERİLER' : 'AYARLAR'}
          </span>
        </div>

        {/* Alt Toplam Sansür Rozeti */}
        <div className="flex flex-col items-center">
          <button
            onClick={onToggleCollapse}
            className="w-7 h-7 bg-[#121316] text-white text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer hover:bg-[#1E3A8A] transition-colors border border-white/20 brutal-shadow-sm"
            title={`${totalApproved} Onaylı Sansür (Genişletmek için tıkla)`}
          >
            {totalApproved}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-96 border-l-2 border-[#121316] bg-[#FFFFFF] flex flex-col shrink-0 z-10 select-none relative transition-all duration-200">
      {/* Sol Kenardaki Katlama / Daraltma Düğmesi (Left Edge Floating Handle) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -left-3.5 top-3 z-30 w-7 h-7 bg-[#FFFFFF] hover:bg-[#1E3A8A] hover:text-white border-2 border-[#121316] text-[#121316] rounded-full brutal-shadow-sm flex items-center justify-center transition-all cursor-pointer shadow-md"
          title="Kenar Çubuğunu Daralt"
          aria-label="Kenar Çubuğunu Daralt"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Üst Sekme Seçici */}
      <div className="flex border-b-2 border-[#121316] bg-[#FFFFFF] shrink-0">
        <button
          onClick={() => setSidebarTab('data')}
          className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 border-r-2 border-[#121316] transition-all cursor-pointer ${
            sidebarTab === 'data'
              ? 'bg-[#F4EFEA] text-[#121316] border-b-4 border-b-[#1E3A8A]'
              : 'bg-[#FFFFFF] text-[#575A65] hover:bg-[#F4EFEA]/50 hover:text-[#121316]'
          }`}
        >
          <FileText className="w-4 h-4 text-[#1E3A8A]" />
          <span>Bu Sayfadaki Veriler</span>
          <span
            className={`text-[10px] font-black px-1.5 py-0.5 rounded-full transition-colors ${
              sidebarTab === 'data'
                ? 'bg-[#1E3A8A] text-white'
                : 'bg-[#121316]/10 text-[#121316]'
            }`}
          >
            {currentPageRedactions.length}
          </span>
        </button>

        <button
          onClick={() => setSidebarTab('settings')}
          className={`flex-1 py-3 px-3 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
            sidebarTab === 'settings'
              ? 'bg-[#F4EFEA] text-[#121316] border-b-4 border-b-[#1E3A8A]'
              : 'bg-[#FFFFFF] text-[#575A65] hover:bg-[#F4EFEA]/50 hover:text-[#121316]'
          }`}
        >
          <Sliders className="w-4 h-4 text-[#121316]" />
          <span>Filtreler & Ayarlar</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#121316]/10 text-[#121316] rounded-full">
            {Object.values(filters).filter(Boolean).length}/12
          </span>
        </button>

        {/* Sekme Barı İçi Daraltma Butonu */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="px-3 border-l-2 border-[#121316] hover:bg-[#F4EFEA] hover:text-[#1E3A8A] text-[#575A65] flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Kenar Çubuğunu Daralt"
            aria-label="Kenar Çubuğunu Daralt"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TAB 1: VERİ LİSTESİ */}
      {sidebarTab === 'data' && (
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          {/* Kompakt Arama Barı */}
          <div className="p-3 border-b-2 border-[#121316] bg-[#F4EFEA] shrink-0">
            <form onSubmit={onSearch} className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#575A65]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Kişi, unvan veya kelime ara..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border-2 border-[#121316] text-xs font-bold text-[#121316] focus:outline-none placeholder:text-[#575A65]"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchTerm.trim()}
                className="brutal-btn px-3 py-1.5 bg-[#121316] text-white text-xs font-black shrink-0 hover:bg-[#1E3A8A] disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? '...' : 'Bul & Kapat'}
              </button>
            </form>
          </div>

          {/* Toplu Eylemler ve Muafiyet Rozeti Barı */}
          <div className="p-2 border-b-2 border-[#121316] bg-[#FFFFFF] flex items-center justify-between gap-2 shrink-0">
            <button
              onClick={onApproveAll}
              className="brutal-btn flex-1 py-1.5 px-2 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Tüm belgedeki varlıkları tek tıkla sansürlemeye dahil et"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tümünü Sansürle</span>
            </button>
            <button
              onClick={onUnapproveAll}
              className="brutal-btn flex-1 py-1.5 px-2 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-[11px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Tüm belgedeki onayları kaldır"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Tümünü Kaldır</span>
            </button>
            {whitelist.length > 0 && (
              <button
                onClick={() => setSidebarTab('settings')}
                className="text-[10px] font-black px-2 py-1.5 bg-[#F4EFEA] border-2 border-[#121316] text-[#1E3A8A] cursor-pointer hover:bg-[#1E3A8A] hover:text-white transition-colors shrink-0"
                title="Muaf tutulan kelimeleri görüntülemek ve düzenlemek için tıklayın"
              >
                {whitelist.length} Muaf
              </button>
            )}
          </div>

          {/* Kapsam (Scope) Seçici */}
          <div className="px-3 py-1.5 border-b border-[#121316] bg-[#F4EFEA] flex items-center justify-between text-xs font-bold shrink-0">
            <span className="text-[10px] font-black uppercase text-[#121316]">
              KAPSAM:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDataScope('current_page')}
                className={`px-2 py-0.5 text-[10px] font-black border transition-colors cursor-pointer ${
                  dataScope === 'current_page'
                    ? 'bg-[#121316] text-white border-[#121316]'
                    : 'bg-[#FFFFFF] text-[#575A65] border-[#121316]/30 hover:text-[#121316]'
                }`}
                title="Yalnızca şu an görüntülenen sayfadaki verileri listele"
              >
                Sayfa {currentPage + 1} ({currentPageRedactions.length})
              </button>
              <button
                onClick={() => setDataScope('all_pages')}
                className={`px-2 py-0.5 text-[10px] font-black border transition-colors cursor-pointer ${
                  dataScope === 'all_pages'
                    ? 'bg-[#121316] text-white border-[#121316]'
                    : 'bg-[#FFFFFF] text-[#575A65] border-[#121316]/30 hover:text-[#121316]'
                }`}
                title="Belgenin tamamındaki verileri listele"
              >
                Tüm Belge ({redactions.length})
              </button>
            </div>
          </div>

          {/* Yatay Kaydırılabilir Neo-Brutalist Kategori Çip Barı */}
          <div className="px-3 py-2 border-b-2 border-[#121316] bg-[#FFFFFF] flex items-center gap-1.5 overflow-x-auto shrink-0 select-none scrollbar-thin">
            {/* [Tümü (X)] Çipi */}
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`group px-2.5 py-1 text-[11px] border-2 border-[#121316] flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                selectedCategoryFilter === 'ALL'
                  ? 'bg-[#1E3A8A] text-white font-black brutal-shadow-sm'
                  : 'bg-[#F4EFEA] text-[#121316] font-bold hover:bg-[#121316] hover:text-white'
              }`}
              title={`Tüm kategorileri göster (${categoryStats.total} varlık)`}
            >
              <span>Tümü</span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full transition-colors ${
                  selectedCategoryFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#121316]/10 text-[#121316] group-hover:bg-white/20 group-hover:text-white'
                }`}
              >
                {categoryStats.total}
              </span>
            </button>

            {/* Dinamik Kategori Çipleri (Yalnızca en az 1 adet bulunan kategoriler) */}
            {categoryStats.sortedCategories.map((catKey) => {
              const isSelected = selectedCategoryFilter === catKey;
              const count = categoryStats.counts[catKey];
              const label = getCategoryLabel(catKey);

              return (
                <button
                  key={catKey}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(isSelected ? 'ALL' : catKey)}
                  className={`group px-2.5 py-1 text-[11px] border-2 border-[#121316] flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#1E3A8A] text-white font-black brutal-shadow-sm'
                      : 'bg-[#F4EFEA] text-[#121316] font-bold hover:bg-[#121316] hover:text-white'
                  }`}
                  title={`${label} (${count}) - Filtrelemek için tıklayın`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full transition-colors ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-[#121316]/10 text-[#121316] group-hover:bg-white/20 group-hover:text-white'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kategori Filtresi Seçiliyken: Kategoriye Özel Toplu Onayla & Kaldır Kolaylığı */}
          {selectedCategoryFilter !== 'ALL' && (
            <div className="px-3 py-1.5 bg-[#F4EFEA] border-b-2 border-[#121316] flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] font-black uppercase text-[#1E3A8A] truncate">
                  {getCategoryLabel(selectedCategoryFilter)}
                </span>
                <span className="text-[10px] font-mono font-bold text-[#575A65]">
                  ({displayedRedactions.length} Varlık)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleApproveCategory(selectedCategoryFilter)}
                  className="brutal-btn px-2 py-1 bg-[#1E3A8A] text-white hover:bg-[#172554] text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                  title={`Seçili ${getCategoryLabel(selectedCategoryFilter)} varlıklarını topluca onayla`}
                >
                  <CheckCheck className="w-3 h-3" />
                  <span>Kategori Onayla</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUnapproveCategory(selectedCategoryFilter)}
                  className="brutal-btn px-2 py-1 bg-[#FFFFFF] text-[#121316] hover:bg-[#121316] hover:text-white text-[10px] font-black flex items-center gap-1 transition-colors cursor-pointer"
                  title={`Seçili ${getCategoryLabel(selectedCategoryFilter)} varlıklarının onayını kaldır`}
                >
                  <XCircle className="w-3 h-3" />
                  <span>Kaldır</span>
                </button>
              </div>
            </div>
          )}

          {/* Dikey Veri Akışı */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {displayedRedactions.length === 0 ? (
              <div className="text-center py-16 px-4 text-xs text-[#575A65] font-medium flex flex-col items-center">
                <div className="w-12 h-12 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-[#121316]" />
                </div>
                <p className="font-bold text-[#121316] mb-1">
                  {selectedCategoryFilter !== 'ALL'
                    ? `"${getCategoryLabel(selectedCategoryFilter)}" kategorisinde veri bulunamadı.`
                    : dataScope === 'current_page'
                    ? `Sayfa ${currentPage + 1}'de tespit edilen veri bulunmuyor.`
                    : 'Belgede tespit edilen hassas veri bulunmuyor.'}
                </p>
                {selectedCategoryFilter !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryFilter('ALL')}
                    className="mt-2 text-[11px] font-bold text-[#1E3A8A] hover:underline cursor-pointer"
                  >
                    Tüm Kategorileri Göster
                  </button>
                ) : (
                  <p className="text-[11px] text-[#575A65] max-w-xs">
                    Yukarıdaki <strong>"Bant Çek"</strong> butonuna basıp fareyle sürükleyerek istediğiniz alanı serbestçe kapatabilirsiniz.
                  </p>
                )}
              </div>
            ) : (
              displayedRedactions.map((item) => {
                const catName = getCategoryLabel(item.category || 'MANUEL');

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredRedactionId?.(item.id)}
                    onMouseLeave={() => setHoveredRedactionId?.(null)}
                    onClick={() => {
                      setSelectedRedactionId?.(item.id);
                      onToggleRedactionApproval(item.id);
                      if (dataScope === 'all_pages') {
                        onScrollToPage(item.page_number);
                      }
                    }}
                    className={`p-2.5 border transition-all cursor-pointer flex items-center justify-between rounded-none ${
                      item.approved
                        ? 'border-neutral-300 bg-white hover:border-[#121316] hover:shadow-[2px_2px_0px_#121316]'
                        : 'border-dashed border-neutral-300 bg-[#F4EFEA]/40 opacity-60 hover:opacity-100 hover:border-[#121316]/70'
                    } ${
                      hoveredRedactionId === item.id || selectedRedactionId === item.id
                        ? 'ring-2 ring-[#1E3A8A] border-[#1E3A8A]!'
                        : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        {dataScope === 'all_pages' && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#121316] text-[#F4EFEA]">
                            S.{item.page_number + 1}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#F4EFEA] text-[#121316] border border-neutral-200">
                          {catName}
                        </span>
                        <span className="text-[10px] text-[#575A65] font-medium">
                          %{Math.round(item.confidence * 100)} Güven
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#121316] truncate" title={item.value}>
                        {item.value || '(Manuel Alan Seçimi)'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Beyaz Listeye Ekle (Muaf Tut) */}
                      {item.value && (
                        <button
                          type="button"
                          onClick={(e) => onAddToWhitelist(item.value, e)}
                          className="p-1 hover:text-[#1E3A8A] text-[#575A65] hover:bg-[#F4EFEA] rounded transition-colors cursor-pointer"
                          title="Bu kelimeyi tüm belgede muaf tut (Beyaz Liste)"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Sil */}
                      <button
                        type="button"
                        onClick={(e) => onRemoveRedaction(item.id, e)}
                        className="p-1 hover:text-rose-600 text-[#575A65] hover:bg-[#F4EFEA] rounded transition-colors cursor-pointer"
                        title="Bu alandaki sansürü sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Onay İmi */}
                      <div
                        className={`w-5 h-5 flex items-center justify-center border transition-all ${
                          item.approved
                            ? 'bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-xs'
                            : 'border-neutral-300 bg-white hover:border-[#121316]'
                        }`}
                      >
                        {item.approved && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FİLTRELER & AYARLAR */}
      {sidebarTab === 'settings' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-[#FFFFFF]">
          {/* KVKK Filtreleri Grubu */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>KVKK Algılama Filtreleri</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onSelectAllFilters}
                  className="text-[10px] font-black text-[#1E3A8A] hover:underline cursor-pointer"
                >
                  Tümünü Seç
                </button>
                <span className="text-xs text-[#575A65]">|</span>
                <button
                  onClick={onDeselectAllFilters}
                  className="text-[10px] font-black text-[#575A65] hover:text-[#121316] hover:underline cursor-pointer"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['tckn', 'TCKN'],
                  ['vkn', 'Vergi No (VKN)'],
                  ['names', 'Kişi İsimleri'],
                  ['companies', 'Şirket Unvanları'],
                  ['dockets', 'Dosya No / Esas'],
                  ['address', 'Adres Bilgileri'],
                  ['identity', 'Kimlik / Aile'],
                  ['iban', 'IBAN'],
                  ['phone', 'Telefon'],
                  ['plate', 'Plaka'],
                  ['property', 'Tapu / Taşınmaz'],
                  ['email', 'E-Posta'],
                ] as const
              ).map(([key, label]) => {
                const isActive = filters[key];
                return (
                  <button
                    key={key}
                    onClick={() => onToggleFilter(key)}
                    className={`brutal-btn text-xs py-2 px-2.5 font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isActive
                        ? 'brutal-btn-primary'
                        : 'bg-[#F4EFEA] text-[#121316] hover:bg-[#EAE3DC]'
                    }`}
                  >
                    <span>{label}</span>
                    {isActive ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <div className="w-3 h-3 border border-[#121316]/40" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                if (pdfMeta) {
                  onRescan();
                  setSidebarTab('data');
                }
              }}
              disabled={isScanning}
              className="w-full mt-2.5 brutal-btn py-2 bg-[#121316] text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Taranıyor...' : 'Filtrelerle Yeniden Tara'}</span>
            </button>
          </div>

          {/* Sansür Görünüm Ayarları */}
          <div className="pt-4 border-t-2 border-[#121316]">
            <span className="block text-xs font-black uppercase text-[#121316] mb-2.5">
              Sansür Görünüm Ayarları
            </span>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setRedactionColor('black')}
                className={`brutal-btn flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                  redactionColor === 'black' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-[#121316] border border-white" />
                <span>Siyah Kutu</span>
              </button>
              <button
                onClick={() => setRedactionColor('white')}
                className={`brutal-btn flex-1 py-2 px-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer ${
                  redactionColor === 'white' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white border border-[#121316]" />
                <span>Beyaz Kutu</span>
              </button>
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setRedactionOverlay('none')}
                className={`brutal-btn flex-1 py-1.5 px-2 text-xs font-bold cursor-pointer ${
                  redactionOverlay === 'none' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                }`}
              >
                Düz Dolgu
              </button>
              <button
                onClick={() => setRedactionOverlay('redacted')}
                className={`brutal-btn flex-1 py-1.5 px-2 text-xs font-bold cursor-pointer ${
                  redactionOverlay === 'redacted' ? 'brutal-btn-primary' : 'bg-white text-[#121316]'
                }`}
              >
                [SANSÜRLENDİ] Metni
              </button>
            </div>

            {/* Canlı Görünüm Önizlemesi */}
            <div className="p-2.5 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#575A65]">Görünüm Önizleme:</span>
              <div
                className={`px-3 py-1 text-[10px] font-black uppercase border ${
                  redactionColor === 'black'
                    ? 'bg-[#121316] text-white border-[#121316]'
                    : 'bg-white text-[#121316] border-[#121316]'
                }`}
              >
                {redactionOverlay === 'redacted' ? '[SANSÜRLENDİ]' : '█████████'}
              </div>
            </div>
          </div>

          {/* Whitelist / Muafiyetler Yönetimi */}
          <div className="pt-4 border-t-2 border-[#121316]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase text-[#121316] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
                <span>Muaf Tutulanlar (Beyaz Liste)</span>
              </span>
              <span className="text-[11px] font-bold text-[#575A65]">
                {whitelist.length} Kelime
              </span>
            </div>

            {whitelist.length === 0 ? (
              <p className="text-xs text-[#575A65] bg-[#F4EFEA] p-3 border-2 border-dashed border-[#121316]/30 leading-relaxed">
                Henüz muaf tutulan kelime yok. Veri listesindeki kalkan (🛡️) butonuna basarak büro unvanı veya vekil ismini tüm belgede sansürden muaf tutabilirsiniz.
              </p>
            ) : (
              <div className="space-y-1.5">
                {whitelist.map((word) => (
                  <div
                    key={word}
                    className="flex items-center justify-between p-2 bg-[#F4EFEA] border-2 border-[#121316] text-xs font-bold text-[#121316]"
                  >
                    <span className="truncate pr-2 font-mono">{word}</span>
                    <button
                      onClick={() => onRemoveFromWhitelist(word)}
                      className="p-1 hover:text-white hover:bg-[#121316] text-[#575A65] transition-colors cursor-pointer"
                      title="Muafiyeti kaldır ve yeniden tara"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
