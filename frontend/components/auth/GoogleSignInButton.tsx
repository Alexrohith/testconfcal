"use client";

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

export default function GoogleSignInButton({ callbackError }: { callbackError: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        setError("Google sign-in could not be started. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Google sign-in could not be started. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="auth-action">
      {callbackError && <p className="auth-error" role="alert">Google sign-in could not be completed. Please try again.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button-secondary google-sign-in" type="button" onClick={signIn} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
}