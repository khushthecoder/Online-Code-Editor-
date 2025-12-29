const axios = require("axios");
const PISTON_API_URL = "https://emkc.org/api/v2/piston/execute";

const runCode = async (req, res) => {
  const { language, code, stdin } = req.body;
  let apiLanguage = language;
  let version = "*";

  switch (language.toLowerCase()) {
    case "python":
    case "python3":
      apiLanguage = "python";
      version = "3.10.0";
      break;
    case "javascript":
    case "js":
    case "node":
      apiLanguage = "javascript";
      version = "18.15.0";
      break;
    case "java":
      apiLanguage = "java";
      version = "15.0.2";
      break;
    case "c++":
    case "cpp":
      apiLanguage = "c++";
      version = "10.2.0";
      break;
    case "html":
      return res.json({
        ran: false,
        output: "HTML cannot be executed on the server.",
      });
    case "css":
      return res.json({
        ran: false,
        output: "CSS cannot be executed on the server.",
      });
  }

  if (!apiLanguage || !code) {
    return res.status(400).json({ message: "Language and code are required" });
  }

  let fileName = "main";
  switch (apiLanguage) {
    case "python":
      fileName = "main.py";
      break;
    case "javascript":
      fileName = "main.js";
      break;
    case "java":
      fileName = "Main.java";
      break;
    case "c++":
      fileName = "main.cpp";
      break;
    default:
      fileName = "main.txt";
  }

  try {
    console.log(`Executing ${apiLanguage} code via Piston API...`);
    const response = await axios.post(PISTON_API_URL, {
      language: apiLanguage,
      version: version,
      files: [
        {
          name: fileName,
          content: code,
        },
      ],
      stdin: stdin || "",
      args: [],
      run_timeout: 10000,
      compile_timeout: 10000,
    });

    console.log("Piston API Response:", JSON.stringify(response.data, null, 2)); 
    const result = response.data.run || response.data.compile;

    if (!result) {
      throw new Error(response.data.message || "Unknown Piston API error");
    }

    res.json({
      ran: result.signal !== "SIGKILL" && result.signal !== "SIGSEGV",
      output: result.stdout !== undefined ? result.stdout : result.output,
      error: result.stderr || "",
    });
  } catch (error) {
    console.error(
      "[runCode] Error executing code via Piston:",
      error.response ? error.response.data : error.message,
    );
    res.status(500).json({
      message: "Error executing code",
      error:
        error.response?.data?.message ||
        error.message ||
        "Unknown server error",
    });
  }
};

module.exports = {
  runCode,
};
