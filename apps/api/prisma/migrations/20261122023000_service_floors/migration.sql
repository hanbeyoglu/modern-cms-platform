-- CreateTable
CREATE TABLE "_ServiceFloors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ServiceFloors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ServiceFloors_B_index" ON "_ServiceFloors"("B");

-- AddForeignKey
ALTER TABLE "_ServiceFloors" ADD CONSTRAINT "_ServiceFloors_A_fkey" FOREIGN KEY ("A") REFERENCES "MallFloor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ServiceFloors" ADD CONSTRAINT "_ServiceFloors_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve legacy assignments only when one floor matches within the same scope.
INSERT INTO "_ServiceFloors" ("A", "B")
SELECT MIN(f."id"), s."id"
FROM "Service" s
JOIN "MallFloor" f ON f."tenantId" = s."tenantId" AND f."mallId" = s."mallId"
  AND (f."name" = s."floor" OR f."label" = s."floor")
WHERE s."floor" IS NOT NULL
GROUP BY s."id"
HAVING COUNT(*) = 1
ON CONFLICT DO NOTHING;
