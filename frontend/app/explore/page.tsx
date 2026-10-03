import { Suspense } from "react";
import ExploreBrowser from "@/components/conferences/ExploreBrowser";

function ExploreFallback() {
  return <main className="page-main"><div className="content-width" aria-busy="true">Loading conference discovery…</div></main>;
}

export default function ExplorePage() {
  return <Suspense fallback={<ExploreFallback />}><ExploreBrowser /></Suspense>;
}