"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-black/6 bg-white p-6 shadow-sm">
        <h1 className="mb-1 font-display text-xl tracking-[-0.01em] text-[var(--color-ink)]">
          Create an account
        </h1>
        <p className="mb-5 text-[12px] text-[#8a857c]">
          Get started with Humify
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-[11px] font-medium text-[#8a857c]"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-sand-deep)] bg-[var(--color-parchment)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[#a39e95] focus:border-[var(--color-clay)] focus:outline-none focus:ring-2 focus:ring-[var(--color-clay)]/20"
              placeholder="Your name"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-[11px] font-medium text-[#8a857c]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-sand-deep)] bg-[var(--color-parchment)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[#a39e95] focus:border-[var(--color-clay)] focus:outline-none focus:ring-2 focus:ring-[var(--color-clay)]/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-[11px] font-medium text-[#8a857c]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-sand-deep)] bg-[var(--color-parchment)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[#a39e95] focus:border-[var(--color-clay)] focus:outline-none focus:ring-2 focus:ring-[var(--color-clay)]/20"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-[11px] font-medium text-[#8a857c]"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-sand-deep)] bg-[var(--color-parchment)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[#a39e95] focus:border-[var(--color-clay)] focus:outline-none focus:ring-2 focus:ring-[var(--color-clay)]/20"
              placeholder="Repeat your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-clay)] px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
      </div>

      <p className="mt-4 text-center text-[12px] text-[#8a857c]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--color-clay)] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
