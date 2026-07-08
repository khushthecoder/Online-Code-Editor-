const { stripCodeFence, extractJson } = require("../aiService");
const { buildCompletionPrompt, buildErrorExplainPrompt } = require("../prompts");

describe("ai/aiService helpers", () => {
  test("stripCodeFence unwraps a fenced block", () => {
    expect(stripCodeFence("```python\nprint(1)\n```")).toBe("print(1)");
  });

  test("stripCodeFence leaves plain code untouched", () => {
    expect(stripCodeFence("print(1)")).toBe("print(1)");
  });

  test("extractJson parses a clean object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  test("extractJson recovers JSON wrapped in prose/fences", () => {
    const raw = "Here you go:\n```json\n{\"diagnosis\":\"x\",\"correctedCode\":\"y\"}\n```";
    expect(extractJson(raw)).toMatchObject({ diagnosis: "x", correctedCode: "y" });
  });

  test("extractJson throws on non-JSON", () => {
    expect(() => extractJson("not json at all")).toThrow();
  });
});

describe("ai/prompts", () => {
  test("completion prompt embeds language, code and instruction", () => {
    const p = buildCompletionPrompt({ prompt: "add types", code: "def f(): pass", language: "python", contextInstruction: "TASK: REPLACE" });
    expect(p).toMatch(/python/);
    expect(p).toMatch(/def f\(\): pass/);
    expect(p).toMatch(/TASK: REPLACE/);
  });

  test("error-explain prompt asks for strict JSON with correctedCode", () => {
    const p = buildErrorExplainPrompt({ code: "x", language: "python", error: "IndexError" });
    expect(p).toMatch(/IndexError/);
    expect(p).toMatch(/correctedCode/);
    expect(p).toMatch(/JSON/);
  });
});
