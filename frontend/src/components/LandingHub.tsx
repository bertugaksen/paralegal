import React from 'react';
import { ShieldCheck, FileImage, ArrowRight, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceMode } from '../types';

interface LandingHubProps {
  onSelectMode: (mode: WorkspaceMode) => void;
}

export const LandingHub: React.FC<LandingHubProps> = ({ onSelectMode }) => {
  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 max-w-5xl mx-auto bg-[#F4EFEA] text-[#121316] select-none">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between border-b-2 border-[#121316] pb-3 sm:pb-4 shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 bg-[#121316] text-[#F4EFEA] flex items-center justify-center font-black text-lg sm:text-xl rounded-none brutal-shadow-sm shrink-0">
            P
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#121316]">
              PARALEGAL
            </h1>
            <p className="text-[11px] sm:text-xs text-[#575A65] font-semibold">
              Avukatlar için.
            </p>
          </div>
        </div>

        {/* Sağ Üst Güvenlik Rozeti */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-xs font-bold text-[#121316] brutal-shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#121316]" />
            <span>Veriler Güvende</span>
          </div>
        </div>
      </motion.div>

      {/* Main Choice Hub */}
      <div className="my-auto py-4 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className="text-center mb-5 sm:mb-8"
        >
          <span className="inline-block text-[10px] sm:text-[11px] uppercase tracking-widest font-black px-2.5 sm:px-3 py-0.5 sm:py-1 bg-[#121316] text-[#F4EFEA] mb-2">
            İŞLEM SEÇİN
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-[#121316]">
            Ne yapmak istiyorsunuz?
          </h2>
          <p className="text-xs sm:text-sm text-[#575A65] mt-1 max-w-md mx-auto font-medium">
            Lütfen üzerinde çalışmak istediğiniz aracı seçin.
          </p>
        </motion.div>

        {/* 2 Big Neo-Brutalist Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 md:gap-8 max-w-4xl mx-auto">
          {/* Card 1: Redaction */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.12 }}
            onClick={() => onSelectMode('redactor')}
            className="group brutal-card-interactive p-6 sm:p-7 md:p-8 bg-[#FFFFFF] flex flex-col justify-between min-h-[220px] sm:min-h-[240px] md:min-h-[260px] cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150">
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black px-2.5 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-[#121316]">
                  KVKK UYUMLU
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-[#121316] mb-2 tracking-tight">
                Belge Anonimleştir
              </h3>
              <p className="text-xs sm:text-sm text-[#575A65] font-medium leading-relaxed mb-6">
                Dava dilekçeleri, mahkeme kararları ve delil belgelerindeki TCKN, ad-soyad, şirket unvanları ve dosya numaralarını otomatik tespit edip kalıcı olarak sansürleyin.
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('redactor');
              }}
              className="brutal-btn w-full py-3 px-4 bg-[#121316] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            >
              <span>Anonimleştirme Aracını Aç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Card 2: Converter */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: 0.16 }}
            onClick={() => onSelectMode('converter')}
            className="group brutal-card-interactive p-6 sm:p-7 md:p-8 bg-[#FFFFFF] flex flex-col justify-between min-h-[220px] sm:min-h-[240px] md:min-h-[260px] cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150">
                  <FileImage className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-black px-2.5 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-[#121316]">
                  UYAP UYUMLU
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-[#121316] mb-2 tracking-tight">
                Evrak & Tablo Dönüştür
              </h3>
              <p className="text-xs sm:text-sm text-[#575A65] font-medium leading-relaxed mb-6">
                Delil niteliğindeki TIFF, JPEG, PNG taramaları ile hesaplama, ekstre ve faiz içeren Excel (.xlsx, .xls) tablolarını aslına uygun, sütun bölünmesiz UYAP PDF formatına dönüştürün.
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('converter');
              }}
              className="brutal-btn w-full py-3 px-4 bg-[#121316] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors cursor-pointer"
            >
              <span>Dönüştürme Aracını Aç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Alt boşluk dengeleyici (Sıfır kaydırma emniyeti) */}
      <div className="h-2 shrink-0" />
    </div>
  );
};
