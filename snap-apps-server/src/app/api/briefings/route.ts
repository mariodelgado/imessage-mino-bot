import { NextRequest, NextResponse } from "next/server";
import {
  createBriefingSubscription,
  getUserBriefingSubscriptions,
} from "@/lib/storage";
import { nanoid } from "nanoid";

/**
 * GET /api/briefings - Get user's briefing subscriptions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const subscriptions = await getUserBriefingSubscriptions(userId);

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error) {
    console.error("Error fetching briefing subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/briefings - Create a new briefing subscription
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      email,
      phone,
      topics,
      companies,
      schedule,
      deliveryMethod,
      webhookUrl,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!topics?.length && !companies?.length) {
      return NextResponse.json(
        { error: "At least one topic or company is required" },
        { status: 400 }
      );
    }

    // Validate delivery method has required contact info
    const method = deliveryMethod || "imessage";
    if ((method === "imessage" || method === "sms") && !phone) {
      return NextResponse.json(
        { error: "Phone number is required for iMessage/SMS delivery" },
        { status: 400 }
      );
    }

    if (method === "email" && !email) {
      return NextResponse.json(
        { error: "Email is required for email delivery" },
        { status: 400 }
      );
    }

    if (method === "webhook" && !webhookUrl) {
      return NextResponse.json(
        { error: "Webhook URL is required for webhook delivery" },
        { status: 400 }
      );
    }

    // Generate a user ID based on phone or email
    const userId = phone
      ? `phone:${phone.replace(/\D/g, "")}`
      : email
      ? `email:${email.toLowerCase()}`
      : `anon:${nanoid(8)}`;

    const subscription = await createBriefingSubscription({
      userId,
      name,
      email,
      phone,
      topics: topics || [],
      companies: companies || [],
      schedule: schedule || {
        enabled: true,
        time: "06:00",
        timezone: "America/Los_Angeles",
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      },
      deliveryMethod: method,
      webhookUrl,
    });

    return NextResponse.json({
      success: true,
      subscription,
      message: `Your daily briefing has been set up! You'll receive updates at ${subscription.schedule.time} ${subscription.schedule.timezone}.`,
    });
  } catch (error) {
    console.error("Error creating briefing subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}
