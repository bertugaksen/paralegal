import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootFrontend = path.resolve(__dirname, '../..');

test('vercel.json contains SPA rewrites, security headers, and binary download disposition', () => {
  const vercelPath = path.join(rootFrontend, 'vercel.json');
  assert.equal(fs.existsSync(vercelPath), true, 'vercel.json must exist');

  const content = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

  // 1. SPA rewrite
  assert.ok(Array.isArray(content.rewrites), 'rewrites must be an array');
  const spaRewrite = content.rewrites.find((r: any) => r.source === '/(.*)' && r.destination === '/index.html');
  assert.ok(spaRewrite, 'SPA rewrite /(.*) -> /index.html must be present');

  // 2. Binary attachment header for Paralegal_Setup.exe
  assert.ok(Array.isArray(content.headers), 'headers must be an array');
  const downloadHeaderRule = content.headers.find((h: any) => h.source.includes('Paralegal_Setup.exe'));
  assert.ok(downloadHeaderRule, 'Paralegal_Setup.exe header rule must be present');

  const contentDisp = downloadHeaderRule.headers.find((kv: any) => kv.key.toLowerCase() === 'content-disposition');
  assert.ok(contentDisp, 'Content-Disposition header must be defined');
  assert.ok(contentDisp.value.includes('attachment'), 'Content-Disposition must be attachment');
  assert.ok(contentDisp.value.includes('Paralegal_Setup.exe'), 'Content-Disposition must specify filename Paralegal_Setup.exe');

  // 3. Security headers (X-Content-Type-Options, X-Frame-Options)
  const generalRule = content.headers.find((h: any) => h.source === '/(.*)');
  assert.ok(generalRule, 'General header rule for /(.*) must be present');

  const contentTypeOptions = generalRule.headers.find((kv: any) => kv.key.toLowerCase() === 'x-content-type-options');
  assert.ok(contentTypeOptions, 'X-Content-Type-Options header must be present');
  assert.equal(contentTypeOptions.value, 'nosniff');

  const frameOptions = generalRule.headers.find((kv: any) => kv.key.toLowerCase() === 'x-frame-options');
  assert.ok(frameOptions, 'X-Frame-Options header must be present');
  assert.equal(frameOptions.value, 'DENY');
});

test('LandingHub.tsx and DesktopUpsellModal.tsx implement chancery requirements without emojis', () => {
  const landingHubPath = path.join(rootFrontend, 'src/components/LandingHub.tsx');
  const modalPath = path.join(rootFrontend, 'src/components/DesktopUpsellModal.tsx');

  assert.equal(fs.existsSync(landingHubPath), true);
  assert.equal(fs.existsSync(modalPath), true);

  const hubSource = fs.readFileSync(landingHubPath, 'utf8');
  const modalSource = fs.readFileSync(modalPath, 'utf8');

  // 1. Header has Masaüstü Sürümünü İndir (.exe) linking to /downloads/Paralegal_Setup.exe with download attribute
  assert.ok(
    hubSource.includes('Masaüstü Sürümünü İndir (.exe)'),
    'Header must contain Masaüstü Sürümünü İndir (.exe)'
  );
  assert.ok(
    hubSource.includes('/downloads/Paralegal_Setup.exe'),
    'Header button must link to /downloads/Paralegal_Setup.exe'
  );
  assert.ok(
    hubSource.includes('download="Paralegal_Setup.exe"'),
    'Header link must include download attribute'
  );

  // 2. Integration of clientPdfEngine
  assert.ok(hubSource.includes('inspectFiles'), 'LandingHub must call inspectFiles');
  assert.ok(hubSource.includes('mergePdfsClientSide'), 'LandingHub must call mergePdfsClientSide');
  assert.ok(hubSource.includes('convertImagesToPdfClientSide'), 'LandingHub must call convertImagesToPdfClientSide');
  assert.ok(hubSource.includes('downloadBlob'), 'LandingHub must call downloadBlob');

  // 3. Actions text & Dignified status
  assert.ok(
    hubSource.includes('Tarayıcıda Birleştir ve İndir'),
    'LandingHub must offer "Tarayıcıda Birleştir ve İndir"'
  );
  assert.ok(
    hubSource.includes("UYAP PDF'e Dönüştür ve İndir"),
    'LandingHub must offer "UYAP PDF\'e Dönüştür ve İndir"'
  );
  assert.ok(
    hubSource.includes('İşlem tarayıcınızda yerel ortamda tamamlandı.'),
    'LandingHub must provide the dignified status message'
  );

  // 4. Quiet, dignified chancery assurance text at bottom
  const assuranceText = 'Tüm işlemler tarayıcınızda yerel ortamda yürütülür; sunucuya hiçbir veri veya dosya aktarılmaz.';
  assert.ok(hubSource.includes(assuranceText), 'LandingHub must contain exact assurance text');

  // 5. DesktopUpsellModal contents
  assert.ok(
    modalSource.includes('Bu işlem tarayıcı bellek koruma sınırını (10 sayfa / 10 MB) aşmaktadır.'),
    'Modal must present formal memory limit explanation'
  );
  assert.ok(
    modalSource.includes('Paralegal Masaüstü Sürümünü İndir (Setup.exe)'),
    'Modal must provide prominent button text'
  );
  assert.ok(modalSource.includes('Kapat'), 'Modal must provide secondary button Kapat');

  // 6. Zero emojis check in both sources
  // Emoji regex range check
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.equal(emojiRegex.test(hubSource), false, 'LandingHub must contain zero emojis');
  assert.equal(emojiRegex.test(modalSource), false, 'DesktopUpsellModal must contain zero emojis');
});
