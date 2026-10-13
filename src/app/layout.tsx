import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import BottomNav from "@/components/BottomNav";

/** The site is served from a sub-path on GitHub Pages, so the icon needs the prefix too. */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const viewport: Viewport = {
  themeColor: "#080f16",
};

export const metadata: Metadata = {
  title: "Chess Learn",
  description:
    "A browser chess trainer: play the data-driven bots, solve tactics puzzles, explore openings, learn traps, and run a full Stockfish game review.",
  icons: { icon: `${BASE_PATH}/icon.svg` },
  openGraph: {
    title: "Chess Learn",
    description: "Play bots, solve puzzles, explore openings and review your games with Stockfish.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <BottomNav />
        <footer className="footer">
          <div className="container">
            <p style={{ margin: 0 }}>
              Chess Learn — an original web implementation. Opening,
              trap, bot and piece data are derived from the app&apos;s bundled assets.
            </p>
            <p className="small" style={{ margin: "6px 0 0", opacity: 0.8 }}>
              Analysis uses Stockfish (GPL-3.0) and the cburnett piece set; their licences ship with
              the project. Verify third-party data reuse rights before publishing.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
