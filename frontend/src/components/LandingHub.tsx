import React from 'react';
import { ShieldCheck, FileImage, ArrowRight, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceMode } from '../types';

interface LandingHubProps {
  onSelectMode: (mode: WorkspaceMode) => void;
}

export const LandingHub: React.FC<LandingHubProps> = ({ onSelectMode }) => {
  return (
    <div className="w-full h-full flex flex-col justify-between p-6 sm:p-8 md:p-10 lg:p-12 max-w-5xl xl:max-w-6xl mx-auto bg-[#F4EFEA] text-[#121316] select-none">
      {/* Üst Başlık ve Güvenlik Göstergesi */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between border-b-2 border-[#121316] pb-4 sm:pb-5 shrink-0"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#121316] text-[#F4EFEA] flex items-center justify-center font-black text-lg sm:text-2xl rounded-none brutal-shadow-sm shrink-0">
            P
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#121316] leading-none">
              PARALEGAL
            </h1>
            <p className="text-[11px] sm:text-xs text-[#575A65] font-semibold mt-1">
              Avukatlar için yerel ve adli güvenlikli çalışma alanı.
            </p>
          </div>
        </div>

        {/* Sağ Üst Güvenlik Rozeti */}
        <div className="flex items-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 bg-[#FFFFFF] border-2 border-[#121316] text-xs font-black text-[#121316] brutal-shadow-sm tracking-wide">
            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1E3A8A] shrink-0" />
            <span className="hidden xs:inline">Veriler Güvende</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </div>
        </div>
      </motion.div>

      {/* Ana Seçim Merkezi */}
      <div className="my-auto py-6 sm:py-8 md:py-10 w-full">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className="text-center mb-6 sm:mb-8 md:mb-10"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight text-[#121316] leading-tight">
            Ne yapmak istiyorsunuz?
          </h2>
          <p className="text-xs sm:text-sm md:text-base text-[#575A65] mt-2 max-w-lg mx-auto font-medium">
            Lütfen üzerinde çalışmak istediğiniz aracı seçin.
          </p>
        </motion.div>

        {/* 2 Büyük Etkileşimli Mod Kartı */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 max-w-4xl lg:max-w-5xl mx-auto w-full">
          {/* Kart 1: Anonimleştirme (Redaction) */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            role="button"
            tabIndex={0}
            onClick={() => onSelectMode('redactor')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectMode('redactor');
              }
            }}
            aria-label="Belge Anonimleştirme Aracını Aç"
            className="group brutal-card-interactive p-6 sm:p-8 lg:p-9 bg-[#FFFFFF] flex flex-col justify-between min-h-[260px] sm:min-h-[290px] md:min-h-[310px] cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150 shrink-0">
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] border-2 border-[#121316] brutal-shadow-sm shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-[#121316] font-mono leading-none">
                    KVKK UYUMLU
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-[#121316] mb-2.5 tracking-tight group-hover:text-[#1E3A8A] transition-colors">
                Belge Anonimleştir
              </h3>
              <p className="text-xs sm:text-sm text-[#575A65] font-medium leading-relaxed mb-6 sm:mb-8">
                Belgelerdeki hassas verileri otomatik tespit edip kalıcı olarak sansürleyin.
              </p>
            </div>

            <div className="brutal-btn w-full py-3.5 px-4 bg-[#121316] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors select-none">
              <span>Anonimleştirme Aracını Aç</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </motion.div>

          {/* Kart 2: Dönüştürme (Converter) */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.16 }}
            role="button"
            tabIndex={0}
            onClick={() => onSelectMode('converter')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectMode('converter');
              }
            }}
            aria-label="Belge & Tablo Dönüştürme Aracını Aç"
            className="group brutal-card-interactive p-6 sm:p-8 lg:p-9 bg-[#FFFFFF] flex flex-col justify-between min-h-[260px] sm:min-h-[290px] md:min-h-[310px] cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-5 sm:mb-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150 shrink-0">
                  <FileImage className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFFFFF] border-2 border-[#121316] brutal-shadow-sm shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#1E3A8A] shrink-0" />
                  <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-[#121316] font-mono leading-none">
                    UYAP UYUMLU
                  </span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-[#121316] mb-2.5 tracking-tight group-hover:text-[#1E3A8A] transition-colors">
                Belge & Tablo Dönüştür
              </h3>
              <p className="text-xs sm:text-sm text-[#575A65] font-medium leading-relaxed mb-6 sm:mb-8">
                Belgelerinizi UYAP'ın boyut sınırını aşmayacak şekilde PDF formatına dönüştürün.
              </p>
            </div>

            <div className="brutal-btn w-full py-3.5 px-4 bg-[#121316] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors select-none">
              <span>Dönüştürme Aracını Aç</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Alt Bilgi / Güvenlik ve Uyumluluk Notu */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25, delay: 0.2 }}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] sm:text-xs text-[#575A65] font-semibold border-t border-[#121316]/10 pt-3 sm:pt-4 shrink-0"
      >
        <span>⚡ Tamamen Çevrimdışı Çalışır</span>
        <span className="hidden sm:inline text-[#121316]/30">•</span>
        <span>🔒 Dosyalar Asla Cihazınızdan Ayrılmaz</span>
        <span className="hidden sm:inline text-[#121316]/30">•</span>
        <span>⚖️ Türk Yargı Standartlarına Uygun</span>
      </motion.div>
    </div>
  );
};
