import { useState, useCallback } from 'react';
import { api } from '../../../api';
import { ExcelAnalysis } from '../../../types';

export interface FileItem {
  id: string;
  path: string;
  name: string;
  type: 'image' | 'excel';
  size?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMessage?: string;
  rotation?: number;
  thumbnailUrl?: string;
  excelAnalysis?: ExcelAnalysis;
}

export function useConverterState() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [combinePdfs, setCombinePdfs] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Excel Settings
  const [excelOrientation, setExcelOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [excelFitWidth, setExcelFitWidth] = useState(true);
  const [excelRepeatHeader, setExcelRepeatHeader] = useState(true);

  return {
    files, setFiles,
    isConverting, setIsConverting,
    combinePdfs, setCombinePdfs,
    saveStatus, setSaveStatus,
    excelOrientation, setExcelOrientation,
    excelFitWidth, setExcelFitWidth,
    excelRepeatHeader, setExcelRepeatHeader
  };
}
