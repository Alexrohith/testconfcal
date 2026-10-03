import Link from "next/link";

export default function SavedPage() {
  return (
    <main className="page-main">
      <div className="content-width">
        <header className="page-heading">
          <div>
            <div className="eyebrow">Your reading list</div>
            <h1>Saved conferences</h1>
            <p>Keep calls for papers you are considering together.</p>
          </div>
        </header>
        <section className="state-panel saved-empty-state">
          <h2>Sign in to save conferences.</h2>
          <p>Saved listings will appear here when account access is available.</p>
          <Link className="button-primary" href="/login">Sign in</Link>
        </section>
      </div>
    </main>
  );
}