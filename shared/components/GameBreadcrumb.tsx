import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { links } from '../links';
import { SiteMark } from './SiteMark';
import '../styles/game-breadcrumb.css';

export function GameBreadcrumb({ children }: { children: ReactNode }) {
  return (
    <nav className="game-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <a
            className="breadcrumb-home"
            href={links.home}
            aria-label="Puzzle Craze home"
            title="All games"
          >
            <SiteMark />
          </a>
        </li>
        <li aria-current="page">
          <ChevronRight className="breadcrumb-separator" size={16} aria-hidden="true" />
          {children}
        </li>
      </ol>
    </nav>
  );
}
