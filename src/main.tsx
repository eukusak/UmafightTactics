import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import '@fontsource-variable/noto-sans-kr';
import '@fontsource/jua';
import '@fontsource/press-start-2p/latin-400.css';
import './styles/global.css';
import './styles/arena.css';
import './styles/pixel.css';
import './styles/mobile.css';
import './styles/typography.css';
import './styles/race-plan.css';
// Registers the PvE combat bodies before any battle can be constructed.
import './game/engine/battle/pve-units';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

// Native browser menus/selection interfere with unit and item dragging.
// Keep normal editing behavior in text fields and contenteditable elements.
const isTextEntry = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest('input, textarea, [contenteditable="true"], [role="textbox"]');
container.addEventListener('contextmenu', event => { if (!isTextEntry(event.target)) event.preventDefault(); });
container.addEventListener('selectstart', event => { if (!isTextEntry(event.target)) event.preventDefault(); });

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
