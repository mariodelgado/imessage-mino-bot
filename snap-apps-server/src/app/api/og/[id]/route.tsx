/**
 * Dynamic OG Image Generation for Snap Apps
 *
 * Generates beautiful social share images for each Snap App type
 * using Vercel's @vercel/og library (built on Satori)
 */

import { ImageResponse } from "next/og";
import { getSnapApp } from "@/lib/storage";
import { SNAP_APP_TYPE_METADATA } from "@/types/snap-app";

export const runtime = "edge";

const TYPE_EMOJIS: Record<string, string> = {
  price_comparison: "📊",
  product_gallery: "🛒",
  article: "📄",
  map_view: "🗺️",
  availability: "📅",
  code_block: "💻",
  data_table: "📋",
  smart_card: "✨",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const snapApp = await getSnapApp(id);

    if (!snapApp) {
      // Return a generic "not found" OG image
      return new ImageResponse(
        (
          <div
            style={{
              height: "100%",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#0A0A0F",
              backgroundImage:
                "radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0A0A0F 70%)",
            }}
          >
            <div style={{ fontSize: 80, marginBottom: 20 }}>🔍</div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "white",
                textAlign: "center",
              }}
            >
              Snap App Not Found
            </div>
          </div>
        ),
        { width: 1200, height: 630 }
      );
    }

    const typeMetadata = SNAP_APP_TYPE_METADATA[snapApp.type];
    const emoji = TYPE_EMOJIS[snapApp.type] || "✨";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0A0A0F",
            backgroundImage:
              "radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(0, 212, 255, 0.15) 0%, transparent 50%)",
            padding: 60,
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: `linear-gradient(90deg, ${typeMetadata.color}, ${typeMetadata.color}80)`,
            }}
          />

          {/* Main content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  backgroundColor: `${typeMetadata.color}20`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                }}
              >
                {emoji}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: typeMetadata.color,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {snapApp.type.replace("_", " ")}
                </div>
              </div>
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: "white",
                lineHeight: 1.1,
                maxWidth: "90%",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {snapApp.title}
            </div>

            {/* Subtitle */}
            {snapApp.subtitle && (
              <div
                style={{
                  fontSize: 28,
                  color: "rgba(255, 255, 255, 0.6)",
                  maxWidth: "80%",
                }}
              >
                {snapApp.subtitle}
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background:
                      "linear-gradient(135deg, #00D4FF 0%, #8B5CF6 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  M
                </div>
                <div
                  style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 24 }}
                >
                  Mino Snap App
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 24,
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: 20,
                }}
              >
                <span>{snapApp.viewCount.toLocaleString()} views</span>
                <span>{snapApp.shareCount.toLocaleString()} shares</span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("OG image generation failed:", error);

    // Return a fallback image
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0A0A0F",
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: "white",
              background: "linear-gradient(135deg, #00D4FF, #8B5CF6)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
            }}
          >
            Mino Snap Apps
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }
}
