import React, { useState } from 'react';
import {
  ArrowLeft,
  FileImage,
  FileSpreadsheet,
  Table,
  Sliders,
  Check,
  Trash2,
  FolderOpen,
  ArrowRight,
  Layers,
  FilePlus,
  RotateCw,
  ChevronUp,
  ChevronDown,
  Shield,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';

interface ConverterWorkspaceProps {
  onBackToHub: () => void;
}

export const ConverterWorkspace: React.FC<ConverterWorkspaceProps> = ({ onBackToHub }) => {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [combineIntoOne, setCombineIntoOne] = useState<boolean>(true);
  const [excelOrientation, setExcelOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [fitAllColumns, setFitAllColumns] = useState<boolean>(true);
  const [repeatHeaderRow, setRepeatHeaderRow] = useState<boolean>(true);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<{
    success: boolean;
    text: string;
    files: string[];
  } | null>(null);

  const hasExcelFiles = selectedPaths.some((p) => /\.(xlsx|xls)$/i.test(p));

  // Dosya Seçim Dialogu
  const handleSelectFiles = async () => {
    try {
      const paths = await api.chooseFiles();
      if (paths && paths.length > 0) {
        // Tekrarsız ekle
        const set = new Set([...selectedPaths, ...paths]);
        const updated = Array.from(set);
        setSelectedPaths(updated);
        setResultMessage(null);
      }
    } catch (err: any) {
      alert(`Dosya seçimi başarısız: ${err.message}`);
    }
  };

  // Listeden dosya kaldır
  const removeFile = (idx: number) => {
    const target = selectedPaths[idx];
    setSelectedPaths((prev) => prev.filter((_, i) => i !== idx));
    setRotations((prev) => {
      const copy = { ...prev };
      delete copy[target];
      return copy;
    });
  };

  // Sıralamayı Yukarı Taşı
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setSelectedPaths((prev) => {
      const copy = [...prev];
      const temp = copy[idx - 1];
      copy[idx - 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  // Sıralamayı Aşağı Taşı
  const moveDown = (idx: number) => {
    if (idx >= selectedPaths.length - 1) return;
    setSelectedPaths((prev) => {
      const copy = [...prev];
      const temp = copy[idx + 1];
      copy[idx + 1] = copy[idx];
      copy[idx] = temp;
      return copy;
    });
  };

  // 90° Saat Yönünde Döndür
  const rotateFile = (path: string) => {
    setRotations((prev) => {
      const current = prev[path] || 0;
      const next = (current + 90) % 360;
      return { ...prev, [path]: next };
    });
  };

  // Dönüştürme İşlemi
  const handleConvert = async () => {
    if (selectedPaths.length === 0) return;

    setIsConverting(true);
    setResultMessage(null);

    try {
      const res = await api.convertImages(
        selectedPaths,
        combineIntoOne,
        rotations,
        undefined,
        {
          orientation: excelOrientation,
          fit_width: fitAllColumns,
          repeat_header: repeatHeaderRow,
        }
      );
      if (res.success) {
        setResultMessage({
          success: true,
          text: combineIntoOne
            ? `${selectedPaths.length} adet evrak/tablo başarıyla tek bir UYAP PDF dosyasında birleştirildi.`
            : `${selectedPaths.length} adet evrak/tablo ayrı ayrı UYAP PDF formatına dönüştürüldü.`,
          files: res.output_paths,
        });
      } else {
        setResultMessage({
          success: false,
          text: `Dönüştürme sırasında hatalar oluştu: ${res.errors.join(', ')}`,
          files: [],
        });
      }
    } catch (err: any) {
      setResultMessage({
        success: false,
        text: `Hata oluştu: ${err.message}`,
        files: [],
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4EFEA] text-[#121316]">
      {/* Top Header */}
      <header className="h-16 border-b-2 border-[#121316] bg-[#FFFFFF] px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToHub}
            className="brutal-btn px-3 py-1.5 bg-[#F4EFEA] hover:bg-[#121316] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ana Menü</span>
          </button>
          <div className="h-5 w-[1.5px] bg-[#121316]/20" />
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#121316]" />
            <h2 className="font-black text-sm tracking-tight">Evrak & Tablo Dönüştürücü (Görsel & Excel)</h2>
          </div>
        </div>

        {/* Üst bardaki mükerrer buton kaldırıldı, sadece liste varsa temizleme butonu durur */}
        <div className="flex items-center gap-3">
          {selectedPaths.length > 0 && (
            <button
              onClick={() => {
                setSelectedPaths([]);
                setRotations({});
              }}
              className="text-xs font-bold text-[#575A65] hover:text-[#121316] flex items-center gap-1 underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Listeyi Temizle</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 flex flex-col justify-between">
        {selectedPaths.length === 0 ? (
          /* Single Expansive Drag & Drop Zone (Boş Durum) */
          <div className="my-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleSelectFiles}
              className="brutal-card p-12 text-center bg-[#FFFFFF] cursor-pointer hover:border-[#1E3A8A] transition-colors border-2 border-dashed border-[#121316]"
            >
              <div className="w-20 h-20 bg-[#F4EFEA] border-2 border-[#121316] flex items-center justify-center mx-auto mb-6 brutal-shadow-sm">
                <FileSpreadsheet className="w-10 h-10 text-[#121316]" />
              </div>

              <h3 className="text-2xl font-black text-[#121316] mb-2">
                Dönüştürülecek Evrak ve Tabloları Seçin
              </h3>
              <p className="text-sm text-[#575A65] max-w-lg mx-auto mb-6 font-medium">
                TIFF, TIF, JPEG, JPG, PNG formatındaki taramaları veya hesaplama/ekstre içeren Excel (.xlsx, .xls) tablolarını seçin. Dosyaları buraya sürükleyip bırakabilir veya tıklayabilirsiniz.
              </p>

              <button className="brutal-btn py-3.5 px-8 bg-[#121316] text-white font-bold text-sm inline-flex items-center gap-2 hover:bg-[#1E3A8A] transition-colors">
                <FolderOpen className="w-4 h-4" />
                <span>Bilgisayardan Dosya Seç</span>
              </button>

              <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[#575A65] font-semibold">
                <span>✓ Excel Akıllı Sütun Sığdırma</span>
                <span>✓ Çok Sayfalı TIFF Desteği</span>
                <span>✓ UYAP Standartlarına Uygun</span>
                <span>✓ %100 Çevrimdışı & Yerel</span>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Selected Files Queue & Action Panel */
          <div className="space-y-6">
            {/* Top Config Card */}
            <div className="brutal-card p-5 bg-[#FFFFFF] flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black uppercase text-[#121316] block mb-1">
                  Dönüştürme Modu
                </span>
                <p className="text-xs text-[#575A65] font-medium">
                  {selectedPaths.length} adet dosya kuyrukta bekliyor.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCombineIntoOne(true)}
                  className={`brutal-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${
                    combineIntoOne ? 'brutal-btn-primary' : 'bg-[#F4EFEA] text-[#121316]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>Tek PDF Olarak Birleştir</span>
                </button>

                <button
                  onClick={() => setCombineIntoOne(false)}
                  className={`brutal-btn px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${
                    !combineIntoOne ? 'brutal-btn-primary' : 'bg-[#F4EFEA] text-[#121316]'
                  }`}
                >
                  <FilePlus className="w-4 h-4" />
                  <span>Ayrı Ayrı PDF Yap</span>
                </button>
              </div>
            </div>

            {/* Excel Configuration Panel (Visible when Excel files exist in queue) */}
            {hasExcelFiles && (
              <div className="brutal-card p-5 bg-[#FFFFFF] border-2 border-[#121316]">
                <div className="flex items-center justify-between border-b-2 border-[#121316] pb-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Table className="w-4 h-4 text-[#1E3A8A]" />
                    <span className="text-xs font-black uppercase text-[#121316]">
                      Excel UYAP Uyum ve Sığdırma Ayarları
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#1E3A8A] text-white">
                    Sütun Bölünmesini Önler
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sayfa Yönlendirmesi */}
                  <div>
                    <label className="text-xs font-bold text-[#121316] block mb-2">
                      Sayfa Yönü (Orientation)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('auto')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'auto'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Tablonun sütun sayısına göre (≥6 sütun ise Yatay) otomatik belirler"
                      >
                        ⚡ Akıllı Otomatik
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('landscape')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'landscape'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Tüm tabloları yatay A4 (Landscape) sayfaya basar"
                      >
                        ↔ Yatay (Geniş Tablo)
                      </button>
                      <button
                        type="button"
                        onClick={() => setExcelOrientation('portrait')}
                        className={`brutal-btn px-3 py-1.5 text-xs font-bold transition-all ${
                          excelOrientation === 'portrait'
                            ? 'bg-[#121316] text-white'
                            : 'bg-[#F4EFEA] text-[#121316]'
                        }`}
                        title="Dikey A4 (Portrait) sayfaya basar"
                      >
                        ↕ Dikey
                      </button>
                    </div>
                  </div>

                  {/* Sığdırma & Başlık Seçenekleri */}
                  <div className="flex flex-col justify-center gap-2.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={fitAllColumns}
                        onChange={(e) => setFitAllColumns(e.target.checked)}
                        className="w-4 h-4 accent-[#1E3A8A] rounded-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#121316]">
                        Tüm Sütunları Tek Sayfa Genişliğine Sığdır (Fit to Width)
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={repeatHeaderRow}
                        onChange={(e) => setRepeatHeaderRow(e.target.checked)}
                        className="w-4 h-4 accent-[#1E3A8A] rounded-none cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#121316]">
                        Tablo Başlık Satırını Her Sayfada Yinele (Repeat Headers)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* List of files with Thumbnail, Rotate, and Reorder */}
            <div className="brutal-card bg-[#FFFFFF] p-4">
              <div className="flex items-center justify-between border-b-2 border-[#121316] pb-2 mb-3">
                <span className="text-xs font-black uppercase text-[#121316]">
                  Dönüştürülecek Evraklar ({selectedPaths.length})
                </span>
                <button
                  onClick={handleSelectFiles}
                  className="brutal-btn px-3 py-1 bg-[#F4EFEA] text-xs font-bold text-[#121316] hover:bg-[#121316] hover:text-white flex items-center gap-1 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>+ Daha Fazla Ekle</span>
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {selectedPaths.map((filePath, index) => {
                  const fileName = filePath.split(/[/\\]/).pop() || filePath;
                  const ext = fileName.split('.').pop()?.toUpperCase() || '';
                  const isExcel = /\.(xlsx|xls)$/i.test(filePath);
                  const rot = rotations[filePath] || 0;

                  return (
                    <div
                      key={filePath}
                      className="p-3 border-2 border-[#121316] bg-[#FFFFFF] flex items-center justify-between brutal-shadow-sm hover:border-[#1E3A8A] transition-all"
                    >
                      {/* Left: Index badge + Thumbnail + Name */}
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                        {/* Sıra Numarası Rozeti */}
                        <div className="w-7 h-7 bg-[#121316] text-white flex items-center justify-center text-xs font-black shrink-0">
                          {index + 1}
                        </div>

                        {/* Canlı Küçük Resim Önizlemesi (Thumbnail / Excel İkonu) */}
                        <div className="w-12 h-12 bg-[#F4EFEA] border border-[#121316] shrink-0 overflow-hidden flex items-center justify-center relative">
                          {isExcel ? (
                            <FileSpreadsheet className="w-6 h-6 text-[#1E3A8A]" />
                          ) : (
                            <img
                              src={api.getImageThumbnailUrl(filePath, rot)}
                              alt={fileName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`px-1.5 py-0.2 border text-[10px] font-black ${
                              isExcel
                                ? 'bg-[#1E3A8A] text-white border-[#1E3A8A]'
                                : 'bg-[#F4EFEA] border-[#121316] text-[#121316]'
                            }`}>
                              {ext}
                            </span>
                            {isExcel ? (
                              <span className="text-[10px] text-[#575A65] font-semibold">
                                {excelOrientation === 'auto' ? '⚡ Akıllı UYAP' : excelOrientation === 'landscape' ? '↔ Yatay' : '↕ Dikey'}
                              </span>
                            ) : (
                              rot > 0 && (
                                <span className="px-1.5 py-0.2 bg-[#1E3A8A] text-white text-[10px] font-black">
                                  {rot}°
                                </span>
                              )
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#121316] truncate" title={filePath}>
                            {fileName}
                          </p>
                        </div>
                      </div>

                      {/* Right: Actions (Rotate, Move Up/Down, Remove) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* 90° Sağa Döndür (Yalnızca görseller için) */}
                        {!isExcel && (
                          <button
                            onClick={() => rotateFile(filePath)}
                            className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white text-xs font-bold"
                            title="90° Sağa Döndür"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Yukarı Taşı */}
                        <button
                          disabled={index === 0}
                          onClick={() => moveUp(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Yukarı Taşı"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>

                        {/* Aşağı Taşı */}
                        <button
                          disabled={index === selectedPaths.length - 1}
                          onClick={() => moveDown(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#121316] hover:bg-[#121316] hover:text-white disabled:opacity-30 disabled:hover:bg-[#F4EFEA] disabled:hover:text-[#121316]"
                          title="Aşağı Taşı"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>

                        {/* Çıkar */}
                        <button
                          onClick={() => removeFile(index)}
                          className="brutal-btn p-1.5 bg-[#F4EFEA] text-[#575A65] hover:bg-[#121316] hover:text-white transition-colors ml-1"
                          title="Listeden Çıkar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sticky Action Dock: Hukuk Laciverti Primary CTA */}
            <div className="brutal-card p-4 bg-[#FFFFFF] flex items-center justify-between">
              <span className="text-xs text-[#575A65] font-semibold">
                Toplam {selectedPaths.length} evrak dönüştürülmeye hazır.
              </span>
              <button
                disabled={isConverting}
                onClick={handleConvert}
                className="brutal-btn-primary py-3.5 px-8 font-black text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isConverting ? 'Dönüştürülüyor...' : 'PDF Olarak Kaydet'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Results Alert (Clean Minimalist Contrast) */}
            <AnimatePresence>
              {resultMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="brutal-card p-5 bg-[#FFFFFF] border-2 border-[#121316]"
                >
                  <div className="flex items-start gap-3">
                    {resultMessage.success ? (
                      <Check className="w-5 h-5 text-[#1E3A8A] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#121316] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <h4 className="text-sm font-black text-[#121316] mb-1">
                        {resultMessage.success ? 'Dönüştürme Tamamlandı!' : 'Hata Oluştu'}
                      </h4>
                      <p className="text-xs text-[#575A65] font-medium mb-3">
                        {resultMessage.text}
                      </p>

                      {resultMessage.files.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-[#121316] block">
                            Oluşturulan Dosyalar:
                          </span>
                          {resultMessage.files.map((f) => (
                            <div
                              key={f}
                              className="text-xs font-mono bg-[#F4EFEA] border border-[#121316] px-2 py-1 select-all"
                            >
                              {f}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t-2 border-[#121316] flex items-center justify-between text-xs text-[#575A65] font-semibold">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#121316]" />
            <span>Tüm işlemler yerel olarak çalışır; hiçbir veri internete aktarılmaz.</span>
          </div>
          <div>Paralegal Hukuk Teknolojileri</div>
        </footer>
      </main>
    </div>
  );
};
