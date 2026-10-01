import Link from "next/link";
import fs from "fs";
import path from "path";
import { bots, repertoire, traps, countryFlag, asset } from "@/lib/data";
import Icon, { type IconName } from "@/components/Icon";

function openingCount(): number {
  try {
    const p = path.join(process.cwd(), "public", "data", "openings.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")).length;
  } catch {
    return 0;
  }
}

type Area = { href: string; icon: IconName; tone: string; title: string; desc: string };

const AREAS: Area[] = [
  { href: "/play", icon: "play", tone: "green", title: "Play vs Bot", desc: "Play with different strength and styles" },
  { href: "/analyze", icon: "search", tone: "blue", title: "Analyze", desc: "Upload PGN/FEN and get deep analysis" },
  { href: "/openings", icon: "book", tone: "orange", title: "Openings", desc: "Explore thousands of opening lines" },
  { href: "/traps", icon: "target", tone: "red", title: "Traps", desc: "Learn common traps and mating patterns" },
  { href: "/repertoire", icon: "doc", tone: "purple", title: "Repertoire", desc: "Save and study your favourite lines" },
  { href: "/analyze", icon: "chart", tone: "gold", title: "Game Report", desc: "Accuracy, mistakes, blunders and key moments" },
];

const CONTINUE: { href: string; piece: string; tone: string; title: string; sub: string }[] = [
  { href: "/play", piece: "wn", tone: "green", title: "Play vs Bot", sub: "Continue playing" },
  { href: "/analyze", piece: "bq", tone: "blue", title: "Analyze Game", sub: "Review your last game" },
  { href: "/openings", piece: "bp", tone: "orange", title: "Sicilian Defense", sub: "Explore this opening" },
];

export default function Home() {
  const nOpenings = openingCount();
  const featured = bots.filter((b) => b.index && b.index >= 4 && b.index <= 9).slice(0, 4);

  return (
    <div className="home">
      {/* ---------- hero ---------- */}
      <section className="hero3">
        <div className="hero3-art" aria-hidden="true">
          <img src={asset("/pieces/cburnett/bn.svg")} alt="" className="art-piece a1" />
          <img src={asset("/pieces/cburnett/wn.svg")} alt="" className="art-piece a2" />
          <img src={asset("/pieces/cburnett/bb.svg")} alt="" className="art-piece a3" />
        </div>
        <div className="container hero3-inner">
          <h1>Play. Learn. Improve.</h1>
          <p>
            Play against bots, analyze your games, explore openings, learn traps and build your
            repertoire — all in one place.
          </p>
          <Link className="cta-pill" href="/play">
            <span className="cta-tri" aria-hidden="true">▶</span>
            Play vs Bot
            <span className="cta-ar" aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      {/* ---------- main menu ---------- */}
      <section className="container home-sec">
        <div className="menu-grid">
          {AREAS.map((a) => (
            <Link key={a.title} href={a.href} className="menu-card">
              <span className={`menu-ic ${a.tone}`}>
                <Icon name={a.icon} size={19} />
              </span>
              <span className="menu-body">
                <span className="menu-tt">{a.title}</span>
                <span className="menu-dd">{a.desc}</span>
              </span>
              <span className="menu-ar" aria-hidden="true">
                <Icon name="chevron" size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- stats ---------- */}
      <section className="container home-sec">
        <div className="sec-head">
          <h2>
            <span className="sec-ic green"><Icon name="chart" size={15} /></span>
            At a glance
          </h2>
          <Link className="viewall" href="/openings">
            View all <Icon name="chevron" size={13} />
          </Link>
        </div>
        <div className="stat-row">
          <div className="stat-card">
            <span className="stat-ic orange"><Icon name="book" size={17} /></span>
            <div className="stat-num">{nOpenings.toLocaleString("en-IN")}</div>
            <div className="stat-lbl">Openings</div>
          </div>
          <div className="stat-card">
            <span className="stat-ic red"><Icon name="target" size={17} /></span>
            <div className="stat-num">{traps.length}</div>
            <div className="stat-lbl">Traps</div>
          </div>
          <div className="stat-card">
            <span className="stat-ic green"><Icon name="play" size={17} /></span>
            <div className="stat-num">{bots.length}</div>
            <div className="stat-lbl">Bots</div>
          </div>
          <div className="stat-card">
            <span className="stat-ic purple"><Icon name="doc" size={17} /></span>
            <div className="stat-num">{repertoire.length}</div>
            <div className="stat-lbl">Repertoire</div>
          </div>
        </div>
      </section>

      {/* ---------- continue ---------- */}
      <section className="container home-sec">
        <div className="sec-head">
          <h2>
            <span className="sec-ic green"><Icon name="clock" size={15} /></span>
            Continue learning
          </h2>
          <Link className="viewall" href="/play">
            View all <Icon name="chevron" size={13} />
          </Link>
        </div>
        <div className="learn-row">
          {CONTINUE.map((c) => (
            <Link key={c.title} href={c.href} className="learn-card">
              <span className={`learn-thumb ${c.tone}`}>
                <img src={asset(`/pieces/cburnett/${c.piece}.svg`)} alt="" />
              </span>
              <span className="learn-body">
                <span className="learn-tt">{c.title}</span>
                <span className="learn-sub">{c.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- bots ---------- */}
      <section className="container home-sec">
        <div className="sec-head">
          <h2>
            <span className="sec-ic green"><Icon name="play" size={15} /></span>
            Meet the bots
          </h2>
          <Link className="viewall" href="/play">
            View all <Icon name="chevron" size={13} />
          </Link>
        </div>
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
