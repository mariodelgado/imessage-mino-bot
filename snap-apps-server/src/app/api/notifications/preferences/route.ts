/**
 * Notification Preferences API
 *
 * POST /api/notifications/preferences - Set notification preferences
 * GET /api/notifications/preferences?userId=xxx - Get preferences
 */

import { NextRequest, NextResponse } from "next/server";
import {
  setNotificationPreferences,
  getNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notifications";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// POST - Set preferences
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { userId, channels, apnsToken, phoneNumber, webhookUrl, imessageHandle } =
      body;

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "userId is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: "channels array is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const prefs: NotificationPreferences = {
      userId,
      channels,
      apnsToken,
      phoneNumber,
      webhookUrl,
      imessageHandle,
    };

    await setNotificationPreferences(prefs);

    const response: ApiResponse<NotificationPreferences> = {
      success: true,
      data: prefs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to set notification preferences:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to set preferences",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// GET - Get preferences
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "userId is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const prefs = await getNotificationPreferences(userId);

    if (!prefs) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Preferences not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse<NotificationPreferences> = {
      success: true,
      data: prefs,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get notification preferences:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to get preferences",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
