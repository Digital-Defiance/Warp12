import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/app';
import { OpsAuthProvider } from './firebase/ops-auth';
import './styles/global.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root');
}

createRoot(root).render(
  <StrictMode>
    <OpsAuthProvider>
      <App />
    </OpsAuthProvider>
  </StrictMode>
);
