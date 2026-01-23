import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { createSnapApp } from "@/lib/storage";
import {
  SnapAppTypeSchema,
  SnapAppInsightTypeSchema,
  type SnapAppType,
  type SnapAppInsightType,
} from "@/types/snap-app";
import { AUTHOR_SYSTEM_PROMPT } from "@/lib/author-prompts";

export const maxDuration = 60;

// Define the input schema for the createSnapApp tool
const CreateSnapAppInputSchema = z.object({
  type: SnapAppTypeSchema.describe("The type of Snap App to create"),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe("A descriptive title for the Snap App"),
  subtitle: z
    .string()
    .max(500)
    .optional()
    .describe("Optional subtitle providing additional context"),
  data: z
    .record(z.unknown())
    .describe(
      "The type-specific data payload for the Snap App (structure depends on type)"
    ),
  insights: z
    .array(
      z.object({
        icon: z.string().describe("Emoji icon for the insight"),
        text: z
          .string()
          .max(100)
          .describe("Brief insight text (under 50 chars recommended)"),
        type: SnapAppInsightTypeSchema.describe(
          "The type of insight: positive, negative, neutral, or warning"
        ),
      })
    )
    .default([])
    .describe("Array of insights to display as badges"),
  sourceUrl: z
    .string()
    .url()
    .optional()
    .describe("Optional source URL for the data"),
  creatorName: z.string().optional().describe("Optional name of the creator"),
});

type CreateSnapAppInput = z.infer<typeof CreateSnapAppInputSchema>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: AUTHOR_SYSTEM_PROMPT,
    messages,
    stopWhen: stepCountIs(3),
    tools: {
      createSnapApp: tool({
        description:
          "Create a new Snap App with the specified type, title, data, and insights. Call this when you have gathered enough information from the user to create a complete Snap App.",
        inputSchema: CreateSnapAppInputSchema,
        execute: async (input: CreateSnapAppInput) => {
          const { type, title, subtitle, data, insights, sourceUrl, creatorName } = input;
          try {
            const snapApp = await createSnapApp({
              type: type as SnapAppType,
              title,
              subtitle,
              data,
              insights: insights.map((i) => ({
                ...i,
                type: i.type as SnapAppInsightType,
              })),
              sourceUrl,
              creatorName: creatorName || "Snap App Author",
              actions: [
                {
                  label: "Share",
                  icon: "link",
                  action: "share",
                },
              ],
              isPublic: true,
            });

            return {
              success: true,
              snapApp: {
                id: snapApp.id,
                title: snapApp.title,
                type: snapApp.type,
                shareUrl: snapApp.shareUrl,
              },
              message: `Snap App created successfully! View it at: ${snapApp.shareUrl}`,
            };
          } catch (error) {
            console.error("Error creating Snap App:", error);
            return {
              success: false,
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to create Snap App",
            };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
