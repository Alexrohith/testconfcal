import { Suspense } from "react";
import ExploreBrowser from "@/components/conferences/ExploreBrowser";
import ConferenceSkeleton from "@/components/conferences/ConferenceSkeleton";

function ExploreFallback() {
  return (
    <main className="page-main">
      <div className="content-width" aria-busy="true">
        <header className="page-heading explore-fallback-heading">
          <div>
            <div className="skeleton-line short" />
            <div className="skeleton-line large" />
            <div className="skeleton-line medium" />
          </div>
        </header>
        <div className="explore-fallback-filters">
          {Array.from({ length: 5 }, (_, index) => (
            <div className="skeleton-line" key={index} />
          ))}
        </div>
        <ConferenceSkeleton />
      </div>
    </main>
  );
}

export default function ExplorePage() {
  return <Suspense fallback={<ExploreFallback />}><ExploreBrowser /></Suspense>;
}