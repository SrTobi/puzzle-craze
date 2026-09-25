import { ArrowRight } from 'lucide-react';
import { SiteHeader } from '../../../shared/components/SiteHeader';
import { links } from '../../../shared/links';

export default function App() {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className="snake-placeholder">
        <p className="site-kicker">A new direction / Coming soon</p>
        <h1>
          Logic Snake<span>.</span>
        </h1>
        <svg
          className="snake-preview"
          viewBox="0 0 320 230"
          aria-hidden="true"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M65 183h73v-61H95V55h116v67h43" stroke="#80a376" strokeWidth="28" />
          <circle cx="255" cy="116" r="3" fill="#fffdf4" />
          <circle cx="255" cy="127" r="3" fill="#fffdf4" />
          <rect x="206" y="174" width="20" height="20" rx="6" fill="#d9ae59" />
        </svg>
        <h2>Something clever is taking shape.</h2>
        <p>
          We’re working on a new game for curious minds.
          <br />
          Logic Snake isn’t ready to play yet. In the meantime, there’s a little untangling waiting
          for you.
        </p>
        <a className="site-button" href={links.arrowSurgery}>
          Play Arrow Surgery <ArrowRight size={18} />
        </a>
        <a className="snake-back" href={links.home}>
          Back to all games
        </a>
      </main>
      <footer className="site-footer">Part of Puzzle Craze. A little play goes a long way.</footer>
    </div>
  );
}
