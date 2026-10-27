import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_CONFIG = {
  success: {
    badge: 'BAŞARILI',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-[#121316]',
    accentColor: 'bg-emerald-500',
    iconColor: 'text-emerald-600',
    progressColor: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  error: {
    badge: 'HATA',
    badgeClass: 'bg-rose-100 text-rose-900 border-[#121316]',
    accentColor: 'bg-rose-500',
    iconColor: 'text-rose-600',
    progressColor: 'bg-rose-500',
    Icon: XCircle,
  },
  warning: {
    badge: 'UYARI',
    badgeClass: 'bg-amber-100 text-amber-900 border-[#121316]',
    accentColor: 'bg-amber-500',
    iconColor: 'text-amber-600',
    progressColor: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  info: {
    badge: 'BİLGİ',
    badgeClass: 'bg-blue-100 text-blue-900 border-[#121316]',
    accentColor: 'bg-[#1E3A8A]',
    iconColor: 'text-[#1E3A8A]',
    progressColor: 'bg-[#1E3A8A]',
    Icon: Info,
  },
};

interface ToastCardProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast, onClose }) => {
  const { id, type, message, duration = 3500 } = toast;
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const { Icon } = config;

  useEffect(() => {
    if (!duration || duration <= 0) return;
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="pointer-events-auto w-full max-w-sm sm:max-w-md bg-[#FFFFFF] border-2 border-[#121316] shadow-[3px_3px_0px_#121316] flex flex-col overflow-hidden select-text"
      role="alert"
    >
      <div className="flex items-stretch min-h-[56px]">
        {/* Sol Renkli Şerit */}
        <div className={`w-2 shrink-0 ${config.accentColor}`} />

        {/* Gövde */}
        <div className="flex-1 p-3 flex items-start gap-2.5 min-w-0">
          <div className="pt-0.5 shrink-0">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${config.badgeClass}`}
              >
                {config.badge}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#121316] leading-snug break-words">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onClose(id)}
            className="shrink-0 p-1 text-[#575A65] hover:text-[#121316] hover:bg-[#F4EFEA] border border-transparent hover:border-[#121316] transition-colors cursor-pointer"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3.5s Otomatik Kapanma Zaman Çizgisi */}
      {duration > 0 && (
        <div className="w-full h-1 bg-[#F4EFEA] border-t border-[#121316]/10 overflow-hidden">
          <motion.div
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            className={`h-full ${config.progressColor}`}
          />
        </div>
      )}
    </motion.div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, message, duration };
      // En son 5 toasta kadar göster
      setToasts((prev) => [...prev.slice(-4), newToast]);
    },
    []
  );

  const toast = useMemo(
    () => ({
      success: (msg: string, dur?: number) => showToast(msg, 'success', dur),
      error: (msg: string, dur?: number) => showToast(msg, 'error', dur),
      warning: (msg: string, dur?: number) => showToast(msg, 'warning', dur),
      info: (msg: string, dur?: number) => showToast(msg, 'info', dur),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast, toast }}>
      {children}
      {/* Toast Konteyneri - Ekranın Sağ Üst Köşesi */}
      <div
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((item) => (
            <ToastCard key={item.id} toast={item} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
