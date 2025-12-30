import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Fraunces, Space_Grotesk } from "next/font/google";

import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700"],
});

const body = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "BDM Knowledge Base",
  description: "Black Desert Mobile knowledge base",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const uiMode = cookies().get("ui_mode")?.value;
  const uiClass =
    uiMode === "login"
      ? "login-mode"
      : uiMode === "register"
        ? "register-mode"
        : uiMode === "home"
          ? "home-mode"
          : uiMode === "updates"
            ? "updates-mode"
            : "";

  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${uiClass}`}>
      <body className={uiClass}>
        <div className="min-h-screen px-4 pb-16 pt-6 md:px-10">
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ink-500">BDM Knowledge</p>
              <h1 className="font-display text-2xl text-ink-900">Black Desert Mobile</h1>
            </div>
            <nav className="flex flex-wrap items-center gap-4 text-sm text-ink-700">
              <Link href="/" className="hover:text-ink-900">Home</Link>
              <Link href="/updates" className="hover:text-ink-900">Updates</Link>
              <Link href="/auth/login" className="hover:text-ink-900">Login</Link>
              <Link href="/auth/register" className="hover:text-ink-900">Register</Link>
              <Link href="/profile" className="hover:text-ink-900">Profile</Link>
              <Link href="/moderator" className="hover:text-ink-900">Moderator</Link>
            </nav>
          </header>
          <main className="mx-auto mt-10 w-full max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
