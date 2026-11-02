import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  mergePdfsClientSide,
  convertImagesToPdfClientSide,
  inspectFiles,
  downloadBlob,
  isOutlookEmailFile,
  isPdfFile,
  isSupportedImageFile,
  formatBytes,
  MAX_CLIENT_PAGES,
  MAX_CLIENT_SIZE_BYTES,
} from '../services/clientPdfEngine';

// Helper to create a dummy PDF in memory with a specified page count
async function createTestPdfFile(filename: string, pageCount: number): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdfDoc.addPage([595.28, 841.89]);
  }
  const bytes = await pdfDoc.save();
  return new File([bytes as unknown as BlobPart], filename, { type: 'application/pdf' });
}

// 1x1 Transparent PNG bytes
const MINIMAL_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

// 10x10 Solid JPEG bytes
const MINIMAL_JPG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAKAAoDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z';
const MINIMAL_JPG_BYTES = Buffer.from(MINIMAL_JPG_BASE64, 'base64');

// ============================================================================
// 1. HELPER & FORMAT UTILITIES
// ============================================================================
test('Format and File Extension Detectors', () => {
  // Outlook detection
  assert.equal(isOutlookEmailFile('dava_dosyasi.msg'), true);
  assert.equal(isOutlookEmailFile('tebligat.eml'), true);
  assert.equal(isOutlookEmailFile('DELIL_LISTESI.MSG'), true);
  assert.equal(isOutlookEmailFile('dilekce.pdf'), false);

  // PDF detection
  const pdfFile = new File(['%PDF-1.4'], 'ornek.pdf', { type: 'application/pdf' });
  assert.equal(isPdfFile(pdfFile), true);

  // Image detection
  const jpgFile = new File([MINIMAL_JPG_BYTES], 'vesikalik.jpg', { type: 'image/jpeg' });
  const pngFile = new File([MINIMAL_PNG_BYTES], 'makbuz.png', { type: 'image/png' });
  const txtFile = new File(['metin'], 'notlar.txt', { type: 'text/plain' });
  assert.equal(isSupportedImageFile(jpgFile), true);
  assert.equal(isSupportedImageFile(pngFile), true);
  assert.equal(isSupportedImageFile(txtFile), false);

  // Byte formatting
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(10 * 1024 * 1024), '10 MB');
});

// ============================================================================
// 2. INSPECT FILES (Limits & Thresholds)
// ============================================================================
test('inspectFiles: Normal compliant files (under 10 pages, under 10 MB)', async () => {
  const pdf1 = await createTestPdfFile('belge1.pdf', 3);
  const pdf2 = await createTestPdfFile('belge2.pdf', 2);
  const img1 = new File([MINIMAL_PNG_BYTES], 'kimlik.png', { type: 'image/png' });

  const result = await inspectFiles([pdf1, pdf2, img1]);
  assert.equal(result.totalPages, 6);
  assert.equal(result.hasMsgFile, false);
  assert.equal(result.exceedsLimit, false);
  assert.equal(result.reasons.length, 0);
  assert.ok(result.totalSizeBytes > 0);
});

test('inspectFiles: Exceeds 10-page limit triggers formal Turkish explanation', async () => {
  const bigPdf = await createTestPdfFile('buyuk_dosya.pdf', 12);

  const result = await inspectFiles([bigPdf]);
  assert.equal(result.totalPages, 12);
  assert.equal(result.exceedsLimit, true);
  assert.ok(result.reasons.length > 0);
  assert.ok(
    result.reasons.some((r) => r.includes('12 sayfa') && r.includes('10 sayfayı aşmaktadır')),
    'Should contain formal Turkish explanation of page limit'
  );
});

test('inspectFiles: Detects Outlook .msg and .eml files with formal explanation', async () => {
  const msgFile = new File(['DUMMY MSG CONTENT'], 'avukat_iletisi.msg', {
    type: 'application/vnd.ms-outlook',
  });

  const result = await inspectFiles([msgFile]);
  assert.equal(result.hasMsgFile, true);
  assert.equal(result.exceedsLimit, true);
  assert.ok(
    result.reasons.some((r) => r.includes('Outlook e-posta dosyası') && r.includes('sunucu tabanlı')),
    'Should contain formal Turkish explanation about Outlook email parser requirement'
  );
});

test('inspectFiles: Exceeds 10 MB size limit triggers formal Turkish explanation', async () => {
  // Simulate large file by creating a 10.5 MB mock file
  const largeSize = 11 * 1024 * 1024;
  const largeMockFile = {
    name: 'agir_belge.pdf',
    size: largeSize,
    type: 'application/pdf',
    arrayBuffer: async () => {
      // Minimal valid 1-page PDF buffer so page count works
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage();
      return (await pdfDoc.save()).buffer;
    },
  } as unknown as File;

  const result = await inspectFiles([largeMockFile]);
  assert.equal(result.totalSizeBytes, largeSize);
  assert.equal(result.exceedsLimit, true);
  assert.ok(
    result.reasons.some((r) => r.includes('UYAP yükleme') && r.includes('10 MB')),
    'Should contain formal Turkish explanation about UYAP 10 MB limit'
  );
});

// ============================================================================
// 3. MERGE PDFS CLIENT-SIDE
// ============================================================================
test('mergePdfsClientSide: Empty list throws error', async () => {
  await assert.rejects(
    async () => {
      await mergePdfsClientSide([]);
    },
    {
      message: 'Birleştirme işlemi için en az bir PDF dosyası seçilmelidir.',
    }
  );
});

test('mergePdfsClientSide: Merges multiple PDFs into single downloadable Blob', async () => {
  const pdf1 = await createTestPdfFile('dilekce.pdf', 2);
  const pdf2 = await createTestPdfFile('ek_deliller.pdf', 3);

  const result = await mergePdfsClientSide([pdf1, pdf2], 'sonuc_birlestirilmis.pdf');

  assert.equal(result.totalPages, 5);
  assert.equal(result.filename, 'sonuc_birlestirilmis.pdf');
  assert.ok(result.sizeBytes > 0);
  assert.ok(result.blob instanceof Blob);
  assert.equal(result.blob.type, 'application/pdf');

  // Verify the resulting Blob can be reloaded and has exactly 5 pages
  const loadedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(loadedPdf.getPageCount(), 5);
});

// ============================================================================
// 4. CONVERT IMAGES TO PDF CLIENT-SIDE
// ============================================================================
test('convertImagesToPdfClientSide: Empty list throws error', async () => {
  await assert.rejects(
    async () => {
      await convertImagesToPdfClientSide([]);
    },
    {
      message: 'Dönüştürme işlemi için en az bir görsel dosyası seçilmelidir.',
    }
  );
});

test('convertImagesToPdfClientSide: Converts PNG & JPG to standard A4 PDF', async () => {
  const pngFile = new File([MINIMAL_PNG_BYTES], 'tarama.png', { type: 'image/png' });
  const jpgFile = new File([MINIMAL_JPG_BYTES], 'makbuz.jpg', { type: 'image/jpeg' });

  const result = await convertImagesToPdfClientSide([pngFile, jpgFile]);

  assert.equal(result.totalPages, 2);
  assert.ok(result.sizeBytes > 0);
  assert.ok(result.blob instanceof Blob);
  assert.equal(result.blob.type, 'application/pdf');
  assert.ok(result.filename.endsWith('.pdf'));

  // Verify resulting document structure and page sizes
  const loadedPdf = await PDFDocument.load(await result.blob.arrayBuffer());
  assert.equal(loadedPdf.getPageCount(), 2);

  const page1 = loadedPdf.getPage(0);
  const { width: p1W, height: p1H } = page1.getSize();
  // Standard A4 portrait or landscape points: [595.28, 841.89]
  assert.ok(
    (Math.abs(p1W - 595.28) < 1 && Math.abs(p1H - 841.89) < 1) ||
    (Math.abs(p1W - 841.89) < 1 && Math.abs(p1H - 595.28) < 1),
    'Page 1 should match standard A4 dimensions'
  );
});

// ============================================================================
// 5. DOWNLOAD BLOB (Memory Management & Safety)
// ============================================================================
test('downloadBlob: Safe execution in non-browser (SSR/Node) environment', () => {
  const dummyBlob = new Blob(['sample pdf data'], { type: 'application/pdf' });
  // Should not throw when window or document is undefined
  assert.doesNotThrow(() => {
    downloadBlob(dummyBlob, 'test.pdf');
  });
});

test('downloadBlob: Simulates browser download, anchor click, and URL revocation', async () => {
  let createdUrl = '';
  let revokedUrl = '';
  let clicked = false;
  let appended = false;
  let removed = false;

  const mockAnchor = {
    href: '',
    download: '',
    style: {} as Record<string, string>,
    click: () => {
      clicked = true;
    },
  };

  const globalScope = globalThis as any;
  const originalWindow = globalScope.window;
  const originalDocument = globalScope.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  try {
    URL.createObjectURL = (blob: Blob) => {
      createdUrl = 'blob:http://localhost/mock-uuid-1234';
      return createdUrl;
    };
    URL.revokeObjectURL = (url: string) => {
      revokedUrl = url;
    };

    globalScope.window = {};
    globalScope.document = {
      createElement: (tag: string) => {
        if (tag === 'a') return mockAnchor;
        return {};
      },
      body: {
        appendChild: (el: any) => {
          appended = true;
        },
        removeChild: (el: any) => {
          removed = true;
        },
      },
    };

    const dummyBlob = new Blob(['pdf data'], { type: 'application/pdf' });
    downloadBlob(dummyBlob, 'indirilen_dosya.pdf');

    assert.equal(mockAnchor.download, 'indirilen_dosya.pdf');
    assert.equal(mockAnchor.href, createdUrl);
    assert.equal(clicked, true);
    assert.equal(appended, true);
    assert.equal(removed, true);

    // Wait for the 1000ms cleanup timeout to verify URL.revokeObjectURL
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(revokedUrl, createdUrl, 'ObjectURL should be revoked for memory safety');
  } finally {
    globalScope.window = originalWindow;
    globalScope.document = originalDocument;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});
