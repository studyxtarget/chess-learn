import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Chess Learn",
  description:
    "A browser chess trainer: play the data-driven bots, explore openings, learn traps, and run a full Stockfish game review.",
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
          </div>
        </footer>
      </body>
    </html>
  );
}
