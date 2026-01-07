/**
 * Mino-powered scraper for regulatory websites
 * Handles delta detection and document extraction
 */

import crypto from "crypto";
import { upsertDocument, markRemovedDocuments, logScrape, getSources, type Source, type ScrapedDocument } from "./db";
import { KEYWORDS, EXCLUSIONS, SCRAPE_INSTRUCTIONS } from "../config/renewable-fuels";
import { mapDocumentToTopics, saveDocumentTopics } from "./topic-mapper";

const MINO_API_URL = "https://mino.ai/v1/automation/run-sse";

// Per-source timeout configuration (in ms) - based on observed performance
const SOURCE_TIMEOUTS: Record<string, number> = {
  iscc: 600000,              // 10 min
  "eu-lex-red": 300000,      // 5 min - targeted search
  "eu-lex-biofuels": 300000, // 5 min - targeted search
  "eu-lex-sustainability": 300000, // 5 min - targeted search
  sweden: 600000,            // 10 min
  germany: 600000,           // 10 min
  norway: 600000,            // 10 min
  netherlands: 600000,       // 10 min
  uk: 600000,                // 10 min
};

// Better source URLs - more targeted landing pages
export const OPTIMIZED_SOURCE_URLS: Record<string, { url: string; instructions: string }> = {
  iscc: {
    url: "https://www.iscc-system.org/certification/iscc-documents/",
    instructions: `Find the latest ISCC system updates, circular economy documents, and guidance.
Look for:
- System document updates (numbered docs like 201, 202, 203)
- Circular economy guidance
- Changes to certification requirements
- New guidance documents

For each document return:
{
  "title": "Document title",
  "url": "Direct link to document",
  "date": "Date if shown (ISO format)",
  "summary": "Brief description",
  "type": "guidance"
}

Return as JSON array. Focus on documents from the last 90 days.`,
  },
  "eu-lex-red": {
    url: "https://eur-lex.europa.eu/search.html?type=advanced&qid=1704637200000&SUBDOM_INIT=ALL_ALL&DTS_SUBDOM=ALL_ALL&DTS_DOM=ALL&lang=en&text=renewable+energy+directive+RED",
    instructions: `Find EU Renewable Energy Directive (RED) documents.
Look for:
- RED III (Directive 2023/2413) and amendments
- RED II updates and implementation
- Delegated regulations under RED

For each document return:
{
  "title": "Document title",
  "url": "Direct EUR-Lex link (celex URL)",
  "date": "Publication date (YYYY-MM-DD)",
  "summary": "Brief description",
  "type": "directive"
}

Return as JSON array. Focus on 2024-2025 documents. Maximum 10 results.`,
  },
  "eu-lex-biofuels": {
    url: "https://eur-lex.europa.eu/search.html?type=advanced&qid=1704637200001&SUBDOM_INIT=ALL_ALL&DTS_SUBDOM=ALL_ALL&DTS_DOM=ALL&lang=en&text=biofuels+transport+renewable",
    instructions: `Find EU legislation on biofuels and renewable transport fuels.
Look for:
- Biofuel sustainability requirements
- Transport fuel mandates
- Aviation fuel (SAF) regulations
- Renewable fuel certificates

For each document return:
{
  "title": "Document title",
  "url": "Direct EUR-Lex link (celex URL)",
  "date": "Publication date (YYYY-MM-DD)",
  "summary": "Brief description",
  "type": "regulation"
}

Return as JSON array. Focus on 2024-2025 documents. Maximum 10 results.`,
  },
  "eu-lex-sustainability": {
    url: "https://eur-lex.europa.eu/search.html?type=advanced&qid=1704637200002&SUBDOM_INIT=ALL_ALL&DTS_SUBDOM=ALL_ALL&DTS_DOM=ALL&lang=en&text=sustainability+criteria+greenhouse+gas",
    instructions: `Find EU sustainability criteria and GHG requirements.
Look for:
- Sustainability certification requirements
- GHG calculation methodologies
- Land use criteria (ILUC)
- Delegated acts on sustainability

For each document return:
{
  "title": "Document title",
  "url": "Direct EUR-Lex link (celex URL)",
  "date": "Publication date (YYYY-MM-DD)",
  "summary": "Brief description",
  "type": "delegated_act"
}

Return as JSON array. Focus on 2024-2025 documents. Maximum 10 results.`,
  },
  sweden: {
    url: "https://www.energimyndigheten.se/fornybart/hallbarhetskriterier/",
    instructions: `Find Swedish regulations on sustainability criteria for biofuels.
Look for:
- Hållbarhetskriterier (sustainability criteria)
- Biodrivmedel regulations
- Implementation of EU RED
- Reporting requirements

For each document return:
{
  "title": "Document title",
  "url": "Direct link",
  "date": "Date if available",
  "summary": "What the document covers",
  "type": "regulation"
}

Return as JSON array.`,
  },
  germany: {
    url: "https://www.bmuv.de/themen/luft-laerm-mobilitaet/verkehr",
    instructions: `Find German regulations on renewable fuels and transport decarbonisation.
Look for:
- Biokraftstoff regulations
- THG-Quote (GHG quota)
- RED III implementation
- Sustainability requirements

For each document return:
{
  "title": "Document title",
  "url": "Direct link",
  "date": "Date if available",
  "summary": "What the document covers",
  "type": "regulation"
}

Return as JSON array.`,
  },
  norway: {
    url: "https://www.miljodirektoratet.no/fagomrader/klima/",
    instructions: `Find Norwegian regulations on biofuels and renewable energy.
Look for:
- Biodrivstoff regulations
- Sustainability criteria
- Climate reporting requirements

For each document return:
{
  "title": "Document title",
  "url": "Direct link",
  "date": "Date if available",
  "summary": "What the document covers",
  "type": "regulation"
}

Return as JSON array.`,
  },
  netherlands: {
    url: "https://www.emissieautoriteit.nl/onderwerpen/rapportage-energie-voor-vervoer",
    instructions: `Find Dutch regulations on transport fuel sustainability.
Look for:
- Energie voor vervoer (Energy for transport)
- Hernieuwbare energie (Renewable energy)
- Biobrandstoffen regulations
- NEa reporting requirements

For each document return:
{
  "title": "Document title",
  "url": "Direct link",
  "date": "Date if available",
  "summary": "What the document covers",
  "type": "regulation"
}

Return as JSON array.`,
  },
  uk: {
    url: "https://www.gov.uk/government/collections/renewable-transport-fuel-obligation-rtfo-guidance",
    instructions: `Find UK regulations on renewable transport fuels.
Look for:
- RTFO (Renewable Transport Fuel Obligation) updates
- SAF mandate guidance
- Sustainability reporting requirements
- Development fuel certificates

For each document return:
{
  "title": "Document title",
  "url": "Direct link",
  "date": "Date if available",
  "summary": "What the document covers",
  "type": "regulation"
}

Return as JSON array.`,
  },
};

interface MinoResult {
  status: "success" | "error" | "running";
  result?: string;
  error?: string;
}

interface ExtractedDocument {
  title: string;
  url: string;
  date?: string;
  summary?: string;
  type?: string;
}

interface ScrapeResult {
  source: Source;
  documents: ScrapedDocument[];
  deltas: {
    new: ScrapedDocument[];
    changed: ScrapedDocument[];
    removed: number;
  };
  duration: number;
  error?: string;
}

// Run Mino extraction on a URL
async function runMinoExtract(
  apiKey: string,
  url: string,
  instructions: string,
  timeoutMs: number = 300000 // 5 minutes timeout for complex regulatory sites
): Promise<MinoResult> {
  console.log(`[Scraper] Extracting from ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(MINO_API_URL, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, goal: instructions }),
    });

    if (!response.ok) {
      return { status: "error", error: `HTTP ${response.status}` };
    }

    // Handle SSE streaming
    const reader = response.body?.getReader();
    if (!reader) return { status: "error", error: "No response body" };

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = "";
    let status: MinoResult["status"] = "running";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const rawData = line.slice(6).trim();
          if (!rawData || rawData === "[DONE]") continue;

          try {
            const data = JSON.parse(rawData);
            const eventType = (data.type || "").toUpperCase();

            if (eventType === "COMPLETE" || eventType === "DONE" || data.resultJson || data.result) {
              status = "success";
              const resultData = data.resultJson || data.result || data.output;
              finalResult = typeof resultData === "string" ? resultData : JSON.stringify(resultData);
            } else if (eventType === "ERROR" || data.status === "error") {
              status = "error";
              finalResult = data.error || data.message || "Unknown error";
            }
          } catch {
            // Non-JSON, skip
          }
        }
      }
    }

    if (status === "running" && finalResult) status = "success";
    return { status, result: finalResult };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "error", error: "Timeout" };
    }
    return { status: "error", error: error instanceof Error ? error.message : "Unknown error" };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Parse Mino result into documents
function parseMinoResult(result: string, sourceId: string): ScrapedDocument[] {
  const documents: ScrapedDocument[] = [];

  try {
    let jsonStr = result;

    // First try: if it's already JSON with a "result" field, extract that
    try {
      const outer = JSON.parse(result);
      if (outer.result && typeof outer.result === "string") {
        jsonStr = outer.result;
      }
    } catch {
      // Not outer JSON, continue
    }

    // Extract JSON from markdown code blocks if present
    const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    } else {
      // Try to find JSON array directly in the text
      const arrayMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }

    // Try to parse as JSON array
    let parsed = JSON.parse(jsonStr);

    // Handle nested structure
    if (parsed.result) parsed = parsed.result;
    if (!Array.isArray(parsed)) parsed = [parsed];

    for (const item of parsed as ExtractedDocument[]) {
      if (!item.title || !item.url) continue;

      // Check exclusions
      const text = `${item.title} ${item.summary || ""}`.toLowerCase();
      const excluded = EXCLUSIONS.some((ex) => text.includes(ex.toLowerCase()));
      if (excluded) continue;

      const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
      const contentHash = crypto
        .createHash("sha256")
        .update(item.title + (item.summary || ""))
        .digest("hex")
        .slice(0, 16);

      documents.push({
        id,
        source_id: sourceId,
        url: item.url,
        title: item.title,
        summary: item.summary,
        doc_type: item.type,
        content_hash: contentHash,
        metadata: { date: item.date },
      });
    }
  } catch (error) {
    console.error(`[Scraper] Failed to parse result:`, error);
  }

  return documents;
}

// Scrape a single source
export async function scrapeSource(source: Source): Promise<ScrapeResult> {
  const start = Date.now();
  const minoKey = process.env.MINO_API_KEY;

  if (!minoKey) {
    return {
      source,
      documents: [],
      deltas: { new: [], changed: [], removed: 0 },
      duration: 0,
      error: "MINO_API_KEY not configured",
    };
  }

  const deltas: ScrapeResult["deltas"] = { new: [], changed: [], removed: 0 };

  // Use optimized URL and instructions if available, otherwise fall back to defaults
  const optimized = OPTIMIZED_SOURCE_URLS[source.id];
  const targetUrl = optimized?.url || source.url;
  const instructions = optimized?.instructions || SCRAPE_INSTRUCTIONS.replace(
    "Keywords to look for:",
    `Keywords to look for: ${KEYWORDS.slice(0, 15).join(", ")}`
  );

  // Use per-source timeout
  const timeout = SOURCE_TIMEOUTS[source.id] || 300000;

  console.log(`[Scraper] Scraping ${source.id} from ${targetUrl} (timeout: ${timeout / 1000}s)`);

  const minoResult = await runMinoExtract(minoKey, targetUrl, instructions, timeout);

  if (minoResult.status !== "success" || !minoResult.result) {
    const duration = Date.now() - start;
    logScrape(source.id, 0, 0, 0, 0, duration, "error", minoResult.error);
    return {
      source,
      documents: [],
      deltas: { new: [], changed: [], removed: 0 },
      duration,
      error: minoResult.error,
    };
  }

  const documents = parseMinoResult(minoResult.result, source.id);

  // Process each document
  for (const doc of documents) {
    const delta = upsertDocument(doc);

    if (delta.type === "new") {
      deltas.new.push(doc);
    } else if (delta.type === "changed") {
      deltas.changed.push(doc);
    }

    // Cross-reference to topics
    const topics = mapDocumentToTopics(doc);
    saveDocumentTopics(doc.id, topics);
  }

  // Mark removed documents
  const removedCount = markRemovedDocuments(
    source.id,
    documents.map((d) => d.url)
  );
  deltas.removed = removedCount;

  const duration = Date.now() - start;
  logScrape(source.id, documents.length, deltas.new.length, deltas.changed.length, removedCount, duration, "success");

  console.log(`[Scraper] ${source.id}: ${documents.length} docs, ${deltas.new.length} new, ${deltas.changed.length} changed`);

  return { source, documents, deltas, duration };
}

// Run daily scrape across all sources
export async function runDailyScrape(): Promise<{
  results: ScrapeResult[];
  summary: {
    totalDocs: number;
    totalNew: number;
    totalChanged: number;
    totalRemoved: number;
    errors: string[];
  };
}> {
  console.log("[Scraper] Starting daily scrape...");
  const sources = getSources();
  const results: ScrapeResult[] = [];
  const errors: string[] = [];

  let totalDocs = 0;
  let totalNew = 0;
  let totalChanged = 0;
  let totalRemoved = 0;

  for (const source of sources) {
    try {
      const result = await scrapeSource(source);
      results.push(result);

      totalDocs += result.documents.length;
      totalNew += result.deltas.new.length;
      totalChanged += result.deltas.changed.length;
      totalRemoved += result.deltas.removed;

      if (result.error) {
        errors.push(`${source.id}: ${result.error}`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`${source.id}: ${errMsg}`);
      logScrape(source.id, 0, 0, 0, 0, 0, "error", errMsg);
    }

    // Small delay between sources to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`[Scraper] Complete: ${totalDocs} docs, ${totalNew} new, ${totalChanged} changed, ${totalRemoved} removed`);

  return {
    results,
    summary: { totalDocs, totalNew, totalChanged, totalRemoved, errors },
  };
}
