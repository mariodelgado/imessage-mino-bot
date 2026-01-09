"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PAPER_TEXTURE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`;

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError("Invalid password");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FDFBF7]">
      {/* Paper texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: PAPER_TEXTURE_SVG }}
      />

      <div className="relative min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-12 h-12 rounded-lg bg-stone-900 flex items-center justify-center">
              <span className="text-[14px] font-bold text-white tracking-wider">
                M
              </span>
            </div>
          </div>

          {/* Title */}
          <h1
            className="text-[1.75rem] font-medium text-stone-900 tracking-[-0.02em] text-center mb-2"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Mino SDK
          </h1>
          <p className="text-[0.9rem] text-stone-500 text-center mb-8">
            Enter the password to continue
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-lg text-stone-900 text-[1rem] placeholder:text-stone-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700/20 transition-all"
              />
            </div>

            {error && (
              <p className="text-[0.85rem] text-red-600 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={!password || isLoading}
              className="w-full px-6 py-3 rounded-lg text-[0.95rem] font-medium bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? "Verifying..." : "Enter"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-[0.7rem] text-stone-400 text-center mt-8 tracking-[0.1em] uppercase">
            Private Access Only
          </p>
        </div>
      </div>
    </main>
  );
}
