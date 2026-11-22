import type { CSSProperties, ReactNode } from 'react';
import { IconSearch } from './icons';

export type ListFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchLabel: string;
  searchPlaceholder?: string;
  statusValue: string;
  onStatusChange: (value: string) => void;
  statusLabel?: string;
  statusOptions: { value: string; label: string }[];
  trailing?: ReactNode;
};

const inputBase: CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 10px',
  fontSize: 13,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#fff',
  color: '#374151',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export function ListFilterBar({
  searchValue,
  onSearchChange,
  searchLabel,
  searchPlaceholder = 'Başlığa göre ara…',
  statusValue,
  onStatusChange,
  statusLabel = 'Durum filtresi',
  statusOptions,
  trailing,
}: ListFilterBarProps) {
  return (
    <div className="cms-list-filters">
      <div className="cms-list-filters__search">
        <span className="cms-list-filters__search-icon" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          type="search"
          className="cms-list-filters__input"
          aria-label={searchLabel}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ ...inputBase, paddingLeft: 30 }}
        />
      </div>
      <select
        className="cms-list-filters__status cms-list-filters__input"
        aria-label={statusLabel}
        value={statusValue}
        onChange={(e) => onStatusChange(e.target.value)}
        style={{ ...inputBase, width: 'auto', minWidth: 160 }}
      >
        {statusOptions.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {trailing}
    </div>
  );
}
