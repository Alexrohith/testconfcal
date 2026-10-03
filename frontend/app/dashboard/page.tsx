import { redirect } from "next/navigation";
import DashboardExperience from "@/components/dashboard/DashboardExperience";
import { getCategories } from "@/src/lib/api";
import { createClient } from "@/src/lib/supabase/server";
import type { Category } from "@/src/types/api";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/login");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  const { data: interestRows, error: interestError } = await supabase
    .from("user_interests")
    .select("category_id")
    .eq("user_id", user.id);

  const profileName = [user.user_metadata.full_name, user.user_metadata.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (interestError) {
    return <DashboardExperience userName={profileName?.trim() ?? "Account"} researchInterests={null} researchInterestError />;
  }

  if (interestRows.length === 0) redirect("/onboarding");

  let researchInterests: Category[] | null = null;
  let researchInterestError = false;

  try {
    const { categories } = await getCategories();
    const selectedIds = new Set(interestRows.map((interest) => interest.category_id));
    researchInterests = categories.filter((category) => selectedIds.has(category.id));
    researchInterestError = researchInterests.length === 0;
  } catch {
    researchInterestError = true;
  }

  return <DashboardExperience userName={profileName?.trim() ?? "Account"} researchInterests={researchInterests} researchInterestError={researchInterestError} />;
}