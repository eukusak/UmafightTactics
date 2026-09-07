import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource-variable/noto-sans-kr';
import './styles/global.css';
import './styles/arena.css';
// Registers the PvE combat bodies before any battle can be constructed.
import './game/engine/battle/pve-units';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
