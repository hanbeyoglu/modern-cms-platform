import type { MovieProviderType } from '../types';

export const MOVIE_IMPORT_QUEUE_NAME = 'movie-import';

export type MovieImportBatchStatus = 'queued' | 'running' | 'completed' | 'failed';

export type MovieImportBatchProgress = {
  batchId: string;
  tenantId: string;
  status: MovieImportBatchStatus;
  total: number;
  processed: number;
  newMovies: number;
  updatedMovies: number;
  failedMovies: number;
  /** 0–100, BullMQ job.updateProgress tek kaynağı */
  percent: number;
  startedAt?: string;
  finishedAt?: string;
};

export type MovieImportBulkJobData = {
  batchId: string;
  tenantId: string;
  userId: string;
  provider: MovieProviderType;
  tmdbIds: number[];
};

export function movieImportJobId(batchId: string): string {
  return `import-${batchId}`;
}

export function mapBullMqStateToStatus(state: string): MovieImportBatchStatus {
  switch (state) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'active':
      return 'running';
    default:
      return 'queued';
  }
}

export function buildImportProgress(
  data: MovieImportBulkJobData,
  fields: {
    status: MovieImportBatchStatus;
    processed: number;
    newMovies: number;
    updatedMovies: number;
    failedMovies: number;
    startedAt?: string;
    finishedAt?: string;
  },
): MovieImportBatchProgress {
  const total = data.tmdbIds.length;
  const processed = fields.processed;
  return {
    batchId: data.batchId,
    tenantId: data.tenantId,
    status: fields.status,
    total,
    processed,
    newMovies: fields.newMovies,
    updatedMovies: fields.updatedMovies,
    failedMovies: fields.failedMovies,
    percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0,
    startedAt: fields.startedAt,
    finishedAt: fields.finishedAt,
  };
}

export function parseJobProgress(
  data: MovieImportBulkJobData,
  jobState: string,
  raw: unknown,
): MovieImportBatchProgress {
  if (raw && typeof raw === 'object' && 'batchId' in raw) {
    const p = raw as MovieImportBatchProgress;
    const status =
      p.status === 'completed' || p.status === 'failed'
        ? p.status
        : mapBullMqStateToStatus(jobState);
    return { ...p, status };
  }

  return buildImportProgress(data, {
    status: mapBullMqStateToStatus(jobState),
    processed: 0,
    newMovies: 0,
    updatedMovies: 0,
    failedMovies: 0,
  });
}
