-- CreateTable
CREATE TABLE "MallStoreOnCategory" (
    "mallStoreId" TEXT NOT NULL,
    "storeCategoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MallStoreOnCategory_pkey" PRIMARY KEY ("mallStoreId","storeCategoryId")
);

-- CreateIndex
CREATE INDEX "MallStoreOnCategory_storeCategoryId_idx" ON "MallStoreOnCategory"("storeCategoryId");

-- AddForeignKey
ALTER TABLE "MallStoreOnCategory" ADD CONSTRAINT "MallStoreOnCategory_mallStoreId_fkey" FOREIGN KEY ("mallStoreId") REFERENCES "MallStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallStoreOnCategory" ADD CONSTRAINT "MallStoreOnCategory_storeCategoryId_fkey" FOREIGN KEY ("storeCategoryId") REFERENCES "StoreCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
