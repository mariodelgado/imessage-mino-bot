#!/usr/bin/env bun
/**
 * Investor Brief Delivery Script
 *
 * Fetches the investor morning brief from Vercel API and delivers via iMessage.
 * Run via launchd at 7:00 AM PST daily.
 *
 * Usage:
 *   bun deliver-investor-brief.ts [investorId]
 *
 * Environment:
 *   SNAP_APP_URL - Base URL for snap apps (default: https://snap-apps.minnow.so)
 */

import { IMessageSDK } from "@photon-ai/imessage-kit";

// Default investor ID (Ryan Koh)
const DEFAULT_INVESTOR_ID = "ece30471-dff9-448e-81f5-6f0286b00a34";

// API base URL
const API_BASE_URL = process.env.SNAP_APP_URL || "https://snap-apps.minnow.so";

interface BriefResponse {
  success: boolean;
  investorId: string;
  investor: {
    name: string;
    firm: string;
    phone: string;
  };
  message: string;
  newsCount: number;
  generatedAt: string;
  error?: string;
}

async function fetchBrief(investorId: string): Promise<BriefResponse> {
  const url = `${API_BASE_URL}/api/investor/${investorId}/brief`;
  console.log(`📡 Fetching brief from ${url}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch brief: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function deliverViaIMessage(phone: string, message: string): Promise<void> {
  const iMessage = new IMessageSDK({ debug: false });

  console.log(`📤 Sending to ${phone}...`);
  await iMessage.send(phone, message);
  console.log(`✅ Message delivered successfully!`);
}

async function main() {
  const investorId = process.argv[2] || DEFAULT_INVESTOR_ID;

  console.log(`
╔═══════════════════════════════════════════════╗
║     Investor Brief Delivery                   ║
║     ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}
╚═══════════════════════════════════════════════╝
`);

  try {
    // Fetch the brief
    const brief = await fetchBrief(investorId);

    if (!brief.success) {
      console.error(`❌ API error: ${brief.error || "Unknown error"}`);
      process.exit(1);
    }

    console.log(`📰 Brief generated for ${brief.investor.name} (${brief.investor.firm})`);
    console.log(`📊 News items: ${brief.newsCount}`);
    console.log(`📱 Delivering to: ${brief.investor.phone}`);
    console.log(`\n--- Message Preview ---\n${brief.message.slice(0, 200)}...\n-----------------------\n`);

    // Deliver via iMessage
    await deliverViaIMessage(brief.investor.phone, brief.message);

    console.log(`\n✅ Morning brief delivered to ${brief.investor.name}!`);

  } catch (error) {
    console.error(`❌ Delivery failed:`, error);
    process.exit(1);
  }
}

main();
