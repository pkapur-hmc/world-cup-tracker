"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign-in" | "sign-up";

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setBusy(false);
      setError(authError.message);
      return;
    }

    router.refresh();
    router.replace(redirectTo);
  }

  const otherMode: Mode = mode === "sign-in" ? "sign-up" : "sign-in";
  const submitLabel =
    mode === "sign-in" ? (busy ? "Signing in..." : "Sign in") : busy ? "Creating..." : "Create account";

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        className="input"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={busy}
        aria-label="Email"
      />
      <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        disabled={busy}
        aria-label="Password"
      />
      {error ? <p className="t-small" style={{ color: "var(--penalty)" }}>{error}</p> : null}
      <button type="submit" className="btn primary block" disabled={busy}>
        {submitLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setMode(otherMode);
        }}
        className="t-small muted"
        style={{ background: "none", border: 0, padding: 0, textAlign: "center", cursor: "pointer" }}
        disabled={busy}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
