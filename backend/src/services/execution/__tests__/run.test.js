const execution = require("../index");

describe("execution.run — validation & non-executable (no network)", () => {
  test("missing language → ValidationError(400)", async () => {
    await expect(execution.run({ code: "print(1)" })).rejects.toMatchObject({ status: 400 });
  });

  test("empty code → ValidationError(400)", async () => {
    await expect(execution.run({ language: "python", code: "" })).rejects.toMatchObject({ status: 400 });
  });

  test("unsupported language → ValidationError(400)", async () => {
    await expect(execution.run({ language: "ruby", code: "puts 1" })).rejects.toMatchObject({ status: 400 });
  });

  test("html is returned as non-executable without calling a provider", async () => {
    const out = await execution.run({ language: "html", code: "<h1>x</h1>" });
    expect(out.ran).toBe(false);
    expect(out.output).toMatch(/HTML cannot be executed/);
  });
});
