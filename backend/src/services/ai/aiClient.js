const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai/index.js");

const AI_TIMEOUT_MS = 20000;
const MAX_OUTPUT_TOKENS = 2048; // cap response size (cost + latency guard)

// Groq — free, fast, OpenAI-compatible. Primary provider when GROQ_API_KEY is set.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Gemini fallback — only free-tier-eligible flash models (preview/pro models are
// retired or have no free tier).
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-flash-latest"];

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

// One OpenAI-compatible chat call — used for both Groq and OpenAI (Groq just points
// the OpenAI SDK at its own base URL).
async function chatCompletion({ apiKey, baseURL, model }, prompt) {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}), timeout: AI_TIMEOUT_MS });
  const completion = await withTimeout(
    client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: MAX_OUTPUT_TOKENS,
    }),
  );
  return completion.choices[0].message.content;
}

// Single entry point for text generation with automatic failover:
// Groq (free) → Gemini (model cascade) → OpenAI. Throws if all fail.
async function generate(prompt) {
  const groqKey = process.env.GROQ_API_KEY;
  const keys = geminiKeys();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!groqKey && keys.length === 0 && !openaiKey) {
    const err = new Error("No AI provider configured");
    err.code = "NO_PROVIDER";
    throw err;
  }

  const errorLog = [];

  // 1) Groq — free, fast, primary.
  if (groqKey) {
    try {
      return await chatCompletion({ apiKey: groqKey, baseURL: GROQ_BASE_URL, model: GROQ_MODEL }, prompt);
    } catch (error) {
      errorLog.push(`groq/${GROQ_MODEL}: ${error.message}`);
    }
  }

  // 2) Gemini — fallback across keys/models.
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

  // 3) OpenAI — last-resort fallback (mini model + token cap to bound cost).
  if (openaiKey) {
    try {
      return await chatCompletion({ apiKey: openaiKey, model: "gpt-4o-mini" }, prompt);
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
