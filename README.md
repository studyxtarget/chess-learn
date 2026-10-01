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

## Engine & licensing

The bots use the original in-repo engine (`src/lib/engine.ts`). The Analyze page uses
**Stockfish 19 (lite, single-threaded WASM)**, vendored under `public/stockfish/` and driven
from a Web Worker via UCI (`src/lib/stockfish.ts`). The single-threaded build is deliberate:
it needs no `SharedArrayBuffer`, so no COOP/COEP headers are required and it runs on plain
GitHub Pages. If the worker fails to load, the review silently falls back to the built-in
engine.

**Stockfish is GPL-3.0.** Its licence text ships with the binary at
`public/stockfish/COPYING.txt`, with provenance in `public/stockfish/NOTICE.txt`. Because the
site distributes Stockfish, the combined work must comply with GPL-3.0 — keep that licence and
attribution in place if you publish this.

The *cburnett* piece set is by Colin M.L. Burnett (CC BY-SA 3.0 / GPL).

## Data provenance

The JSON in `src/data` and `public/data`, the bot avatars in `public/bots`, and the piece
set in `public/pieces/cburnett` are derived from the bundled assets of the original Android chess app
(`assets/bot_opening_repertoire.txt`, `assets/openings_with_fens.txt`,
`assets/opening_traps_with_fens.txt`, `assets/bots/`, `assets/pieces/cburnett.zip`).

## Scope

This is the *core* experience. Android-specific pieces of the original app — Google Drive
backup, Play Billing, the Chessnut BLE electronic-board service, background engine analysis
and push notifications — are intentionally out of scope for a browser build.
