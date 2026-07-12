import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // NEXT_PUBLIC_* variables are baked into the browser bundle at BUILD
  // time, not read live like server-side env vars. If a build ran before
  // these were set in Vercel, this code ships with literal "undefined"
  // in place of the URL forever -- until a NEW build happens. That
  // produces exactly a generic "NetworkError when attempting to fetch
  // resource" with no useful detail. Fail loud and specific instead.
  if (!url || !key) {
    throw new Error(
      "Supabase browser client misconfigured: NEXT_PUBLIC_SUPABASE_URL or " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from this build. This means " +
      "the env vars were added to Vercel AFTER the currently-deployed build " +
      "ran. Fix: Vercel -> Deployments -> latest -> the ... menu -> Redeploy " +
      "(a fresh build is required, the vars being 'set' isn't enough on its own)."
    );
  }

  return createBrowserClient(url, key);
}
