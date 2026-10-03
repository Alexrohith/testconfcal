"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { User } from "@supabase/supabase-js";
import GlobalSearch from "@/components/layout/GlobalSearch";
import NotificationCenter from "@/components/layout/NotificationCenter";
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
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let receivedAuthEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setAuthLoading(false);
    });

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (active && !receivedAuthEvent) {
          setUser(error ? null : data.session?.user ?? null);
          setAccessToken(error ? null : data.session?.access_token ?? null);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (active && !receivedAuthEvent) {
          setUser(null);
          setAccessToken(null);
          setAuthLoading(false);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
        profileTriggerRef.current?.focus();
        return;
      }

      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const items = profileMenuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not(:disabled)',
      );
      if (!items?.length) return;

      event.preventDefault();
      const currentIndex = Array.from(items).indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
      items[nextIndex].focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

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

  const metadata = user?.user_metadata ?? {};
  const metadataName = [
    metadata.full_name,
    metadata.name,
    [metadata.given_name, metadata.family_name].filter(
      (part): part is string => typeof part === "string" && part.trim().length > 0,
    ).join(" "),
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const email = user?.email ?? "";
  const emailName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  const displayName = metadataName?.trim() || emailName || "Account";
  const avatarCandidate = metadata.avatar_url ?? metadata.picture ?? metadata.avatar;
  let avatarUrl: string | null = null;
  if (typeof avatarCandidate === "string") {
    try {
      const parsedAvatarUrl = new URL(avatarCandidate);
      if (parsedAvatarUrl.protocol === "https:") avatarUrl = parsedAvatarUrl.href;
    } catch {
      avatarUrl = null;
    }
  }
  if (avatarUrl === failedAvatarUrl) avatarUrl = null;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "A";

  function handleProfileTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !profileOpen) {
      event.preventDefault();
      setProfileOpen(true);
      const firstItem = event.key === "ArrowDown";
      requestAnimationFrame(() => {
        const items = profileMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
        if (!items?.length) return;
        items[firstItem ? 0 : items.length - 1].focus();
      });
    }
  }

  return (
    <header className="site-header">
      <nav className="nav-inner" aria-label="Main navigation">
        <Link className="brand" href="/" aria-label="CONFCal home">
          <Image
            className="brand-mark-image"
            src="/confcal-logo.svg"
            alt=""
            width={32}
            height={32}
          />
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
              {accessToken && <NotificationCenter accessToken={accessToken} />}
              <div className="nav-profile" ref={profileRef}>
                <button
                  ref={profileTriggerRef}
                  className="nav-profile-trigger"
                  type="button"
                  aria-label={`Open profile menu for ${displayName}`}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-controls="nav-profile-menu"
                  onClick={() => setProfileOpen((open) => !open)}
                  onKeyDown={handleProfileTriggerKeyDown}
                >
                  <span className="nav-avatar" aria-hidden="true">
                    {avatarUrl ? (
                      <Image
                        className="nav-avatar-image"
                        src={avatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        unoptimized
                        onError={() => setFailedAvatarUrl(avatarUrl)}
                      />
                    ) : (
                      <span className="nav-avatar-initials">{initials}</span>
                    )}
                  </span>
                  <span className="nav-user-name">{displayName}</span>
                  <span className={`nav-profile-chevron${profileOpen ? " is-open" : ""}`} aria-hidden="true">⌄</span>
                </button>
                {profileOpen && (
                  <div
                    id="nav-profile-menu"
                    className="nav-profile-menu"
                    role="menu"
                    aria-label="Profile menu"
                    ref={profileMenuRef}
                  >
                    <div className="nav-profile-summary">
                      <span className="nav-avatar nav-profile-avatar" aria-hidden="true">
                        {avatarUrl ? (
                          <Image
                            className="nav-avatar-image"
                            src={avatarUrl}
                            alt=""
                            width={36}
                            height={36}
                            unoptimized
                            onError={() => setFailedAvatarUrl(avatarUrl)}
                          />
                        ) : (
                          <span className="nav-avatar-initials">{initials}</span>
                        )}
                      </span>
                      <span className="nav-profile-identity">
                        <strong>{displayName}</strong>
                        {email && <span>{email}</span>}
                      </span>
                    </div>
                    <div className="nav-profile-links">
                      <Link role="menuitem" href="/dashboard" onClick={() => setProfileOpen(false)}>Dashboard</Link>
                      <Link role="menuitem" href="/saved" onClick={() => setProfileOpen(false)}>Saved Conferences</Link>
                      <Link role="menuitem" href="/onboarding" onClick={() => setProfileOpen(false)}>Research Interests</Link>
                    </div>
                    <div className="nav-profile-footer">
                      <button
                        className="nav-profile-sign-out"
                        type="button"
                        role="menuitem"
                        onClick={signOut}
                        disabled={signingOut}
                      >
                        {signingOut ? "Signing out..." : "Sign out"}
                      </button>
                      {signOutError && <span className="nav-sign-out-error" role="alert">Sign out failed. Try again.</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Link className="nav-account" href="/login">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}