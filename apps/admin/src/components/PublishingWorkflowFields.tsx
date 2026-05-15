import type { CSSProperties } from 'react';
import {
  STATUS_HELPER,
  STATUS_LABELS,
  type PublishWorkflowStatus,
  primaryScheduleForPublished,
  schedulePrimaryDisabled,
  schedulePrimaryRequired,
  showsScheduleFields,
} from '../lib/publishing-workflow';

const DEFAULT_LABEL: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 4,
};

const DEFAULT_INPUT: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  outline: 'none',
};

const helperTextStyle: CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  marginTop: 6,
  lineHeight: 1.45,
};

const warningStyle: CSSProperties = {
  fontSize: 12,
  color: '#b45309',
  background: '#fffbeb',
  border: '1px solid #fcd34d',
  borderRadius: 6,
  padding: '8px 10px',
  marginTop: 8,
};

type BaseProps = {
  status: PublishWorkflowStatus;
  onStatusChange: (status: PublishWorkflowStatus) => void;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

type PageModeProps = BaseProps & {
  mode: 'page';
  publishAt: string;
  unpublishAt: string;
  onPublishAtChange: (value: string) => void;
  onUnpublishAtChange: (value: string) => void;
};

type RangeModeProps = BaseProps & {
  mode: 'range';
  startAt: string;
  endAt: string;
  onStartAtChange: (value: string) => void;
  onEndAtChange: (value: string) => void;
};

export type PublishingWorkflowFieldsProps = PageModeProps | RangeModeProps;

export function PublishingWorkflowFields(props: PublishingWorkflowFieldsProps) {
  const labelStyle = props.labelStyle ?? DEFAULT_LABEL;
  const inputStyle = props.inputStyle ?? DEFAULT_INPUT;
  const { status, onStatusChange } = props;

  const handleStatusChange = (next: PublishWorkflowStatus) => {
    if (next === 'PUBLISHED') {
      if (props.mode === 'page' && !props.publishAt.trim()) {
        props.onPublishAtChange(primaryScheduleForPublished(props.publishAt));
      }
      if (props.mode === 'range' && !props.startAt.trim()) {
        props.onStartAtChange(primaryScheduleForPublished(props.startAt));
      }
    }
    onStatusChange(next);
  };

  const primaryLabel =
    status === 'SCHEDULED'
      ? props.mode === 'page'
        ? 'Yayın zamanı *'
        : 'Yayın zamanı (startAt) *'
      : props.mode === 'page'
        ? 'Yayın zamanı'
        : 'Başlangıç (startAt)';

  const secondaryLabel = props.mode === 'page' ? 'Yayından kalkma (unpublishAt)' : 'Bitiş (endAt)';

  const primaryValue = props.mode === 'page' ? props.publishAt : props.startAt;
  const secondaryValue = props.mode === 'page' ? props.unpublishAt : props.endAt;

  return (
    <>
      <div>
        <label style={labelStyle}>Durum</label>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as PublishWorkflowStatus)}
          style={{ ...inputStyle, width: '100%' }}
        >
          {(Object.keys(STATUS_LABELS) as PublishWorkflowStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <p style={helperTextStyle}>{STATUS_HELPER[status]}</p>
        {status === 'ARCHIVED' && (
          <p style={warningStyle}>
            Bu içerik arşivlenecek ve public taraftan kaldırılacak. Admin panelinde görünmeye devam eder.
          </p>
        )}
      </div>

      {showsScheduleFields(status) && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>{primaryLabel}</label>
            <input
              type="datetime-local"
              value={primaryValue}
              required={schedulePrimaryRequired(status)}
              disabled={schedulePrimaryDisabled(status)}
              onChange={(e) =>
                props.mode === 'page'
                  ? props.onPublishAtChange(e.target.value)
                  : props.onStartAtChange(e.target.value)
              }
              style={{
                ...inputStyle,
                width: '100%',
                maxWidth: 320,
                opacity: schedulePrimaryDisabled(status) ? 0.6 : 1,
              }}
            />
          </div>
          <div>
            <label style={labelStyle}>{secondaryLabel}</label>
            <input
              type="datetime-local"
              value={secondaryValue}
              onChange={(e) =>
                props.mode === 'page'
                  ? props.onUnpublishAtChange(e.target.value)
                  : props.onEndAtChange(e.target.value)
              }
              style={{ ...inputStyle, width: '100%', maxWidth: 320 }}
            />
            {status === 'PUBLISHED' && (
              <p style={{ ...helperTextStyle, marginTop: 4 }}>
                {props.mode === 'page'
                  ? 'Yayından kalkma tarihi dolunca sayfa otomatik arşivlenir (scheduler).'
                  : 'Bitiş tarihi dolunca içerik otomatik arşivlenir (scheduler).'}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
