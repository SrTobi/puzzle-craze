import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';

export function mountApp(app: ReactNode) {
  createRoot(document.getElementById('root')!).render(<StrictMode>{app}</StrictMode>);
}
