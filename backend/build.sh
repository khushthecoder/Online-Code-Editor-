set -e
echo "--- Build script starting ---"
echo "--- Generating Prisma Client ---"
npx prisma generate --schema=./server/prisma/schema.prisma
echo "--- Running Prisma Migrations ---"
npx prisma migrate deploy
echo "--- Build script finished successfully ---"