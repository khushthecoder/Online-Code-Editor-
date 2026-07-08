-- CreateTable
CREATE TABLE "CollabDoc" (
    "roomId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollabDoc_pkey" PRIMARY KEY ("roomId")
);
