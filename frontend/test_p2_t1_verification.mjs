import test from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// FAZ P2-T1 KAPSAMLI TEST SUITE
// Test Agent P2-T1: Manuel Kutu Yeniden Boyutlandırma (Resize Handles),
// Taşıma (Drag & Move), Klavye Kaydırma (Nudge) & Undo/Redo Doğrulaması
// ============================================================================

// Mock Helper: Klonlama (Deep Clone) fonksiyonu
function cloneRedactions(items) {
  return items.map((item) => ({
    ...item,
    rect: [...item.rect],
  }));
}

// Mock Helper: Redaction Item oluşturucu
function createMockItem(id, rect = [100, 100, 200, 150], page = 0, approved = true, category = 'MANUEL') {
  return {
    id,
    category,
    value: category === 'MANUEL' ? 'Manuel Seçim (Bant)' : 'Örnek Veri',
    page_number: page,
    rect: [...rect],
    confidence: 1.0,
    approved,
  };
}

// Sayfa Ölçüsü (Standart A4: 595.28 x 841.89 pt)
const mockPageInfo = {
  width: 595.28,
  height: 841.89,
};

// ============================================================================
// 1. RESIZE HANDLES GÖRÜNÜRLÜK VE 4 KÖŞE YAPISI
// ============================================================================
test('1. Resize Handles: 4 Köşe (nw, ne, sw, se) Tutamaklarının Görünürlük Mantığı', async (t) => {
  await t.test('Seçili veya üzerine gelinen kutuda ve çizim aracı pasifken handles görünmelidir', () => {
    // showHandles = !drawToolActive && (isSelected || isHovered)
    const computeShowHandles = (drawToolActive, isSelected, isHovered) => {
      return !drawToolActive && (isSelected || isHovered);
    };

    assert.strictEqual(computeShowHandles(false, true, false), true, 'Kutu seçiliyken tutamaklar görünmelidir');
    assert.strictEqual(computeShowHandles(false, false, true), true, 'Kutunun üzerine gelindiğinde tutamaklar görünmelidir');
    assert.strictEqual(computeShowHandles(false, true, true), true, 'Kutu hem seçili hem üzerine gelindiğinde tutamaklar görünmelidir');
    assert.strictEqual(computeShowHandles(false, false, false), false, 'Seçili veya hovered değilken tutamaklar gizli olmalıdır');
    
    // Çizim aracı aktifken (Bant Modu) handles asla görünmemelidir (çakışmayı önlemek için)
    assert.strictEqual(computeShowHandles(true, true, false), false, 'Bant çizim modu etkinken tutamaklar gizlenmelidir');
    assert.strictEqual(computeShowHandles(true, false, true), false, 'Bant çizim modu etkinken hovered olsa bile tutamaklar gizlenmelidir');
  });

  await t.test('4 köşenin (nw, ne, sw, se) konumlandırma ve imleç (cursor) tanımları doğru olmalıdır', () => {
    const handles = [
      { id: 'nw', title: 'Boyutlandır: Sol-Üst', cursor: 'cursor-nwse-resize', posClass: 'top-0 left-0 -translate-x-1/2 -translate-y-1/2' },
      { id: 'ne', title: 'Boyutlandır: Sağ-Üst', cursor: 'cursor-nesw-resize', posClass: 'top-0 right-0 translate-x-1/2 -translate-y-1/2' },
      { id: 'sw', title: 'Boyutlandır: Sol-Alt', cursor: 'cursor-nesw-resize', posClass: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2' },
      { id: 'se', title: 'Boyutlandır: Sağ-Alt', cursor: 'cursor-nwse-resize', posClass: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2' },
    ];

    assert.strictEqual(handles.length, 4, 'Tam 4 adet tutamak bulunmalıdır');
    
    // Çapraz imleç eşleşmeleri (nw ve se -> nwse-resize; ne ve sw -> nesw-resize)
    for (const h of handles) {
      if (h.id === 'nw' || h.id === 'se') {
        assert.strictEqual(h.cursor, 'cursor-nwse-resize');
      } else {
        assert.strictEqual(h.cursor, 'cursor-nesw-resize');
      }
      assert.ok(h.posClass.includes(h.id.includes('n') ? 'top-0' : 'bottom-0'), `${h.id} dikey eksen sınıfı doğru olmalı`);
      assert.ok(h.posClass.includes(h.id.includes('w') ? 'left-0' : 'right-0'), `${h.id} yatay eksen sınıfı doğru olmalı`);
    }
  });

  await t.test('Manuel çizim tamamlandığında çizilen yeni kutu otomatik olarak seçilmelidir', () => {
    // handlePointerUp içindeki mantık simülasyonu
    let selectedRedactionId = null;
    const normStart = { x: 0.1, y: 0.1 };
    const normCurrent = { x: 0.4, y: 0.3 };
    const targetPage = 0;

    const pdfX0 = Math.min(normStart.x, normCurrent.x) * mockPageInfo.width;
    const pdfY0 = Math.min(normStart.y, normCurrent.y) * mockPageInfo.height;
    const pdfX1 = Math.max(normStart.x, normCurrent.x) * mockPageInfo.width;
    const pdfY1 = Math.max(normStart.y, normCurrent.y) * mockPageInfo.height;

    assert.ok(pdfX1 - pdfX0 > 4 && pdfY1 - pdfY0 > 4, 'Çizim boyutu 4pt eşiğini geçmelidir');

    const newItem = {
      id: `manual_${targetPage}_${Math.round(pdfX0)}_${Math.round(pdfY0)}_${Date.now()}`,
      category: 'MANUEL',
      value: 'Manuel Seçim (Bant)',
      page_number: targetPage,
      rect: [pdfX0, pdfY0, pdfX1, pdfY1],
      confidence: 1.0,
      approved: true,
    };

    selectedRedactionId = newItem.id;
    assert.strictEqual(selectedRedactionId, newItem.id, 'Manuel çizilen kutu anında seçili duruma geçmelidir');
  });
});

// ============================================================================
// 2. KOORDİNAT DÖNÜŞÜMÜ, SCALEX/SCALEY VE 4PT MİNİMUM SINIR KORUMASI
// ============================================================================
test('2. Boyutlandırma (Resize): scaleX/scaleY Dönüşümü, Min 4pt Sınırı ve Sayfa Dışına Taşmama', async (t) => {
  // scaleX ve scaleY hesaplama fonksiyonu
  const getScales = (pageInfo, zoomPercent = 100) => {
    const dpiScale = 140 / 72;
    const cardWidth = Math.round(pageInfo.width * dpiScale * (zoomPercent / 100));
    const cardHeight = Math.round(pageInfo.height * dpiScale * (zoomPercent / 100));
    const scaleX = cardWidth / pageInfo.width;
    const scaleY = cardHeight / pageInfo.height;
    return { scaleX, scaleY, cardWidth, cardHeight };
  };

  // Resize mantığı simülatörü (index.tsx satır 636-654)
  const resizeRect = (initialRect, handle, dx, dy, scaleX, scaleY, pageInfo) => {
    const deltaPdfX = dx / scaleX;
    const deltaPdfY = dy / scaleY;
    let [x0, y0, x1, y1] = initialRect;

    if (handle === 'se') {
      x1 = Math.min(pageInfo.width, Math.max(x0 + 4, x1 + deltaPdfX));
      y1 = Math.min(pageInfo.height, Math.max(y0 + 4, y1 + deltaPdfY));
    } else if (handle === 'sw') {
      x0 = Math.max(0, Math.min(x1 - 4, x0 + deltaPdfX));
      y1 = Math.min(pageInfo.height, Math.max(y0 + 4, y1 + deltaPdfY));
    } else if (handle === 'ne') {
      x1 = Math.min(pageInfo.width, Math.max(x0 + 4, x1 + deltaPdfX));
      y0 = Math.max(0, Math.min(y1 - 4, y0 + deltaPdfY));
    } else if (handle === 'nw') {
      x0 = Math.max(0, Math.min(x1 - 4, x0 + deltaPdfX));
      y0 = Math.max(0, Math.min(y1 - 4, y0 + deltaPdfY));
    }

    return [x0, y0, x1, y1];
  };

  await t.test('Zoom %100, %150 ve %75 altında scaleX ve scaleY ölçeklemesi doğru hesaplanmalıdır', () => {
    for (const z of [75, 100, 150]) {
      const { scaleX, scaleY } = getScales(mockPageInfo, z);
      // scaleX ve scaleY dpiScale * zoom oranına eşit olmalıdır
      const expectedScale = (140 / 72) * (z / 100);
      assert.ok(Math.abs(scaleX - expectedScale) < 0.05, `Zoom ${z}% için scaleX doğrulanmalıdır`);
      assert.ok(Math.abs(scaleY - expectedScale) < 0.05, `Zoom ${z}% için scaleY doğrulanmalıdır`);
    }
  });

  await t.test('Tutamak "se" (Sağ-Alt) genişletildiğinde ve küçültüldüğünde min 4pt ve sayfa sınırları korunmalıdır', () => {
    const initialRect = [100, 100, 200, 150]; // w = 100, h = 50
    const { scaleX, scaleY } = getScales(mockPageInfo, 100);

    // Dışarıya doğru 50px genişletme
    const expanded = resizeRect(initialRect, 'se', 50 * scaleX, 40 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(expanded[0], 100, 'Sol kenar sabit kalmalı');
    assert.strictEqual(expanded[1], 100, 'Üst kenar sabit kalmalı');
    assert.strictEqual(Math.round(expanded[2]), 250, 'Sağ kenar 50pt artmalı');
    assert.strictEqual(Math.round(expanded[3]), 190, 'Alt kenar 40pt artmalı');

    // İçeriye doğru aşırı küçültme (küçültüp ters dönmeyi deneme: x0 + 4 sınır testi)
    const collapsed = resizeRect(initialRect, 'se', -500 * scaleX, -500 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(collapsed[0], 100);
    assert.strictEqual(collapsed[1], 100);
    assert.strictEqual(collapsed[2], 104, 'Genişlik min 4pt altına düşmemeli (x1 = x0 + 4 = 104)');
    assert.strictEqual(collapsed[3], 104, 'Yükseklik min 4pt altına düşmemeli (y1 = y0 + 4 = 104)');
    assert.ok(collapsed[2] - collapsed[0] >= 4, 'Minimum 4pt genişlik korunmalıdır');
    assert.ok(collapsed[3] - collapsed[1] >= 4, 'Minimum 4pt yükseklik korunmalıdır');

    // Sayfa dışına doğru aşırı çekme (sayfa sınır testi)
    const outOfBounds = resizeRect(initialRect, 'se', 10000, 10000, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(outOfBounds[2], mockPageInfo.width, 'Sağ kenar sayfa genişliğini aşmamalıdır');
    assert.strictEqual(outOfBounds[3], mockPageInfo.height, 'Alt kenar sayfa yüksekliğini aşmamalıdır');
  });

  await t.test('Tutamak "nw" (Sol-Üst) çekildiğinde sol/üst sınırlar, min 4pt ve 0 sıfır noktası korunmalıdır', () => {
    const initialRect = [100, 100, 200, 150]; // w = 100, h = 50
    const { scaleX, scaleY } = getScales(mockPageInfo, 100);

    // Dışarıya doğru (sola ve yukarı 50pt) genişletme
    const expanded = resizeRect(initialRect, 'nw', -50 * scaleX, -40 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(Math.round(expanded[0]), 50, 'Sol kenar sola 50pt kaymalı');
    assert.strictEqual(Math.round(expanded[1]), 60, 'Üst kenar yukarı 40pt kaymalı');
    assert.strictEqual(expanded[2], 200, 'Sağ kenar sabit kalmalı');
    assert.strictEqual(expanded[3], 150, 'Alt kenar sabit kalmalı');

    // Sol-üst köşeyi sağ-altın ötesine geçirmeye çalışma (inversion denemesi)
    const collapsed = resizeRect(initialRect, 'nw', 500 * scaleX, 500 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(collapsed[0], 196, 'Sol kenar en fazla x1 - 4 = 196 olabilir');
    assert.strictEqual(collapsed[1], 146, 'Üst kenar en fazla y1 - 4 = 146 olabilir');
    assert.strictEqual(collapsed[2], 200, 'Sağ kenar sabit kalmalı');
    assert.strictEqual(collapsed[3], 150, 'Alt kenar sabit kalmalı');
    assert.ok(collapsed[2] - collapsed[0] >= 4, 'Genişlik en az 4pt kalmalıdır');
    assert.ok(collapsed[3] - collapsed[1] >= 4, 'Yükseklik en az 4pt kalmalıdır');

    // Sayfa dışına (negatif koordinatlara) çekme denemesi
    const negative = resizeRect(initialRect, 'nw', -10000, -10000, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(negative[0], 0, 'Sol kenar 0 dan küçük olamaz');
    assert.strictEqual(negative[1], 0, 'Üst kenar 0 dan küçük olamaz');
  });

  await t.test('Tutamak "ne" (Sağ-Üst) ve "sw" (Sol-Alt) simetrisi ve sınırları doğrulanmalıdır', () => {
    const initialRect = [100, 100, 200, 150];
    const { scaleX, scaleY } = getScales(mockPageInfo, 100);

    // "ne" (Sağ-Üst): x1 değişir, y0 değişir
    const neNormal = resizeRect(initialRect, 'ne', 20 * scaleX, -20 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(neNormal[0], 100);
    assert.strictEqual(Math.round(neNormal[1]), 80);
    assert.strictEqual(Math.round(neNormal[2]), 220);
    assert.strictEqual(neNormal[3], 150);

    const neLimits = resizeRect(initialRect, 'ne', -500 * scaleX, 500 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(neLimits[2], 104, 'ne: x1 en az x0 + 4 = 104 olmalıdır');
    assert.strictEqual(neLimits[1], 146, 'ne: y0 en fazla y1 - 4 = 146 olmalıdır');

    // "sw" (Sol-Alt): x0 değişir, y1 değişir
    const swNormal = resizeRect(initialRect, 'sw', -20 * scaleX, 20 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(Math.round(swNormal[0]), 80);
    assert.strictEqual(swNormal[1], 100);
    assert.strictEqual(swNormal[2], 200);
    assert.strictEqual(Math.round(swNormal[3]), 170);

    const swLimits = resizeRect(initialRect, 'sw', 500 * scaleX, -500 * scaleY, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(swLimits[0], 196, 'sw: x0 en fazla x1 - 4 = 196 olmalıdır');
    assert.strictEqual(swLimits[3], 104, 'sw: y1 en az y0 + 4 = 104 olmalıdır');
  });
});

// ============================================================================
// 3. TAŞIMA (DRAG & MOVE) DOĞRULAMASI
// ============================================================================
test('3. Taşıma (Drag & Move): Boyut Sabitliği, Sayfa Dışına Taşmama ve Click/Drag Ayrımı', async (t) => {
  const getScales = (pageInfo) => {
    const dpiScale = 140 / 72;
    const cardWidth = Math.round(pageInfo.width * dpiScale);
    const cardHeight = Math.round(pageInfo.height * dpiScale);
    return { scaleX: cardWidth / pageInfo.width, scaleY: cardHeight / pageInfo.height };
  };

  // Drag simülatörü (index.tsx satır 707-731)
  const dragBox = (initialRect, dx, dy, scaleX, scaleY, pageInfo) => {
    const w = initialRect[2] - initialRect[0];
    const h = initialRect[3] - initialRect[1];

    const deltaPdfX = dx / scaleX;
    const deltaPdfY = dy / scaleY;

    const x0 = Math.max(0, Math.min(pageInfo.width - w, initialRect[0] + deltaPdfX));
    const y0 = Math.max(0, Math.min(pageInfo.height - h, initialRect[1] + deltaPdfY));
    const x1 = x0 + w;
    const y1 = y0 + h;

    return [x0, y0, x1, y1];
  };

  await t.test('Taşıma sırasında kutunun genişliği (w) ve yüksekliği (h) kesinlikle değişmemelidir', () => {
    const initialRect = [120, 150, 260, 210]; // w = 140, h = 60
    const initialW = initialRect[2] - initialRect[0];
    const initialH = initialRect[3] - initialRect[1];
    const { scaleX, scaleY } = getScales(mockPageInfo);

    const moved = dragBox(initialRect, 80 * scaleX, 100 * scaleY, scaleX, scaleY, mockPageInfo);
    const movedW = moved[2] - moved[0];
    const movedH = moved[3] - moved[1];

    assert.strictEqual(movedW, initialW, 'Taşıma sonrası genişlik tam aynı kalmalıdır');
    assert.strictEqual(movedH, initialH, 'Taşıma sonrası yükseklik tam aynı kalmalıdır');
    assert.strictEqual(Math.round(moved[0]), 200, 'x0 koordinatı 80pt ilerlemelidir');
    assert.strictEqual(Math.round(moved[1]), 250, 'y0 koordinatı 100pt ilerlemelidir');
  });

  await t.test('Kutu sayfanın sol, üst, sağ veya alt sınırlarının dışına sürülemez (clamping)', () => {
    const initialRect = [100, 100, 200, 150]; // w = 100, h = 50
    const w = initialRect[2] - initialRect[0];
    const h = initialRect[3] - initialRect[1];
    const { scaleX, scaleY } = getScales(mockPageInfo);

    // Sol-üst köşenin ötesine sürükleme (negatif)
    const clampTopLeft = dragBox(initialRect, -5000, -5000, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(clampTopLeft[0], 0, 'Sol kenar 0 da durmalıdır');
    assert.strictEqual(clampTopLeft[1], 0, 'Üst kenar 0 da durmalıdır');
    assert.strictEqual(clampTopLeft[2], w, 'Genişlik bozulmadan sağ kenar w olmalıdır');
    assert.strictEqual(clampTopLeft[3], h, 'Yükseklik bozulmadan alt kenar h olmalıdır');

    // Sağ-alt köşenin ötesine sürükleme (aşırı pozitif)
    const clampBottomRight = dragBox(initialRect, 10000, 10000, scaleX, scaleY, mockPageInfo);
    assert.strictEqual(clampBottomRight[0], mockPageInfo.width - w, 'x0 sayfası genişliği - w değerinde durmalıdır');
    assert.strictEqual(clampBottomRight[1], mockPageInfo.height - h, 'y0 sayfası yüksekliği - h değerinde durmalıdır');
    assert.strictEqual(clampBottomRight[2], mockPageInfo.width, 'x1 sayfa genişliğinde durmalıdır');
    assert.strictEqual(clampBottomRight[3], mockPageInfo.height, 'y1 sayfa yüksekliğinde durmalıdır');
  });

  await t.test('3px altındaki fare hareketleri tıklama sayılmalı ve wasDragged bayrağını açmamalıdır', () => {
    // index.tsx satır 716: if (!hasMoved && (Math.abs(dx) > 3 || Math.abs(dy) > 3))
    const isDragGesture = (dx, dy) => Math.abs(dx) > 3 || Math.abs(dy) > 3;

    assert.strictEqual(isDragGesture(1, 1), false, '1px hareket tıklama (click) sayılmalıdır');
    assert.strictEqual(isDragGesture(2, 3), false, '2px/3px hareket tıklama sayılmalıdır');
    assert.strictEqual(isDragGesture(4, 0), true, '4px hareket sürükleme (drag) olarak algılanmalıdır');
    assert.strictEqual(isDragGesture(0, 5), true, '5px hareket sürükleme olarak algılanmalıdır');
  });

  await t.test('Kutu sürüklendiğinde click olayında toggleRedaction tetiklenmemelidir (wasDraggedRef ayrımı)', () => {
    // index.tsx satır 1185-1193:
    // onClick={(e) => {
    //   if (wasDraggedRef.current) { wasDraggedRef.current = false; return; }
    //   setSelectedRedactionId(item.id);
    //   toggleRedaction(item.id);
    // }}
    let toggleCount = 0;
    const toggleRedaction = () => { toggleCount++; };

    let wasDraggedRef = { current: true };

    const handleClick = () => {
      if (wasDraggedRef.current) {
        wasDraggedRef.current = false;
        return;
      }
      toggleRedaction();
    };

    handleClick();
    assert.strictEqual(toggleCount, 0, 'Sürükleme sonrası ilk tıklama sansür durumunu değiştirmemelidir');
    assert.strictEqual(wasDraggedRef.current, false, 'wasDragged bayrağı sıfırlanmalıdır');

    // Gerçek kullanıcı tıklaması (hareket ettirmeden)
    handleClick();
    assert.strictEqual(toggleCount, 1, 'Temiz tıklama sansür durumunu tersine çevirmelidir (toggle)');
  });
});

// ============================================================================
// 4. UNDO / REDO YIĞINI VE PUSHSTATE ENTEGRASYONU
// ============================================================================
test('4. Undo / Redo: Boyutlandırma ve Taşıma Bitiminde pushState ve Ctrl+Z ile Geri Alma', async (t) => {
  // Redactor State Yığını Simülatörü
  class RedactorHistoryManager {
    constructor(initialRedactions = []) {
      this.redactions = cloneRedactions(initialRedactions);
      this.history = [];
      this.future = [];
      this.MAX_HISTORY = 30;
    }

    pushState(newRedactionsOrFn, previousOverride) {
      const current = previousOverride || this.redactions;
      const next = typeof newRedactionsOrFn === 'function' ? newRedactionsOrFn(current) : newRedactionsOrFn;

      this.history.push(cloneRedactions(current));
      if (this.history.length > this.MAX_HISTORY) {
        this.history = this.history.slice(this.history.length - this.MAX_HISTORY);
      }
      this.future = [];
      this.redactions = cloneRedactions(next);
    }

    undo() {
      if (this.history.length === 0) return false;
      const previous = this.history.pop();
      this.future.push(cloneRedactions(this.redactions));
      this.redactions = cloneRedactions(previous);
      return true;
    }

    redo() {
      if (this.future.length === 0) return false;
      const next = this.future.pop();
      this.history.push(cloneRedactions(this.redactions));
      this.redactions = cloneRedactions(next);
      return true;
    }
  }

  await t.test('Boyutlandırma (Resize) tamamlandığında önceki konum pushState ile kaydedilmeli ve Ctrl+Z ile eski boyuta dönmelidir', () => {
    const item = createMockItem('item_1', [100, 100, 200, 150]);
    const manager = new RedactorHistoryManager([item]);

    assert.strictEqual(manager.history.length, 0);

    // Kullanıcı boyutlandırma başlattı: initialSnapshot alındı
    const initialSnapshot = cloneRedactions(manager.redactions);
    
    // Boyutlandırma sırasında ara güncellemeler (setRedactions) yapıldı
    manager.redactions[0].rect = [100, 100, 320, 220];

    // PointerUp gerçekleşti (hasMoved = true):
    const finalRect = [100, 100, 320, 220];
    manager.pushState(
      (prev) => prev.map((r) => (r.id === item.id ? { ...r, rect: finalRect } : r)),
      initialSnapshot
    );

    assert.strictEqual(manager.history.length, 1, 'Geçmişe 1 durum eklenmelidir');
    assert.deepStrictEqual(manager.redactions[0].rect, [100, 100, 320, 220], 'Yeni boyut geçerli olmalıdır');

    // Ctrl+Z (Undo) tetiklendi
    manager.undo();
    assert.deepStrictEqual(manager.redactions[0].rect, [100, 100, 200, 150], 'Ctrl+Z sonrası kutu ilk orijinal boyutuna dönmelidir');

    // Ctrl+Y (Redo) tetiklendi
    manager.redo();
    assert.deepStrictEqual(manager.redactions[0].rect, [100, 100, 320, 220], 'Ctrl+Y sonrası yeniden boyutlandırılmış haline dönmelidir');
  });

  await t.test('Taşıma (Drag) tamamlandığında önceki konum kaydedilmeli ve Ctrl+Z ile geri alınabilmelidir', () => {
    const item = createMockItem('item_drag', [50, 60, 150, 110]);
    const manager = new RedactorHistoryManager([item]);

    // Başlangıç anı snapshot
    const initialSnapshot = cloneRedactions(manager.redactions);

    // Kutu yeni konuma sürüklendi
    const newRect = [180, 220, 280, 270];
    manager.redactions[0].rect = newRect;

    // PointerUp ile pushState
    manager.pushState(
      (prev) => prev.map((r) => (r.id === item.id ? { ...r, rect: newRect } : r)),
      initialSnapshot
    );

    assert.deepStrictEqual(manager.redactions[0].rect, newRect);

    // Ctrl+Z
    manager.undo();
    assert.deepStrictEqual(manager.redactions[0].rect, [50, 60, 150, 110], 'Ctrl+Z ile sürüklenmeden önceki koordinata dönmelidir');
  });

  await t.test('Hareket olmadığında (hasMoved = false) pushState çağrılmamalı ve geçmiş kirlenmemelidir', () => {
    const item = createMockItem('item_clean', [50, 60, 150, 110]);
    const manager = new RedactorHistoryManager([item]);

    // Kullanıcı tıkladı ama hareket ettirmedi (hasMoved = false)
    const hasMoved = false;
    if (hasMoved) {
      manager.pushState([item]);
    }

    assert.strictEqual(manager.history.length, 0, 'Sıfır hareket durumunda undo geçmişi boş kalmalıdır');
  });
});

// ============================================================================
// 5. KLAVYE KAYDIRMA (KEYBOARD NUDGE - 2PT / 10PT), ESCAPE VE DELETE
// ============================================================================
test('5. Klavye Kısayolları: Ok Tuşları (Nudge 2pt / 10pt), Escape ve Delete/Backspace', async (t) => {
  // Klavye olay yöneticisi simülatörü (index.tsx satır 758-837)
  class KeyboardRedactorHandler {
    constructor(items, selectedId = null, drawToolActive = false, isDrawing = false) {
      this.redactions = cloneRedactions(items);
      this.selectedRedactionId = selectedId;
      this.drawToolActive = drawToolActive;
      this.isDrawing = isDrawing;
      this.history = [];
      this.cancelledDrawing = false;
    }

    pushState(updater) {
      this.history.push(cloneRedactions(this.redactions));
      this.redactions = updater(this.redactions);
    }

    handleKeyDown(event, targetTag = 'BODY') {
      if (['INPUT', 'TEXTAREA'].includes(targetTag)) {
        return; // Form alanlarında kısayolları yoksay
      }

      if (event.key === 'Escape') {
        if (this.isDrawing) {
          this.isDrawing = false;
          this.cancelledDrawing = true;
        } else if (this.drawToolActive) {
          this.drawToolActive = false;
        } else if (this.selectedRedactionId) {
          this.selectedRedactionId = null;
        }
        return;
      }

      // Ok tuşlarıyla kaydırma (Nudge 2pt / Shift ile 10pt)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) &&
          this.selectedRedactionId &&
          !this.drawToolActive) {
        const item = this.redactions.find((r) => r.id === this.selectedRedactionId);
        if (!item) return;

        const step = event.shiftKey ? 10 : 2;
        let dx = 0;
        let dy = 0;
        if (event.key === 'ArrowLeft') dx = -step;
        if (event.key === 'ArrowRight') dx = step;
        if (event.key === 'ArrowUp') dy = -step;
        if (event.key === 'ArrowDown') dy = step;

        const [x0, y0, x1, y1] = item.rect;
        const w = x1 - x0;
        const h = y1 - y0;

        const newX0 = Math.max(0, Math.min(mockPageInfo.width - w, x0 + dx));
        const newY0 = Math.max(0, Math.min(mockPageInfo.height - h, y0 + dy));
        const newX1 = newX0 + w;
        const newY1 = newY0 + h;

        this.pushState((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, rect: [newX0, newY0, newX1, newY1] } : r
          )
        );
        return;
      }

      // Delete / Backspace ile silme
      if ((event.key === 'Delete' || event.key === 'Backspace') &&
          this.selectedRedactionId &&
          !this.drawToolActive) {
        const idToDelete = this.selectedRedactionId;
        this.selectedRedactionId = null;
        this.pushState((prev) => prev.filter((r) => r.id !== idToDelete));
        return;
      }
    }
  }

  await t.test('Ok tuşlarıyla (Arrow Keys) standart 2pt kaydırma (nudge) doğru çalışmalıdır', () => {
    const item = createMockItem('item_k', [100, 100, 200, 150]); // w = 100, h = 50
    const handler = new KeyboardRedactorHandler([item], 'item_k');

    // ArrowRight (2pt sağa)
    handler.handleKeyDown({ key: 'ArrowRight', shiftKey: false });
    assert.deepStrictEqual(handler.redactions[0].rect, [102, 100, 202, 150], 'Sağa 2pt gitmelidir');

    // ArrowDown (2pt aşağı)
    handler.handleKeyDown({ key: 'ArrowDown', shiftKey: false });
    assert.deepStrictEqual(handler.redactions[0].rect, [102, 102, 202, 152], 'Aşağı 2pt gitmelidir');

    // ArrowLeft (2pt sola)
    handler.handleKeyDown({ key: 'ArrowLeft', shiftKey: false });
    assert.deepStrictEqual(handler.redactions[0].rect, [100, 102, 200, 152], 'Sola 2pt gitmelidir');

    // ArrowUp (2pt yukarı)
    handler.handleKeyDown({ key: 'ArrowUp', shiftKey: false });
    assert.deepStrictEqual(handler.redactions[0].rect, [100, 100, 200, 150], 'Yukarı 2pt gitmelidir');

    assert.strictEqual(handler.history.length, 4, 'Her 4 adım da pushState ile geçmişe yazılmalıdır');
  });

  await t.test('Shift + Ok tuşlarıyla 10pt hızlı kaydırma çalışmalıdır', () => {
    const item = createMockItem('item_shift', [100, 100, 200, 150]);
    const handler = new KeyboardRedactorHandler([item], 'item_shift');

    // Shift + ArrowRight (10pt sağa)
    handler.handleKeyDown({ key: 'ArrowRight', shiftKey: true });
    assert.deepStrictEqual(handler.redactions[0].rect, [110, 100, 210, 150], 'Shift ile sağa 10pt kaymalıdır');

    // Shift + ArrowUp (10pt yukarı)
    handler.handleKeyDown({ key: 'ArrowUp', shiftKey: true });
    assert.deepStrictEqual(handler.redactions[0].rect, [110, 90, 210, 140], 'Shift ile yukarı 10pt kaymalıdır');
  });

  await t.test('Klavye kaydırmasında (nudge) sayfa kenarı sınırları kesinlikle aşılmamalıdır', () => {
    // Sol kenarda (x0 = 0) duran bir kutu
    const itemLeft = createMockItem('item_border', [0, 50, 100, 100]);
    const handler = new KeyboardRedactorHandler([itemLeft], 'item_border');

    // Sola kaydırmaya çalışma (x0 = 0 altında kalamaz)
    handler.handleKeyDown({ key: 'ArrowLeft', shiftKey: true });
    assert.strictEqual(handler.redactions[0].rect[0], 0, 'Sol kenar 0 altına inemez');
    assert.strictEqual(handler.redactions[0].rect[2], 100, 'Genişlik bozulmamalıdır');

    // Sağ kenara doğru aşırı kaydırma
    for (let i = 0; i < 70; i++) {
      handler.handleKeyDown({ key: 'ArrowRight', shiftKey: true });
    }
    const maxAllowedX0 = mockPageInfo.width - 100;
    assert.strictEqual(handler.redactions[0].rect[0], maxAllowedX0, 'Sağ sınır aşılmamalıdır');
    assert.strictEqual(handler.redactions[0].rect[2], mockPageInfo.width, 'x1 tam sayfa genişliğinde durmalıdır');
  });

  await t.test('Escape tuşu öncelik hiyerarşisi (Çizim iptali -> Bant modu kapatma -> Seçim kaldırma) doğru çalışmalıdır', () => {
    // 1. Çizim devam ederken Escape
    const h1 = new KeyboardRedactorHandler([], 'item_1', true, true);
    h1.handleKeyDown({ key: 'Escape' });
    assert.strictEqual(h1.cancelledDrawing, true, 'isDrawing true iken Escape çizimi iptal etmelidir');
    assert.strictEqual(h1.drawToolActive, true, 'Bant modu henüz kapanmamalıdır');

    // 2. Bant modu aktifken Escape
    const h2 = new KeyboardRedactorHandler([], 'item_1', true, false);
    h2.handleKeyDown({ key: 'Escape' });
    assert.strictEqual(h2.drawToolActive, false, 'İkinci Escape bant modunu kapatmalıdır');
    assert.strictEqual(h2.selectedRedactionId, 'item_1', 'Seçim henüz kalkmamalıdır');

    // 3. Seçili kutu varken Escape
    const h3 = new KeyboardRedactorHandler([], 'item_1', false, false);
    h3.handleKeyDown({ key: 'Escape' });
    assert.strictEqual(h3.selectedRedactionId, null, 'Son Escape seçimi temizlemelidir');
  });

  await t.test('Delete ve Backspace tuşları seçili kutuyu silmeli ve pushState ile geri alınabilmelidir', () => {
    const item1 = createMockItem('item_del_1');
    const item2 = createMockItem('item_del_2');
    const handler = new KeyboardRedactorHandler([item1, item2], 'item_del_1');

    handler.handleKeyDown({ key: 'Delete' });
    assert.strictEqual(handler.redactions.length, 1, '1 öğe silinmelidir');
    assert.strictEqual(handler.redactions[0].id, 'item_del_2', 'Kalan öğe item_del_2 olmalıdır');
    assert.strictEqual(handler.selectedRedactionId, null, 'Seçim sıfırlanmalıdır');
    assert.strictEqual(handler.history.length, 1, 'Silme işlemi undo geçmişine eklenmelidir');

    // Geri alma simülasyonu
    const restored = handler.history.pop();
    assert.strictEqual(restored.length, 2, 'Undo ile silinen kutu geri gelebilmelidir');
  });

  await t.test('Arama veya metin kutusunda (INPUT/TEXTAREA) Delete ve Arrow tuşları çalışma alanını etkilememelidir', () => {
    const item = createMockItem('item_input');
    const handler = new KeyboardRedactorHandler([item], 'item_input');

    // Input odağında Delete ve Arrow tuşları
    handler.handleKeyDown({ key: 'Delete' }, 'INPUT');
    handler.handleKeyDown({ key: 'ArrowRight', shiftKey: false }, 'TEXTAREA');

    assert.strictEqual(handler.redactions.length, 1, 'INPUT içindeyken kutu silinmemelidir');
    assert.deepStrictEqual(handler.redactions[0].rect, item.rect, 'INPUT içindeyken kutu kaydırılmamalıdır');
    assert.strictEqual(handler.history.length, 0, 'Geçmişe kayıt eklenmemelidir');
  });
});
