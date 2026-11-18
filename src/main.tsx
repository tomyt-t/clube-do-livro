import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { Splash, StartupError } from './app/StartupScreens';
import { readConfig } from './config/env';
import { loadBackend } from './services';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado em index.html');
const root = createRoot(container);

async function start() {
  try {
    const config = readConfig();
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
