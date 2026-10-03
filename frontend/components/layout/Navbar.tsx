"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import GlobalSearch from "@/components/layout/GlobalSearch";
import { createClient } from "@/src/lib/supabase/client";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/calendar", label: "Calendar" },
  { href: "/saved", label: "Saved" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let receivedAuthEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    supabase.auth.getUser()
      .then(({ data, error }) => {
        if (active && !receivedAuthEvent) {
          setUser(error ? null : data.user);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (active && !receivedAuthEvent) {
          setUser(null);
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(false);

    try {
      const { error } = await createClient().auth.signOut();
      if (error) {
        setSignOutError(true);
        setSigningOut(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError(true);
      setSigningOut(false);
    }
  }

  const profileName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  const displayName = typeof profileName === "string" && profileName.trim() ? profileName.trim() : "Account";
  const profileAvatar = user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const avatarUrl = typeof profileAvatar === "string" && profileAvatar.startsWith("https://") ? profileAvatar : null;

  return (
    <header className="site-header">
      <nav className="nav-inner" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="CONFCal home">
          <span className="brand-mark" aria-hidden="true" />
          <span>CONFCal</span>
        </Link>
        <div className="app-navigation">
          <div className="nav-links">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={pathname === item.href ? "nav-link-active" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <GlobalSearch />
          {authLoading ? (
            <span className="nav-auth-loading" aria-label="Checking session" />
          ) : user ? (
            <div className="nav-user-area">
              {avatarUrl && <Image className="nav-avatar" src={avatarUrl} alt="" width={28} height={28} unoptimized />}
              <span className="nav-user-name">{displayName}</span>
              <button className="nav-sign-out" type="button" onClick={signOut} disabled={signingOut}>
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
              {signOutError && <span className="nav-sign-out-error" role="alert">Sign out failed. Try again.</span>}
            </div>
          ) : (
            <Link className="nav-account" href="/login">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}