import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="pipboy-bg pipboy-font">
        <nav className="pipboy-nav">
          <Link href="/stat">STAT</Link>
          <Link href="/items">ITEMS</Link>
          <Link href="/quests">QUESTS</Link>
          <Link href="/map">MAP</Link>
        </nav>
        <main className="pipboy-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
