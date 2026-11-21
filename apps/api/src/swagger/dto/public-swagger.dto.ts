import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicEnvelopeTenantDto {
  @ApiProperty({ format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, example: '660e8400-e29b-41d4-a716-446655440001' })
  mallId!: string | null;
}

export class PublicPaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PublicMediaAssetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'https://cdn.example.com/media/hero.jpg' })
  url!: string;

  @ApiPropertyOptional({ example: 'image/jpeg', nullable: true })
  mimeType!: string | null;

  @ApiPropertyOptional({ example: 1920, nullable: true })
  width!: number | null;

  @ApiPropertyOptional({ example: 1080, nullable: true })
  height!: number | null;

  @ApiPropertyOptional({ nullable: true })
  alt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  caption!: string | null;

  @ApiPropertyOptional({ example: '#1a2b3c', nullable: true })
  dominantColor!: string | null;
}

export class PublicEnvelopeDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiPropertyOptional({ example: 'tr', nullable: true })
  locale!: string | null;

  @ApiProperty({ type: PublicEnvelopeTenantDto })
  tenant!: PublicEnvelopeTenantDto;
}

export class PublicPaginatedEnvelopeDto extends PublicEnvelopeDto {
  @ApiProperty({ type: PublicPaginationMetaDto })
  pagination!: PublicPaginationMetaDto;
}

export class PublicSiteConfigDto {
  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'Demo Mall Group' })
  tenantName!: string;

  @ApiProperty({ example: 'demo-mall' })
  tenantSlug!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  mallId!: string | null;

  @ApiPropertyOptional({ example: 'City Center AVM', nullable: true })
  mallName!: string | null;

  @ApiPropertyOptional({ example: 'city-center', nullable: true })
  mallSlug!: string | null;

  @ApiProperty({ example: [{ code: 'tr', name: 'Türkçe', rtl: false }] })
  supportedLocales!: Array<{ code: string; name: string; rtl: boolean }>;

  @ApiProperty({
    example: [{ code: 'tr', default: true }, { code: 'en', default: false }],
    description: 'Active languages for the current location (mall-scoped when x-mall-id is set).',
  })
  languages!: Array<{ code: string; default: boolean }>;

  @ApiPropertyOptional({ example: 'tr', nullable: true })
  defaultLocale!: string | null;

  @ApiPropertyOptional({ example: 'tr', nullable: true })
  activeLocale!: string | null;

  @ApiProperty({ example: false })
  rtl!: boolean;
}

export class PublicCampaignSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'summer-sale' })
  slug!: string;

  @ApiProperty({ example: 'Yaz İndirimi' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  summary!: string | null;

  @ApiPropertyOptional({ type: PublicMediaAssetDto, nullable: true })
  cover!: PublicMediaAssetDto | null;

  @ApiProperty({ example: 'PUBLISHED' })
  status!: string;
}

export class PublicEventSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'live-music-night' })
  slug!: string;

  @ApiProperty({ example: 'Canlı Müzik Gecesi' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  category!: string | null;

  @ApiPropertyOptional({ type: PublicMediaAssetDto, nullable: true })
  cover!: PublicMediaAssetDto | null;
}

export class PublicStoreSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'zara' })
  slug!: string;

  @ApiProperty({ example: 'Zara' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  floor!: string | null;

  @ApiProperty({ example: true })
  featured!: boolean;
}

export class PublicMediaGuidelineDto {
  @ApiProperty({ example: 'campaign.cover' })
  usageKey!: string;

  @ApiProperty({ example: 'Campaign Cover' })
  label!: string;

  @ApiProperty({ example: 1920 })
  recommendedWidth!: number;

  @ApiProperty({ example: 1080 })
  recommendedHeight!: number;

  @ApiProperty({ example: ['image/jpeg', 'image/webp'] })
  acceptedMimeTypes!: string[];

  @ApiPropertyOptional({ nullable: true })
  helperText!: string | null;

  @ApiProperty({ example: true })
  aspectRatioLocked!: boolean;
}

export class PublicSearchHitDto {
  @ApiProperty({ example: 'CAMPAIGN' })
  type!: string;

  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'summer-sale' })
  slug!: string;

  @ApiProperty({ example: 'Yaz İndirimi' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;
}

export class PublicSearchDataDto {
  @ApiProperty({ type: [PublicSearchHitDto] })
  results!: PublicSearchHitDto[];
}

export class PublicSearchEnvelopeDto extends PublicPaginatedEnvelopeDto {
  @ApiProperty({ type: PublicSearchDataDto })
  data!: PublicSearchDataDto;
}

export class PublicSiteConfigEnvelopeDto extends PublicEnvelopeDto {
  @ApiProperty({ type: PublicSiteConfigDto })
  data!: PublicSiteConfigDto;
}

export class PublicMediaGuidelinesEnvelopeDto extends PublicEnvelopeDto {
  @ApiProperty({ type: [PublicMediaGuidelineDto] })
  data!: PublicMediaGuidelineDto[];
}

export class PublicCampaignsPaginatedDto extends PublicPaginatedEnvelopeDto {
  @ApiProperty({ type: [PublicCampaignSummaryDto] })
  data!: PublicCampaignSummaryDto[];
}

export class PublicEventsPaginatedDto extends PublicPaginatedEnvelopeDto {
  @ApiProperty({ type: [PublicEventSummaryDto] })
  data!: PublicEventSummaryDto[];
}

export class PublicStoresPaginatedDto extends PublicPaginatedEnvelopeDto {
  @ApiProperty({ type: [PublicStoreSummaryDto] })
  data!: PublicStoreSummaryDto[];
}

export class PublicMoviePosterDto {
  @ApiProperty() id!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ type: String, nullable: true }) alt!: string | null;
}

export class PublicMovieCategoryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

export class PublicMovieTrailerDto {
  @ApiProperty({ enum: ['YOUTUBE'] }) provider!: 'YOUTUBE';
  @ApiProperty({ example: 'M7lc1UVf-VE' }) videoId!: string;
  @ApiProperty({ example: 'https://www.youtube.com/watch?v=M7lc1UVf-VE' }) url!: string;
  @ApiProperty({ example: 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?rel=0&playsinline=1' }) embedUrl!: string;
}

export class PublicMovieDto {
  @ApiProperty({ type: PublicMovieTrailerDto, nullable: true, description: 'Normalized YouTube player data; null for missing or unsupported links. Embedding availability is controlled by the video publisher.' }) trailer!: PublicMovieTrailerDto | null;
  @ApiProperty({ type: String, nullable: true, example: 'https://www.youtube.com/watch?v=example', description: 'Trailer URL from TMDB or manually entered in the CMS. Null when unavailable.' }) trailerUrl!: string | null;
  @ApiProperty({ enum: ['NOW_PLAYING', 'UPCOMING', 'OTHER'] }) listingStatus!: string;
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ type: Number, nullable: true }) durationMinutes!: number | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) releaseDate!: string | null;
  @ApiProperty({ type: String, nullable: true }) ticketUrl!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '/poster.jpg', description: 'TMDB poster path; use when poster is null.' }) posterPath!: string | null;
  @ApiProperty({ type: PublicMoviePosterDto, nullable: true }) poster!: PublicMoviePosterDto | null;
  @ApiProperty({ type: [PublicMovieCategoryDto] }) categories!: PublicMovieCategoryDto[];
}

export class PublicMoviesPaginatedDto extends PublicPaginatedEnvelopeDto {
  @ApiProperty({ type: [PublicMovieDto] }) data!: PublicMovieDto[];
}
