-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT,
    "author" TEXT,
    "state" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Snapshot_roomId_createdAt_idx" ON "Snapshot"("roomId", "createdAt");
