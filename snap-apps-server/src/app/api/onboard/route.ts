/**
 * Investor Onboarding API
 *
 * Handles the conversational onboarding flow for new investors via iMessage.
 * Manages state machine: name → firm → companies → schedule → complete
 *
 * POST /api/onboard - Process onboarding message
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getInvestorByPhone,
  createInvestor,
  updateInvestor,
  addCompanyToInvestor,
  completeOnboarding,
  ONBOARDING_PROMPTS,
  type PortfolioCompany,
} from "@/lib/investors";

interface OnboardingRequest {
  phone: string;
  message: string;
}

interface OnboardingResponse {
  success: boolean;
  investorId?: string;
  nextPrompt: string;
  onboardingStep?: string;
  isComplete?: boolean;
  dashboardUrl?: string;
  error?: string;
}

// Parse company from natural language
function parseCompany(message: string): Partial<PortfolioCompany> | null {
  const lowerMessage = message.toLowerCase();

  // Extract company name (first quoted or capitalized word)
  const nameMatch = message.match(/(?:invested in|tracking|watching|company called|company named)\s+([A-Z][a-zA-Z0-9]*)/i)
    || message.match(/([A-Z][a-zA-Z0-9]+)/)
    || message.match(/"([^"]+)"/)
    || message.match(/'([^']+)'/);

  if (!nameMatch) return null;

  const company: Partial<PortfolioCompany> = {
    name: nameMatch[1],
    status: "active",
    sector: "General",
  };

  // Extract investment amount
  const amountMatch = message.match(/\$(\d+(?:\.\d+)?)\s*([mMbBkK])?/);
  if (amountMatch) {
    let amount = parseFloat(amountMatch[1]);
    const suffix = amountMatch[2]?.toUpperCase();
    if (suffix === "M") amount *= 1;
    else if (suffix === "B") amount *= 1000;
    else if (suffix === "K") amount /= 1000;
    company.invested = `$${amount}M`;
  }

  // Extract round
  const roundMatch = message.match(/series\s*([a-z])/i)
    || message.match(/(seed|pre-seed|angel)/i)
    || message.match(/(series\s*[a-z])/i);
  if (roundMatch) {
    company.round = roundMatch[1].charAt(0).toUpperCase() === "S"
      ? roundMatch[1]
      : `Series ${roundMatch[1].toUpperCase()}`;
  }

  // Extract sector
  const sectorPatterns: Record<string, RegExp> = {
    "AI/ML": /\b(ai|ml|machine learning|artificial intelligence|LLM|GPT)\b/i,
    "Fintech": /\b(fintech|finance|payments?|banking|crypto|defi)\b/i,
    "DevTools": /\b(devtools?|developer|engineering|infrastructure|cloud)\b/i,
    "Sales Tech": /\b(sales|crm|revenue|enablement)\b/i,
    "Healthcare": /\b(health|medical|biotech|pharma)\b/i,
    "E-commerce": /\b(e-?commerce|retail|marketplace|shopping)\b/i,
    "Enterprise": /\b(enterprise|b2b|saas)\b/i,
  };

  for (const [sector, pattern] of Object.entries(sectorPatterns)) {
    if (pattern.test(lowerMessage)) {
      company.sector = sector;
      break;
    }
  }

  // Extract status
  if (/\b(board|director)\b/i.test(lowerMessage)) {
    company.status = "board";
  } else if (/\b(acquired|exit(ed)?|sold)\b/i.test(lowerMessage)) {
    company.status = "acquired";
  } else if (/\b(ipo|public|listed)\b/i.test(lowerMessage)) {
    company.status = "public";
  }

  return company;
}

// Parse time from natural language
function parseTime(message: string): string | null {
  // Match patterns like "6am", "6:30 AM", "6 AM PST"
  const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const period = timeMatch[3]?.toLowerCase();

  if (period === "pm" && hours < 12) hours += 12;
  if (period === "am" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: OnboardingRequest = await request.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json({
        success: false,
        error: "Missing phone or message",
        nextPrompt: ONBOARDING_PROMPTS.name,
      } as OnboardingResponse, { status: 400 });
    }

    // Check if investor exists
    let investor = getInvestorByPhone(phone);

    // If investor exists and is fully onboarded, return completion message
    if (investor?.isOnboarded) {
      return NextResponse.json({
        success: true,
        investorId: investor.id,
        nextPrompt: `Hey ${investor.firstName}! You're already set up. Your dashboard is at: https://snap-apps-server.vercel.app/investor/${investor.id}`,
        isComplete: true,
        dashboardUrl: `https://snap-apps-server.vercel.app/investor/${investor.id}`,
      } as OnboardingResponse);
    }

    // Create new investor if doesn't exist
    if (!investor) {
      investor = createInvestor({ phone });
    }

    const lowerMessage = message.toLowerCase().trim();
    let response: OnboardingResponse;

    switch (investor.onboardingStep) {
      case "name": {
        // Extract name from message
        const name = message.trim();
        const firstName = name.split(" ")[0];

        updateInvestor(investor.id, {
          name,
          firstName,
          onboardingStep: "firm",
        });

        response = {
          success: true,
          investorId: investor.id,
          nextPrompt: ONBOARDING_PROMPTS.firm(firstName),
          onboardingStep: "firm",
        };
        break;
      }

      case "firm": {
        const firm = message.trim();
        const isIndependent = /independent|personal|myself|my own/i.test(lowerMessage);

        updateInvestor(investor.id, {
          firm: isIndependent ? "Independent" : firm,
          onboardingStep: "companies",
        });

        response = {
          success: true,
          investorId: investor.id,
          nextPrompt: ONBOARDING_PROMPTS.companies(investor.firstName),
          onboardingStep: "companies",
        };
        break;
      }

      case "companies": {
        // Check if done adding companies
        if (/^(done|finished|that'?s\s*(it|all)|no\s*more|complete)$/i.test(lowerMessage)) {
          updateInvestor(investor.id, { onboardingStep: "schedule" });

          response = {
            success: true,
            investorId: investor.id,
            nextPrompt: ONBOARDING_PROMPTS.schedule(investor.firstName),
            onboardingStep: "schedule",
          };
        } else {
          // Try to parse company
          const company = parseCompany(message);

          if (company && company.name) {
            addCompanyToInvestor(investor.id, {
              name: company.name,
              status: company.status || "active",
              sector: company.sector || "General",
              invested: company.invested || "Undisclosed",
              round: company.round,
            });

            response = {
              success: true,
              investorId: investor.id,
              nextPrompt: `Got it - added ${company.name}${company.sector !== "General" ? ` (${company.sector})` : ""}! ${ONBOARDING_PROMPTS.moreCompanies}`,
              onboardingStep: "companies",
            };
          } else {
            response = {
              success: true,
              investorId: investor.id,
              nextPrompt: `I couldn't quite parse that. Try: "I invested in [Company Name] at Series A, they're in [sector]"`,
              onboardingStep: "companies",
            };
          }
        }
        break;
      }

      case "schedule": {
        const time = parseTime(message);

        if (time) {
          updateInvestor(investor.id, {
            preferences: {
              ...investor.preferences,
              briefSchedule: {
                ...investor.preferences.briefSchedule,
                time,
                enabled: true,
              },
            },
          });

          // Complete onboarding
          completeOnboarding(investor.id);

          const dashboardUrl = `https://snap-apps-server.vercel.app/investor/${investor.id}`;

          response = {
            success: true,
            investorId: investor.id,
            nextPrompt: ONBOARDING_PROMPTS.complete(investor.firstName, dashboardUrl),
            onboardingStep: "complete",
            isComplete: true,
            dashboardUrl,
          };
        } else {
          response = {
            success: true,
            investorId: investor.id,
            nextPrompt: `I couldn't parse that time. Try something like "6 AM" or "7:30am Pacific"`,
            onboardingStep: "schedule",
          };
        }
        break;
      }

      default: {
        // Reset to beginning
        updateInvestor(investor.id, { onboardingStep: "name" });
        response = {
          success: true,
          investorId: investor.id,
          nextPrompt: ONBOARDING_PROMPTS.name,
          onboardingStep: "name",
        };
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Onboarding failed",
      nextPrompt: ONBOARDING_PROMPTS.name,
    } as OnboardingResponse, { status: 500 });
  }
}

export const runtime = "nodejs";
