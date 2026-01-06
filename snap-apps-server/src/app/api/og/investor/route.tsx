import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
          backgroundColor: "#FFFEFB",
          backgroundImage: "linear-gradient(135deg, #FFFEFB 0%, #F5F4F1 100%)",
          fontFamily: "system-ui, sans-serif",
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
            background: "linear-gradient(90deg, #223D48 0%, #1C7BBB 50%, #3D6A3D 100%)",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "60px 80px",
          }}
        >
          {/* Icon */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 80,
              height: 80,
              backgroundColor: "#223D48",
              borderRadius: 16,
              marginBottom: 32,
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#09162F",
              letterSpacing: "-0.03em",
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            Investor Dashboard
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              color: "#42515A",
              marginBottom: 48,
              textAlign: "center",
            }}
          >
            Real-time portfolio intelligence
          </div>

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              gap: 48,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#223D48" }}>10</div>
              <div style={{ fontSize: 16, color: "#42515A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Companies
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#1C7BBB" }}>3</div>
              <div style={{ fontSize: 16, color: "#42515A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Board Seats
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 700, color: "#3D6A3D" }}>24/7</div>
              <div style={{ fontSize: 16, color: "#42515A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#DB3B31",
            }}
          />
          <div
            style={{
              fontSize: 16,
              color: "#42515A",
              textTransform: "uppercase",
              letterSpacing: "0.15em",
            }}
          >
            Powered by Mino
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
