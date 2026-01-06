/**
 * Public Snap App Page - Shareable URL for Snap Apps
 *
 * This is the public-facing page that renders a Snap App for sharing.
 * URL: /app/[id]
 *
 * Features:
 * - Apple Pass card design (like Apple Wallet/Passbook)
 * - Refresh button triggers Mino re-fetch without data loss
 * - Server-side rendering with metadata for social sharing
 * - Dynamic OG images based on Snap App type
 * - View tracking
 */

import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSnapAppWithView } from "@/lib/storage";
import { ApplePassCard } from "@/components/ApplePassCard";
import { SNAP_APP_TYPE_METADATA } from "@/types/snap-app";
import { ShareActions } from "@/components/ShareActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ============================================================================
// METADATA GENERATION
// ============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const snapApp = await getSnapAppWithView(id);

  if (!snapApp) {
    return {
      title: "Snap App Not Found | Mino",
      description: "This Snap App doesn't exist or has been removed.",
    };
  }

  const typeMetadata = SNAP_APP_TYPE_METADATA[snapApp.type];
  const description =
    snapApp.subtitle ||
    `${typeMetadata.label} - ${typeMetadata.description}`;

  return {
    title: `${snapApp.title} | Mino Snap App`,
    description,
    openGraph: {
      title: snapApp.title,
      description,
      type: "website",
      siteName: "Mino",
      images: [
        {
          url: `/api/og/${id}`,
          width: 1200,
          height: 630,
          alt: snapApp.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: snapApp.title,
      description,
      images: [`/api/og/${id}`],
    },
  };
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default async function SnapAppPage({ params }: PageProps) {
  const { id } = await params;
  const snapApp = await getSnapAppWithView(id);

  if (!snapApp) {
    notFound();
  }

  const typeMetadata = SNAP_APP_TYPE_METADATA[snapApp.type];

  return (
    <main className="min-h-screen py-8 px-4">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: typeMetadata.color }}
        />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500 rounded-full opacity-10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-white/70 group-hover:text-white transition-colors">
              Mino
            </span>
          </Link>

          <ShareActions snapAppId={id} title={snapApp.title} />
        </div>
      </header>

      {/* Apple Pass Card */}
      <div className="relative z-10">
        <ApplePassCard app={snapApp} />
      </div>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto mt-16 pt-8 border-t border-white/10 text-center">
        <p className="text-white/40 text-sm">
          Snap Apps are AI-generated interactive applications from web data.
        </p>
        <p className="text-white/30 text-xs mt-2">
          Powered by{" "}
          <a
            href="https://minnow.so"
            className="text-cyan-400/60 hover:text-cyan-400 transition-colors"
          >
            Mino
          </a>
        </p>
      </footer>
    </main>
  );
}
