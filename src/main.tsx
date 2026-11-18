import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { Framed, Splash, StartupError } from './app/StartupScreens';
import { readConfig } from './config/env';
import { loadBackend } from './services';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado em index.html');
const root = createRoot(container);

/** Inside another site's frame, clicks could be tricked: the club opens only on its own. */
function isFramed(): boolean {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

async function start() {
  if (isFramed()) {
    root.render(<Framed />);
    return;
  }
  try {
    const config = readConfig();
    document.title = config.clubName;
    root.render(<Splash clubName={config.clubName} />);
    const backend = await loadBackend(config);
    root.render(
      <StrictMode>
        <App services={{ config, backend }} />
      </StrictMode>,
    );
  } catch (error) {
    console.error(error);
    root.render(<StartupError error={error} />);
  }
}

void start();
