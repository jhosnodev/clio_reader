import React, { useEffect, useState } from 'react';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  type FeedbackArea,
  type FeedbackCategory,
  type FeedbackDocumentFormat,
  type FeedbackReaction,
} from '@clio-reader/domain';

import { fetchAppInfo } from '../bridges/feedback-bridge';
import { getInstallationId } from '../feedback/installation-id';
import { getFeedbackService } from '../feedback/service';
import { useT } from '../i18n';
import type { MessageKey } from '@clio-reader/i18n';

interface FeedbackPanelProps {
  readonly open: boolean;
  readonly area: FeedbackArea;
  readonly initialCategory?: FeedbackCategory | undefined;
  readonly documentFormat?: FeedbackDocumentFormat | undefined;
  readonly onClose: () => void;
}

const REACTIONS: { id: FeedbackReaction; emoji: string; labelKey: MessageKey }[] = [
  { id: 'very_negative', emoji: '😞', labelKey: 'feedback.reaction.veryNegative' },
  { id: 'negative', emoji: '🙁', labelKey: 'feedback.reaction.negative' },
  { id: 'neutral', emoji: '😐', labelKey: 'feedback.reaction.neutral' },
  { id: 'positive', emoji: '🙂', labelKey: 'feedback.reaction.positive' },
  { id: 'very_positive', emoji: '😍', labelKey: 'feedback.reaction.veryPositive' },
];

const CATEGORY_LABEL_KEYS: Record<FeedbackCategory, MessageKey> = {
  bug: 'feedback.category.bug',
  idea: 'feedback.category.idea',
  praise: 'feedback.category.praise',
  general: 'feedback.category.general',
};

export function FeedbackPanel({
  open,
  area,
  initialCategory,
  documentFormat,
  onClose,
}: FeedbackPanelProps): JSX.Element | null {
  const { t, locale, tp } = useT();
  const [reaction, setReaction] = useState<FeedbackReaction | null>(null);
  const [category, setCategory] = useState<FeedbackCategory | null>(initialCategory ?? null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (open && initialCategory) {
      setCategory(initialCategory);
    }
  }, [open, initialCategory]);

  if (!open) return null;

  const canSubmit = !sending && (reaction !== null || message.trim().length > 0);

  const handleSend = async () => {
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      const appInfo = await fetchAppInfo();
      const service = getFeedbackService();
      await service.submitFeedback({
        appInfo,
        installationId: getInstallationId(),
        reaction: reaction ?? undefined,
        category: category ?? undefined,
        message: message.trim().length > 0 ? message.trim() : undefined,
        area,
        documentFormat,
        locale,
      });
      setPendingCount(await service.getPendingCount());
      setReaction(null);
      setCategory(initialCategory ?? null);
      setMessage('');
      setDone(true);
    } catch (err) {
      console.error('Error guardando feedback:', err);
      setError(t('feedback.saveFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setDone(false);
    onClose();
  };

  return (
    <div style={backdropStyle} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        {done ? (
          <div style={doneWrapStyle}>
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--gold)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m8.5 12.5 2.5 2.5 4.5-5" />
            </svg>
            <h2 id="feedback-title" style={titleStyle}>
              {t('feedback.thanks')}
            </h2>
            <p style={descStyle}>{t('feedback.saved')}</p>
            {pendingCount > 1 && <p style={pendingStyle}>{tp('feedback.pending', pendingCount)}</p>}
            <div style={actionsStyle}>
              <button style={primaryBtn} onClick={handleClose}>
                {t('app.close')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="feedback-title" style={titleStyle}>
              {t('feedback.title')}
            </h2>
            <p style={privacyStyle}>{t('feedback.privacy')}</p>

            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>{t('feedback.experience')}</legend>
              <div style={reactionsStyle}>
                {REACTIONS.map((r) => {
                  const selected = reaction === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      style={{
                        ...reactionBtnStyle,
                        ...(selected ? reactionBtnSelectedStyle : {}),
                      }}
                      onClick={() => setReaction(selected ? null : r.id)}
                      aria-pressed={selected}
                      title={t(r.labelKey)}
                    >
                      <span style={{ fontSize: 22 }} aria-hidden="true">
                        {r.emoji}
                      </span>
                      <span style={reactionLabelStyle}>{t(r.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset style={fieldsetStyle}>
              <legend style={legendStyle}>{t('feedback.categoryOptional')}</legend>
              <div style={chipsStyle}>
                {FEEDBACK_CATEGORIES.map((c) => {
                  const selected = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      style={{
                        ...chipStyle,
                        ...(selected ? chipSelectedStyle : {}),
                      }}
                      onClick={() => setCategory(selected ? null : c)}
                      aria-pressed={selected}
                    >
                      {t(CATEGORY_LABEL_KEYS[c])}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label style={labelStyle} htmlFor="feedback-message">
              {t('feedback.messageLabel')}
            </label>
            <textarea
              id="feedback-message"
              style={textareaStyle}
              value={message}
              maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
              placeholder={t('feedback.messagePlaceholder')}
              rows={4}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div style={counterStyle} aria-live="polite">
              {message.length}/{FEEDBACK_MESSAGE_MAX_LENGTH}
            </div>

            {error && (
              <p style={errorStyle} role="alert">
                {error}
              </p>
            )}

            <div style={actionsStyle}>
              <button style={secondaryBtn} onClick={handleClose} disabled={sending}>
                {t('app.cancel')}
              </button>
              <button style={primaryBtn} onClick={handleSend} disabled={!canSubmit}>
                {sending ? t('feedback.sending') : t('feedback.send')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: 'var(--ink-900)',
  border: '1px solid var(--gold-dim)',
  borderRadius: 8,
  padding: 24,
  maxWidth: 560,
  width: '90%',
  maxHeight: '90vh',
  overflowY: 'auto',
  color: 'var(--tx)',
  fontFamily: '"Hanken Grotesk", system-ui, sans-serif',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
};

const doneWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--gold)',
};

const descStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  fontSize: 14,
  lineHeight: 1.6,
  color: 'var(--tx)',
  opacity: 0.9,
};

const pendingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: 'var(--tx-lo)',
};

const privacyStyle: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--tx-lo)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  padding: '8px 10px',
};

const fieldsetStyle: React.CSSProperties = {
  border: 'none',
  margin: '0 0 12px 0',
  padding: 0,
};

const legendStyle: React.CSSProperties = {
  padding: 0,
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--tx)',
};

const reactionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const reactionBtnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '8px 10px',
  minWidth: 76,
  background: 'var(--ink-800)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  color: 'var(--tx)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const reactionBtnSelectedStyle: React.CSSProperties = {
  border: '1px solid var(--gold)',
  background: 'var(--ink-950)',
};

const reactionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--tx-lo)',
};

const chipsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const chipStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--ink-800)',
  border: '1px solid var(--line)',
  borderRadius: 999,
  color: 'var(--tx)',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const chipSelectedStyle: React.CSSProperties = {
  border: '1px solid var(--gold)',
  color: 'var(--gold)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--tx)',
  marginBottom: 6,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  minHeight: 88,
  padding: '10px 12px',
  background: 'var(--ink-950)',
  border: '1px solid var(--line)',
  borderRadius: 6,
  color: 'var(--tx)',
  fontSize: 14,
  lineHeight: 1.5,
  fontFamily: 'inherit',
};

const counterStyle: React.CSSProperties = {
  textAlign: 'right',
  fontSize: 12,
  color: 'var(--tx-lo)',
  margin: '4px 0 0 0',
};

const errorStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  fontSize: 13,
  color: '#e08a8a',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  justifyContent: 'flex-end',
  marginTop: 16,
};

const primaryBtn: React.CSSProperties = {
  background: 'var(--gold)',
  color: 'var(--ink-950)',
  border: '1px solid var(--gold)',
  padding: '8px 16px',
  borderRadius: 6,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtn: React.CSSProperties = {
  background: 'var(--ink-800)',
  color: 'var(--tx)',
  border: '1px solid var(--gold-dim)',
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
