/**
 * Mino API Client - SSE Streaming
 */

const MINO_API_URL = "https://mino.ai/v1/automation/run-sse";

interface MinoResult {
  status: "success" | "error" | "running";
  result?: string;
  error?: string;
  progress?: string[];
}

export async function runMinoAutomation(
  apiKey: string,
  url: string,
  goal: string
): Promise<MinoResult> {
  const progress: string[] = [];
  let finalResult = "";
  let status: "success" | "error" | "running" = "running";

  try {
    const response = await fetch(MINO_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, goal }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { status: "error", error: "Invalid Mino API key" };
      }
      return { status: "error", error: `Mino API error: ${response.status}` };
    }

    // Handle SSE streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return { status: "error", error: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress" || data.status === "running") {
              progress.push(data.message || data.step || "Processing...");
            } else if (data.type === "complete" || data.status === "completed") {
              status = "success";
              finalResult = data.result || data.output || JSON.stringify(data);
            } else if (data.type === "error" || data.status === "error") {
              status = "error";
              finalResult = data.error || data.message || "Unknown error";
            } else if (data.result) {
              // Direct result
              status = "success";
              finalResult = typeof data.result === "string"
                ? data.result
                : JSON.stringify(data.result, null, 2);
            }
          } catch {
            // Non-JSON line, might be progress
            if (line.slice(6).trim()) {
              progress.push(line.slice(6).trim());
            }
          }
        }
      }
    }

    // If we got here without explicit status, check if we have results
    if (status === "running" && finalResult) {
      status = "success";
    }

    return {
      status,
      result: finalResult,
      progress,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export function formatMinoResult(result: MinoResult, url: string, goal: string): string {
  if (result.status === "error") {
    return `❌ Mino Error: ${result.error}`;
  }

  let output = `✅ Done!\n\n`;
  output += `🎯 Goal: ${goal}\n`;
  output += `🌐 Site: ${url}\n\n`;

  if (result.result) {
    // Try to parse and format JSON results nicely
    try {
      const parsed = JSON.parse(result.result);
      if (parsed.result && Array.isArray(parsed.result)) {
        output += `📋 Results:\n`;
        parsed.result.forEach((item: any, i: number) => {
          output += `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}\n`;
        });
      } else {
        output += `📋 Result:\n${result.result}`;
      }
    } catch {
      output += `📋 Result:\n${result.result}`;
    }
  }

  return output;
}
