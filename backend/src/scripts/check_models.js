require("dotenv").config();
const axios = require("axios");

async function checkModelsViaHttp() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API Key");
        return;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log(`Querying ${url.replace(apiKey, "HIDDEN")}...`);

    try {
        const response = await axios.get(url);
        const models = response.data.models || [];
        console.log(`Found ${models.length} models.`);

        // Filter for generateContent support
        const contentModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));

        console.log("Supported Models for Verification:");
        contentModels.forEach(m => console.log(` - ${m.name}`));

        if (contentModels.length === 0) {
            console.log("No models support generateContent!");
        }
    } catch (error) {
        console.error("HTTP Request Failed:", error.response ? error.response.status : error.message);
        if (error.response && error.response.data) {
            console.error("Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
}

checkModelsViaHttp();
