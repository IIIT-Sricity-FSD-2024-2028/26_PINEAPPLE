import { useState, useRef } from 'react';
import './TagInput.css';

/**
 * Reusable TagInput component for skill pills, keywords, and categorical tags.
 *
 * @param {Object} props
 * @param {string[]} [props.tags=[]] - Currently selected tags.
 * @param {(tags: string[]) => void} props.onChange - Handler called when tags are added or removed.
 * @param {string} [props.label] - Input label.
 * @param {string} [props.placeholder="Type and press Enter..."] - Input placeholder.
 * @param {number} [props.maxTags] - Maximum number of tags allowed.
 * @param {string} [props.error] - Validation error message.
 * @param {string} [props.helperText] - Supplementary hint text.
 * @param {string} [props.className=""] - Additional class name.
 * @param {boolean} [props.disabled=false] - Whether input is disabled.
 */
export const TagInput = ({
  tags = [],
  onChange,
  label,
  placeholder = 'Type and press Enter...',
  maxTags,
  error,
  helperText,
  className = '',
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef(null);

  const addTag = (text) => {
    const trimmed = text.trim().replace(/^,+|,+$/g, '');
    if (!trimmed) return;
    if (maxTags && tags.length >= maxTags) return;

    if (!tags.includes(trimmed)) {
      const nextTags = [...tags, trimmed];
      if (onChange) onChange(nextTags);
    }
    setInputValue('');
  };

  const removeTag = (indexToRemove) => {
    if (disabled) return;
    const nextTags = tags.filter((_, idx) => idx !== indexToRemove);
    if (onChange) onChange(nextTags);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const handleBlur = () => {
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`tf-tag-input-group ${className}`.trim()}>
      {label && <label className="tf-tag-input-label">{label}</label>}

      <div
        className={`tf-tag-input-box ${error ? 'has-error' : ''}`}
        onClick={handleContainerClick}
      >
        {tags.map((tag, idx) => (
          <span key={idx} className="tf-tag-chip">
            {tag}
            {!disabled && (
              <button
                type="button"
                className="tf-tag-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                aria-label={`Remove tag ${tag}`}
              >
                &times;
              </button>
            )}
          </span>
        ))}

        {!disabled && (!maxTags || tags.length < maxTags) && (
          <input
            ref={inputRef}
            type="text"
            className="tf-tag-native-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
          />
        )}
      </div>

      {error && <span className="tf-tag-input-error">{error}</span>}
      {!error && helperText && <span className="tf-tag-input-helper">{helperText}</span>}
    </div>
  );
};

export default TagInput;
