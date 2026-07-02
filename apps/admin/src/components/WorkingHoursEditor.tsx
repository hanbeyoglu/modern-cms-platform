import { useEffect, useId, useState } from 'react';
import type { WorkingHourDay, WorkingHoursMode, WorkingHoursSchedule } from '../lib/working-hours';
import {
  WORKING_HOUR_DAYS,
  WORKING_HOUR_DAY_LABELS,
  buildScheduleFromMode,
  generateSchedulePreview,
  initWorkingHoursEditorState,
  scheduleToCustomByDay,
  validateWorkingHoursEditor,
  type SpecialDay,
  type WorkingHoursEditorState,
} from '../lib/working-hours';

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  value: WorkingHoursSchedule | null;
  onChange: (value: WorkingHoursSchedule | null) => void;
  /** Reset trigger — change this key to reinitialise state from `value` */
  formKey?: string;
  disabled?: boolean;
  /** Show "AVM saatlerini kullan" option (for store context). Default: true */
  showUseMallHoursOption?: boolean;
  /** Reference mall hours to display when USE_MALL_HOURS is active */
  mallHours?: WorkingHoursSchedule | null;
  /** Show live preview panel. Default: false */
  showPreview?: boolean;
  /** Enable special days section. Default: false */
  showSpecialDays?: boolean;
  specialDays?: SpecialDay[];
  onSpecialDaysChange?: (days: SpecialDay[]) => void;
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────

const S = {
  modeBar: {
    display: 'flex', gap: 0, marginBottom: 20,
    border: '1px solid #d1d5db', borderRadius: 8, overflow: 'hidden',
  } as React.CSSProperties,
  modeBtn (active: boolean): React.CSSProperties {
    return {
      flex: 1, padding: '8px 4px', border: 'none', borderRight: '1px solid #d1d5db',
      background: active ? '#2563eb' : '#fff',
      color: active ? '#fff' : '#374151',
      fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
      transition: 'background 0.15s',
    };
  },
  modeBtnLast (active: boolean): React.CSSProperties {
    return {
      flex: 1, padding: '8px 4px', border: 'none',
      background: active ? '#2563eb' : '#fff',
      color: active ? '#fff' : '#374151',
      fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer',
    };
  },
  timeRow: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
  } as React.CSSProperties,
  timeInput: {
    padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, width: 100,
  } as React.CSSProperties,
  sep: { color: '#9ca3af', fontSize: 13, flexShrink: 0 } as React.CSSProperties,
  dayRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  } as React.CSSProperties,
  dayLabel: { width: 90, fontSize: 13, color: '#374151', fontWeight: 500, flexShrink: 0 } as React.CSSProperties,
  toggle (open: boolean): React.CSSProperties {
    return {
      padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
      fontWeight: 600,
      background: open ? '#dcfce7' : '#f3f4f6',
      color: open ? '#16a34a' : '#9ca3af',
    };
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#374151',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    marginBottom: 12,
  } as React.CSSProperties,
  previewBox: {
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '12px 16px', marginTop: 20,
  } as React.CSSProperties,
  previewRow (isToday: boolean): React.CSSProperties {
    return {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', fontSize: 13,
      fontWeight: isToday ? 600 : 400,
      color: isToday ? '#2563eb' : '#374151',
    };
  },
  specialCard: {
    border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px',
    marginBottom: 10, background: '#fff',
  } as React.CSSProperties,
  addBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', border: '1px dashed #d1d5db', borderRadius: 6,
    background: '#f9fafb', fontSize: 12, color: '#6b7280', cursor: 'pointer',
    marginTop: 4,
  } as React.CSSProperties,
  removeBtn: {
    padding: '2px 8px', border: 'none', background: 'none',
    color: '#dc2626', cursor: 'pointer', fontSize: 18, lineHeight: '1',
  } as React.CSSProperties,
  error: {
    color: '#dc2626', fontSize: 12, marginTop: 8, padding: '6px 10px',
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
  } as React.CSSProperties,
};

function TimeInput({
  value, onChange, disabled,
}: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={S.timeInput}
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkingHoursEditor({
  value,
  onChange,
  formKey,
  disabled,
  showUseMallHoursOption = true,
  mallHours,
  showPreview = false,
  showSpecialDays = false,
  specialDays = [],
  onSpecialDaysChange,
}: Props) {
  const uid = useId();

  const [mode, setMode] = useState<WorkingHoursMode>('SAME_EVERY_DAY');
  const [editorState, setEditorState] = useState<WorkingHoursEditorState>(
    () => {
      const init = initWorkingHoursEditorState(value);
      return {
        sameEveryDay: init.sameEveryDay,
        weekdayHours: init.weekdayHours,
        weekendHours: init.weekendHours,
        customByDay: init.customByDay,
      };
    },
  );

  // Reset when formKey changes or value is externally reset
  useEffect(() => {
    const init = initWorkingHoursEditorState(value);
    const effectiveMode = showUseMallHoursOption ? init.mode : (init.mode === 'USE_MALL_HOURS' ? 'SAME_EVERY_DAY' : init.mode);
    setMode(effectiveMode);
    setEditorState({
      sameEveryDay: init.sameEveryDay,
      weekdayHours: init.weekdayHours,
      weekendHours: init.weekendHours,
      customByDay: init.customByDay,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const emit = (newMode: WorkingHoursMode, state: WorkingHoursEditorState) => {
    onChange(buildScheduleFromMode(newMode, state));
  };

  const handleModeChange = (newMode: WorkingHoursMode) => {
    const nextState = newMode === 'CUSTOM_BY_DAY'
      ? { ...editorState, customByDay: scheduleToCustomByDay(value) }
      : editorState;
    setMode(newMode);
    setEditorState(nextState);
    emit(newMode, nextState);
  };

  const patchState = (patch: Partial<WorkingHoursEditorState>) => {
    const next = { ...editorState, ...patch };
    setEditorState(next);
    emit(mode, next);
  };

  const validationError = validateWorkingHoursEditor(mode, editorState);

  // Effective schedule for preview
  const schedule = mode === 'USE_MALL_HOURS' ? mallHours ?? null : buildScheduleFromMode(mode, editorState);
  const previewLines = showPreview ? generateSchedulePreview(schedule) : [];

  // ── Modes available in this context ─────────────────────────────────────────
  type ModeOption = { id: WorkingHoursMode; label: string };
  const modeOptions: ModeOption[] = [
    ...(showUseMallHoursOption ? [{ id: 'USE_MALL_HOURS' as WorkingHoursMode, label: 'AVM Saatleri' }] : []),
    { id: 'SAME_EVERY_DAY', label: 'Her Gün Aynı' },
    { id: 'WEEKDAY_WEEKEND', label: 'Hafta İçi / Sonu' },
    { id: 'CUSTOM_BY_DAY', label: 'Günlere Özel' },
  ];

  // ── Special days helpers ─────────────────────────────────────────────────────
  const addSpecialDay = () => {
    onSpecialDaysChange?.([
      ...specialDays,
      { date: '', title: '', open: false },
    ]);
  };

  const updateSpecialDay = (idx: number, patch: Partial<SpecialDay>) => {
    const next = specialDays.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onSpecialDaysChange?.(next);
  };

  const removeSpecialDay = (idx: number) => {
    onSpecialDaysChange?.(specialDays.filter((_, i) => i !== idx));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Mode selector */}
      <div style={S.modeBar}>
        {modeOptions.map((opt, idx) => {
          const isLast = idx === modeOptions.length - 1;
          const isActive = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => handleModeChange(opt.id)}
              style={isLast ? S.modeBtnLast(isActive) : S.modeBtn(isActive)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* USE_MALL_HOURS */}
      {mode === 'USE_MALL_HOURS' && (
        <div style={{ color: '#6b7280', fontSize: 13 }}>
          {mallHours ? (
            <>
              <div style={{ marginBottom: 8, fontWeight: 500, color: '#374151' }}>AVM çalışma saatleri:</div>
              {generateSchedulePreview(mallHours).map((line, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                  <span>{line.label}</span>
                  <span style={{ color: line.value === 'Kapalı' ? '#9ca3af' : '#374151' }}>{line.value}</span>
                </div>
              ))}
            </>
          ) : (
            <span style={{ color: '#9ca3af' }}>AVM çalışma saatleri henüz girilmemiş.</span>
          )}
        </div>
      )}

      {/* SAME_EVERY_DAY */}
      {mode === 'SAME_EVERY_DAY' && (
        <div>
          <div style={{ ...S.sectionTitle, marginBottom: 10 }}>Tüm günler</div>
          <div style={S.timeRow}>
            <TimeInput
              value={editorState.sameEveryDay.from}
              onChange={(v) => patchState({ sameEveryDay: { ...editorState.sameEveryDay, from: v } })}
              disabled={disabled}
            />
            <span style={S.sep}>—</span>
            <TimeInput
              value={editorState.sameEveryDay.to}
              onChange={(v) => patchState({ sameEveryDay: { ...editorState.sameEveryDay, to: v } })}
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* WEEKDAY_WEEKEND */}
      {mode === 'WEEKDAY_WEEKEND' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <div>
              <div style={S.sectionTitle}>Hafta İçi (Pzt – Cum)</div>
              <div style={S.timeRow}>
                <TimeInput
                  value={editorState.weekdayHours.from}
                  onChange={(v) => patchState({ weekdayHours: { ...editorState.weekdayHours, from: v } })}
                  disabled={disabled}
                />
                <span style={S.sep}>—</span>
                <TimeInput
                  value={editorState.weekdayHours.to}
                  onChange={(v) => patchState({ weekdayHours: { ...editorState.weekdayHours, to: v } })}
                  disabled={disabled}
                />
              </div>
            </div>
            <div>
              <div style={S.sectionTitle}>Hafta Sonu (Cmt – Paz)</div>
              <div style={S.timeRow}>
                <TimeInput
                  value={editorState.weekendHours.from}
                  onChange={(v) => patchState({ weekendHours: { ...editorState.weekendHours, from: v } })}
                  disabled={disabled}
                />
                <span style={S.sep}>—</span>
                <TimeInput
                  value={editorState.weekendHours.to}
                  onChange={(v) => patchState({ weekendHours: { ...editorState.weekendHours, to: v } })}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM_BY_DAY */}
      {mode === 'CUSTOM_BY_DAY' && (
        <div>
          {WORKING_HOUR_DAYS.map((day: WorkingHourDay) => {
            const slot = editorState.customByDay[day] ?? { open: false, from: '10:00', to: '22:00' };
            return (
              <div key={day} style={S.dayRow}>
                <span style={S.dayLabel}>{WORKING_HOUR_DAY_LABELS[day]}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const next = { ...editorState.customByDay, [day]: { ...slot, open: !slot.open } };
                    patchState({ customByDay: next });
                  }}
                  style={S.toggle(slot.open)}
                >
                  {slot.open ? 'Açık' : 'Kapalı'}
                </button>
                {slot.open && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TimeInput
                      value={slot.from ?? '10:00'}
                      onChange={(v) => {
                        const next = { ...editorState.customByDay, [day]: { ...slot, from: v } };
                        patchState({ customByDay: next });
                      }}
                      disabled={disabled}
                    />
                    <span style={S.sep}>—</span>
                    <TimeInput
                      value={slot.to ?? '22:00'}
                      onChange={(v) => {
                        const next = { ...editorState.customByDay, [day]: { ...slot, to: v } };
                        patchState({ customByDay: next });
                      }}
                      disabled={disabled}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Validation error */}
      {validationError && mode !== 'USE_MALL_HOURS' && (
        <div style={S.error}>{validationError}</div>
      )}

      {/* Preview */}
      {showPreview && previewLines.length > 0 && (
        <div style={S.previewBox}>
          <div style={{ ...S.sectionTitle, marginBottom: 8 }}>Önizleme</div>
          {previewLines.map((line, i) => (
            <div key={i} style={S.previewRow(!!line.isToday)}>
              <span>{line.label}</span>
              <span style={{ color: line.value === 'Kapalı' ? '#9ca3af' : 'inherit' }}>
                {line.value}
                {line.isToday && (
                  <span style={{
                    marginLeft: 6, fontSize: 10, padding: '1px 6px',
                    background: '#dbeafe', color: '#2563eb', borderRadius: 10,
                  }}>
                    Bugün
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Special Days */}
      {showSpecialDays && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={S.sectionTitle}>Özel Günler</div>
            {!disabled && (
              <button type="button" onClick={addSpecialDay} style={S.addBtn}>
                + Yeni Özel Gün
              </button>
            )}
          </div>

          {specialDays.length === 0 && (
            <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>
              Henüz özel gün eklenmemiş. Resmi tatiller veya özel kapanış günleri ekleyebilirsiniz.
            </div>
          )}

          {specialDays.map((day, idx) => (
            <div key={`${uid}-sd-${idx}`} style={S.specialCard}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px', alignItems: 'center' }}>
                  {/* Date */}
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Tarih</label>
                  <input
                    type="date"
                    value={day.date.length === 10 ? day.date : ''}
                    onChange={(e) => updateSpecialDay(idx, { date: e.target.value })}
                    disabled={disabled}
                    style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                    placeholder="YYYY-MM-DD"
                  />

                  {/* Title */}
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Başlık</label>
                  <input
                    type="text"
                    value={day.title}
                    onChange={(e) => updateSpecialDay(idx, { title: e.target.value })}
                    disabled={disabled}
                    placeholder="Örn: Yılbaşı, Ramazan Bayramı 1. Gün"
                    style={{ padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
                  />

                  {/* Status toggle */}
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>Durum</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => updateSpecialDay(idx, {
                        open: !day.open,
                        from: day.open ? undefined : '10:00',
                        to: day.open ? undefined : '22:00',
                      })}
                      style={S.toggle(day.open)}
                    >
                      {day.open ? 'Açık' : 'Kapalı'}
                    </button>
                    {day.open && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <TimeInput
                          value={day.from ?? '10:00'}
                          onChange={(v) => updateSpecialDay(idx, { from: v })}
                          disabled={disabled}
                        />
                        <span style={S.sep}>—</span>
                        <TimeInput
                          value={day.to ?? '22:00'}
                          onChange={(v) => updateSpecialDay(idx, { to: v })}
                          disabled={disabled}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Remove */}
                {!disabled && (
                  <button type="button" onClick={() => removeSpecialDay(idx)} style={S.removeBtn} title="Kaldır">
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
