/**
 * Home Page - Landing page for Snap Apps
 */

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-40 w-96 h-96 bg-cyan-500 rounded-full opacity-10 blur-3xl" />
        <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-violet-500 rounded-full opacity-10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-8 max-w-2xl">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <span className="text-white font-bold text-3xl">M</span>
        </div>

        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-5xl sm:text-6xl font-bold gradient-text">
            Snap Apps
          </h1>
          <p className="text-xl text-white/60">
            AI-generated interactive applications from web data
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { emoji: "📊", label: "Price Comparisons" },
            { emoji: "🛒", label: "Product Galleries" },
            { emoji: "📅", label: "Availability Trackers" },
            { emoji: "🗺️", label: "Interactive Maps" },
          ].map((feature) => (
            <span
              key={feature.label}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70"
            >
              <span>{feature.emoji}</span>
              <span className="text-sm">{feature.label}</span>
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-4 pt-4">
          <p className="text-white/50">
            Ask Mino anything and get beautiful, shareable results
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://apps.apple.com/app/mino"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download for iOS
            </a>

            <Link href="/explore" className="btn-secondary">
              Explore Snap Apps
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/10 max-w-md mx-auto">
          {[
            { value: "10K+", label: "Apps Created" },
            { value: "50K+", label: "Views" },
            { value: "4.9★", label: "Rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
