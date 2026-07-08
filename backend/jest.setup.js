// Deterministic env for tests — no real DB/provider calls are made in unit tests.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long-xx";
