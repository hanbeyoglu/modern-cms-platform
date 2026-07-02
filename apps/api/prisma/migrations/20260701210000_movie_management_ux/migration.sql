-- Film management UX and data model improvements.

ALTER TABLE "Movie"
ADD COLUMN "publishStartAt" TIMESTAMP(3),
ADD COLUMN "publishEndAt" TIMESTAMP(3),
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Movie"
ADD CONSTRAINT "Movie_publish_window_check"
CHECK ("publishEndAt" IS NULL OR "publishStartAt" IS NULL OR "publishEndAt" >= "publishStartAt");

CREATE TABLE "MovieCategory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MovieCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovieCategoryOnMovie" (
  "movieId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MovieCategoryOnMovie_pkey" PRIMARY KEY ("movieId","categoryId")
);

CREATE UNIQUE INDEX "MovieCategory_tenantId_slug_key" ON "MovieCategory"("tenantId", "slug");
CREATE INDEX "MovieCategory_tenantId_sortOrder_idx" ON "MovieCategory"("tenantId", "sortOrder");
CREATE INDEX "MovieCategoryOnMovie_categoryId_idx" ON "MovieCategoryOnMovie"("categoryId");
CREATE INDEX "Movie_tenantId_sortOrder_idx" ON "Movie"("tenantId", "sortOrder");
CREATE INDEX "Movie_tenantId_publishStartAt_publishEndAt_idx" ON "Movie"("tenantId", "publishStartAt", "publishEndAt");

ALTER TABLE "MovieCategory"
ADD CONSTRAINT "MovieCategory_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovieCategoryOnMovie"
ADD CONSTRAINT "MovieCategoryOnMovie_movieId_fkey"
FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MovieCategoryOnMovie"
ADD CONSTRAINT "MovieCategoryOnMovie_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "MovieCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

WITH defaults(name, slug, sort_order) AS (
  VALUES
    ('Action', 'action', 10),
    ('Adventure', 'adventure', 20),
    ('Animation', 'animation', 30),
    ('Biography', 'biography', 40),
    ('Comedy', 'comedy', 50),
    ('Crime', 'crime', 60),
    ('Documentary', 'documentary', 70),
    ('Drama', 'drama', 80),
    ('Family', 'family', 90),
    ('Fantasy', 'fantasy', 100),
    ('Film Noir', 'film-noir', 110),
    ('History', 'history', 120),
    ('Horror', 'horror', 130),
    ('Music', 'music', 140),
    ('Musical', 'musical', 150),
    ('Mystery', 'mystery', 160),
    ('Romance', 'romance', 170),
    ('Sci-Fi', 'sci-fi', 180),
    ('Short', 'short', 190),
    ('Sport', 'sport', 200),
    ('Superhero', 'superhero', 210),
    ('Thriller', 'thriller', 220),
    ('War', 'war', 230),
    ('Western', 'western', 240),
    ('Psychological', 'psychological', 250),
    ('Suspense', 'suspense', 260),
    ('Disaster', 'disaster', 270),
    ('Epic', 'epic', 280),
    ('Martial Arts', 'martial-arts', 290),
    ('Teen', 'teen', 300),
    ('Christmas', 'christmas', 310),
    ('Zombie', 'zombie', 320),
    ('Monster', 'monster', 330),
    ('Anime', 'anime', 340),
    ('Live Action', 'live-action', 350),
    ('Fantasy Adventure', 'fantasy-adventure', 360),
    ('Dark Comedy', 'dark-comedy', 370),
    ('True Story', 'true-story', 380),
    ('Cyberpunk', 'cyberpunk', 390),
    ('Steampunk', 'steampunk', 400),
    ('Dystopian', 'dystopian', 410),
    ('Post Apocalyptic', 'post-apocalyptic', 420),
    ('Time Travel', 'time-travel', 430),
    ('Space', 'space', 440),
    ('Alien', 'alien', 450),
    ('Magic', 'magic', 460),
    ('Mythology', 'mythology', 470),
    ('Detective', 'detective', 480),
    ('Heist', 'heist', 490),
    ('Spy', 'spy', 500),
    ('Legal', 'legal', 510),
    ('Political', 'political', 520),
    ('Medical', 'medical', 530),
    ('Survival', 'survival', 540),
    ('Road Movie', 'road-movie', 550),
    ('Feel Good', 'feel-good', 560)
)
INSERT INTO "MovieCategory" ("id", "tenantId", "name", "slug", "sortOrder", "updatedAt")
SELECT concat('moviecat_', md5(t."id" || ':' || d.slug)), t."id", d.name, d.slug, d.sort_order, CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN defaults d
ON CONFLICT ("tenantId", "slug") DO NOTHING;

INSERT INTO "MovieCategoryOnMovie" ("movieId", "categoryId")
SELECT m."id", c."id"
FROM "Movie" m
JOIN "MovieCategory" c
  ON c."tenantId" = m."tenantId"
 AND c."slug" = lower(regexp_replace(regexp_replace(trim(m."genre"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
WHERE m."genre" IS NOT NULL
  AND trim(m."genre") <> ''
ON CONFLICT DO NOTHING;
