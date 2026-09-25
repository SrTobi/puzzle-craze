import { ArrowLeft, Puzzle } from 'lucide-react';
import { links } from '../links';
import '../styles/site.css';

export function SiteHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="site-header">
      <a className="site-brand" href={links.home} aria-label="Puzzle Craze home">
        <span className="site-mark">
          <Puzzle size={23} />
        </span>
        puzzle<span>craze.</span>
      </a>
      {home ? (
        <a className="site-nav" href="#games">
          Explore the games <span aria-hidden="true">↘</span>
        </a>
      ) : (
        <a className="site-nav" href={links.home}>
          <ArrowLeft size={16} /> All games
        </a>
      )}
    </header>
  );
}
