import { NextRequest, NextResponse } from "next/server";
import {
  getBriefingSubscription,
  updateBriefingSubscription,
  deleteBriefingSubscription,
  getDeliveryHistory,
} from "@/lib/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/briefings/[id] - Get a specific subscription
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get("history") === "true";

    const subscription = await getBriefingSubscription(id);

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const response: {
      success: boolean;
      subscription: typeof subscription;
      deliveryHistory?: Awaited<ReturnType<typeof getDeliveryHistory>>;
    } = {
      success: true,
      subscription,
    };

    if (includeHistory) {
      response.deliveryHistory = await getDeliveryHistory(id, 10);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/briefings/[id] - Update a subscription
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getBriefingSubscription(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "topics",
      "companies",
      "schedule",
      "deliveryMethod",
      "webhookUrl",
      "isActive",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    const updated = await updateBriefingSubscription(id, updates);

    return NextResponse.json({
      success: true,
      subscription: updated,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/briefings/[id] - Delete a subscription
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const deleted = await deleteBriefingSubscription(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
