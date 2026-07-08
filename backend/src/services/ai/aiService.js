const { generate } = require("./aiClient");
const { buildCompletionPrompt, buildErrorExplainPrompt } = require("./prompts");

// Strip a leading ```lang fence and trailing ``` if the model wrapped its reply.
function stripCodeFence(text) {
  const match = text.match(/```(?:[\w+-]*\n)?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

// Best-effort JSON extraction from a model reply (handles stray prose / fences).
function extractJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("AI did not return valid JSON");
  }
}

// Inline generate/replace for the editor. Returns raw code text.
async function complete(params) {
  const raw = await generate(buildCompletionPrompt(params));
  return stripCodeFence(raw);
}

// Explain a runtime/compile error and produce a corrected full file.
async function explainError({ code, language, error }) {
  const raw = await generate(buildErrorExplainPrompt({ code, language, error }));
  const parsed = extractJson(raw);
  return {
    diagnosis: String(parsed.diagnosis || "").trim(),
    fix: String(parsed.fix || "").trim(),
    correctedCode:
      typeof parsed.correctedCode === "string" ? parsed.correctedCode : code,
  };
}

module.exports = { complete, explainError, stripCodeFence, extractJson };
