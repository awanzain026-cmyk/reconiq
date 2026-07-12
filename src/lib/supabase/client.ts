import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // .trim() matters here: a stray trailing newline or space from copy-
  // pasting a key into Vercel creates an invalid HTTP header value.
  // Browsers reject constructing such a request outright (producing
  // exactly "NetworkError when attempting to fetch resource" on every
  // device, before any real network call happens), while Node's
  // server-side HTTP client is more lenient and silently tolerates it --
  // which is exactly why the diagnostic endpoint kept showing success
  // while login/signup never worked in any browser.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

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
