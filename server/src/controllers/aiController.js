const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");

const getAICompletion = async (req, res) => {
    const { prompt, code, language, selection, cursor, contextInstruction } = req.body;
    
    // Load all available keys
    const geminiKeys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4
    ].filter(Boolean); // Remove undefined/null keys

    const openaiKey = process.env.OPENAI_API_KEY;

    if (geminiKeys.length === 0 && !openaiKey) {
        return res.status(500).json({ error: "No AI API Keys configured" });
    }

    // 1. Construct the prompt
    let finalInstruction = contextInstruction || "";
    if (!finalInstruction) {
        if (selection) {
            finalInstruction = `
            TASK: REPLACE the following selected code based on the instruction.
            SELECTED CODE:
            \`\`\`${language}
            ${selection.text}
            \`\`\`
            `;
        } else {
            finalInstruction = `
            TASK: INSERT code at the cursor position (Line: ${cursor?.line}, Col: ${cursor?.column}).
            CONTEXT: The cursor is inside the provided code.
            `;
        }
    }

    const systemContext = `You are an expert AI coding assistant (Copilot style).
  
    ${finalInstruction}
  
    FULL FILE CONTEXT:
    \`\`\`${language}
    ${code}
    \`\`\`
  
    USER INSTRUCTION: ${prompt}
  
    STRICT INSTRUCTIONS:
    1. Return ONLY the code to be inserted or replaced.
    2. No markdown formatting (unless inside strings).
    3. No explanations.
    4. No comments unless requested.
    5. The output will be injeted directly into the editor.
  
    Generate the code now.`;

    let errorLog = [];
    let lastError = null;

    // Helper: Try a specific Gemini Key with all models
    const tryGeminiKey = async (key, keyIndex) => {
        const geminiModels = [
            "gemini-2.0-flash-lite-preview-02-05",
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest"
        ];

        for (const modelName of geminiModels) {
            try {
                // console.log(`Key ${keyIndex + 1} - Attempting model: ${modelName}`);
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: modelName });
                
                const result = await model.generateContent(systemContext);
                const response = await result.response;
                const text = response.text();
                return text; // Success
            } catch (error) {
                // console.error(`Key ${keyIndex + 1} - Model ${modelName} failed:`, error.message);
                errorLog.push(`Key${keyIndex + 1}(${modelName}): ${error.message}`);
                lastError = error;
                // Continue to next model with THIS key
            }
        }
        throw new Error(`All models failed for Key ${keyIndex + 1}`);
    };

    // 2. Loop through ALL Gemini Keys
    for (let i = 0; i < geminiKeys.length; i++) {
        try {
            console.log(`Using Gemini Key #${i + 1}`);
            const text = await tryGeminiKey(geminiKeys[i], i);
            return res.json({ text }); // Success with this key!
        } catch (error) {
            console.warn(`Gemini Key #${i + 1} exhausted. Switching to next key...`);
        }
    }

    // 3. Fallback to OpenAI (ChatGPT)
    if (openaiKey) {
        try {
            console.log("All Gemini keys failed. Switching to OpenAI (ChatGPT)...");
            const openai = new OpenAI({ apiKey: openaiKey });
            
            const completion = await openai.chat.completions.create({
                messages: [{ role: "system", content: systemContext }],
                model: "gpt-4o",
            });

            const text = completion.choices[0].message.content;
            return res.json({ text }); // OpenAI Success!

        } catch (error) {
            console.error("OpenAI failed:", error.message);
            errorLog.push(`OpenAI: ${error.message}`);
            lastError = error;
        }
    }

    // 4. All Failed
    console.error("All AI services/keys failed.");
    res.status(500).json({
        error: "All AI services failed. Detailed Log: " + errorLog.join(" | ")
    });
};

module.exports = { getAICompletion };
