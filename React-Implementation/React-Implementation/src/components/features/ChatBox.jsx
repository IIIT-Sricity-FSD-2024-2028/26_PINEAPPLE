import { useState, useRef, useEffect } from 'react';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
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
  const r = String(role || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (r === 'project-owner' || r === 'owner') return 'Owner';
  if (r === 'mentor') return 'Mentor';
  if (r === 'collaborator' || r === 'collab') return 'Collaborator';
  if (r === 'admin' || r === 'administrator') return 'Admin';
  if (r === 'superuser' || r === 'super-user') return 'Super User';
  return 'Collaborator';
};

const getRoleVariant = (role) => {
  switch (role) {
    case 'Owner': return 'warning';
    case 'Mentor': return 'success';
    case 'Collaborator': return 'info';
    case 'Admin': return 'danger';
    case 'Super User': return 'secondary';
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
 */
const ChatBox = ({
  messages = [],
  currentUserId = '',
  currentUserName = '',
  currentUserRole = '',
  onSendMessage,
  onRefresh,
  sending = false,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message when message list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setInputText('');
    if (onRefresh) {
      setTimeout(() => onRefresh(), 300);
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

            // Real display name: never show a role as a name
            let senderName = rawSender;
            if (!senderName || isRoleString(senderName)) {
              senderName = isMine ? (currentUserName || 'You') : 'Unknown user';
            }

            const rawRole = msg.role || msg.senderRole || (isMine ? currentUserRole : '');
            const roleLabel = formatRole(rawRole);
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
                    <Badge variant={roleVariant} className="tf-chatbox-role-badge">{roleLabel}</Badge>
                    <span className="tf-chatbox-sender-name" title={senderName}>You</span>
                    <Avatar name={senderName} size="xs" />
                  </div>
                ) : (
                  <div className="tf-chatbox-message-header tf-chatbox-message-header--theirs">
                    <Avatar name={senderName} size="xs" />
                    <span className="tf-chatbox-sender-name">{senderName}</span>
                    <Badge variant={roleVariant} className="tf-chatbox-role-badge">{roleLabel}</Badge>
                    {formattedTime && <span className="tf-chatbox-time-header">{formattedTime}</span>}
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
    </div>
  );
};

export default ChatBox;
