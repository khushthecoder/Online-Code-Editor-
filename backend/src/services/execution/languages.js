// Single source of truth mapping the editor's language id to each provider's
// runtime descriptor. Pure data — easy to test and extend.
const LANGUAGES = {
  python: { piston: { language: "python", version: "3.10.0", file: "main.py" }, judge0: 71 },
  python3: { piston: { language: "python", version: "3.10.0", file: "main.py" }, judge0: 71 },
  javascript: { piston: { language: "javascript", version: "18.15.0", file: "main.js" }, judge0: 63 },
  js: { piston: { language: "javascript", version: "18.15.0", file: "main.js" }, judge0: 63 },
  node: { piston: { language: "javascript", version: "18.15.0", file: "main.js" }, judge0: 63 },
  java: { piston: { language: "java", version: "15.0.2", file: "Main.java" }, judge0: 62 },
  "c++": { piston: { language: "c++", version: "10.2.0", file: "main.cpp" }, judge0: 54 },
  cpp: { piston: { language: "c++", version: "10.2.0", file: "main.cpp" }, judge0: 54 },
};

const NON_EXECUTABLE = new Set(["html", "css"]);

const resolveLanguage = (language) => LANGUAGES[String(language).toLowerCase()];

module.exports = { LANGUAGES, NON_EXECUTABLE, resolveLanguage };
