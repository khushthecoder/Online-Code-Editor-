const { normalizeJudge0 } = require("../judge0");
const { normalizePiston } = require("../piston");

describe("judge0.normalizeJudge0", () => {
  test("accepted run → ran:true with stdout", () => {
    const out = normalizeJudge0({ status: { id: 3 }, stdout: "42\n", stderr: null });
    expect(out).toEqual({ ran: true, output: "42\n", error: "" });
  });

  test("compilation error (status 6) → surfaces compile_output", () => {
    const out = normalizeJudge0({ status: { id: 6 }, compile_output: "expected ';'" });
    expect(out.ran).toBe(false);
    expect(out.error).toMatch(/expected/);
  });

  test("runtime error (status >= 7) → surfaces stderr", () => {
    const out = normalizeJudge0({ status: { id: 11 }, stderr: "ZeroDivisionError" });
    expect(out.ran).toBe(false);
    expect(out.error).toMatch(/ZeroDivisionError/);
  });
});

describe("piston.normalizePiston", () => {
  test("uses run result stdout", () => {
    const out = normalizePiston({ run: { stdout: "hi\n", stderr: "", signal: null } });
    expect(out).toEqual({ ran: true, output: "hi\n", error: "" });
  });

  test("SIGKILL → ran:false", () => {
    const out = normalizePiston({ run: { stdout: "", stderr: "killed", signal: "SIGKILL" } });
    expect(out.ran).toBe(false);
  });

  test("throws when no run/compile block present", () => {
    expect(() => normalizePiston({ message: "bad" })).toThrow(/bad/);
  });
});
