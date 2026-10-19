import React from 'react';
import { ShieldCheck, FileImage, ArrowRight, Lock, Shield } from 'lucide-react';
import { motion } from 'motion/react';
import { WorkspaceMode } from '../types';

interface LandingHubProps {
  onSelectMode: (mode: WorkspaceMode) => void;
}

export const LandingHub: React.FC<LandingHubProps> = ({ onSelectMode }) => {
  return (
    <div className="min-h-screen flex flex-col justify-between p-8 md:p-12 max-w-6xl mx-auto bg-[#F4EFEA] text-[#121316]">
      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between border-b-2 border-[#121316] pb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#121316] text-[#F4EFEA] flex items-center justify-center font-black text-xl rounded-none brutal-shadow-sm">
            P
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-[#121316]">
              PARALEGAL
              <span className="text-xs font-bold px-2 py-0.5 bg-[#FFFFFF] border border-[#121316] text-[#121316]">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-[#575A65] font-medium">
              Avukatlar İçin Yerel KVKK Uyumlu Belge İşleme ve Redaksiyon Motoru
            </p>
          </div>
        </div>

        {/* Kurumsal Çift Güvenlik Rozeti */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-xs font-bold text-[#121316] brutal-shadow-sm">
            <Lock className="w-3.5 h-3.5 text-[#121316]" />
            <span>KVKK Uyumlu</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-xs font-bold text-[#121316] brutal-shadow-sm">
            <Shield className="w-3.5 h-3.5 text-[#121316]" />
            <span>Veriler Güvende</span>
          </div>
        </div>
      </motion.div>

      {/* Main Choice Hub */}
      <div className="my-auto py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-center mb-10"
        >
          <span className="inline-block text-[11px] uppercase tracking-widest font-black px-3 py-1 bg-[#121316] text-[#F4EFEA] mb-3">
            İŞLEM SEÇİN
          </span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[#121316]">
            Ne yapmak istiyorsunuz?
          </h2>
          <p className="text-sm text-[#575A65] mt-2 max-w-md mx-auto font-medium">
            Lütfen üzerinde çalışmak istediğiniz aracı seçin.
          </p>
        </motion.div>

        {/* 2 Big Neo-Brutalist Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Redaction */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            onClick={() => onSelectMode('redactor')}
            className="group brutal-card-interactive p-7 bg-[#FFFFFF] flex flex-col justify-between min-h-[350px]"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-[#121316]">
                  UYAP UYUMLU
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#121316] mb-2 tracking-tight">
                Belge Anonimleştir
              </h3>
              <p className="text-sm text-[#575A65] font-medium leading-relaxed mb-6">
                Dava dilekçeleri, mahkeme kararları ve delil belgelerindeki TCKN, ad-soyad, şirket unvanları ve dosya numaralarını otomatik tespit edip kalıcı olarak sansürleyin.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {['TCKN', 'Kişi Adı', 'Şirket Unvanı', 'Dosya No', 'IBAN'].map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-bold px-2 py-0.5 bg-[#F4EFEA] border border-[#121316] text-[#121316]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('redactor');
              }}
              className="brutal-btn w-full py-3.5 px-4 bg-[#121316] text-white font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors"
            >
              <span>Anonimleştirme Aracını Aç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>

          {/* Card 2: Converter */}
          <motion.div
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            onClick={() => onSelectMode('converter')}
            className="group brutal-card-interactive p-7 bg-[#FFFFFF] flex flex-col justify-between min-h-[350px]"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center text-[#121316] group-hover:bg-[#121316] group-hover:text-white transition-colors duration-150">
                  <FileImage className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-black px-2.5 py-1 bg-[#FFFFFF] border-2 border-[#121316] text-[#121316]">
                  UYAP UYUMLU
                </span>
              </div>

              <h3 className="text-2xl font-black text-[#121316] mb-2 tracking-tight">
                Görsel Dönüştür
              </h3>
              <p className="text-sm text-[#575A65] font-medium leading-relaxed mb-6">
                Delil niteliğindeki tekli veya çoklu sayfa TIFF, JPEG ve PNG taramalarını kalite kaybı yaşamadan tek tıkla standart PDF formatına dönüştürün.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-6">
                {['Çok Sayfalı TIFF', 'JPEG / PNG', 'Toplu Birleştirme'].map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] font-bold px-2 py-0.5 bg-[#F4EFEA] border border-[#121316] text-[#121316]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectMode('converter');
              }}
              className="brutal-btn w-full py-3.5 px-4 bg-[#121316] text-white font-bold text-sm flex items-center justify-center gap-2 group-hover:bg-[#1E3A8A] transition-colors"
            >
              <span>Dönüştürme Aracını Aç</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>

      {/* Footer Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="border-t-2 border-[#121316] pt-4 flex flex-col md:flex-row items-center justify-between text-xs text-[#575A65] gap-2 font-semibold"
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-none bg-[#121316] inline-block"></span>
          <span>Yerel Python ve PyMuPDF Motoru Aktif</span>
        </div>
        <div>
          <span>Paralegal Hukuk Teknolojileri • KVKK ve Avukatlık Meslek Kuralları Uyumlu</span>
        </div>
      </motion.div>
    </div>
  );
};
