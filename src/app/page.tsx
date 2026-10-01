import Link from "next/link";
import fs from "fs";
import path from "path";
import { bots, repertoire, traps, countryFlag, asset } from "@/lib/data";

function openingCount(): number {
  try {
    const p = path.join(process.cwd(), "public", "data", "openings.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).length;
  } catch {
    return 0;
  }
}

const areas = [
  {
    href: "/play",
    icon: "♞",
    title: "Play vs Bot",
    desc: "Face opponents with real personalities and their own prepared openings.",
  },
  {
    href: "/analyze",
    icon: "⌕",
    title: "Analyze",
    desc: "Paste a PGN and get a full Stockfish review — accuracy and move grades.",
  },
  {
    href: "/openings",
    icon: "☰",
    title: "Openings",
    desc: "Search thousands of named lines and step through them on a board.",
  },
  {
    href: "/traps",
    icon: "⚑",
    title: "Traps",
    desc: "Learn classic traps move by move so you spot them coming.",
  },
  {
    href: "/repertoire",
    icon: "☷",
    title: "Repertoire",
    desc: "The exact opening lines the bots play, with their style weights.",
  },
];

export default function Home() {
  const nOpenings = openingCount();
  const featured = bots.filter((b) => b.index && b.index >= 4 && b.index <= 9).slice(0, 4);

  return (
    <div className="container">
      <section className="hero clean">
        <span className="eyebrow">Browser chess trainer</span>
        <h1>
          Improve at chess, <span>one pattern at a time.</span>
        </h1>
        <p className="lead">
          Play data-driven bots, explore thousands of openings, learn real traps, and review your
          games with Stockfish.
        </p>
        <div className="hero-cta">
          <Link className="btn primary" href="/play">
            ♟ Play a bot
          </Link>
          <Link className="btn" href="/analyze">
            Review a game
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="stat-strip">
          <div className="stat">
            <div className="num">{nOpenings.toLocaleString("en-IN")}</div>
            <div className="lbl">Openings</div>
          </div>
          <div className="stat">
            <div className="num">{traps.length}</div>
            <div className="lbl">Traps</div>
          </div>
          <div className="stat">
            <div className="num">{bots.length}</div>
            <div className="lbl">Bots</div>
          </div>
          <div className="stat">
            <div className="num">{repertoire.length}</div>
            <div className="lbl">Repertoire lines</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Explore</h2>
        <p className="sub">Five ways in, all driven by the same bundled chess data.</p>
        <div className="card list-card">
          {areas.map((a) => (
            <Link key={a.href} href={a.href} className="list-row">
              <span className="ic">{a.icon}</span>
              <span>
                <span className="tt">{a.title}</span>
                <span className="dd">{a.desc}</span>
              </span>
              <span className="ar">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Meet a few of the bots</h2>
        <p className="sub">Every bot has an avatar, a rating and a favourite opening.</p>
        <div className="grid cols-4 bot-grid">
          {featured.map((b) => (
            <Link key={b.id} href="/play" className="botcard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset(`/bots/${b.file}`)} alt={b.name} />
              <div className="bname">
                {b.name} {countryFlag(b.country)}
              </div>
              <div className="brating">{b.rating} Elo</div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
