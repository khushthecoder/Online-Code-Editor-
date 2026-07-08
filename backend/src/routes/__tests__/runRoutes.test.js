const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock the execution service so the route test makes no network calls.
jest.mock("../../services/execution", () => {
  const ValidationError = class extends Error {
    constructor(m) { super(m); this.status = 400; }
  };
  return {
    ValidationError,
    provider: () => "judge0",
    run: jest.fn(),
  };
});
const execution = require("../../services/execution");
const runRoutes = require("../runRoutes");

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/run", runRoutes);
  return app;
};

const authHeader = () => {
  const token = jwt.sign({ userId: "u1", username: "aria" }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
};

describe("POST /api/run", () => {
  beforeEach(() => execution.run.mockReset());

  test("401 without a token", async () => {
    const res = await request(buildApp()).post("/api/run").send({ language: "python", code: "print(1)" });
    expect(res.status).toBe(401);
  });

  test("200 with normalized result on success", async () => {
    execution.run.mockResolvedValue({ ran: true, output: "42\n", error: "" });
    const res = await request(buildApp())
      .post("/api/run")
      .set("Authorization", authHeader())
      .send({ language: "python", code: "print(42)" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ran: true, output: "42\n", error: "" });
  });

  test("400 when the service raises a ValidationError", async () => {
    execution.run.mockRejectedValue(new execution.ValidationError("Language is required"));
    const res = await request(buildApp())
      .post("/api/run")
      .set("Authorization", authHeader())
      .send({ code: "print(1)" });
    expect(res.status).toBe(400);
  });

  test("502 on upstream failure, without leaking internals", async () => {
    execution.run.mockRejectedValue(new Error("socket hang up"));
    const res = await request(buildApp())
      .post("/api/run")
      .set("Authorization", authHeader())
      .send({ language: "python", code: "print(1)" });
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toMatch(/socket hang up/);
  });
});
