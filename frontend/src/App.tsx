import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WorkspaceMode } from './types';
import { LandingHub } from './components/LandingHub';
import { RedactorWorkspace } from './components/RedactorWorkspace';
import { ConverterWorkspace } from './components/ConverterWorkspace';
import { MergerWorkspace } from './components/MergerWorkspace';
import { ToastProvider } from './context/ToastContext';

export const App: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>('hub');
  const [targetPdf, setTargetPdf] = useState<string | null>(null);
  const [initialConverterFiles, setInitialConverterFiles] = useState<string[]>([]);
  const [initialMergerFiles, setInitialMergerFiles] = useState<string[]>([]);

  const handleSelectMode = (newMode: WorkspaceMode) => {
    if (newMode !== 'redactor') {
      setTargetPdf(null);
    }
    setMode(newMode);
  };

  const handleOpenPdf = (filePath: string) => {
    setTargetPdf(filePath);
    setMode('redactor');
  };

  const handleOpenConverterWithFiles = (files: string[]) => {
    setInitialConverterFiles(files);
    setMode('converter');
  };

  const handleOpenMergerWithFiles = (files: string[]) => {
    setInitialMergerFiles(files);
    setMode('merger');
  };

  return (
    <ToastProvider>
      <div
        className={`w-full h-screen bg-[#FBFBFA] text-[#16171A] select-none ${
          mode === 'hub'
            ? 'overflow-hidden flex flex-col'
            : 'overflow-x-hidden overflow-y-auto'
        }`}
      >
        <AnimatePresence mode="wait">
          {mode === 'hub' && (
            <motion.div
              key="hub"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full h-full flex flex-col overflow-hidden"
            >
              <LandingHub
                onSelectMode={handleSelectMode}
                onOpenPdf={handleOpenPdf}
                onOpenConverterWithFiles={handleOpenConverterWithFiles}
                onOpenMergerWithFiles={handleOpenMergerWithFiles}
              />
            </motion.div>
          )}

          {mode === 'redactor' && (
            <motion.div
              key="redactor"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full min-h-full flex flex-col"
            >
              <RedactorWorkspace
                onBackToHub={() => handleSelectMode('hub')}
                initialPdfPath={targetPdf || undefined}
              />
            </motion.div>
          )}

          {mode === 'converter' && (
            <motion.div
              key="converter"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full min-h-full flex flex-col"
            >
              <ConverterWorkspace
                onBackToHub={() => handleSelectMode('hub')}
                onOpenInRedactor={handleOpenPdf}
                initialFiles={initialConverterFiles}
              />
            </motion.div>
          )}

          {mode === 'merger' && (
            <motion.div
              key="merger"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full min-h-full flex flex-col"
            >
              <MergerWorkspace
                onBackToHub={() => handleSelectMode('hub')}
                onOpenInRedactor={handleOpenPdf}
                initialFiles={initialMergerFiles}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastProvider>
  );
};

export default App;
