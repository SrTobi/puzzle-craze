import { Home } from 'lucide-react';
import { links } from '../links';
import '../styles/home-button.css';

export function HomeButton({ className = '' }: { className?: string }) {
  return (
    <a
      className={`home-button ${className}`.trim()}
      href={links.home}
      aria-label="All games"
      title="All games"
    >
      <Home size={19} />
    </a>
  );
}
