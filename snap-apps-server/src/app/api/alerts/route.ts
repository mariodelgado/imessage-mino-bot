/**
 * Alerts API - Create and manage diff alerts for Snap Apps
 *
 * POST /api/alerts - Create a new alert
 * GET /api/alerts?snapAppId=xxx - Get alerts for a Snap App
 * DELETE /api/alerts?alertId=xxx - Delete an alert
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createDiffAlert,
  getDiffAlertsForSnapApp,
  deleteDiffAlert,
  type DiffAlert,
} from "@/lib/notifications";
import { getSnapApp } from "@/lib/storage";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// POST - Create a new alert
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { snapAppId, field, threshold, condition } = body;

    if (!snapAppId || !field) {
      const response: ApiResponse<null> = {
        success: false,
        error: "snapAppId and field are required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    // Verify snap app exists
    const snapApp = await getSnapApp(snapAppId);
    if (!snapApp) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Snap App not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Get current value as initial lastValue
    const getValueAtPath = (obj: unknown, path: string): unknown => {
      const parts = path.split(/\.|\[|\]/).filter(Boolean);
      let current: unknown = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        if (typeof current !== "object") return undefined;
        const key = /^\d+$/.test(part) ? parseInt(part) : part;
        current = (current as Record<string, unknown>)[key as string];
      }
      return current;
    };

    const initialValue = getValueAtPath(snapApp.data, field);

    const alert = await createDiffAlert({
      snapAppId,
      field,
      threshold: threshold || undefined,
      condition: condition || "any_change",
      lastValue: initialValue,
    });

    const response: ApiResponse<DiffAlert> = {
      success: true,
      data: alert,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create alert:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to create alert",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// GET - Get alerts for a Snap App
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const snapAppId = searchParams.get("snapAppId");

    if (!snapAppId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "snapAppId is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const alerts = await getDiffAlertsForSnapApp(snapAppId);

    const response: ApiResponse<DiffAlert[]> = {
      success: true,
      data: alerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get alerts:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to get alerts",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete an alert
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get("alertId");

    if (!alertId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "alertId is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    await deleteDiffAlert(alertId);

    const response: ApiResponse<{ deleted: boolean }> = {
      success: true,
      data: { deleted: true },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to delete alert:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to delete alert",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
