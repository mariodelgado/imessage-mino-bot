/**
 * Snap Apps API - Create and List endpoints
 *
 * POST /api/snap-apps - Create a new Snap App
 * GET /api/snap-apps - List recent public Snap Apps
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createSnapApp,
  getRecentPublicSnapApps,
  getUserSnapApps,
} from "@/lib/storage";
import {
  CreateSnapAppRequestSchema,
  type ApiResponse,
  type SnapApp,
} from "@/types/snap-app";

// ============================================================================
// POST - Create a new Snap App
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = CreateSnapAppRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Validation error: ${parseResult.error.errors[0].message}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Create the Snap App
    const snapApp = await createSnapApp(parseResult.data);

    const response: ApiResponse<SnapApp> = {
      success: true,
      data: snapApp,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create Snap App:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to create Snap App",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// GET - List Snap Apps
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Clamp limits
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    let snapApps: SnapApp[];

    if (userId) {
      // Get user's snap apps
      snapApps = await getUserSnapApps(userId, safeLimit, safeOffset);
    } else {
      // Get recent public snap apps
      snapApps = await getRecentPublicSnapApps(safeLimit, safeOffset);
    }

    const response: ApiResponse<SnapApp[]> = {
      success: true,
      data: snapApps,
      meta: {
        limit: safeLimit,
        page: Math.floor(safeOffset / safeLimit) + 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to list Snap Apps:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to list Snap Apps",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
