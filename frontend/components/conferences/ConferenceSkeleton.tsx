export default function ConferenceSkeleton({
  count = 6,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`conference-grid ${className}`.trim()} aria-label="Conference results loading" aria-busy="true">
      {Array.from({ length: count }, (_, skeletonIndex) => (
        <div className="skeleton-card" key={skeletonIndex}>
          <div className="skeleton-card-topline"><span /><span /></div>
          <div className="skeleton-line large" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
          <div className="skeleton-card-deadline">
            <span /><span />
          </div>
          <div className="skeleton-card-footer"><span /><span /></div>
        </div>
      ))}
    </div>
  );
}