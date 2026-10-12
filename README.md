# Chess Learn

A browser chess trainer, built as an original
Next.js application. It reuses the app's bundled *data* (openings, traps, bot repertoire,
bot avatars, piece sets) but the code is written from scratch — no decompiled source is
copied.

## What's inside

| Route | What it does |
|---|---|
| `/` | Home / dashboard with data-driven stats and featured bots |
| `/play` | Play against 34 data-driven bots with personalities, opening books and ratings |
| `/analyze` | Paste a PGN/FEN, step through the game, and run a **full Stockfish review** — accuracy, move classification, evaluation graph |
| `/openings` | Searchable explorer over ~4,700 named opening lines with a move-playback board |
| `/traps` | 120 traps / mating patterns with variation tabs and playback |
| `/repertoire` | The bots' 41 opening lines with style weights, tags and cp ceilings |

## Highlights

- **Full-game review** on the Analyze page: every position is scored by **Stockfish** (WASM, in a
  Web Worker), then each move gets a centipawn loss, a win-probability drop, an accuracy figure
  and a classification (best / excellent / good / inaccuracy / mistake / blunder), plus a game
  report with per-side accuracy, a counts table and an evaluation graph.
- **PGN / FEN import & export** on the Analyze page (merged in from the separate *ChessAnalyzer* project).
- **Adaptive puzzles**: the tactics trainer rates you with a simple Elo and serves puzzles near your
  level (the fixed rating bands are still available as an override).
- **Settings** (gear in the header): six board themes, two piece sets, and synthesized move sounds
  (Web Audio — no audio files are bundled).

- **Real chess logic** via `chess.js`.
- **Original engine** (`src/lib/engine.ts`): alpha-beta search over material + piece-square
  tables, plus a per-bot *personality* term (aggressive bots push and attack the king;
  defensive bots keep a king shield). Bots also follow their stored opening line until it
  runs out.
- **Custom SVG board** using the bundled *cburnett* piece set — click-to-move, legal-move
  hints, last-move and check highlighting, promotion picker.
- **Replay board** with full playback controls for openings, traps and repertoire lines.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export -> ./out
npm run build:pages  # static export for GitHub Pages (basePath /chess-learn) -> ./out
npm run preview      # serve ./out locally
```

The project uses `output: "export"`, so `npm run build` produces a fully static site in `out/`.

## Deploying to GitHub Pages

The live site is served from the `docs/` folder on the `main` branch at
**https://studyxtarget.github.io/chess-learn/**.

To redeploy after a change:

```bash
npm run build:pages
rm -rf docs && cp -r out docs && touch docs/.nojekyll
# commit and push docs/
```

Two things matter for Pages:

1. **`basePath`** — a GitHub Pages *project* site is served under `/<repo>/`, so the build
   needs `NEXT_PUBLIC_BASE_PATH=/chess-learn` (that is what `build:pages` sets). Without it,
   the JS/CSS/images 404.
2. **`.nojekyll`** — Jekyll ignores folders that start with an underscore, which would break
   Next's `_next/` assets. The empty `docs/.nojekyll` file disables Jekyll.

## Project layout

```
src/
  app/            # App Router pages (home, play, analyze, openings, traps, repertoire)
  components/     # Board, ReplayBoard, Nav, EvalGraph, GameReport
  lib/            # data.ts, engine.ts (bot engine), stockfish.ts (UCI worker), review.ts
  data/           # bots.json, repertoire.json, traps.json  (small, imported)
public/
  data/openings.json    # large dataset, fetched at runtime
  stockfish/            # Stockfish 19 WASM (lite, single-threaded) + licence
  pieces/cburnett/*.svg
  bots/*.svg
```

## Engine, licences & third-party notices

The bots use the original in-repo engine (`src/lib/engine.ts`). The Analyze page uses
**Stockfish 19 (lite, single-threaded WASM)**, vendored under `public/stockfish/` and driven
from a Web Worker via UCI (`src/lib/stockfish.ts`). The single-threaded build is deliberate:
it needs no `SharedArrayBuffer`, so no COOP/COEP headers are required and it runs on plain
GitHub Pages.

The app always tells you which engine produced a report: the Analyze screen and the Game
Report show a **“Stockfish active”** or **“Basic engine (fallback)”** badge. If the WASM worker
cannot start, the built-in engine is used and the numbers are less reliable — the badge makes
that visible rather than presenting both as the same quality.

### Licences

| Component | Licence | Notes |
|---|---|---|
| Stockfish (WASM) | **GPL-3.0** | licence text ships at `public/stockfish/COPYING.txt`; provenance in `NOTICE.txt` |
| cburnett piece set | CC BY-SA 3.0 / GPL | by Colin M.L. Burnett |
| merida piece set | free / public-domain-style | by Armando Hernandez Marroquin |
| Move sounds | — | synthesized at runtime with the Web Audio API (no audio assets) |
| App code | — | original code written for this project |

Because the site distributes Stockfish, the combined work must comply with GPL-3.0 — keep the
licence and attribution in place if you publish this.

### Data reuse — please verify

The opening dataset, the trap list, the bot opening repertoire and the bot avatars are derived
from the bundled assets of the original Android chess app (`bot_opening_repertoire.txt`,
`openings_with_fens.txt`, `opening_traps_with_fens.txt`, `assets/bots/`). Including a licence
file does **not** by itself grant permission to redistribute someone else's dataset — check the
reuse rights before publishing this publicly.

## Data provenance

The JSON in `src/data` and `public/data`, the bot avatars in `public/bots`, and the piece
set in `public/pieces/cburnett` are derived from the bundled assets of the original Android chess app
(`assets/bot_opening_repertoire.txt`, `assets/openings_with_fens.txt`,
`assets/opening_traps_with_fens.txt`, `assets/bots/`, `assets/pieces/cburnett.zip`).

## Scope

This is the *core* experience. Android-specific pieces of the original app — Google Drive
backup, Play Billing, the Chessnut BLE electronic-board service, background engine analysis
and push notifications — are intentionally out of scope for a browser build.
