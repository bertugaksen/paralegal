import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initGlobalZoomGuard } from './utils/zoomGuard';

// Global pencere zoom kilidini başlat (touchpad pinch ve ctrl+wheel koruması)
initGlobalZoomGuard();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
