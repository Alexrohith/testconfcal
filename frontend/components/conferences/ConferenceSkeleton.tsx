export default function ConferenceSkeleton() {
  return (
    <div className="conference-grid" aria-label="Loading conferences" aria-busy="true">
      {Array.from({ length: 6 }, (_, skeletonIndex) => (
        <div className="skeleton-card" key={skeletonIndex}>
          <div className="skeleton-line short" />
          <div className="skeleton-line large" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}