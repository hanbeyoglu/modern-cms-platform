CREATE TABLE "_MallStoreFloors" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX "_MallStoreFloors_AB_unique" ON "_MallStoreFloors"("A", "B");
CREATE INDEX "_MallStoreFloors_B_index" ON "_MallStoreFloors"("B");
ALTER TABLE "_MallStoreFloors" ADD CONSTRAINT "_MallStoreFloors_A_fkey" FOREIGN KEY ("A") REFERENCES "MallFloor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_MallStoreFloors" ADD CONSTRAINT "_MallStoreFloors_B_fkey" FOREIGN KEY ("B") REFERENCES "MallStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
INSERT INTO "_MallStoreFloors" ("A", "B") SELECT s."floorId", s."id" FROM "MallStore" s JOIN "MallFloor" f ON f."id" = s."floorId" AND f."tenantId" = s."tenantId" AND f."mallId" = s."mallId" ON CONFLICT DO NOTHING;
