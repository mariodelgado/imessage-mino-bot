/**
 * Gemini Image Generation for Rich Cards
 * Uses Gemini 2.0 Flash with Imagen 3 to generate visual cards from data
 */

import { VertexAI } from "@google-cloud/vertexai";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

let vertexAI: VertexAI | null = null;

export function initImageGen(projectId: string, location: string = "us-central1") {
  // Use global location for gemini-3-pro-image-preview
  vertexAI = new VertexAI({ project: projectId, location: "global" });
}

/**
 * Generate a visual card/infographic from structured data
 * Returns the path to the generated image
 */
export async function generateDataCard(
  data: any,
  title: string,
  style: "menu" | "list" | "info" | "comparison" = "list"
): Promise<string | null> {
  if (!vertexAI) {
    console.error("VertexAI not initialized for image generation");
    return null;
  }

  try {
    // Use gemini-3-pro-image-preview for image generation
    const model = vertexAI.getGenerativeModel({
      model: "gemini-3-pro-image-preview",
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      } as any,
    });

    // Build prompt based on data and style
    const dataStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);

    const stylePrompts: Record<string, string> = {
      menu: "Design a sleek restaurant menu card. Use a clean white or cream background with dark text. Show items in a clear list format with prices if available.",
      list: "Design a clean numbered list card. White background, dark text, subtle icons next to each item. Modern and minimal.",
      info: "Design an info card with clear sections. Use a clean layout with headers and bullet points. Professional look.",
      comparison: "Design a simple comparison table. Clean grid layout, easy to scan, highlight key differences.",
    };

    const prompt = `${stylePrompts[style]}

CONTENT TO DISPLAY:
${title}

${dataStr.slice(0, 1500)}

REQUIREMENTS:
- iPhone-sized vertical card (9:16 ratio)
- Large, readable text (minimum 16pt equivalent)
- Maximum 8 items shown
- White or light background
- No decorative clutter
- Text must be sharp and crisp`;

    console.log(`🎨 Generating ${style} card for: ${title}`);

    const result = await model.generateContent(prompt);
    const response = result.response;

    // Extract image from response
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if ((part as any).inlineData?.mimeType?.startsWith("image/")) {
        const imageData = (part as any).inlineData;
        const buffer = Buffer.from(imageData.data, "base64");

        // Save to temp file
        const ext = imageData.mimeType.split("/")[1] || "png";
        const tempPath = path.join(os.tmpdir(), `mino-card-${Date.now()}.${ext}`);
        fs.writeFileSync(tempPath, buffer);

        console.log(`✅ Generated card: ${tempPath}`);
        return tempPath;
      }
    }

    console.log("⚠️ No image in response");
    return null;
  } catch (error) {
    console.error("Image generation error:", error);
    return null;
  }
}

/**
 * Quick test function
 */
export async function testImageGen() {
  const testData = {
    coffee_drinks: [
      { name: "Tesora", type: "Medium Roast" },
      { name: "Philtered Soul", type: "Hazelnut, Maple" },
      { name: "Jacob's Wonderbar", type: "Dark Roast" },
    ],
  };

  return generateDataCard(testData, "Philz Coffee Menu", "menu");
}
