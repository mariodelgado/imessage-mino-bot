/**
 * Snap Apps API - Individual Snap App endpoints
 *
 * GET /api/snap-apps/[id] - Get a Snap App by ID
 * PATCH /api/snap-apps/[id] - Update a Snap App
 * DELETE /api/snap-apps/[id] - Delete a Snap App
 * POST /api/snap-apps/[id]/share - Record a share event
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSnapApp,
  getSnapAppWithView,
  updateSnapApp,
  deleteSnapApp,
  incrementShareCount,
} from "@/lib/storage";
import {
  UpdateSnapAppRequestSchema,
  type ApiResponse,
  type SnapApp,
} from "@/types/snap-app";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get a Snap App by ID
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const trackView = searchParams.get("trackView") !== "false";

    // Get snap app (with or without view tracking)
    const snapApp = trackView
      ? await getSnapAppWithView(id)
      : await getSnapApp(id);

    if (!snapApp) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Snap App not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<SnapApp> = {
      success: true,
      data: snapApp,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get Snap App:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to get Snap App",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// PATCH - Update a Snap App
// ============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Validate request body
    const parseResult = UpdateSnapAppRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Validation error: ${parseResult.error.errors[0].message}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Update the Snap App
    const snapApp = await updateSnapApp(id, parseResult.data);

    if (!snapApp) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Snap App not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<SnapApp> = {
      success: true,
      data: snapApp,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to update Snap App:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to update Snap App",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete a Snap App
// ============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const deleted = await deleteSnapApp(id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Snap App not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to delete Snap App:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to delete Snap App",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// POST - Record a share event
// ============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "share") {
      const count = await incrementShareCount(id);

      const response: ApiResponse<{ shareCount: number }> = {
        success: true,
        data: { shareCount: count },
      };

      return NextResponse.json(response);
    }

    const response: ApiResponse<null> = {
      success: false,
      error: "Unknown action",
    };

    return NextResponse.json(response, { status: 400 });
  } catch (error) {
    console.error("Failed to process action:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to process action",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
