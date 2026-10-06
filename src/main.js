import { GameApp } from './app/GameApp.js';
import './styles/global.css';

function showFatalError(error) {
  const mount = document.querySelector('#game') ?? document.body;
  const message = error instanceof Error
    ? `${error.name}: ${error.message}\n\n${error.stack ?? ''}`
    : String(error);

  console.error('[Tabuada Quest] Fatal startup error:', error);

  const panel = document.createElement('pre');
  panel.id = 'boot-error';
  panel.textContent = message;
  Object.assign(panel.style, {
    position: 'fixed',
    inset: '12px',
    zIndex: '999999',
    margin: '0',
    padding: '16px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    background: '#260b0b',
    color: '#ffd7d7',
    border: '2px solid #ff5f5f',
    borderRadius: '10px',
    font: '13px/1.45 monospace'
  });
  mount.appendChild(panel);
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  const mount = document.querySelector('#game');
  const app = new GameApp({ mount });
  await app.start();
} catch (error) {
  showFatalError(error);
}
