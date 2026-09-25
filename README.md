# Puzzle Craze

**[Play Puzzle Craze](https://srtobi.github.io/puzzle-craze/)**

A collection of browser games built with React, TypeScript, and Vite. The landing page introduces each game; each game has its own page and source directory.

| Page          | URL                     | Source                 |
| ------------- | ----------------------- | ---------------------- |
| Title page    | `/`                     | `index.html`, `src/`   |
| Arrow Surgery | `/games/arrow-surgery/` | `games/arrow-surgery/` |
| Logic Snake   | `/games/logic-snake/`   | `games/logic-snake/`   |

## Development

```sh
nix develop
pnpm install
pnpm dev
```

Open the address printed by Vite (normally http://127.0.0.1:5173). All commands run from the repository root. The pinned flake provides Node 24, pnpm 11, and the TypeScript language server. With direnv, run `direnv allow` once; without Nix, install Node 24+ and pnpm 11.

```sh
pnpm test          # Tests across all games
pnpm build         # TypeScript checks and all three pages in dist/
pnpm preview       # Serve the production site locally
pnpm format:check  # Check formatting
```

## Organization

```text
index.html                 Landing page entry and metadata
src/                       Landing page UI and styles
games/
  arrow-surgery/           Existing game, tests, levels, worker, and design docs
  logic-snake/             Snake deduction puzzles, rules, saved progress, and tests
shared/
  components/             Reusable site UI
  styles/                 Fonts, base styles, and site layout
  links.ts                Navigation paths using Vite's base URL
  mountApp.tsx            Common React bootstrap
public/                    Site-wide static assets
```

The root package, lockfile, TypeScript, Vite, formatting, and Nix configuration are shared infrastructure. Keep game-specific logic, styles, assets, and tests inside its game folder. Put code in `shared/` when it is useful across pages; shared code should not import a game's internals. Game styles load only on that game's page. Fonts are bundled locally.

See [Arrow Surgery's guide](games/arrow-surgery/README.md) for gameplay, level formats, and generation details, and [Logic Snake's guide](games/logic-snake/README.md) for its rules and controls.

## Building and hosting

Vite builds separate HTML entry points, so each page can be opened or refreshed directly without a client-side router. Publish the whole `dist/` directory to a static host that serves directory `index.html` files:

```text
dist/index.html
dist/games/arrow-surgery/index.html
dist/games/logic-snake/index.html
dist/assets/               Shared and page-specific bundles
```

For hosting beneath a URL prefix, build with `pnpm build --base=/your-prefix/`. Shared navigation follows that base path.

### GitHub Pages

[The deployment workflow](.github/workflows/deploy-pages.yml) runs on every push to `main` and can also be run manually from Actions. Both triggers check out the current tip of `main`, install the locked dependencies, check formatting, run tests, build all pages, and deploy `dist/`. New runs supersede older pending deployments.

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. If the `github-pages` environment restricts deployment branches, allow `main` there as well.

The workflow obtains the site's base path from GitHub Pages, so repository sites (such as `https://srtobi.github.io/puzzle-craze/`) and custom domains use the correct navigation, scripts, styles, fonts, and worker URLs. No SPA fallback or rewrite is required. This follows [Vite's GitHub Pages deployment guidance](https://vite.dev/guide/static-deploy.html#github-pages).

To check the repository Pages layout locally:

```sh
pnpm build --base=/puzzle-craze/
pnpm preview --base=/puzzle-craze/
# Open http://127.0.0.1:4173/puzzle-craze/
```

To add another game, create `games/<name>/index.html` and its source directory, register the HTML entry in `vite.config.ts`, add its path to `shared/links.ts`, and link it from the landing page. The root TypeScript configuration and test runner already include `games/` and `shared/`.
