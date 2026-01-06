import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Investor Dashboard | Mino",
    description: "Real-time portfolio intelligence and news tracking for venture investors",
    openGraph: {
      title: "📊 Investor Dashboard",
      description: "Real-time portfolio intelligence, powered by Mino",
      type: "website",
      siteName: "Mino",
      images: [
        {
          url: "/api/og/investor",
          width: 1200,
          height: 630,
          alt: "Investor Dashboard Preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "📊 Investor Dashboard",
      description: "Real-time portfolio intelligence, powered by Mino",
      images: ["/api/og/investor"],
    },
  };
}

export default function InvestorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
