import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Toolbar } from '../components/RedactorWorkspace/components/Toolbar';
import { PDFMeta } from '../types';

const mockPdfMeta: PDFMeta = {
  path: 'C:/sample.pdf',
  filename: 'sample.pdf',
  total_pages: 3,
  pages: [
    { page: 0, width: 595, height: 842 },
    { page: 1, width: 595, height: 842 },
    { page: 2, width: 595, height: 842 },
  ],
};

test('Toolbar: Renders Undo/Redo buttons with disabled attribute when canUndo/canRedo are false', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Toolbar, {
      onBackToHub: () => {},
      pdfMeta: mockPdfMeta,
      currentPage: 0,
      totalApproved: 2,
      zoom: 100,
      isScanning: false,
      isSaving: false,
      drawToolActive: false,
      canUndo: false,
      canRedo: false,
      onUndo: () => {},
      onRedo: () => {},
      onPrevPage: () => {},
      onNextPage: () => {},
      onScrollToCurrentPage: () => {},
      onZoomIn: () => {},
      onZoomOut: () => {},
      onToggleFitOrFull: () => {},
      onToggleDrawTool: () => {},
      onRescan: () => {},
      onSave: () => {},
    })
  );

  // Extract the button containing title="Geri Al (Ctrl+Z)"
  const geriAlMatch = html.match(/<button[^>]*title="Geri Al \(Ctrl\+Z\)"[^>]*>/);
  assert.ok(geriAlMatch, 'Geri Al button should be rendered');
  // Check for the HTML attribute disabled="" (not the tailwind class disabled:)
  assert.match(geriAlMatch[0], /\bdisabled=""/, 'Geri Al button must have HTML disabled attribute when canUndo=false');

  // Extract the button containing title="İleri Al (Ctrl+Y)"
  const ileriAlMatch = html.match(/<button[^>]*title="İleri Al \(Ctrl\+Y\)"[^>]*>/);
  assert.ok(ileriAlMatch, 'İleri Al button should be rendered');
  assert.match(ileriAlMatch[0], /\bdisabled=""/, 'İleri Al button must have HTML disabled attribute when canRedo=false');
});

test('Toolbar: Renders Undo/Redo buttons without disabled attribute when canUndo and canRedo are true', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Toolbar, {
      onBackToHub: () => {},
      pdfMeta: mockPdfMeta,
      currentPage: 0,
      totalApproved: 2,
      zoom: 100,
      isScanning: false,
      isSaving: false,
      drawToolActive: false,
      canUndo: true,
      canRedo: true,
      onUndo: () => {},
      onRedo: () => {},
      onPrevPage: () => {},
      onNextPage: () => {},
      onScrollToCurrentPage: () => {},
      onZoomIn: () => {},
      onZoomOut: () => {},
      onToggleFitOrFull: () => {},
      onToggleDrawTool: () => {},
      onRescan: () => {},
      onSave: () => {},
    })
  );

  const geriAlMatch = html.match(/<button[^>]*title="Geri Al \(Ctrl\+Z\)"[^>]*>/);
  assert.ok(geriAlMatch, 'Geri Al button found');
  assert.ok(!/\bdisabled=""/.test(geriAlMatch[0]), 'Geri Al button must NOT have HTML disabled attribute when canUndo=true');

  const ileriAlMatch = html.match(/<button[^>]*title="İleri Al \(Ctrl\+Y\)"[^>]*>/);
  assert.ok(ileriAlMatch, 'İleri Al button found');
  assert.ok(!/\bdisabled=""/.test(ileriAlMatch[0]), 'İleri Al button must NOT have HTML disabled attribute when canRedo=true');
});
