/**
 * Schedule API - Create and manage scheduled jobs
 *
 * POST /api/schedule - Create a new scheduled job for a Snap App
 * DELETE /api/schedule?jobId=xxx - Cancel a scheduled job
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createScheduledJob,
  cancelScheduledJob,
  getSnapApp,
} from "@/lib/storage";
import {
  ScheduleSnapAppRequestSchema,
  type ApiResponse,
  type ScheduledJob,
} from "@/types/snap-app";

// ============================================================================
// POST - Create a scheduled job
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parseResult = ScheduleSnapAppRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Validation error: ${parseResult.error.errors[0].message}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const { snapAppId, cronExpression, intervalMinutes, webhookUrl } =
      parseResult.data;

    // Verify snap app exists
    const snapApp = await getSnapApp(snapAppId);
    if (!snapApp) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Snap App not found",
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Create the scheduled job
    const job = await createScheduledJob(snapAppId, {
      cronExpression,
      intervalMinutes,
      webhookUrl,
    });

    const response: ApiResponse<ScheduledJob> = {
      success: true,
      data: job,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to create scheduled job:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to create scheduled job",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// DELETE - Cancel a scheduled job
// ============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      const response: ApiResponse<null> = {
        success: false,
        error: "jobId is required",
      };
      return NextResponse.json(response, { status: 400 });
    }

    await cancelScheduledJob(jobId);

    const response: ApiResponse<{ cancelled: boolean }> = {
      success: true,
      data: { cancelled: true },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to cancel scheduled job:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Failed to cancel scheduled job",
    };

    return NextResponse.json(response, { status: 500 });
  }
}
