import os

# 1. Update clientPdfEngine.ts
engine_path = 'frontend/src/services/clientPdfEngine.ts'
with open(engine_path, 'r', encoding='utf-8') as f:
    text = f.read()

is_crlf = '\r\n' in text
text = text.replace('\r\n', '\n')

old_merge_sig = """export async function mergePdfsClientSide(
  files: File[],
  customFilename?: string
): Promise<PdfOperationResult> {"""

new_merge_sig = """export async function mergePdfsClientSide(
  files: File[],
  customFilenameOrAddBookmarks?: string | boolean,
  optionalFilename?: string
): Promise<PdfOperationResult> {"""
assert old_merge_sig in text, 'old_merge_sig not found'
text = text.replace(old_merge_sig, new_merge_sig, 1)

old_filename = """  const filename =
    customFilename?.trim() || `birlestirilmis_belge_${Date.now()}.pdf`;"""

new_filename = """  let safeFilename = '';
  if (typeof customFilenameOrAddBookmarks === 'string' && customFilenameOrAddBookmarks.trim()) {
    safeFilename = customFilenameOrAddBookmarks.trim();
  } else if (typeof optionalFilename === 'string' && optionalFilename.trim()) {
    safeFilename = optionalFilename.trim();
  } else {
    safeFilename = `birlestirilmis_belge_${Date.now()}.pdf`;
  }
  const filename = safeFilename;"""
assert old_filename in text, 'old_filename not found'
text = text.replace(old_filename, new_filename, 1)

old_img_filename = """  const filename =
    customFilename?.trim() || `gorsellerden_pdf_${Date.now()}.pdf`;"""

new_img_filename = """  const filename =
    (typeof customFilename === 'string' && customFilename.trim())
      ? customFilename.trim()
      : `gorsellerden_pdf_${Date.now()}.pdf`;"""
assert old_img_filename in text, 'old_img_filename not found'
text = text.replace(old_img_filename, new_img_filename, 1)

if is_crlf:
    text = text.replace('\n', '\r\n')

with open(engine_path, 'w', encoding='utf-8') as f:
    f.write(text)

print('clientPdfEngine.ts updated!')

# 2. Update MergerWorkspace/index.tsx
merger_path = 'frontend/src/components/MergerWorkspace/index.tsx'
with open(merger_path, 'r', encoding='utf-8') as f:
    mtext = f.read()

is_crlf_m = '\r\n' in mtext
mtext = mtext.replace('\r\n', '\n')

old_m_call = "const result = await mergePdfsClientSide(orderedFiles, addBookmarks);"
new_m_call = """const firstStem = (selectedPaths[0] || 'dosya').replace(/\\.pdf$/i, '');
        const outFilename = `${firstStem}_birlestirilmis.pdf`;
        const result = await mergePdfsClientSide(orderedFiles, addBookmarks, outFilename);"""

assert old_m_call in mtext, 'old_m_call not found'
mtext = mtext.replace(old_m_call, new_m_call, 1)

if is_crlf_m:
    mtext = mtext.replace('\n', '\r\n')

with open(merger_path, 'w', encoding='utf-8') as f:
    f.write(mtext)

print('MergerWorkspace/index.tsx updated!')
