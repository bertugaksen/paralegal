/**
 * Paralegal Web Client-Side PDF Engine
 * Pure in-browser (0-server dependence) PDF merging, image-to-PDF conversion,
 * threshold inspection (UYAP 10 MB / 10 page limit), and memory-safe downloads.
 */

import { PDFDocument, PageSizes } from 'pdf-lib';

// Limits defined for pure client-side processing & UYAP compliance
export const MAX_CLIENT_PAGES = 10;
export const MAX_CLIENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB in bytes

export interface InspectionResult {
  totalPages: number;
  totalSizeBytes: number;
  exceedsLimit: boolean;
  hasMsgFile: boolean;
  reasons: string[];
}

export interface PdfOperationResult {
  blob: Blob;
  totalPages: number;
  sizeBytes: number;
  filename: string;
}

/**
 * Checks whether a given filename or File object represents an Outlook email file (.msg or .eml).
 */
export function isOutlookEmailFile(file: File | string): boolean {
  const name = typeof file === 'string' ? file : file.name;
  const lowerName = name.toLowerCase();
  return lowerName.endsWith('.msg') || lowerName.endsWith('.eml');
}

/**
 * Checks whether a given file is a PDF.
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Checks whether a given file is a JPG or PNG image.
 */
export function isSupportedImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png')
  );
}

/**
 * Formats bytes into human-readable Turkish representation (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Pure client-side PDF merger using pdf-lib (zero server calls).
 * Reads each PDF file into an ArrayBuffer, uses PDFDocument.load and PDFDocument.create,
 * copies all pages, saves and returns a downloadable Blob.
 *
 * @param files Array of PDF File objects
 * @param customFilename Optional custom filename for the merged PDF
 * @returns Promise resolving to { blob, totalPages, sizeBytes, filename }
 */
export async function mergePdfsClientSide(
  files: File[],
  customFilenameOrAddBookmarks?: string | boolean,
  optionalFilename?: string
): Promise<PdfOperationResult> {
  if (!files || files.length === 0) {
    throw new Error('Birleştirme işlemi için en az bir PDF dosyası seçilmelidir.');
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer);
      const pageIndices = srcPdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);

      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`'${file.name}' dosyası birleştirilemedi: ${msg}`);
    }
  }

  const totalPages = mergedPdf.getPageCount();
  if (totalPages === 0) {
    throw new Error('Birleştirilecek geçerli sayfa bulunamadı.');
  }

  const pdfBytes = await mergedPdf.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  let safeFilename = '';
  if (typeof customFilenameOrAddBookmarks === 'string' && customFilenameOrAddBookmarks.trim()) {
    safeFilename = customFilenameOrAddBookmarks.trim();
  } else if (typeof optionalFilename === 'string' && optionalFilename.trim()) {
    safeFilename = optionalFilename.trim();
  } else {
    safeFilename = `birlestirilmis_belge_${Date.now()}.pdf`;
  }
  const filename = safeFilename;

  return {
    blob,
    totalPages,
    sizeBytes: blob.size,
    filename,
  };
}

/**
 * Pure client-side Image-to-PDF converter using pdf-lib (zero server calls).
 * Takes JPG/PNG image files, embeds them using pdfDoc.embedJpg or pdfDoc.embedPng,
 * fits them on standard A4 pages with margins, and returns a downloadable PDF Blob.
 *
 * @param files Array of Image File objects (JPG or PNG)
 * @param customFilename Optional custom filename for the resulting PDF
 * @returns Promise resolving to { blob, totalPages, sizeBytes, filename }
 */
export async function convertImagesToPdfClientSide(
  files: File[],
  customFilename?: string
): Promise<PdfOperationResult> {
  if (!files || files.length === 0) {
    throw new Error('Dönüştürme işlemi için en az bir görsel dosyası seçilmelidir.');
  }

  const pdfDoc = await PDFDocument.create();

  // Standard A4 dimensions in points: [595.28, 841.89]
  const [a4Width, a4Height] = PageSizes.A4;
  const MARGIN = 36; // 0.5 inch (12.7 mm) margin

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Identify image format (JPG vs PNG) using magic bytes & file properties
    const isPng =
      (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47) ||
      file.type === 'image/png' ||
      file.name.toLowerCase().endsWith('.png');

    const isJpg =
      (bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) ||
      file.type === 'image/jpeg' ||
      file.name.toLowerCase().endsWith('.jpg') ||
      file.name.toLowerCase().endsWith('.jpeg');

    let img;
    try {
      if (isPng) {
        img = await pdfDoc.embedPng(arrayBuffer);
      } else if (isJpg) {
        img = await pdfDoc.embedJpg(arrayBuffer);
      } else {
        // Fallback heuristic: try JPG first then PNG
        try {
          img = await pdfDoc.embedJpg(arrayBuffer);
        } catch {
          img = await pdfDoc.embedPng(arrayBuffer);
        }
      }
    } catch {
      throw new Error(
        `'${file.name}' görseli işlenemedi. Yalnızca standart JPG ve PNG formatları desteklenmektedir.`
      );
    }

    // Determine orientation based on image aspect ratio
    const isLandscape = img.width > img.height;
    const pageWidth = isLandscape ? a4Height : a4Width;
    const pageHeight = isLandscape ? a4Width : a4Height;

    const availableWidth = pageWidth - MARGIN * 2;
    const availableHeight = pageHeight - MARGIN * 2;

    // Scale to fit within available page area maintaining aspect ratio
    const scale = Math.min(
      availableWidth / img.width,
      availableHeight / img.height
    );
    const renderWidth = img.width * scale;
    const renderHeight = img.height * scale;

    // Center image on page with margins
    const x = MARGIN + (availableWidth - renderWidth) / 2;
    const y = MARGIN + (availableHeight - renderHeight) / 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(img, {
      x,
      y,
      width: renderWidth,
      height: renderHeight,
    });
  }

  const totalPages = pdfDoc.getPageCount();
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const filename =
    (typeof customFilename === 'string' && customFilename.trim())
      ? customFilename.trim()
      : `gorsellerden_pdf_${Date.now()}.pdf`;

  return {
    blob,
    totalPages,
    sizeBytes: blob.size,
    filename,
  };
}

/**
 * Inspects selected files before processing.
 * - Checks whether any file is an Outlook .msg or .eml file.
 * - Accurately calculates total page count and file size against the threshold (max 10 pages / 10 MB).
 * - Returns clear, formal Turkish explanations if limits are exceeded.
 *
 * @param files Array of File objects to inspect
 * @returns Promise resolving to InspectionResult
 */
export async function inspectFiles(files: File[]): Promise<InspectionResult> {
  let totalPages = 0;
  let totalSizeBytes = 0;
  let hasMsgFile = false;
  const reasons: string[] = [];

  for (const file of files) {
    totalSizeBytes += file.size;

    // 1. Outlook mail check (.msg / .eml)
    if (isOutlookEmailFile(file)) {
      hasMsgFile = true;
    }

    // 2. Page count calculation
    if (isPdfFile(file)) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // Load with ignoreEncryption to inspect page count without throwing on standard encryption
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
          ignoreEncryption: true,
        });
        totalPages += pdfDoc.getPageCount();
      } catch {
        // If password protected or malformed, account for at least 1 page
        totalPages += 1;
        reasons.push(
          `'${file.name}' belgesinin sayfa sayısı tam olarak doğrulanamadı (parola korumalı veya hasarlı olabilir).`
        );
      }
    } else if (isSupportedImageFile(file)) {
      // Each image translates to a single page in PDF conversion
      totalPages += 1;
    } else if (!isOutlookEmailFile(file)) {
      // Other document types count as at least 1 page
      totalPages += 1;
    }
  }

  // Formal Turkish threshold evaluations
  if (hasMsgFile) {
    reasons.push(
      'Yüklenen belgeler arasında Outlook e-posta dosyası (.msg / .eml) bulunmaktadır. E-posta iletilerinin ekleriyle birlikte işlenebilmesi için sunucu tabanlı dönüştürücü gerekmektedir.'
    );
  }

  const exceedsPageLimit = totalPages > MAX_CLIENT_PAGES;
  if (exceedsPageLimit) {
    reasons.push(
      `Toplam sayfa sayısı (${totalPages} sayfa), tarayıcı içi anlık işlem sınırı olan ${MAX_CLIENT_PAGES} sayfayı aşmaktadır.`
    );
  }

  const exceedsSizeLimit = totalSizeBytes > MAX_CLIENT_SIZE_BYTES;
  if (exceedsSizeLimit) {
    const formattedTotal = formatBytes(totalSizeBytes);
    const formattedMax = formatBytes(MAX_CLIENT_SIZE_BYTES);
    reasons.push(
      `Toplam dosya boyutu (${formattedTotal}), UYAP yükleme ve tarayıcı bellek üst sınırı olan ${formattedMax}'ı aşmaktadır.`
    );
  }

  const exceedsLimit = exceedsPageLimit || exceedsSizeLimit || hasMsgFile;

  return {
    totalPages,
    totalSizeBytes,
    exceedsLimit,
    hasMsgFile,
    reasons,
  };
}

/**
 * Triggers standard browser file download via URL.createObjectURL and an anchor click,
 * revoking the object URL afterwards to ensure robust browser memory management.
 *
 * @param blob The Blob to download
 * @param filename The desired filename for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'belge.pdf';
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoke the object URL after a short timeout so the browser has initiated the download stream
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
