/**
 * Investor Preferences API
 *
 * GET /api/investor/[id]/preferences - Get investor preferences
 * POST /api/investor/[id]/preferences - Update investor preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { getInvestorPreferences, saveInvestorPreferences } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const preferences = await getInvestorPreferences(id);

    if (!preferences) {
      // Return default preferences if none exist
      const defaultPrefs = await saveInvestorPreferences(id, {});
      return NextResponse.json({ success: true, data: defaultPrefs });
    }

    return NextResponse.json({ success: true, data: preferences });
  } catch (error) {
    console.error("Failed to get investor preferences:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get preferences" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await saveInvestorPreferences(id, body);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update investor preferences:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
