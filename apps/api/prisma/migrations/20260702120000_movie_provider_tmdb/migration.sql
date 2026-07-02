-- CreateEnum
CREATE TYPE "MovieProviderSource" AS ENUM ('TMDB', 'MANUAL');

-- CreateEnum
CREATE TYPE "MovieSyncLogStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "posterPath" TEXT,
ADD COLUMN     "backdropPath" TEXT,
ADD COLUMN     "provider" "MovieProviderSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "tmdbId" INTEGER,
ADD COLUMN     "tmdbVoteAverage" DOUBLE PRECISION,
ADD COLUMN     "tmdbVoteCount" INTEGER,
ADD COLUMN     "tmdbPopularity" DOUBLE PRECISION,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "imdbId" TEXT,
ADD COLUMN     "homepage" TEXT,
ADD COLUMN     "originalLanguage" TEXT,
ADD COLUMN     "adult" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releaseStatus" TEXT,
ADD COLUMN     "castJson" JSONB,
ADD COLUMN     "directorsJson" JSONB,
ADD COLUMN     "productionCompaniesJson" JSONB,
ADD COLUMN     "productionCountriesJson" JSONB,
ADD COLUMN     "notCurrentlyAvailable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MovieSyncLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "MovieProviderSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "MovieSyncLogStatus" NOT NULL DEFAULT 'RUNNING',
    "newMovies" INTEGER NOT NULL DEFAULT 0,
    "updatedMovies" INTEGER NOT NULL DEFAULT 0,
    "failedMovies" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,

    CONSTRAINT "MovieSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movie_tenantId_tmdbId_key" ON "Movie"("tenantId", "tmdbId");

-- CreateIndex
CREATE INDEX "Movie_tenantId_provider_idx" ON "Movie"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "Movie_tenantId_tmdbId_idx" ON "Movie"("tenantId", "tmdbId");

-- CreateIndex
CREATE INDEX "MovieSyncLog_tenantId_startedAt_idx" ON "MovieSyncLog"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "MovieSyncLog_tenantId_provider_status_idx" ON "MovieSyncLog"("tenantId", "provider", "status");

-- AddForeignKey
ALTER TABLE "MovieSyncLog" ADD CONSTRAINT "MovieSyncLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
