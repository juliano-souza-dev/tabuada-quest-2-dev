import './styles/global.css';

const BUILD_VERSION = __BUILD_VERSION__;

function mountBuildVersion() {
  const badge = document.createElement('div');
  badge.id = 'build-version';
  badge.textContent = `v ${BUILD_VERSION}`;
  badge.title = 'Build atual do Tabuada Quest';
  document.body.appendChild(badge);
}

async function ensureFreshBuild() {
  if (BUILD_VERSION === 'dev') return;

  try {
    const base = import.meta.env.BASE_URL || '/';
    const response = await fetch(
      `${base}version.json?_=${Date.now()}`,
      { cache: 'no-store' }
    );

    if (!response.ok) return;

    const remote = await response.json();
    const latest = String(remote?.version || '');

    if (!latest || latest === BUILD_VERSION) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get('v') === latest) return;

    url.searchParams.set('v', latest);
    window.location.replace(url.toString());
  } catch (error) {
    console.warn('[Tabuada Quest] Version check unavailable:', error);
  }
}

function showFatalError(error) {
  const mount = document.querySelector('#game') ?? document.body;
  const message = error instanceof Error
    ? `${error.name}: ${error.message}\n\n${error.stack ?? ''}`
    : String(error);

  console.error('[Tabuada Quest] Fatal startup error:', error);

  let panel = document.querySelector('#boot-error');
  if (!panel) {
    panel = document.createElement('pre');
    panel.id = 'boot-error';
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
  panel.textContent = message;
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

mountBuildVersion();
void ensureFreshBuild();

try {
  const { GameApp } = await import('./app/GameApp.js');
  const mount = document.querySelector('#game');
  const app = new GameApp({ mount });
  await app.start();
} catch (error) {
  showFatalError(error);
}
