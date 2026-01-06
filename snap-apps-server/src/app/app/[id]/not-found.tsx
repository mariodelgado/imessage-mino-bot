/**
 * Not Found Page for Snap Apps
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
          <span className="text-5xl">🔍</span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white">Snap App Not Found</h1>

        {/* Description */}
        <p className="text-white/60">
          This Snap App doesn&apos;t exist or has been removed. It may have
          expired or been deleted by its creator.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
          <a
            href="https://minnow.so"
            className="btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            Create Your Own
          </a>
        </div>
      </div>
    </main>
  );
}
