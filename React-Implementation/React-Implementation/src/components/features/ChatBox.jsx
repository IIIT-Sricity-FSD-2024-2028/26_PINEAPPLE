import { useState, useRef, useEffect } from 'react';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import Modal from '../common/Modal';
import communicationApi from '../../services/communicationApi';
import './ChatBox.css';

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const isRoleString = (str) => {
  if (!str) return false;
  const s = String(str).trim().toLowerCase().replace(/[_\s]+/g, '-');
  return [
    'collaborator',
    'collab',
    'project-owner',
    'owner',
    'mentor',
    'admin',
    'administrator',
    'superuser',
    'super-user',
  ].includes(s);
};

const formatRole = (role) => {
  if (!role) return null;
  const r = String(role).trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (r === 'project-owner' || r === 'owner') return 'Owner';
  if (r === 'mentor') return 'Mentor';
  if (r === 'collaborator' || r === 'collab' || r === 'member') return 'Collaborator';
  if (r === 'former-member' || r === 'former member') return 'Former member';
  return null;
};

const getRoleVariant = (role) => {
  switch (role) {
    case 'Owner': return 'warning';
    case 'Mentor': return 'purple';
    case 'Collaborator': return 'info';
    default: return 'info';
  }
};

/**
 * Reusable ChatBox component encapsulating real-time message stream and input dispatch.
 * @param {Object} props
 * @param {Array<Object>} props.messages
 * @param {string} [props.currentUserId]
 * @param {string} [props.currentUserName]
 * @param {string} [props.currentUserRole]
 * @param {(text: string) => void} props.onSendMessage
 * @param {() => void} [props.onRefresh]
 * @param {boolean} [props.sending=false]
 * @param {boolean} [props.isForbidden=false]
 * @param {string} [props.forbiddenMessage]
 */
const ChatBox = ({
  messages = [],
  currentUserId = '',
  currentUserName = '',
  onSendMessage,
  onRefresh,
  sending = false,
  isForbidden = false,
  forbiddenMessage = 'You are not a member of this project.',
}) => {
  const [inputText, setInputText] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccessMsg, setReportSuccessMsg] = useState('');
  const [reportedIds, setReportedIds] = useState(() => new Set());
  const messagesEndRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  const openReportModal = (msg, senderName, text) => {
    setReportTarget({
      id: msg.id,
      senderName,
      content: text,
    });
    setReportReason('');
    setReportError('');
  };

  const closeReportModal = () => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason('');
    setReportError('');
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportTarget?.id) return;
    const trimmed = reportReason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setReportError('Reason must be between 10 and 500 characters.');
      return;
    }

    setReportSubmitting(true);
    setReportError('');
    try {
      await communicationApi.reportMessage(reportTarget.id, trimmed);
      setReportedIds((prev) => {
        const next = new Set(prev);
        next.add(String(reportTarget.id));
        return next;
      });
      setReportTarget(null);
      setReportReason('');
      setReportSuccessMsg('Report sent. Admins will review it. You can track it in Help & Support under My reports.');
    } catch (err) {
      const code = err?.code || err?.data?.code;
      if (code === 'ALREADY_REPORTED') {
        setReportError('You have already reported this message.');
      } else if (code === 'TOO_MANY_REPORTS') {
        setReportError('Daily report limit reached. Please try again tomorrow.');
      } else {
        setReportError(err?.message || 'Failed to submit report.');
      }
    } finally {
      setReportSubmitting(false);
    }
  };

  // Auto-scroll to latest message when message list updates
  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  if (isForbidden) {
    return (
      <div className="tf-chatbox tf-chatbox--forbidden" data-testid="chatbox-forbidden">
        <div
          className="tf-chatbox-forbidden-content"
          style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#6b7280' }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
          <h4 style={{ fontWeight: 600, color: '#111827', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            {forbiddenMessage || 'You are not a member of this project.'}
          </h4>
          <p style={{ fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto', color: '#6b7280' }}>
            Project chat is private. Only project members, assigned mentors, and administrators can read or participate.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setInputText('');
    if (onRefresh) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => onRefresh(), 300);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="tf-chatbox">
      {reportSuccessMsg && (
        <div
          role="status"
          data-testid="chat-report-success"
          style={{
            padding: '0.5rem 0.75rem',
            marginBottom: '0.5rem',
            borderRadius: '6px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.82rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{reportSuccessMsg}</span>
          <button
            type="button"
            onClick={() => setReportSuccessMsg('')}
            style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontWeight: 700 }}
            aria-label="Dismiss notice"
          >
            ×
          </button>
        </div>
      )}
      <div className="tf-chatbox-messages">
        {messages.length === 0 ? (
          <div className="tf-chatbox-empty">
            <p>No messages yet. Start the team conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const rawSender = msg.senderName || msg.sender;
            const text = msg.text || msg.message || msg.content || '';

            const isMine =
              Boolean(msg.isMine) ||
              (currentUserId && String(msg.senderId) === String(currentUserId)) ||
              (currentUserName && rawSender && rawSender.toLowerCase() === currentUserName.toLowerCase());

            const isDeletedSender = Boolean(
              msg.senderIsDeleted || String(rawSender || '').trim().toLowerCase() === 'deleted user',
            );
            // Real display name: never show a role as a name
            let senderName = isDeletedSender ? 'Deleted user' : rawSender;
            if (!senderName || isRoleString(senderName)) {
              senderName = isMine ? (currentUserName || 'You') : 'Unknown user';
            }

            const rawRole = msg.projectRole || msg.role || msg.senderRole;
            const roleLabel = formatRole(rawRole);
            const isFormer = roleLabel === 'Former member';
            const roleVariant = getRoleVariant(roleLabel);

            const formattedTime = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';

            return (
              <div
                key={msg.id || index}
                className={`tf-chatbox-message-row ${isMine ? 'tf-chatbox-message-row--mine' : 'tf-chatbox-message-row--theirs'}`}
              >
                {isMine ? (
                  <div className="tf-chatbox-message-header tf-chatbox-message-header--mine">
                    {formattedTime && <span className="tf-chatbox-time-header">{formattedTime}</span>}
                    {roleLabel && !isFormer && (
                      <Badge variant={roleVariant} className="tf-chatbox-role-badge">{roleLabel}</Badge>
                    )}
                    {isFormer && <span className="tf-chatbox-former-member" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>(Former member)</span>}
                    <span className="tf-chatbox-sender-name" title={senderName}>You</span>
                    <Avatar name={senderName} isDeleted={isDeletedSender} size="xs" />
                  </div>
                ) : (
                  <div className="tf-chatbox-message-header tf-chatbox-message-header--theirs">
                    <Avatar name={senderName} isDeleted={isDeletedSender} size="xs" />
                    <span className="tf-chatbox-sender-name" style={isDeletedSender ? { color: '#64748b', fontStyle: 'italic' } : undefined}>
                      {senderName}
                    </span>
                    {roleLabel && !isFormer && (
                      <Badge variant={roleVariant} className="tf-chatbox-role-badge">{roleLabel}</Badge>
                    )}
                    {isFormer && <span className="tf-chatbox-former-member" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>(Former member)</span>}
                    {formattedTime && <span className="tf-chatbox-time-header">{formattedTime}</span>}
                    {msg.id && (
                      reportedIds.has(String(msg.id)) ? (
                        <span
                          data-testid={`reported-badge-${msg.id}`}
                          style={{ fontSize: '0.72rem', color: '#b45309', marginLeft: '6px', fontWeight: 600 }}
                        >
                          Reported
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="tf-chatbox-report-btn"
                          data-testid={`report-msg-btn-${msg.id}`}
                          onClick={() => openReportModal(msg, senderName, text)}
                          style={{
                            marginLeft: '6px',
                            background: 'transparent',
                            border: 'none',
                            color: '#dc2626',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: '0 2px',
                          }}
                        >
                          Report
                        </button>
                      )
                    )}
                  </div>
                )}
                <div className="tf-chatbox-bubble">
                  <p className="tf-chatbox-bubble-text">{text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="tf-chatbox-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="tf-chatbox-input"
          placeholder="Type your message and press Enter..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          type="submit"
          className="tf-chatbox-send-btn"
          disabled={!inputText.trim() || sending}
          aria-label="Send message"
        >
          {sending ? (
            <span className="tf-chatbox-spinner" />
          ) : (
            <SendIcon />
          )}
        </button>
      </form>

      {reportTarget && (
        <Modal
          isOpen={true}
          onClose={closeReportModal}
          title="Report Chat Message"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-outline" onClick={closeReportModal} disabled={reportSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                form="chat-report-form"
                className="btn btn-danger"
                data-testid="submit-chat-report-btn"
                disabled={reportSubmitting || reportReason.trim().length < 10}
              >
                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          }
        >
          <form id="chat-report-form" onSubmit={handleSubmitReport}>
            <div
              style={{
                padding: '0.65rem 0.75rem',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginBottom: '0.75rem',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{reportTarget.senderName}</div>
              <div style={{ color: '#334155' }}>{reportTarget.content}</div>
            </div>

            <label htmlFor="chat-report-reason" style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.35rem' }}>
              Reason for report (10–500 characters)
            </label>
            <textarea
              id="chat-report-reason"
              data-testid="chat-report-reason-input"
              rows={3}
              maxLength={500}
              value={reportReason}
              onChange={(e) => {
                setReportReason(e.target.value);
                if (reportError) setReportError('');
              }}
              placeholder="Explain why this chat message violates community rules..."
              style={{
                width: '100%',
                padding: '0.5rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.88rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginTop: '0.3rem', color: '#64748b' }}>
              <span>Up to 20 messages around this message will be preserved for moderators.</span>
              <span>{reportReason.trim().length}/500</span>
            </div>
            {reportError && (
              <div data-testid="chat-report-error" style={{ color: '#dc2626', fontSize: '0.84rem', marginTop: '0.45rem' }}>
                {reportError}
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ChatBox;
