import { Button } from './ui/Button';

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  /** Noun shown next to the total, e.g. "kampanya". */
  itemLabel: string;
  disabled?: boolean;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  page,
  pageSize,
  total,
  itemLabel,
  disabled = false,
  onPageChange,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <nav
      aria-label="Sayfalama"
      style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', fontSize: 13 }}
    >
      <Button disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        Önceki
      </Button>
      <span style={{ color: '#374151' }}>
        {total} {itemLabel} · Sayfa {page} / {totalPages}
      </span>
      <Button disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Sonraki
      </Button>
    </nav>
  );
}
