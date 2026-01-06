/**
 * Investor Feedback API
 *
 * GET /api/investor/[id]/feedback - Get investor's feedback history
 * POST /api/investor/[id]/feedback - Submit new feedback
 */

import { NextRequest, NextResponse } from "next/server";
import { addInvestorFeedback, getInvestorFeedback } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");

    const feedback = await getInvestorFeedback(id, limit);

    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    console.error("Failed to get investor feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get feedback" },
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

    if (!body.type || !body.message) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, message" },
        { status: 400 }
      );
    }

    const feedback = await addInvestorFeedback(id, {
      type: body.type,
      message: body.message,
      context: body.context,
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    console.error("Failed to submit investor feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
