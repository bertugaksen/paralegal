import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { WorkspaceMode } from './types';
import { LandingHub } from './components/LandingHub';
import { RedactorWorkspace } from './components/RedactorWorkspace';
import { ConverterWorkspace } from './components/ConverterWorkspace';

export const App: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>('hub');

  return (
    <div className="w-screen h-screen bg-[#F4EFEA] text-[#121316] overflow-hidden select-none">
      <AnimatePresence mode="wait">
        {mode === 'hub' && (
          <motion.div
            key="hub"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full h-full"
          >
            <LandingHub onSelectMode={setMode} />
          </motion.div>
        )}

        {mode === 'redactor' && (
          <motion.div
            key="redactor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full h-full"
          >
            <RedactorWorkspace onBackToHub={() => setMode('hub')} />
          </motion.div>
        )}

        {mode === 'converter' && (
          <motion.div
            key="converter"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full h-full"
          >
            <ConverterWorkspace onBackToHub={() => setMode('hub')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
