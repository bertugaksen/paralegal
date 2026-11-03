/**
 * Environment detection for Paralegal: Web (Vercel/Static) vs Desktop (PySide6 / Local Server).
 */

export function isWebMode(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
}

let _isBackendReachable: boolean | null = null;

export async function isBackendAvailable(): Promise<boolean> {
  if (isWebMode()) {
    return false;
  }
  if (_isBackendReachable !== null) {
    return _isBackendReachable;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const base = window.location.port === '3000' ? 'http://127.0.0.1:52410' : '';
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    _isBackendReachable = res.ok;
    return res.ok;
  } catch {
    _isBackendReachable = false;
    return false;
  }
}
