/**
 * Investor Snap Apps API
 *
 * Create and manage custom micro-applications for a specific investor.
 * Snap Apps are lightweight, focused apps generated on-demand.
 *
 * POST /api/investor/[id]/snap-apps - Create a new Snap App
 * GET /api/investor/[id]/snap-apps - List investor's Snap Apps
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getInvestor,
  createSnapApp,
  getInvestorSnapApps,
  type SnapApp,
} from "@/lib/investors";

interface CreateSnapAppRequest {
  type: SnapApp["type"];
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

// Predefined Snap App templates
const SNAP_APP_TEMPLATES: Record<SnapApp["type"], { description: string; urlPath: string }> = {
  portfolio: {
    description: "Full portfolio dashboard with news and metrics",
    urlPath: "/investor/{investorId}",
  },
  company_deep_dive: {
    description: "Deep analysis of a specific portfolio company",
    urlPath: "/investor/{investorId}/company/{companyName}",
  },
  competitive_analysis: {
    description: "Competitive landscape analysis",
    urlPath: "/investor/{investorId}/competitive",
  },
  custom: {
    description: "Custom AI-generated application",
    urlPath: "/investor/{investorId}/app/{appId}",
  },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: investorId } = await params;

    // Validate investor exists
    const investor = getInvestor(investorId);
    if (!investor) {
      return NextResponse.json({
        success: false,
        error: "Investor not found",
      }, { status: 404 });
    }

    const body: CreateSnapAppRequest = await request.json();
    const { type, name, description, config } = body;

    if (!type || !name) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: type, name",
      }, { status: 400 });
    }

    // Validate type
    if (!SNAP_APP_TEMPLATES[type]) {
      return NextResponse.json({
        success: false,
        error: `Invalid type. Must be one of: ${Object.keys(SNAP_APP_TEMPLATES).join(", ")}`,
      }, { status: 400 });
    }

    // Generate URL based on type
    let urlPath = SNAP_APP_TEMPLATES[type].urlPath;
    urlPath = urlPath.replace("{investorId}", investorId);

    if (type === "company_deep_dive" && config?.companyName) {
      urlPath = urlPath.replace("{companyName}", encodeURIComponent(config.companyName as string));
    }

    // Create the Snap App
    const snapApp = createSnapApp(investorId, {
      type,
      name,
      description: description || SNAP_APP_TEMPLATES[type].description,
      url: `https://snap-apps-server.vercel.app${urlPath}`,
      config,
    });

    return NextResponse.json({
      success: true,
      snapApp,
      message: `Snap App "${name}" created for ${investor.name}`,
    });
  } catch (error) {
    console.error("Create Snap App error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create Snap App",
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: investorId } = await params;

    // Validate investor exists
    const investor = getInvestor(investorId);
    if (!investor) {
      return NextResponse.json({
        success: false,
        error: "Investor not found",
      }, { status: 404 });
    }

    const snapApps = getInvestorSnapApps(investorId);

    // Always include the default portfolio app
    const defaultApp: Partial<SnapApp> = {
      type: "portfolio",
      name: "Portfolio Dashboard",
      description: "Your personalized portfolio intelligence dashboard",
      url: `https://snap-apps-server.vercel.app/investor/${investorId}`,
    };

    return NextResponse.json({
      success: true,
      investor: {
        id: investor.id,
        name: investor.name,
        firm: investor.firm,
      },
      defaultApp,
      snapApps,
      availableTypes: Object.entries(SNAP_APP_TEMPLATES).map(([type, info]) => ({
        type,
        description: info.description,
      })),
    });
  } catch (error) {
    console.error("Get Snap Apps error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get Snap Apps",
    }, { status: 500 });
  }
}

export const runtime = "nodejs";
