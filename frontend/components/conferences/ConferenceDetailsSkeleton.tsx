export default function ConferenceDetailsSkeleton() {
  return (
    <div className="detail-layout detail-skeleton" aria-label="Conference details loading" aria-busy="true">
      <article>
        <div className="skeleton-line short" />
        <div className="skeleton-line detail-title-skeleton" />
        <section className="detail-deadline detail-deadline-skeleton">
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
        </section>
        <section className="detail-reminder-skeleton">
          <div className="skeleton-line short" />
          <div className="detail-reminder-options-skeleton">
            <span /><span /><span />
          </div>
        </section>
        <div className="detail-metadata-skeleton">
          <span /><span /><span />
        </div>
        <div className="skeleton-line large" />
        <div className="skeleton-line medium" />
      </article>
      <aside className="detail-aside detail-aside-skeleton" aria-hidden="true">
        <div className="skeleton-line medium" />
        <div className="skeleton-line large" />
        <div className="skeleton-line large" />
        <div className="skeleton-line large" />
      </aside>
    </div>
  );
}
