const execution = require("../services/execution");

const runCode = async (req, res) => {
  const { language, code, stdin } = req.body;
  try {
    const result = await execution.run({ language, code, stdin });
    res.json(result);
  } catch (error) {
    if (error instanceof execution.ValidationError) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(`[runCode] ${execution.provider()} execution failed:`,
      error.response ? JSON.stringify(error.response.data) : error.message);
    const status = error.code === "ECONNABORTED" ? 504 : 502;
    res.status(status).json({ message: "Error executing code. Please try again." });
  }
};

module.exports = { runCode };
