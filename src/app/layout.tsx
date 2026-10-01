import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Chessis — Web",
  description:
    "A web port of the core Chessis chess-improvement experience: play the data-driven bots, explore openings, learn traps, and drill the bot repertoire.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            <p style={{ margin: 0 }}>
              Chessis Web — an original web implementation of the Chessis experience. Opening,
              trap, bot and piece data are derived from the app&apos;s bundled assets.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
