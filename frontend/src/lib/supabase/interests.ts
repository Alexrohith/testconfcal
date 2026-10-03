import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/src/types/supabase";

type UserInterestsClient = SupabaseClient<Database>;

export class UnauthenticatedUserError extends Error {
  constructor() {
    super("No authenticated user is available.");
    this.name = "UnauthenticatedUserError";
  }
}

async function getAuthenticatedUser(client: UserInterestsClient): Promise<User> {
  const { data: { user }, error } = await client.auth.getUser();
  if (error?.name === "AuthSessionMissingError") throw new UnauthenticatedUserError();
  if (error) throw error;
  if (!user) throw new UnauthenticatedUserError();
  return user;
}

export async function getCurrentUserInterestProfile(client: UserInterestsClient): Promise<{ user: User; categoryIds: number[] }> {
  const user = await getAuthenticatedUser(client);
  const { data, error } = await client
    .from("user_interests")
    .select("category_id")
    .eq("user_id", user.id);

  if (error) throw error;
  return {
    user,
    categoryIds: [...new Set(data.map((interest) => interest.category_id))],
  };
}

export async function getCurrentUserInterests(client: UserInterestsClient): Promise<number[]> {
  const profile = await getCurrentUserInterestProfile(client);
  return profile.categoryIds;
}

export async function replaceCurrentUserInterests(
  client: UserInterestsClient,
  categoryIds: number[],
): Promise<void> {
  const user = await getAuthenticatedUser(client);
  const selectedIds = [...new Set(categoryIds)];

  if (selectedIds.length === 0 || selectedIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    throw new Error("Select at least one valid research area.");
  }

  const { error: saveError } = await client
    .from("user_interests")
    .upsert(
      selectedIds.map((categoryId) => ({ user_id: user.id, category_id: categoryId })),
      { onConflict: "user_id,category_id" },
    );

  if (saveError) throw saveError;

  const { data: savedRows, error: loadError } = await client
    .from("user_interests")
    .select("category_id")
    .eq("user_id", user.id);

  if (loadError) throw loadError;

  const selectedSet = new Set(selectedIds);
  const deselectedIds = savedRows
    .map((interest) => interest.category_id)
    .filter((categoryId) => !selectedSet.has(categoryId));

  if (deselectedIds.length > 0) {
    const { error: deleteError } = await client
      .from("user_interests")
      .delete()
      .eq("user_id", user.id)
      .in("category_id", deselectedIds);

    if (deleteError) throw deleteError;
  }
}