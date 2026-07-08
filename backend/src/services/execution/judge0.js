const axios = require("axios");

const HTTP_TIMEOUT = 20000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const host = () => process.env.JUDGE0_API_HOST || "judge0-ce.p.rapidapi.com";
const key = () => process.env.RAPIDAPI_KEY || process.env.PISTON_API_KEY;

// Convert a raw Judge0 submission result into our normalized shape.
// Exported for unit testing (pure function, no network).
function normalizeJudge0(data) {
  const statusId = data.status && data.status.id;
  const stdout = data.stdout || "";
  const stderr = data.stderr || "";
  const compile = data.compile_output || "";

  if (statusId === 6) {
    return { ran: false, output: "", error: compile || "Compilation error" };
  }
  const error =
    stderr ||
    compile ||
    (statusId && statusId >= 7 ? data.message || (data.status && data.status.description) || "" : "");
  return { ran: statusId === 3, output: stdout, error };
}

async function execute({ langId, code, stdin }) {
  const base = `https://${host()}`;
  const headers = {
    "content-type": "application/json",
    "X-RapidAPI-Key": key(),
    "X-RapidAPI-Host": host(),
  };
  const fields = "stdout,stderr,compile_output,message,status";

  const submit = await axios.post(
    `${base}/submissions?base64_encoded=false&wait=true&fields=${fields}`,
    { source_code: code, language_id: langId, stdin: stdin || "" },
    { headers, timeout: HTTP_TIMEOUT },
  );

  let data = submit.data;

  // Fallback: some plans ignore wait=true and return only a token — poll for it.
  if (!data.status && data.token) {
    for (let i = 0; i < 10; i++) {
      await sleep(700);
      const poll = await axios.get(
        `${base}/submissions/${data.token}?base64_encoded=false&fields=${fields}`,
        { headers, timeout: HTTP_TIMEOUT },
      );
      data = poll.data;
      if (data.status && data.status.id >= 3) break;
    }
  }

  return normalizeJudge0(data);
}

module.exports = { execute, normalizeJudge0 };
