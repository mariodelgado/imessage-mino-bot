/**
 * Mino API Client - SSE Streaming with Progress Callbacks
 */

const MINO_API_URL = "https://mino.ai/v1/automation/run-sse";

export interface MinoResult {
  status: "success" | "error" | "running";
  result?: string;
  error?: string;
  progress?: string[];
}

export type ProgressCallback = (message: string) => void;

export async function runMinoAutomation(
  apiKey: string,
  url: string,
  goal: string,
  onProgress?: ProgressCallback
): Promise<MinoResult> {
  const progress: string[] = [];
  let finalResult = "";
  let status: "success" | "error" | "running" = "running";

  try {
    console.log(`🌐 Mino: Starting request to ${url}`);

    const response = await fetch(MINO_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, goal }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Mino HTTP error: ${response.status} - ${errorText}`);
      if (response.status === 401) {
        return { status: "error", error: "Invalid Mino API key" };
      }
      return { status: "error", error: `Mino API error: ${response.status} - ${errorText}` };
    }

    // Handle SSE streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      return { status: "error", error: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let lastProgressUpdate = Date.now();
    const PROGRESS_INTERVAL = 30000; // Send progress every 30 seconds

    console.log(`📡 Mino: Reading SSE stream...`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(`📡 Mino: Stream ended`);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const rawData = line.slice(6).trim();
          if (!rawData || rawData === "[DONE]") continue;

          try {
            const data = JSON.parse(rawData);
            console.log(`📡 Mino SSE event:`, JSON.stringify(data).slice(0, 200));

            // Handle Mino SSE event types (case-insensitive)
            const eventType = (data.type || "").toUpperCase();

            if (eventType === "PROGRESS") {
              const msg = data.purpose || data.message || data.step || "Processing...";
              progress.push(msg);

              // Send periodic progress updates to user
              if (onProgress && Date.now() - lastProgressUpdate > PROGRESS_INTERVAL) {
                onProgress(msg);
                lastProgressUpdate = Date.now();
              }
            } else if (eventType === "COMPLETE" || eventType === "DONE") {
              status = "success";
              // Mino returns resultJson, not result
              const resultData = data.resultJson || data.result || data.output || data.data;
              finalResult = typeof resultData === "string"
                ? resultData
                : JSON.stringify(resultData, null, 2);
              console.log(`✅ Mino: Got result (${finalResult.length} chars)`);
            } else if (eventType === "ERROR" || eventType === "FAILED" || data.status === "error") {
              status = "error";
              finalResult = data.error || data.message || "Unknown error";
              console.log(`❌ Mino: Error - ${finalResult}`);
            } else if (eventType === "STARTED" || eventType === "STREAMING_URL") {
              // Informational events, just log
              console.log(`📡 Mino: ${eventType}`);
            } else if (data.resultJson !== undefined) {
              // Direct resultJson field
              status = "success";
              finalResult = typeof data.resultJson === "string"
                ? data.resultJson
                : JSON.stringify(data.resultJson, null, 2);
              console.log(`✅ Mino: Direct resultJson (${finalResult.length} chars)`);
            } else if (data.result !== undefined) {
              // Direct result field
              status = "success";
              finalResult = typeof data.result === "string"
                ? data.result
                : JSON.stringify(data.result, null, 2);
              console.log(`✅ Mino: Direct result (${finalResult.length} chars)`);
            }
          } catch (parseErr) {
            // Non-JSON line, might be progress text
            console.log(`📡 Mino non-JSON: ${rawData.slice(0, 100)}`);
            if (rawData) {
              progress.push(rawData);
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      console.log(`📡 Mino remaining buffer: ${buffer.slice(0, 200)}`);
    }

    // If stream ended without explicit completion, check for results
    if (status === "running") {
      if (finalResult) {
        status = "success";
      } else if (progress.length > 0) {
        // Maybe the progress contains the result
        const lastProgress = progress[progress.length - 1];
        if (lastProgress && lastProgress.length > 50) {
          finalResult = lastProgress;
          status = "success";
        }
      }
    }

    console.log(`📦 Mino final: status=${status}, result=${finalResult.length} chars, progress=${progress.length} items`);

    return {
      status,
      result: finalResult,
      progress,
    };
  } catch (error) {
    console.error(`❌ Mino exception:`, error);
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
