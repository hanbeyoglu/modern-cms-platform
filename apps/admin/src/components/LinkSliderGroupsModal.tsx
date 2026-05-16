import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { Button } from './ui/Button';
import {
  apiSliderUpdate,
  apiSlidersList,
  API_MAX_PAGE_SIZE,
  type Slider,
} from '../lib/api';
import { formatChannels } from '../lib/content-channels';
import {
  getLinkedSliderEntityConfig,
  type LinkedSliderEntityKind,
} from '../lib/linked-slider-entities';

type Props = {
  open: boolean;
  entityType: LinkedSliderEntityKind;
  entityId: string;
  linkedSliderIds: string[];
  mallId?: string;
  onClose: () => void;
  onLinked: () => void;
};

export function LinkSliderGroupsModal({
  open,
  entityType,
  entityId,
  linkedSliderIds,
  mallId,
  onClose,
  onLinked,
}: Props) {
  const config = getLinkedSliderEntityConfig(entityType);
  const { accessToken, activeTenantId, activeMallId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [sliders, setSliders] = useState<Slider[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const linkedSet = useMemo(() => new Set(linkedSliderIds), [linkedSliderIds]);
  const listMallId = mallId ?? activeMallId ?? undefined;

  const load = useCallback(async () => {
    if (!accessToken || !activeTenantId) return;
    setLoading(true);
    try {
      const data = await apiSlidersList(accessToken, activeTenantId, {
        mallId: listMallId,
        limit: API_MAX_PAGE_SIZE,
      });
      setSliders(data.sliders);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Slider grupları yüklenemedi');
      setSliders([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeTenantId, listMallId]);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setSearch('');
    void load();
  }, [open, load]);

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sliders.filter((s) => {
      if (linkedSet.has(s.id)) return false;
      if (s.placementType === config.placementType && s.linkedEntityId === entityId) return false;
      if (!q) return true;
      return s.title.toLowerCase().includes(q);
    });
  }, [sliders, linkedSet, config.placementType, entityId, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    if (!accessToken || !activeTenantId || selected.size === 0) return;
    setLinking(true);
    try {
      await Promise.all(
        [...selected].map((id) =>
          apiSliderUpdate(accessToken, activeTenantId, id, {
            placementType: config.placementType,
            linkedEntityType: config.kind,
            linkedEntityId: entityId,
          }),
        ),
      );
      toast.success(
        selected.size === 1 ? 'Slider grubu bağlandı' : `${selected.size} slider grubu bağlandı`,
      );
      onLinked();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bağlantı kurulamadı');
    } finally {
      setLinking(false);
    }
  };

  if (!open) return null;

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxSizing: 'border-box',
  };

  return createPortal(
    <ModalShell
      onClose={onClose}
      title="Slider Grubu Bağla"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={linking}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleLink()}
            disabled={linking || selected.size === 0}
          >
            {linking ? 'Bağlanıyor…' : `Seçilenleri bağla (${selected.size})`}
          </Button>
        </>
      }
    >
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{config.linkModalDescription}</p>
      <input
        type="search"
        placeholder="Başlığa göre ara…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ ...inputStyle, marginBottom: 12 }}
      />
      {loading ? (
        <p style={{ fontSize: 13, color: '#6b7280' }}>Yükleniyor…</p>
      ) : available.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Bağlanabilecek slider grubu bulunamadı.
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: 320,
            overflowY: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
          }}
        >
          {available.map((s) => {
            const isChecked = selected.has(s.id);
            const relink =
              s.placementType === config.placementType &&
              s.linkedEntityId &&
              s.linkedEntityId !== entityId;
            return (
              <li
                key={s.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  padding: '10px 12px',
                  background: isChecked ? '#eff6ff' : '#fff',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(s.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <strong>{s.title}</strong>
                    <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                      {formatChannels(s.channels)} · {s._count?.items ?? s.items?.length ?? 0} slayt
                      {relink ? ` · ${config.relinkHint}` : ''}
                    </div>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </ModalShell>,
    document.body,
  );
}

function ModalShell({
  onClose,
  title,
  children,
  footer,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: '#fff',
          borderRadius: 10,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>{children}</div>
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
