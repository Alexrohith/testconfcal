"use client";

import Link from "next/link";

export default function ApplicationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-main">
      <div className="content-width">
        <section className="state-panel" role="alert">
          <h1>We couldn’t open this page.</h1>
          <p>Something interrupted the page. Try again, or return to conference discovery.</p>
          <div className="error-state-actions">
            <button className="button-primary" type="button" onClick={reset}>Try again</button>
            <Link className="button-secondary" href="/explore">Explore conferences</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
