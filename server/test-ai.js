const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env" });

async function verifyModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ No API key found!");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = "gemini-flash-latest";

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        console.log(`Testing model: ${modelName}...`);
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        console.log(`✅ Model '${modelName}' works! Response:`, response.text());
    } catch (error) {
        console.error(`❌ Model '${modelName}' failed:`, error.message);
    }
}

verifyModel();
