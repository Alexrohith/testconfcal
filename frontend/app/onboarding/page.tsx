import { redirect } from "next/navigation";
import ResearchInterestOnboarding from "@/components/onboarding/ResearchInterestOnboarding";
import { createClient } from "@/src/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims) redirect("/login");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login");

  return <ResearchInterestOnboarding />;
}