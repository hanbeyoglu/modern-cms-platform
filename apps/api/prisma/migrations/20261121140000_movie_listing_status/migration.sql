CREATE TYPE "MovieListingStatus" AS ENUM ('NOW_PLAYING', 'UPCOMING', 'OTHER');
ALTER TABLE "Movie" ADD COLUMN "listingStatus" "MovieListingStatus" NOT NULL DEFAULT 'OTHER';
