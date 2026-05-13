-- CreateEnum
CREATE TYPE "CinemaStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MovieStatus" AS ENUM ('ACTIVE', 'PASSIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MovieSessionStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CinemaProviderType" AS ENUM ('MANUAL', 'API', 'XML_FEED');

-- CreateTable
CREATE TABLE "Cinema" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoMediaId" TEXT,
    "description" TEXT,
    "providerType" "CinemaProviderType" NOT NULL DEFAULT 'MANUAL',
    "providerConfigJson" JSONB,
    "status" "CinemaStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cinema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movie" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "originalTitle" TEXT,
    "posterMediaId" TEXT,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "genre" TEXT,
    "rating" TEXT,
    "trailerUrl" TEXT,
    "releaseDate" TIMESTAMP(3),
    "status" "MovieStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mallId" TEXT NOT NULL,
    "cinemaId" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "hallName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "language" TEXT,
    "subtitle" TEXT,
    "format" TEXT,
    "ticketUrl" TEXT,
    "status" "MovieSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MovieSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cinema_tenantId_mallId_idx" ON "Cinema"("tenantId", "mallId");

-- CreateIndex
CREATE INDEX "Cinema_tenantId_status_idx" ON "Cinema"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Cinema_mallId_slug_key" ON "Cinema"("mallId", "slug");

-- CreateIndex
CREATE INDEX "Movie_tenantId_status_idx" ON "Movie"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Movie_tenantId_title_idx" ON "Movie"("tenantId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tenantId_slug_key" ON "Movie"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "MovieSession_tenantId_mallId_startsAt_idx" ON "MovieSession"("tenantId", "mallId", "startsAt");

-- CreateIndex
CREATE INDEX "MovieSession_cinemaId_startsAt_idx" ON "MovieSession"("cinemaId", "startsAt");

-- CreateIndex
CREATE INDEX "MovieSession_movieId_idx" ON "MovieSession"("movieId");

-- CreateIndex
CREATE INDEX "MovieSession_tenantId_status_idx" ON "MovieSession"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "Cinema" ADD CONSTRAINT "Cinema_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cinema" ADD CONSTRAINT "Cinema_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cinema" ADD CONSTRAINT "Cinema_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cinema" ADD CONSTRAINT "Cinema_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cinema" ADD CONSTRAINT "Cinema_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_posterMediaId_fkey" FOREIGN KEY ("posterMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movie" ADD CONSTRAINT "Movie_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_mallId_fkey" FOREIGN KEY ("mallId") REFERENCES "Mall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_cinemaId_fkey" FOREIGN KEY ("cinemaId") REFERENCES "Cinema"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieSession" ADD CONSTRAINT "MovieSession_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
