/**
 * Cron Refresh API - Vercel Cron Job for scheduled Snap App refreshes
 *
 * This endpoint is called by Vercel Cron to process pending scheduled jobs.
 * Configure in vercel.json with a cron schedule for every 15 minutes
 *
 * GET /api/cron/refresh - Process pending refresh jobs
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPendingJobs,
  completeScheduledJob,
  getSnapApp,
  updateSnapApp,
} from "@/lib/storage";
import type { ApiResponse, ScheduledJob } from "@/types/snap-app";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// ============================================================================
// GET - Process pending jobs (called by Vercel Cron)
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      const response: ApiResponse<null> = {
        success: false,
        error: "Unauthorized",
      };
      return NextResponse.json(response, { status: 401 });
    }

    // Get pending jobs
    const pendingJobs = await getPendingJobs(10);

    if (pendingJobs.length === 0) {
      const response: ApiResponse<{ processed: number }> = {
        success: true,
        data: { processed: 0 },
      };
      return NextResponse.json(response);
    }

    const results: {
      jobId: string;
      snapAppId: string;
      status: "success" | "error";
      error?: string;
    }[] = [];

    // Process each pending job
    for (const job of pendingJobs) {
      try {
        await processJob(job);
        results.push({
          jobId: job.id,
          snapAppId: job.snapAppId,
          status: "success",
        });
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);
        results.push({
          jobId: job.id,
          snapAppId: job.snapAppId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const response: ApiResponse<{
      processed: number;
      results: typeof results;
    }> = {
      success: true,
      data: {
        processed: results.filter((r) => r.status === "success").length,
        results,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Cron refresh failed:", error);

    const response: ApiResponse<null> = {
      success: false,
      error: "Cron refresh failed",
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// ============================================================================
// PROCESS JOB
// ============================================================================

async function processJob(job: ScheduledJob): Promise<void> {
  const snapApp = await getSnapApp(job.snapAppId);

  if (!snapApp) {
    console.warn(`Snap App not found for job ${job.id}: ${job.snapAppId}`);
    await completeScheduledJob(job.id);
    return;
  }

  // If webhook URL is configured, call it to refresh the data
  if (job.webhookUrl) {
    try {
      const response = await fetch(job.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Mino-Snap-App-Id": snapApp.id,
          "X-Mino-Job-Id": job.id,
        },
        body: JSON.stringify({
          snapAppId: snapApp.id,
          type: snapApp.type,
          sourceUrl: snapApp.sourceUrl,
          currentData: snapApp.data,
        }),
      });

      if (response.ok) {
        const newData = await response.json();

        // Update snap app with new data
        if (newData.data) {
          await updateSnapApp(snapApp.id, {
            data: newData.data,
            insights: newData.insights || snapApp.insights,
          });
        }
      } else {
        console.error(
          `Webhook returned ${response.status} for job ${job.id}`
        );
      }
    } catch (error) {
      console.error(`Failed to call webhook for job ${job.id}:`, error);
    }
  }

  // Mark job as completed and reschedule if recurring
  await completeScheduledJob(job.id);
}

// ============================================================================
// Vercel Cron Configuration
// ============================================================================

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 second timeout for processing jobs
