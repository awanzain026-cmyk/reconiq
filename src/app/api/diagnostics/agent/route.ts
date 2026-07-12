import { NextResponse } from "next/server";
import OpenAI from "openai";
import { Agent, Runner, setDefaultOpenAIClient, setOpenAIAPI } from "@openai/agents";

// Visit this route directly in a browser once deployed to confirm the
// Agents SDK can actually reach Sodeom's OpenAI-compatible endpoint.
// This was verified against the SDK's real type definitions locally,
// but the live network call can only be confirmed once deployed
// (sandboxed dev environments may block outbound requests to sodeom.com).
export async function GET() {
  try {
    const client = new OpenAI({
      baseURL: "https://sodeom.com/v1",
      apiKey: "any",
    });

    setDefaultOpenAIClient(client);
    setOpenAIAPI("chat_completions");

    const agent = new Agent({
      name: "Connectivity Test Agent",
      instructions: "Reply with exactly the word CONNECTED and nothing else.",
      model: "gpt-4o-mini",
    });

    const runner = new Runner({ tracingDisabled: true });
    const result = await runner.run(agent, "Are you connected?");

    return NextResponse.json({
      ok: true,
      agent_reply: result.finalOutput,
      diagnosis: result.finalOutput?.includes("CONNECTED")
        ? "SUCCESS -- Agents SDK + Sodeom integration confirmed working."
        : "Response received but unexpected content -- review before building further.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        diagnosis: "Agents SDK could not reach Sodeom. Check the error message above.",
      },
      { status: 500 }
    );
  }
}
