"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="card elevated" style={{ textAlign: "center" }}>
        <div className="t-h2" style={{ marginBottom: 6 }}>
          Check your email
        </div>
        <div className="t-small muted">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </div>
      </div>
    );
  }

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
        disabled={status === "sending"}
        aria-label="Email"
      />
      {error ? <p className="t-small" style={{ color: "var(--penalty)" }}>{error}</p> : null}
      <button type="submit" className="btn primary block" disabled={status === "sending"}>
        {status === "sending" ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}
