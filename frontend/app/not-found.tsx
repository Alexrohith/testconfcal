import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main">
      <div className="content-width">
        <section className="state-panel">
          <h1>We couldn’t find that page.</h1>
          <p>The link may be out of date. Browse current conferences or return to the home page.</p>
          <div className="error-state-actions">
            <Link className="button-primary" href="/explore">Explore conferences</Link>
            <Link className="button-secondary" href="/">Home</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
