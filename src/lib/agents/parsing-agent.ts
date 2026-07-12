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

export const CsvStructureSchema = z.object({
  file_type: z.enum(["bank_statement", "invoices", "unknown"]),
  // Each value is the exact CSV column header name that maps to this
  // schema field, or null if that field isn't present in this file.
  column_mapping: z.object({
    // bank_statement fields
    transaction_date: z.string().nullable(),
    // Some banks split amount into separate debit/credit columns instead
    // of one signed amount -- the agent tells us which pattern this is.
    amount: z.string().nullable(),
    debit_column: z.string().nullable(),
    credit_column: z.string().nullable(),
    description: z.string().nullable(),
    reference: z.string().nullable(),
    // invoices fields
    invoice_number: z.string().nullable(),
    customer_name: z.string().nullable(),
    invoice_amount: z.string().nullable(),
    issue_date: z.string().nullable(),
    due_date: z.string().nullable(),
    paid_status: z.string().nullable(),
  }),
  notes: z.string(),
});

export type CsvStructure = z.infer<typeof CsvStructureSchema>;

export async function detectCsvStructure(headers: string[], sampleRows: string[][]): Promise<CsvStructure> {
  ensureSodeomConfigured();

  const agent = new Agent({
    name: "CSV Structure Detection Agent",
    instructions: `You analyze CSV files from real businesses -- bank statements or invoice exports.
Real bank exports never use clean column names like "amount" -- they use things like
"Narrative", "Trans Date", "Chq/Ref No.", or split amount into separate Debit/Credit columns.
Real invoice exports similarly use varied names like "Inv #", "Bill To", "Total Amount".

Given the column headers and a few sample rows, determine:
1. Whether this is a bank_statement or invoices file
2. Which exact header name (copy it exactly, including capitalization and punctuation)
   maps to each of our schema fields
3. If amount is split into separate debit/credit columns rather than one signed column,
   set debit_column and credit_column instead of amount

Set any field to null if it genuinely isn't present in this file.`,
    model: "gpt-4o-mini",
    outputType: CsvStructureSchema,
  });

  const runner = new Runner({ tracingDisabled: true });
  const input = `Headers: ${JSON.stringify(headers)}\n\nSample rows:\n${sampleRows.map((r) => JSON.stringify(r)).join("\n")}`;
  const result = await runner.run(agent, input);

  return result.finalOutput as CsvStructure;
}
