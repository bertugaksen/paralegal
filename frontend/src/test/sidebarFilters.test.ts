import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Sidebar } from '../components/RedactorWorkspace/components/Sidebar';
import { getCategoryLabel } from '../components/RedactorWorkspace/hooks/useRedactorState';
import { FilterSettings, RedactionItem, PDFMeta } from '../types';

const mockPdfMeta: PDFMeta = {
  path: 'C:/sample.pdf',
  filename: 'sample.pdf',
  total_pages: 2,
  pages: [
    { page: 0, width: 595, height: 842 },
    { page: 1, width: 595, height: 842 },
  ],
};

const mockFilters: FilterSettings = {
  names: true,
  companies: true,
  dockets: true,
  tckn: true,
  vkn: true,
  iban: true,
  phone: true,
  plate: true,
  email: true,
  address: true,
  identity: true,
  property: true,
};

const mockRedactions: RedactionItem[] = [
  { id: '1', category: 'TARAF_ISMI', value: 'Ahmet Yılmaz', page_number: 0, rect: [10, 10, 50, 20], confidence: 0.95, approved: true },
  { id: '2', category: 'TARAF_ISMI', value: 'Mehmet Demir', page_number: 0, rect: [10, 30, 50, 40], confidence: 0.92, approved: false },
  { id: '3', category: 'TCKN', value: '12345678901', page_number: 0, rect: [10, 50, 50, 60], confidence: 0.99, approved: true },
  { id: '4', category: 'IBAN', value: 'TR123456789012345678901234', page_number: 0, rect: [10, 70, 50, 80], confidence: 0.88, approved: false },
  { id: '5', category: 'ADRES', value: 'Kadıköy / İstanbul', page_number: 1, rect: [10, 10, 50, 20], confidence: 0.91, approved: false },
  { id: '6', category: 'MANUEL', value: '', page_number: 1, rect: [20, 20, 80, 80], confidence: 1.0, approved: true },
];

test('Category labels helper maps technical keys to user-friendly titles', () => {
  assert.strictEqual(getCategoryLabel('TCKN'), 'TCKN');
  assert.strictEqual(getCategoryLabel('TARAF_ISMI'), 'Kişi Adı');
  assert.strictEqual(getCategoryLabel('IBAN'), 'Banka/IBAN');
  assert.strictEqual(getCategoryLabel('ADRES'), 'Adres');
  assert.strictEqual(getCategoryLabel('MANUEL'), 'Manuel');
  assert.strictEqual(getCategoryLabel('SIRKET_UNVANI'), 'Şirket/Kurum');
});

test('Sidebar renders category filter chips bar with dynamic counts in document scope', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Sidebar, {
      sidebarTab: 'data',
      setSidebarTab: () => {},
      dataScope: 'all_pages',
      setDataScope: () => {},
      currentPage: 0,
      pdfMeta: mockPdfMeta,
      redactions: mockRedactions,
      whitelist: [],
      filters: mockFilters,
      setFilters: () => {},
      redactionColor: 'black',
      setRedactionColor: () => {},
      redactionOverlay: 'none',
      setRedactionOverlay: () => {},
      isScanning: false,
      searchTerm: '',
      setSearchTerm: () => {},
      isSearching: false,
      onSearch: () => {},
      onApproveAll: () => {},
      onUnapproveAll: () => {},
      onSelectAllFilters: () => {},
      onDeselectAllFilters: () => {},
      onToggleFilter: () => {},
      onRescan: () => {},
      onToggleRedactionApproval: () => {},
      onRemoveRedaction: () => {},
      onAddToWhitelist: () => {},
      onRemoveFromWhitelist: () => {},
      onScrollToPage: () => {},
    })
  );

  // Check 'Tümü' chip with total count = 6
  assert.ok(html.includes('Tümü'), 'Chip bar should have Tümü chip');
  assert.ok(html.includes('>6<'), 'Total count badge should show 6');

  // Check present categories: Kişi Adı (2), TCKN (1), Banka/IBAN (1), Adres (1), Manuel (1)
  assert.ok(html.includes('Kişi Adı'), 'Chip bar should have Kişi Adı chip');
  assert.ok(html.includes('TCKN'), 'Chip bar should have TCKN chip');
  assert.ok(html.includes('Banka/IBAN'), 'Chip bar should have Banka/IBAN chip');
  assert.ok(html.includes('Adres'), 'Chip bar should have Adres chip');
  assert.ok(html.includes('Manuel'), 'Chip bar should have Manuel chip');

  // Verify non-present categories are NOT rendered
  assert.ok(!html.includes('Plaka'), 'Categories with 0 items should not be rendered');
  assert.ok(!html.includes('E-Posta'), 'Categories with 0 items should not be rendered');

  // Active chip styling check: Tümü should have bg-[#1E3A8A] text-white
  assert.ok(html.includes('bg-[#1E3A8A] text-white font-black brutal-shadow-sm'), 'Default selected chip (Tümü) should have dark blue active styling');
  // Passive chips should have bg-[#F4EFEA]
  assert.ok(html.includes('bg-[#F4EFEA] text-[#121316] font-bold hover:bg-[#121316] hover:text-white'), 'Inactive chips should have warm beige passive styling');
});

test('Sidebar uses soft-brutalist border styling on redaction cards', () => {
  const html = ReactDOMServer.renderToString(
    React.createElement(Sidebar, {
      sidebarTab: 'data',
      setSidebarTab: () => {},
      dataScope: 'all_pages',
      setDataScope: () => {},
      currentPage: 0,
      pdfMeta: mockPdfMeta,
      redactions: mockRedactions,
      whitelist: [],
      filters: mockFilters,
      setFilters: () => {},
      redactionColor: 'black',
      setRedactionColor: () => {},
      redactionOverlay: 'none',
      setRedactionOverlay: () => {},
      isScanning: false,
      searchTerm: '',
      setSearchTerm: () => {},
      isSearching: false,
      onSearch: () => {},
      onApproveAll: () => {},
      onUnapproveAll: () => {},
      onSelectAllFilters: () => {},
      onDeselectAllFilters: () => {},
      onToggleFilter: () => {},
      onRescan: () => {},
      onToggleRedactionApproval: () => {},
      onRemoveRedaction: () => {},
      onAddToWhitelist: () => {},
      onRemoveFromWhitelist: () => {},
      onScrollToPage: () => {},
    })
  );

  // Verify cards use border-neutral-300 and hover:border-[#121316] instead of harsh 2px black borders
  assert.ok(html.includes('border-neutral-300'), 'Cards should use soft-brutalist border-neutral-300');
  assert.ok(html.includes('hover:border-[#121316]'), 'Cards should have hover:border-[#121316]');
});
