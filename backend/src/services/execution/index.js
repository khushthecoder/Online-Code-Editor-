const judge0 = require("./judge0");
const piston = require("./piston");
const { NON_EXECUTABLE, resolveLanguage } = require("./languages");

const provider = () =>
  process.env.EXEC_PROVIDER ||
  (process.env.RAPIDAPI_KEY || process.env.PISTON_API_KEY ? "judge0" : "piston");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

// Run source code through the configured provider. Returns { ran, output, error }.
// Throws ValidationError (400) on bad input; network/provider errors bubble up.
async function run({ language, code, stdin }) {
  if (!language || typeof language !== "string") {
    throw new ValidationError("Language is required");
  }
  if (typeof code !== "string" || code.length === 0) {
    throw new ValidationError("Code is required");
  }

  const key = language.toLowerCase();
  if (NON_EXECUTABLE.has(key)) {
    return { ran: false, output: `${key.toUpperCase()} cannot be executed on the server.`, error: "" };
  }

  const target = resolveLanguage(language);
  if (!target) throw new ValidationError(`Unsupported language: ${language}`);

  return provider() === "judge0"
    ? judge0.execute({ langId: target.judge0, code, stdin })
    : piston.execute({ piston: target.piston, code, stdin });
}

module.exports = { run, provider, ValidationError };
