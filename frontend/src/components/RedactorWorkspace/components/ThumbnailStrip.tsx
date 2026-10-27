import React, { useEffect, useRef, useState } from 'react';
import { Layers, PanelLeftClose, ShieldCheck } from 'lucide-react';
import { api } from '../../../api';
import { PDFMeta, RedactionItem } from '../../../types';

interface ThumbnailStripProps {
  pdfMeta: PDFMeta;
  currentPage: number;
  redactions: RedactionItem[];
  onScrollToPage: (pageIdx: number) => void;
  onClose: () => void;
}

export const ThumbnailStrip: React.FC<ThumbnailStripProps> = ({
  pdfMeta,
  currentPage,
  redactions,
  onScrollToPage,
  onClose,
}) => {
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [loadedImages, setLoadedImages] = useState<Record<number, boolean>>({});

  // Aktif sayfa değiştiğinde ilgili küçük resmi görünür alana pürüzsüz kaydır
  useEffect(() => {
    const el = thumbnailRefs.current[currentPage];
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentPage]);

  return (
    <aside className="w-[130px] h-full border-r-2 border-[#121316] bg-[#FFFFFF] flex flex-col shrink-0 select-none z-10">
      {/* Üst Başlık ve Kapat Butonu */}
      <div className="h-12 border-b-2 border-[#121316] bg-[#F4EFEA] px-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="w-3.5 h-3.5 text-[#1E3A8A] shrink-0" />
          <span className="text-[11px] font-black uppercase text-[#121316] tracking-wider truncate">
            Sayfalar
          </span>
          <span className="px-1 py-0.2 bg-[#FFFFFF] border border-[#121316] text-[10px] font-mono font-bold text-[#121316] shrink-0">
            {pdfMeta.total_pages}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[#121316] hover:text-white text-[#575A65] transition-colors cursor-pointer border border-transparent hover:border-[#121316]"
          title="Sayfa Gezginini Gizle"
          aria-label="Sayfa Gezginini Gizle"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Kaydırılabilir Küçük Önizleme Listesi */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-3 no-scrollbar">
        {pdfMeta.pages.map((pageInfo, pageIdx) => {
          const isActive = currentPage === pageIdx;
          const approvedCount = redactions.filter(
            (r) => r.page_number === pageIdx && r.approved
          ).length;

          // Belge sayfa en-boy oranı (varsayılan A4 oranı: 595 / 842 ≈ 0.707)
          const aspectRatio =
            pageInfo.width && pageInfo.height
              ? `${pageInfo.width} / ${pageInfo.height}`
              : '595 / 842';

          return (
            <button
              key={`thumb_${pageIdx}`}
              ref={(el) => {
                thumbnailRefs.current[pageIdx] = el;
              }}
              onClick={() => onScrollToPage(pageIdx)}
              className="w-full text-left group flex flex-col items-center cursor-pointer focus:outline-none"
              title={`Sayfa ${pageIdx + 1}${approvedCount > 0 ? ` (${approvedCount} onaylı sansür)` : ''}`}
            >
              {/* Küçük Önizleme Kartı */}
              <div
                className={`w-full relative bg-white transition-all overflow-hidden ${
                  isActive
                    ? 'border-2 border-[#1E3A8A] shadow-[2px_2px_0px_0px_#1E3A8A] ring-2 ring-[#1E3A8A]/30'
                    : 'border-2 border-[#121316]/30 hover:border-[#121316] hover:shadow-[2px_2px_0px_0px_#121316]/30'
                }`}
                style={{ aspectRatio }}
              >
                {/* Onaylı Sansür Rozeti (Sağ Üst) */}
                {approvedCount > 0 && (
                  <div
                    className="absolute top-1 right-1 z-10 px-1 py-0.5 bg-[#121316] text-[#FFFFFF] text-[9px] font-mono font-black brutal-shadow-sm flex items-center gap-0.5 border border-white/20"
                    title={`${approvedCount} onaylı sansür`}
                  >
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{approvedCount}</span>
                  </div>
                )}

                {/* Yükleniyor Spinner Göstergesi */}
                {!loadedImages[pageIdx] && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#F4EFEA]/60 z-0">
                    <span className="w-3 h-3 border-2 border-[#121316] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* 50 DPI Düşük Çözünürlüklü Hızlı Küçük Resim (Thumbnail) */}
                <img
                  src={api.getPageImageUrl(pdfMeta.path, pageIdx, 50)}
                  alt={`Sayfa ${pageIdx + 1} Küçük Resim`}
                  loading="lazy"
                  decoding="async"
                  onLoad={() => {
                    setLoadedImages((prev) => ({ ...prev, [pageIdx]: true }));
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.dataset.retried) {
                      target.dataset.retried = 'true';
                      setTimeout(() => {
                        target.src =
                          api.getPageImageUrl(pdfMeta.path, pageIdx, 50) +
                          `&retry=${Date.now()}`;
                      }, 500);
                    }
                  }}
                  className="w-full h-full object-contain block pointer-events-none select-none relative z-0"
                />
              </div>

              {/* Sayfa Numarası Rozeti */}
              <div
                className={`mt-1.5 px-2 py-0.5 text-[10px] font-mono font-bold text-center border transition-all ${
                  isActive
                    ? 'bg-[#1E3A8A] text-white border-[#121316] shadow-[1px_1px_0px_0px_#121316]'
                    : 'bg-[#F4EFEA] text-[#121316] border-[#121316]/30 group-hover:border-[#121316]'
                }`}
              >
                Sayfa {pageIdx + 1}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
