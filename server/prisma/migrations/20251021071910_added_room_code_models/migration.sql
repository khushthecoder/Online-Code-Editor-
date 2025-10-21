-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Code" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "html" TEXT DEFAULT '',
    "css" TEXT DEFAULT '',
    "javascript" TEXT DEFAULT '',
    "python" TEXT DEFAULT '',
    "roomId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Code_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_roomId_key" ON "Room"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Code_roomId_key" ON "Code"("roomId");
