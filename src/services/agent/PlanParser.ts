import type { AgentPlan } from "../../types/agent";

export class PlanParser {
  parse(input: string): AgentPlan {
    const parsed = tryParseJson(input);
    if (parsed && Array.isArray(parsed.steps)) {
      return {
        steps: parsed.steps.map((step) => String(step)),
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined
      };
    }

    const steps = input
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*[-*\d.]+\s*/, "").trim())
      .filter(Boolean);

    return {
      steps: steps.length ? steps : ["Inspect relevant files", "Prepare changes", "Stage diffs"],
      rationale: "Recovered plan from non-JSON model output."
    };
  }
}

function tryParseJson(input: string): { steps?: string[]; rationale?: string } | undefined {
  const match = input.match(/\{[\s\S]*\}/);
  if (!match) {
    return undefined;
  }
  try {
    return JSON.parse(match[0]) as { steps?: string[]; rationale?: string };
  } catch {
    return undefined;
  }
}
