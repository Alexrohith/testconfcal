export default function CalendarSkeleton() {
  return (
    <div className="calendar-layout calendar-skeleton" aria-busy="true" aria-label="Loading calendar">
      <section className="calendar-skeleton-main">
        <div className="skeleton-line medium" />
        <div className="calendar-skeleton-weekdays">
          {Array.from({ length: 7 }, (_, index) => <div className="skeleton-line short" key={index} />)}
        </div>
        <div className="calendar-skeleton-days">
          {Array.from({ length: 35 }, (_, index) => (
            <div className="calendar-skeleton-day" key={index}>
              <div className="skeleton-line short" />
              <div className="skeleton-line medium" />
            </div>
          ))}
        </div>
      </section>
      <aside className="calendar-skeleton-aside">
        <div className="skeleton-line medium" />
        <div className="skeleton-line large" />
        <div className="skeleton-line large" />
        <div className="skeleton-line large" />
      </aside>
    </div>
  );
}