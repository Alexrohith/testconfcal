"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCategories } from "@/src/lib/api";
import { createClient } from "@/src/lib/supabase/client";
import { getCurrentUserInterests, replaceCurrentUserInterests } from "@/src/lib/supabase/interests";
import type { Category } from "@/src/types/api";

export default function ResearchInterestOnboarding() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [hasExistingInterests, setHasExistingInterests] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const [interestError, setInterestError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedRequest, setLoadedRequest] = useState("");
  const [retry, setRetry] = useState(0);
  const savingRef = useRef(false);
  const requestKey = String(retry);
  const loading = loadedRequest !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    const supabase = createClient();

    async function loadData() {
      const authPromise = supabase.auth.getUser();
      const [categoryResult, authResult] = await Promise.allSettled([
        getCategories(controller.signal),
        authPromise,
      ]);

      if (controller.signal.aborted) return;

      if (authResult.status === "rejected" || authResult.value.error || !authResult.value.data.user) {
        router.replace("/login");
        return;
      }

      if (categoryResult.status === "fulfilled") {
        setCategories(categoryResult.value.categories);
        setCategoryError(false);
      } else {
        setCategoryError(true);
      }

      try {
        const existingIds = await getCurrentUserInterests(supabase);
        if (controller.signal.aborted) return;
        setSelectedIds(new Set(existingIds));
        setHasExistingInterests(existingIds.length > 0);
        setInterestError(false);
      } catch {
        if (!controller.signal.aborted) setInterestError(true);
      } finally {
        if (!controller.signal.aborted) setLoadedRequest(requestKey);
      }
    }

    void loadData().catch(() => {
      if (!controller.signal.aborted) {
        setInterestError(true);
        setLoadedRequest(requestKey);
      }
    });

    return () => controller.abort();
  }, [requestKey, retry, router]);

  function toggleCategory(categoryId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  async function saveInterests() {
    if (savingRef.current || selectedIds.size === 0) return;

    savingRef.current = true;
    setSaving(true);
    setSaveError(false);

    try {
      const validSelectedIds = categories
        .filter((category) => selectedIds.has(category.id))
        .map((category) => category.id);
      await replaceCurrentUserInterests(createClient(), validSelectedIds);
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectionLabel = `${selectedIds.size} research area${selectedIds.size === 1 ? "" : "s"} selected`;

  return (
    <main className="page-main onboarding-page">
      <div className="content-width onboarding-content">
        <div className="eyebrow">Your research profile</div>
        <h1>Personalize your conference calendar</h1>
        <p className="onboarding-intro">Choose the research areas you care about. We&apos;ll use them to personalize the conferences and deadlines you see.</p>

        {loading ? (
          <div className="onboarding-loading" aria-busy="true">
            <div className="skeleton-line medium" />
            <div className="onboarding-skeleton-grid">
              {Array.from({ length: 6 }, (_, index) => <div className="onboarding-skeleton-card" key={index}><div className="skeleton-line medium" /></div>)}
            </div>
          </div>
        ) : categoryError ? (
          <div className="onboarding-error" role="alert">
            <p>Research area options couldn’t be loaded. Check your connection and try again.</p>
            <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : interestError ? (
          <div className="onboarding-error" role="alert">
            <p>Your saved research interests couldn’t be loaded. Check your connection and try again.</p>
            <button className="text-link" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
          </div>
        ) : (
          <>
            <div className="onboarding-selection-status" aria-live="polite">{selectionLabel}</div>
            <div className="interest-options" role="group" aria-label="Research areas">
              {categories.map((category) => {
                const selected = selectedIds.has(category.id);
                return (
                  <button
                    className={`interest-option${selected ? " is-selected" : ""}`}
                    type="button"
                    key={category.id}
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <span className="interest-option-check" aria-hidden="true">{selected ? "✓" : ""}</span>
                    <span>{category.display_name}</span>
                  </button>
                );
              })}
            </div>

            <footer className="onboarding-footer">
              <p>Select at least one research area to continue.</p>
              <div className="onboarding-save-actions">
                {saveError && (
                  <div className="onboarding-save-error" role="alert">
                    <span>Couldn&apos;t save your research interests.</span>
                    <button className="text-link" type="button" onClick={saveInterests} disabled={saving}>Try again</button>
                  </div>
                )}
                <button className="button-primary" type="button" onClick={saveInterests} disabled={saving || selectedIds.size === 0}>
                  {saving ? "Saving..." : hasExistingInterests ? "Save interests" : "Continue"}
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}