import { Puzzle } from 'lucide-react';
import '../styles/site-mark.css';

export function SiteMark() {
  return (
    <span className="site-mark" aria-hidden="true">
      <Puzzle size={23} />
    </span>
  );
}
