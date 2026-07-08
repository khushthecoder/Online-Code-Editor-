const axios = require("axios");

const HTTP_TIMEOUT = 20000;

const rapidKey = () => process.env.RAPIDAPI_KEY || process.env.PISTON_API_KEY;
const rapidHost = () => process.env.PISTON_API_HOST;
const useRapid = () => Boolean(rapidHost() && rapidKey());

const url = () =>
  process.env.PISTON_API_URL ||
  (useRapid()
    ? `https://${rapidHost()}/api/v2/execute`
    : "https://emkc.org/api/v2/piston/execute");

function normalizePiston(data) {
  const result = data.run || data.compile;
  if (!result) throw new Error(data.message || "Unknown Piston API error");
  return {
    ran: result.signal !== "SIGKILL" && result.signal !== "SIGSEGV",
    output: result.stdout !== undefined ? result.stdout : result.output,
    error: result.stderr || "",
  };
}

async function execute({ piston, code, stdin }) {
  const headers = { "Content-Type": "application/json" };
  if (useRapid()) {
    headers["X-RapidAPI-Key"] = rapidKey();
    headers["X-RapidAPI-Host"] = rapidHost();
  }
  const { data } = await axios.post(
    url(),
    {
      language: piston.language,
      version: piston.version,
      files: [{ name: piston.file, content: code }],
      stdin: stdin || "",
      args: [],
      run_timeout: 10000,
      compile_timeout: 10000,
    },
    { headers, timeout: HTTP_TIMEOUT },
  );
  return normalizePiston(data);
}

module.exports = { execute, normalizePiston };
