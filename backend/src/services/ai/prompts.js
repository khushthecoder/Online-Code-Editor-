// Prompt builders — pure functions, unit-testable in isolation.

function buildCompletionPrompt({ prompt, code, language, selection, cursor, contextInstruction }) {
  let instruction = contextInstruction || "";
  if (!instruction) {
    if (selection) {
      instruction = `TASK: REPLACE the following selected code based on the instruction.
SELECTED CODE:
\`\`\`${language}
${selection.text}
\`\`\``;
    } else {
      instruction = `TASK: INSERT code at the cursor position (Line: ${cursor?.line}, Col: ${cursor?.column}).
CONTEXT: The cursor is inside the provided code.`;
    }
  }

  return `You are an expert AI coding assistant (Copilot style).

${instruction}

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
5. The output will be injected directly into the editor.

Generate the code now.`;
}

function buildErrorExplainPrompt({ code, language, error }) {
  return `You are an expert ${language} debugger helping inside a code editor.

The user ran this ${language} code:
\`\`\`${language}
${code}
\`\`\`

It failed with this error / output:
\`\`\`
${error}
\`\`\`

Respond with ONLY a JSON object (no markdown fences, no prose) of this exact shape:
{
  "diagnosis": "one or two plain-English sentences on what went wrong and why",
  "fix": "a short, concrete description of how to fix it",
  "correctedCode": "the FULL corrected ${language} file, ready to replace the editor contents"
}

Rules:
- "correctedCode" must be the complete, runnable file — not a snippet or a diff.
- Keep the user's intent and structure; change only what's needed to fix the error.
- If the code is actually fine, set correctedCode to the original code and explain that in "diagnosis".`;
}

module.exports = { buildCompletionPrompt, buildErrorExplainPrompt };
