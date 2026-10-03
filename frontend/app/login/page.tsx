import Link from "next/link";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="page-main">
      <div className="content-width login-content">
        <div className="eyebrow">CONFCal account</div>
        <h1>Sign in</h1>
        <p>Sign in to access your CONFCal dashboard.</p>
        <GoogleSignInButton callbackError={error === "oauth"} />
        <p><Link className="text-link" href="/explore">Continue exploring conferences</Link></p>
      </div>
    </main>
  );
}