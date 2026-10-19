/**
 * Zoom Guard: Masaüstü WebView ve tarayıcılarda istenmeyen pencere/arayüz ölçeklemesini engeller.
 * Laptop touchpad (pinch-to-zoom) ve Ctrl+Wheel kombinasyonlarının tüm arayüzü büyütmesini önler.
 */
export function initGlobalZoomGuard(): () => void {
  // 1. Ctrl + Wheel veya Meta + Wheel ile tüm sayfa zoom'unu engelle
  const handleWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Tarayıcının varsayılan pencere zoom davranışını durdur
      e.preventDefault();
    }
  };

  // 2. Klavye kısayolları ile pencere zoom engelleme (Ctrl +, Ctrl -, Ctrl 0 vb.)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      (e.ctrlKey || e.metaKey) &&
      ['+', '-', '=', '0', 'NumpadAdd', 'NumpadSubtract'].includes(e.key)
    ) {
      e.preventDefault();
    }
  };

  // 3. WebKit / Safari touchpad gesture event'leri
  const handleGesture = (e: Event) => {
    e.preventDefault();
  };

  // Global listener'ları passive: false ile kaydet (preventDefault çalışabilmesi için şarttır)
  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('gesturestart', handleGesture);
  window.addEventListener('gesturechange', handleGesture);
  window.addEventListener('gestureend', handleGesture);

  // Temizleme fonksiyonu
  return () => {
    window.removeEventListener('wheel', handleWheel);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('gesturestart', handleGesture);
    window.removeEventListener('gesturechange', handleGesture);
    window.removeEventListener('gestureend', handleGesture);
  };
}
