const { PrismaClient } = require("@prisma/client");

// Reuse a single PrismaClient across warm serverless invocations / hot reloads.
// Creating a new client per cold start exhausts the DB connection pool.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
