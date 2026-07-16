import { Agent, Runner, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";

let configured = false;
function ensureSodeomConfigured() {
  if (configured) return;
  const client = new OpenAI({ baseURL: "https://sodeom.com/v1", apiKey: "any" });
  setDefaultOpenAIClient(client);
  setOpenAIAPI("chat_completions");
  configured = true;
}

export const FollowUpDraftSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone: z.enum(["friendly_reminder", "firm_reminder", "final_notice"]),
});

export type FollowUpDraft = z.infer<typeof FollowUpDraftSchema>;

export interface OverdueInvoice {
  invoice_number: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  days_overdue: number;
}

export async function draftFollowUpEmail(invoice: OverdueInvoice): Promise<FollowUpDraft> {
  ensureSodeomConfigured();

  // Tone scales with severity -- friendly at 1-30 days, firm at 31-60,
  // final notice at 60+. This is the judgment call the agent is actually
  // good at: calibrating language to situation, not a rigid template.
  const toneGuidance =
    invoice.days_overdue <= 30
      ? "friendly_reminder: warm and professional, assume they just forgot"
      : invoice.days_overdue <= 60
      ? "firm_reminder: clear and direct, reference the previous reminder"
      : "final_notice: serious and urgent, mention escalation may follow";

  const agent = new Agent({
    name: "Follow-up Email Drafting Agent",
    instructions: `You draft professional payment follow-up emails for unpaid invoices.
Write in a business-appropriate tone matching the situation. Be specific -- use
the real invoice number, amount, and due date. Keep it concise: 3-4 sentences max.
Never be rude or threatening, but be clear about what's needed.
Use tone: ${toneGuidance}`,
    model: "gpt-4o-mini",
    outputType: FollowUpDraftSchema,
  });

  const runner = new Runner({ tracingDisabled: true });
  const input = `Draft a follow-up email for this overdue invoice:
- Invoice: ${invoice.invoice_number}
- Customer: ${invoice.customer_name}
- Amount: $${invoice.amount.toFixed(2)}
- Due date: ${invoice.due_date ?? "not specified"}
- Days overdue: ${invoice.days_overdue}`;

  const result = await runner.run(agent, input);
  return result.finalOutput as FollowUpDraft;
}
