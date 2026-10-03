import Link from "next/link";

const productLinks = [
  { href: "/explore", label: "Explore" },
  { href: "/calendar", label: "Calendar" },
  { href: "/saved", label: "Saved" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="content-width">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="footer-brand-link" href="/" aria-label="CONFCal home">
              <span>CONFCal</span>
            </Link>
            <p>Discover academic conferences, deadlines and research opportunities.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <div className="footer-link-group">
              <h2>Product</h2>
              {productLinks.map((item) => (
                <Link href={item.href} key={item.href}>{item.label}</Link>
              ))}
            </div>
            <div className="footer-link-group">
              <h2>Resources</h2>
              <Link href="/onboarding">Research interests</Link>
            </div>
            <div className="footer-link-group">
              <h2>About</h2>
              <Link href="/#how-it-works">How CONFCal works</Link>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© 2026 CONFCal</span>
          <Link href="/">Academic conference planning</Link>
        </div>
      </div>
    </footer>
  );
}
