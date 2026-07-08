const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai/index.js");

const AI_TIMEOUT_MS = 20000;

const GEMINI_MODELS = [
  "gemini-2.0-flash-lite-preview-02-05",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

// Reject if a provider call hangs, so a slow upstream can't tie up the request.
const withTimeout = (promise, ms = AI_TIMEOUT_MS) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI request timed out")), ms),
    ),
  ]);

const geminiKeys = () =>
  [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter(Boolean);

// Single entry point for text generation with automatic failover:
// Gemini keys (model cascade) → OpenAI. Throws AiUnavailableError if all fail.
// (Structured so another provider can be slotted in as the primary.)
async function generate(prompt) {
  const keys = geminiKeys();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (keys.length === 0 && !openaiKey) {
    const err = new Error("No AI provider configured");
    err.code = "NO_PROVIDER";
    throw err;
  }

  const errorLog = [];

  for (let i = 0; i < keys.length; i++) {
    for (const modelName of GEMINI_MODELS) {
      try {
        const genAI = new GoogleGenerativeAI(keys[i]);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await withTimeout(model.generateContent(prompt));
        return (await result.response).text();
      } catch (error) {
        errorLog.push(`gemini#${i + 1}/${modelName}: ${error.message}`);
      }
    }
  }

  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey, timeout: AI_TIMEOUT_MS });
      const completion = await withTimeout(
        openai.chat.completions.create({
          messages: [{ role: "system", content: prompt }],
          model: "gpt-4o",
        }),
      );
      return completion.choices[0].message.content;
    } catch (error) {
      errorLog.push(`openai: ${error.message}`);
    }
  }

  console.error("All AI providers failed:", errorLog.join(" | "));
  const err = new Error("All AI providers failed");
  err.code = "AI_UNAVAILABLE";
  throw err;
}

module.exports = { generate, AI_TIMEOUT_MS };
