import React from 'react';
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
  ShieldCheck
} from 'lucide-react';
import { FilterSettings, RedactionItem, PDFMeta } from '../../../types';
import { CATEGORY_NAMES } from '../hooks/useRedactorState';

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
}) => {
  const currentPageRedactions = redactions.filter((r) => r.page_number === currentPage);
  const displayedRedactions = dataScope === 'current_page' ? currentPageRedactions : redactions;

  return (
    <aside className="w-96 border-l-2 border-[#121316] bg-[#FFFFFF] flex flex-col shrink-0 z-10 select-none">
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

          {/* Dikey Veri Akışı */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {displayedRedactions.length === 0 ? (
              <div className="text-center py-16 px-4 text-xs text-[#575A65] font-medium flex flex-col items-center">
                <div className="w-12 h-12 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-[#121316]" />
                </div>
                <p className="font-bold text-[#121316] mb-1">
                  {dataScope === 'current_page'
                    ? `Sayfa ${currentPage + 1}'de tespit edilen veri bulunmuyor.`
                    : 'Belgede tespit edilen hassas veri bulunmuyor.'}
                </p>
                <p className="text-[11px] text-[#575A65] max-w-xs">
                  Yukarıdaki <strong>"Bant Çek"</strong> butonuna basıp fareyle sürükleyerek istediğiniz alanı serbestçe kapatabilirsiniz.
                </p>
              </div>
            ) : (
              displayedRedactions.map((item) => {
                const catName = CATEGORY_NAMES[item.category] || item.category;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onToggleRedactionApproval(item.id);
                      if (dataScope === 'all_pages') {
                        onScrollToPage(item.page_number);
                      }
                    }}
                    className={`p-2.5 border-2 transition-all cursor-pointer flex items-center justify-between ${
                      item.approved
                        ? 'border-[#121316] bg-[#FFFFFF] brutal-shadow-sm'
                        : 'border-dashed border-[#121316]/40 bg-[#F4EFEA] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        {dataScope === 'all_pages' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#121316] text-[#F4EFEA] border border-[#121316]">
                            S.{item.page_number + 1}
                          </span>
                        )}
                        <span className="text-[10px] font-black px-1.5 py-0.5 border border-[#121316] bg-[#F4EFEA] text-[#121316]">
                          {catName}
                        </span>
                        <span className="text-[10px] text-[#575A65] font-bold">
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
                          onClick={(e) => onAddToWhitelist(item.value, e)}
                          className="p-1 hover:text-[#1E3A8A] text-[#575A65] hover:bg-[#F4EFEA] rounded cursor-pointer"
                          title="Bu kelimeyi tüm belgede muaf tut (Beyaz Liste)"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Sil */}
                      <button
                        onClick={(e) => onRemoveRedaction(item.id, e)}
                        className="p-1 hover:text-[#121316] text-[#575A65] hover:bg-[#F4EFEA] rounded cursor-pointer"
                        title="Bu alandaki sansürü sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Onay İmi */}
                      <div
                        className={`w-5 h-5 flex items-center justify-center border-2 border-[#121316] ${
                          item.approved ? 'bg-[#1E3A8A] text-white' : 'bg-white'
                        }`}
                      >
                        {item.approved && <Check className="w-3.5 h-3.5" />}
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
