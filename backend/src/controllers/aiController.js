const aiService = require("../services/ai/aiService");

function handleAiError(res, error) {
  if (error.code === "NO_PROVIDER") {
    return res.status(500).json({ error: "No AI provider configured" });
  }
  console.error("[ai] failed:", error.message);
  return res
    .status(502)
    .json({ error: "The AI service is temporarily unavailable. Please try again shortly." });
}

// Inline generate/replace used by the editor's AI Copilot.
const getAICompletion = async (req, res) => {
  const { prompt, code, language, selection, cursor, contextInstruction } = req.body;
  if (typeof code !== "string" || !language) {
    return res.status(400).json({ error: "code and language are required" });
  }
  try {
    const text = await aiService.complete({
      prompt,
      code,
      language,
      selection,
      cursor,
      contextInstruction,
    });
    res.json({ text });
  } catch (error) {
    handleAiError(res, error);
  }
};

// Explain a run error and return a corrected full file.
const explainError = async (req, res) => {
  const { code, language, error } = req.body;
  if (typeof code !== "string" || !language || !error) {
    return res.status(400).json({ error: "code, language and error are required" });
  }
  try {
    const result = await aiService.explainError({ code, language, error });
    res.json(result);
  } catch (err) {
    handleAiError(res, err);
  }
};

module.exports = { getAICompletion, explainError };
