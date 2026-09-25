import { ArrowRight, MoveUpRight, Sparkles } from 'lucide-react';
import { SiteHeader } from '../shared/components/SiteHeader';
import { links } from '../shared/links';

export default function App() {
  return (
    <div className="site-shell">
      <SiteHeader home />
      <main>
        <section className="home-intro" aria-labelledby="home-title">
          <p className="site-kicker">
            <Sparkles size={14} /> A little play goes a long way
          </p>
          <h1 id="home-title">
            Small games.
            <br />
            <span>Curious minds.</span>
          </h1>
          <p>
            A clear path. A clever turn. A little moment of discovery.
            <br className="intro-break" /> Pick a puzzle and make some room for play.
          </p>
        </section>

        <section className="game-collection" id="games" aria-labelledby="games-title">
          <div className="collection-heading">
            <h2 id="games-title">Find your next little obsession</h2>
            <span>THE COLLECTION / 01–02</span>
          </div>
          <div className="game-cards">
            <a className="game-card arrow-card" href={links.arrowSurgery}>
              <div className="game-art arrow-art" aria-hidden="true">
                <span className="game-status">Ready to play</span>
                <svg
                  viewBox="0 0 440 220"
                  fill="none"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M100 164V77H230V42m-17 17 17-17 17 17" stroke="#8a75c7" />
                  <path d="M151 164h72v-48h108m-17-17 17 17-17 17" stroke="#54a792" />
                  <path d="M290 55h56v112h-70m17-17-17 17 17 17" stroke="#df9076" />
                  <path d="M49 83v63m-17-17 17 17 17-17" stroke="#d7ae51" />
                </svg>
                <span className="art-caption">LESS TANGLE. MORE FLOW.</span>
              </div>
              <div className="card-copy">
                <p className="site-kicker">01 / Untangle & unwind</p>
                <h3>
                  Arrow Surgery <MoveUpRight size={25} />
                </h3>
                <p>
                  Find a clear path and send every colorful arrow on its way. A satisfying little
                  untangle, one move at a time.
                </p>
                <span className="card-action">
                  Play Arrow Surgery <ArrowRight size={17} />
                </span>
              </div>
            </a>
            <a className="game-card snake-card" href={links.logicSnake}>
              <div className="game-art snake-art" aria-hidden="true">
                <span className="game-status">Ready to play</span>
                <svg viewBox="0 0 440 220" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M122 168h72v-56h-40V56h105v56h53" stroke="#80a376" strokeWidth="25" />
                  <circle cx="313" cy="107" r="3" fill="#f9faf2" />
                  <circle cx="313" cy="117" r="3" fill="#f9faf2" />
                  <path d="M338 112h10" stroke="#80a376" strokeWidth="3" />
                  <rect x="254" y="157" width="18" height="18" rx="5" fill="#d9ae59" />
                </svg>
                <span className="art-caption">A WINDING PATH. A CLEARER HEAD.</span>
              </div>
              <div className="card-copy">
                <p className="site-kicker">02 / A new direction</p>
                <h3>
                  Logic Snake <MoveUpRight size={25} />
                </h3>
                <p>
                  Find the hidden snake and give every empty space its place. Thirteen thoughtful
                  puzzles, one clever turn at a time.
                </p>
                <span className="card-action">
                  Play Logic Snake <ArrowRight size={17} />
                </span>
              </div>
            </a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        A little challenge. A little breathing room. Made for your browser.
      </footer>
    </div>
  );
}
