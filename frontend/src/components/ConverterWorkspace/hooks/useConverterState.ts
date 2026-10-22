import { useState } from 'react';

export function useConverterState() {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [rotations, setRotations] = useState<Record<string, number>>({});
  const [combineIntoOne, setCombineIntoOne] = useState<boolean>(true);
  const [excelOrientation, setExcelOrientation] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [fitAllColumns, setFitAllColumns] = useState<boolean>(true);
  const [repeatHeaderRow, setRepeatHeaderRow] = useState<boolean>(true);
  const [targetDirectory, setTargetDirectory] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<{
    success: boolean;
    text: string;
    files: string[];
  } | null>(null);

  return {
    selectedPaths, setSelectedPaths,
    rotations, setRotations,
    combineIntoOne, setCombineIntoOne,
    excelOrientation, setExcelOrientation,
    fitAllColumns, setFitAllColumns,
    repeatHeaderRow, setRepeatHeaderRow,
    targetDirectory, setTargetDirectory,
    isConverting, setIsConverting,
    resultMessage, setResultMessage
  };
}
