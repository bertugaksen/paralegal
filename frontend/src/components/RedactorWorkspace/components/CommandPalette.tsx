import React, { useState, useEffect, useRef } from 'react';
import { Search, Shield, Zap, CheckCheck, XCircle, FileText, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RedactionItem, PDFMeta } from '../../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  pdfMeta: PDFMeta | null;
  redactions: RedactionItem[];
  onApproveAll: () => void;
  onUnapproveAll: () => void;
  onScrollToPage: (pageIdx: number) => void;
  onToggleDrawTool: () => void;
  onToggleFocusMode: () => void;
  onSave: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  pdfMeta,
  redactions,
  onApproveAll,
  onUnapproveAll,
  onScrollToPage,
  onToggleDrawTool,
  onToggleFocusMode,
  onSave,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const quickCommands = [
    {
      id: 'approve_all',
      title: 'Tüm Hassas Verileri Onayla',
      subtitle: `${redactions.length} tespit edilen varlığı sansürlenecek olarak işaretle`,
      icon: <CheckCheck className="w-4 h-4 text-emerald-600" />,
      action: () => {
        onApproveAll();
        onClose();
      },
    },
    {
      id: 'unapprove_all',
      title: 'Tüm Onayları Kaldır',
      subtitle: 'Sansür işaretlerini temizle',
      icon: <XCircle className="w-4 h-4 text-rose-600" />,
      action: () => {
        onUnapproveAll();
        onClose();
      },
    },
    {
      id: 'toggle_focus',
      title: 'Zen Odak Modunu Aç / Kapat',
      subtitle: 'Yalnızca belgeye odaklan (Kısayol: F)',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      action: () => {
        onToggleFocusMode();
        onClose();
      },
    },
    {
      id: 'toggle_draw',
      title: 'Bant Çekme Modu (Serbest Dikdörtgen)',
      subtitle: 'Fareyle serbest alan kapatma (Kısayol: B)',
      icon: <FileText className="w-4 h-4 text-[#0E254A]" />,
      action: () => {
        onToggleDrawTool();
        onClose();
      },
    },
    {
      id: 'save_doc',
      title: 'Adli Mühürle ve Kaydet',
      subtitle: 'KVKK uyumlu güvenli PDF oluştur (Kısayol: Ctrl+S)',
      icon: <Shield className="w-4 h-4 text-[#8B1E1E]" />,
      action: () => {
        onSave();
        onClose();
      },
    },
  ];

  const filteredCommands = quickCommands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[#16171A]/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#FFFFFF] border-2 border-[#16171A] brutal-shadow flex flex-col overflow-hidden"
      >
        {/* Arama Girişi */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[rgba(22,23,26,0.12)] bg-[#FBFBFA]">
          <Search className="w-4 h-4 text-[#5A5D66] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bir komut veya eylem arayın... (Örn: Onayla, Odak, Mühürle)"
            className="flex-1 bg-transparent border-none outline-hidden text-xs font-bold text-[#16171A] placeholder:text-[#5A5D66]"
          />
          <kbd className="kbd-cap">ESC</kbd>
        </div>

        {/* Komut Listesi */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5A5D66] font-medium">
              Eşleşen komut bulunamadı.
            </div>
          ) : (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={cmd.action}
                className="w-full text-left p-2.5 flex items-center justify-between gap-3 hover:bg-[#F3EFEA] border border-transparent hover:border-[#16171A] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 bg-white border border-[rgba(22,23,26,0.12)] flex items-center justify-center shrink-0">
                    {cmd.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#16171A] group-hover:text-[#0E254A] truncate">
                      {cmd.title}
                    </p>
                    <p className="text-[10px] text-[#5A5D66] truncate font-medium">
                      {cmd.subtitle}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#5A5D66] group-hover:text-[#16171A] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Alt Kısayol Bilgisi */}
        <div className="px-4 py-2 border-t border-[rgba(22,23,26,0.08)] bg-[#F3EFEA] text-[10px] text-[#5A5D66] flex items-center justify-between font-mono">
          <span>Adli Hızlı Komut Konsolu</span>
          <span>Ctrl + K</span>
        </div>
      </motion.div>
    </div>
  );
};
