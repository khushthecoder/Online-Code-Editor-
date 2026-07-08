const { resolveLanguage, NON_EXECUTABLE } = require("../languages");

describe("execution/languages", () => {
  test("resolves python to Judge0 id 71 and a .py file", () => {
    const t = resolveLanguage("python");
    expect(t.judge0).toBe(71);
    expect(t.piston.file).toBe("main.py");
  });

  test("is case-insensitive and handles aliases", () => {
    expect(resolveLanguage("Python").judge0).toBe(71);
    expect(resolveLanguage("JS").judge0).toBe(63);
    expect(resolveLanguage("cpp").judge0).toBe(54);
    expect(resolveLanguage("c++").judge0).toBe(54);
  });

  test("returns undefined for unknown languages", () => {
    expect(resolveLanguage("ruby")).toBeUndefined();
  });

  test("marks html/css as non-executable", () => {
    expect(NON_EXECUTABLE.has("html")).toBe(true);
    expect(NON_EXECUTABLE.has("css")).toBe(true);
    expect(NON_EXECUTABLE.has("python")).toBe(false);
  });
});
