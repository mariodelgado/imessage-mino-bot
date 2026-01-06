/**
 * Pricing Health Dashboard API
 *
 * GET /api/pricing-tracker/health - Get the full health dashboard
 * GET /api/pricing-tracker/health?reference=Mino - Compare against a specific reference
 *
 * Returns Apple Health-style metrics and visualizations for competitive pricing.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generatePricingHealthDashboard,
  type PricingHealthDashboard,
} from "@/lib/pricing-health";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference") || "Mino";

    const dashboard = await generatePricingHealthDashboard(reference);

    const response: ApiResponse<PricingHealthDashboard> = {
      success: true,
      data: dashboard,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate pricing health dashboard:", error);

    return NextResponse.json(
      { success: false, error: "Failed to generate dashboard" },
      { status: 500 }
    );
  }
}
