import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthGate } from '@/components/auth-gate';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AuthGate>
      <App />
    </AuthGate>
  </ErrorBoundary>,
);
