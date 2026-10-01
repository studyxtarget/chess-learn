import Link from "next/link";
import fs from "fs";
import path from "path";
import { bots, repertoire, traps, countryFlag, styleLabel, styleColor, asset } from "@/lib/data";

function openingCount(): number {
  try {
    const p = path.join(process.cwd(), "public", "data", "openings.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).length;
  } catch {
    return 0;
  }
}

export default function Home() {
  const nOpenings = openingCount();
  const featured = bots.filter((b) => b.index && b.index >= 4 && b.index <= 9).slice(0, 4);

  return (
    <div className="container">
      <section className="hero">
        <h1>
          Improve at chess, <span>one pattern at a time.</span>
        </h1>
        <p className="lead">
          Chessis Web brings the core of the Chessis training experience to the browser: play the
          data-driven bots, explore thousands of openings, learn real traps, and drill the exact
          opening repertoire the bots use against you.
        </p>
        <div className="hero-cta">
          <Link className="btn primary" href="/play">
            ♟ Play a bot
          </Link>
          <Link className="btn" href="/openings">
            Browse openings
          </Link>
          <Link className="btn" href="/traps">
            Learn traps
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="grid cols-4">
          <div className="card stat">
            <div className="num">{nOpenings.toLocaleString("en-IN")}</div>
            <div className="lbl">Openings with positions</div>
          </div>
          <div className="card stat">
            <div className="num">{traps.length}</div>
            <div className="lbl">Traps &amp; mating patterns</div>
          </div>
          <div className="card stat">
            <div className="num">{bots.length}</div>
            <div className="lbl">Computer opponents</div>
          </div>
          <div className="card stat">
            <div className="num">{repertoire.length}</div>
            <div className="lbl">Repertoire lines</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>What you can do</h2>
        <p className="sub">Four ways in, all driven by the same bundled chess data.</p>
        <div className="grid cols-4">
          <Link className="card" href="/play">
            <div className="icon">♞</div>
            <h3>Play vs Bot</h3>
            <p>
              Face opponents with real personalities — aggressive attackers, solid defenders — each
              opening with its own prepared line.
            </p>
          </Link>
          <Link className="card" href="/openings">
            <div className="icon">📖</div>
            <h3>Openings explorer</h3>
            <p>
              Search thousands of named lines, step through the moves on a board, and see how often
              each side wins.
            </p>
          </Link>
          <Link className="card" href="/traps">
            <div className="icon">🪤</div>
            <h3>Traps trainer</h3>
            <p>
              Walk through classic traps move by move so you spot them coming — and know how to
              spring them yourself.
            </p>
          </Link>
          <Link className="card" href="/repertoire">
            <div className="icon">🗂</div>
            <h3>Bot repertoire</h3>
            <p>
              Inspect the exact opening lines the bots play, with their aggression/defence weights
              and vetted move-loss ceilings.
            </p>
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>Meet a few of the bots</h2>
        <p className="sub">Each bot has an avatar, a rating, a style, and a favourite opening.</p>
        <div className="grid cols-4">
          {featured.map((b) => (
            <Link key={b.id} href="/play" className="botcard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(`/bots/${b.file}`)} alt={b.name} />
              <div className="bname">
                {b.name} {countryFlag(b.country)}
              </div>
              <div className="brating">{b.rating} Elo</div>
              <span className="pill" style={{ color: styleColor[b.style], borderColor: styleColor[b.style] }}>
                {styleLabel[b.style]}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
