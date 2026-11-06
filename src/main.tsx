import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { OverlayApp } from './components/OverlayApp';
import { parseOverlayParams } from './utils/overlayParams';

// Janelas abertas pelo Rust durante a captura carregam `?overlay=<id>&mode=<m>`.
const overlay = parseOverlayParams(window.location.search);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{overlay ? <OverlayApp {...overlay} /> : <App />}</React.StrictMode>
);
