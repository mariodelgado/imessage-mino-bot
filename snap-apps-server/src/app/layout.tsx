import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snap Apps by Mino",
  description: "AI-generated interactive applications from web data",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://minnow.so"),
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Snap Apps by Mino",
    description: "AI-generated interactive applications from web data",
    type: "website",
    siteName: "Mino",
  },
  twitter: {
    card: "summary_large_image",
    title: "Snap Apps by Mino",
    description: "AI-generated interactive applications from web data",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0A0A0F" />
        {/* Fonts for investor dashboard - matching TinyFish Current aesthetic */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
