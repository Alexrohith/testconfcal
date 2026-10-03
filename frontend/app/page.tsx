import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="content-width hero-grid">
          <div>
            <div className="eyebrow">Research, in focus</div>
            <h1>Find conferences that matter to <span>your research.</span></h1>
            <p className="hero-copy">Spend less time scanning calls for papers. Discover academic conferences by research area and keep the deadlines that matter close at hand.</p>
            <div className="hero-actions">
              <Link className="button-primary" href="/explore">Explore conferences</Link>
              <a className="button-secondary" href="#how-it-works">See how CONFCal works</a>
            </div>
            <p className="hero-note">Built for researchers, students, and academic teams.</p>
          </div>
          <div className="product-preview" aria-label="A preview of deadline tracking">
            <div className="preview-topline"><span className="preview-label">Research planner</span><span className="preview-count">Deadline first</span></div>
            <h2 className="preview-title">Keep your next steps clear.</h2>
            <p className="preview-subtitle">A focused view of the details that move research forward.</p>
            <div className="preview-row"><span className="preview-date"><i className="preview-dot" />Paper submission</span><span className="preview-status">Deadline tracking</span></div>
            <div className="preview-row"><span className="preview-date"><i className="preview-dot" />Research areas</span><span className="preview-status">Relevant discovery</span></div>
            <div className="preview-row"><span className="preview-date"><i className="preview-dot" />Conference dates</span><span className="preview-status">One clear view</span></div>
          </div>
        </div>
      </section>
      <section className="section" id="how-it-works">
        <div className="content-width">
          <div className="section-heading">
            <div className="eyebrow">A better way to plan</div>
            <h2>Less searching. More time for the work.</h2>
            <p>Find the right calls for papers, understand what is coming up, and make your next submission easier to plan.</p>
          </div>
          <div className="feature-grid">
            <article className="feature-item"><span className="feature-index">01 / DEADLINES</span><h3>Know what is coming</h3><p>See submission deadlines clearly, with urgent dates easy to spot.</p></article>
            <article className="feature-item"><span className="feature-index">02 / DISCOVERY</span><h3>Search your research areas</h3><p>Explore conferences by topic, location, and submission window.</p></article>
            <article className="feature-item"><span className="feature-index">03 / PLANNING</span><h3>Keep the details together</h3><p>Compare dates and formats while deciding where to submit next.</p></article>
          </div>
        </div>
      </section>
    </main>
  );
}
