/**
 * Mino API Client - SSE Streaming with Progress Callbacks
 */

const MINO_API_URL = "https://mino.ai/v1/automation/run-sse";

export interface MinoResult {
  status: "success" | "error" | "running" | "cancelled";
  result?: string;
  error?: string;
  progress?: string[];
}

export type ProgressCallback = (message: string) => void;

// Track active Mino operations per user for cancellation
const activeOperations = new Map<string, AbortController>();

/**
 * Cancel any active Mino operation for a user
 * @returns true if an operation was cancelled
 */
export function cancelMinoOperation(userId: string): boolean {
  const controller = activeOperations.get(userId);
  if (controller) {
    console.log(`🛑 Cancelling Mino operation for ${userId}`);
    controller.abort();
    activeOperations.delete(userId);
    return true;
  }
  return false;
}

/**
 * Check if a user has an active Mino operation
 */
export function hasActiveOperation(userId: string): boolean {
  return activeOperations.has(userId);
}

/**
 * Get count of active operations (for debugging)
 */
export function getActiveOperationCount(): number {
  return activeOperations.size;
}

export async function runMinoAutomation(
  apiKey: string,
  url: string,
  goal: string,
  onProgress?: ProgressCallback,
  userId?: string  // Optional userId to track and allow cancellation
): Promise<MinoResult> {
  const progress: string[] = [];
  let finalResult = "";
  let status: "success" | "error" | "running" | "cancelled" = "running";

  // Create abort controller for this operation
  const abortController = new AbortController();

  // Track this operation if userId provided
  if (userId) {
    // Cancel any existing operation for this user first
    cancelMinoOperation(userId);
    activeOperations.set(userId, abortController);
  }

  try {
    console.log(`🌐 Mino: Starting request to ${url}${userId ? ` (user: ${userId})` : ""}`);

    const response = await fetch(MINO_API_URL, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, goal }),
      signal: abortController.signal,
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
          } catch {
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
    // Check if this was an abort/cancellation
    if (error instanceof Error && error.name === "AbortError") {
      console.log(`🛑 Mino operation cancelled${userId ? ` for ${userId}` : ""}`);
      return {
        status: "cancelled",
        error: "Operation cancelled by user",
        progress,
      };
    }

    console.error(`❌ Mino exception:`, error);
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  } finally {
    // Always clean up the tracking
    if (userId) {
      activeOperations.delete(userId);
    }
  }
}

// ============================================================================
// ORCHESTRATED PARALLEL SEARCHES
// ============================================================================

export interface SearchTask {
  url: string;
  goal: string;
  priority?: number; // Higher = more important
  timeout?: number;  // Custom timeout in ms
}

export interface OrchestratedResult {
  success: boolean;
  results: Array<{
    url: string;
    goal: string;
    result: MinoResult;
    duration: number;
  }>;
  aggregatedAnswer?: string;
  errors: string[];
  totalDuration: number;
}

/**
 * Run multiple Mino searches in parallel and aggregate results
 *
 * Use cases:
 * - Compare prices across multiple sites
 * - Search for availability on multiple platforms
 * - Gather comprehensive info from multiple sources
 */
export async function runParallelSearches(
  apiKey: string,
  tasks: SearchTask[],
  maxConcurrent: number = 3,
  globalTimeout: number = 120000 // 2 minutes
): Promise<OrchestratedResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const results: OrchestratedResult["results"] = [];

  console.log(`🔀 Starting ${tasks.length} parallel Mino searches (max ${maxConcurrent} concurrent)`);

  // Sort by priority (higher first)
  const sortedTasks = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Process in batches
  for (let i = 0; i < sortedTasks.length; i += maxConcurrent) {
    const batch = sortedTasks.slice(i, i + maxConcurrent);

    // Check global timeout
    if (Date.now() - startTime > globalTimeout) {
      console.log(`⏱️ Global timeout reached, stopping parallel searches`);
      errors.push(`Timeout after ${i} tasks`);
      break;
    }

    // Run batch in parallel
    const batchPromises = batch.map(async (task) => {
      const taskStart = Date.now();
      try {
        const result = await Promise.race([
          runMinoAutomation(apiKey, task.url, task.goal),
          new Promise<MinoResult>((_, reject) =>
            setTimeout(() => reject(new Error("Task timeout")), task.timeout || 60000)
          )
        ]);

        return {
          url: task.url,
          goal: task.goal,
          result,
          duration: Date.now() - taskStart,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Task failed for ${task.url}: ${errorMsg}`);
        errors.push(`${task.url}: ${errorMsg}`);
        return {
          url: task.url,
          goal: task.goal,
          result: { status: "error" as const, error: errorMsg },
          duration: Date.now() - taskStart,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`✅ Completed batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(tasks.length / maxConcurrent)}`);
  }

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.result.status === "success").length;

  console.log(`🔀 Parallel search complete: ${successCount}/${results.length} succeeded in ${totalDuration}ms`);

  return {
    success: successCount > 0,
    results,
    errors,
    totalDuration,
  };
}

/**
 * Smart search that determines whether to use single or parallel approach
 * based on the query complexity
 */
export async function smartSearch(
  apiKey: string,
  query: string,
  context?: { recentSites?: string[] }
): Promise<{ singleResult?: MinoResult; parallelResults?: OrchestratedResult; approach: "single" | "parallel" }> {
  // Detect comparison/multi-source queries
  const comparisonPatterns = [
    /compare|vs|versus|difference between/i,
    /best (?:price|deal|option)/i,
    /across (?:all|multiple|different)/i,
    /anywhere|everywhere|all sites/i,
    /cheapest|lowest price/i,
  ];

  const isComparisonQuery = comparisonPatterns.some(p => p.test(query));

  // Detect multi-site queries
  const urlMatches = query.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)/gi);
  const hasMultipleUrls = urlMatches && urlMatches.length > 1;

  if (isComparisonQuery || hasMultipleUrls) {
    console.log(`🔀 Using parallel search for comparison query`);

    // Generate tasks from URLs in query or common sites
    let tasks: SearchTask[] = [];

    if (hasMultipleUrls && urlMatches) {
      tasks = urlMatches.map(url => ({
        url: url.startsWith("http") ? url : `https://${url}`,
        goal: query.replace(url, "").trim() || "Extract relevant information",
      }));
    } else {
      // Use recent sites or common comparison sites
      const sites = context?.recentSites?.slice(0, 3) || [];
      if (sites.length > 0) {
        tasks = sites.map(site => ({
          url: `https://${site}`,
          goal: query,
        }));
      }
    }

    if (tasks.length > 1) {
      const parallelResults = await runParallelSearches(apiKey, tasks);
      return { parallelResults, approach: "parallel" };
    }
  }

  // Default to single search - extract best URL
  const urlMatch = query.match(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+)(?:\/\S*)?/i);
  if (urlMatch) {
    const url = urlMatch[0].startsWith("http") ? urlMatch[0] : `https://${urlMatch[0]}`;
    const goal = query.replace(urlMatch[0], "").trim() || "Extract relevant information";
    const singleResult = await runMinoAutomation(apiKey, url, goal);
    return { singleResult, approach: "single" };
  }

  // No URL found - can't search
  return {
    singleResult: { status: "error", error: "No URL found in query" },
    approach: "single"
  };
}

/**
 * Aggregate results from parallel searches into a unified answer
 */
export function aggregateResults(results: OrchestratedResult): string {
  if (!results.success) {
    return `❌ Search failed: ${results.errors.join(", ")}`;
  }

  const successfulResults = results.results.filter(r => r.result.status === "success" && r.result.result);

  if (successfulResults.length === 0) {
    return "❌ No results found from any source.";
  }

  let output = `📊 **Results from ${successfulResults.length} sources**\n\n`;

  for (const { url, result } of successfulResults) {
    const domain = new URL(url).hostname.replace("www.", "");
    output += `**${domain}**\n`;

    try {
      const data = JSON.parse(result.result || "{}");
      if (Array.isArray(data)) {
        output += data.slice(0, 3).map((item: any) =>
          `  • ${item.name || item.title || JSON.stringify(item).slice(0, 50)}`
        ).join("\n");
      } else if (typeof data === "object") {
        const summary = Object.entries(data).slice(0, 3)
          .map(([k, v]) => `  • ${k}: ${String(v).slice(0, 50)}`)
          .join("\n");
        output += summary;
      } else {
        output += `  ${String(data).slice(0, 100)}`;
      }
    } catch {
      output += `  ${result.result?.slice(0, 100) || "No data"}`;
    }
    output += "\n\n";
  }

  output += `⏱️ Completed in ${(results.totalDuration / 1000).toFixed(1)}s`;

  return output;
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
