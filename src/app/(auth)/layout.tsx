import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-parchment)] px-4 font-dm">
      <Link
        href="/"
        className="mb-8 font-display text-2xl tracking-[-0.02em] text-[var(--color-ink)]"
      >
        Humify
      </Link>
      {children}
    </div>
  );
}
