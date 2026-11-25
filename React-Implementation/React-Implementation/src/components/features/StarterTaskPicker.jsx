import { STARTER_TASK_CONSTRAINTS, formatStarterTaskError } from '../../constants/projectCategories';
import './StarterTaskPicker.css';

const EFFORT_LABELS = {
  small: 'Small · 10 XP',
  medium: 'Medium · 20 XP',
  large: 'Large · 40 XP',
};

const StarterTaskPicker = ({
  category = 'General',
  templates = [],
  loading = false,
  existingTitles = [],
  selectedKeys = [],
  overrides = {},
  onToggleKey,
  onToggleAll,
  onChangeOverride,
  error = '',
  skipped = [],
  headerExtra = null,
}) => {
  const existingSet = new Set(
    (Array.isArray(existingTitles) ? existingTitles : [])
      .map((t) => String(t || '').trim().toLowerCase())
      .filter(Boolean),
  );

  const selectedSet = new Set(Array.isArray(selectedKeys) ? selectedKeys : []);

  const itemsWithState = (Array.isArray(templates) ? templates : []).map((tpl) => {
    const edited = overrides?.[tpl.key] || {};
    const title = edited.title !== undefined ? edited.title : tpl.title;
    const description = edited.description !== undefined ? edited.description : tpl.description;
    const isAlreadyAdded =
      existingSet.has(String(tpl.title || '').trim().toLowerCase()) ||
      existingSet.has(String(title || '').trim().toLowerCase());
    const checked = !isAlreadyAdded && selectedSet.has(tpl.key);
    const titleLen = String(title || '').trim().length;
    const descLen = String(description || '').trim().length;
    const titleInvalid =
      checked &&
      (titleLen < STARTER_TASK_CONSTRAINTS.minTitleLength ||
        titleLen > STARTER_TASK_CONSTRAINTS.maxTitleLength);
    const descInvalid =
      checked &&
      (descLen < STARTER_TASK_CONSTRAINTS.minDescriptionLength ||
        descLen > STARTER_TASK_CONSTRAINTS.maxDescriptionLength);

    return {
      tpl,
      title,
      description,
      isAlreadyAdded,
      checked,
      titleLen,
      descLen,
      titleInvalid,
      descInvalid,
    };
  });

  const selectableItems = itemsWithState.filter((i) => !i.isAlreadyAdded);
  const selectedCount = itemsWithState.filter((i) => i.checked).length;

  return (
    <div className="tf-starter-picker" data-testid="starter-task-picker">
      <div className="tf-starter-picker-header">
        <div className="tf-starter-picker-meta">
          <span>
            Category: <strong>{category || 'General'}</strong>
          </span>
          <span className="tf-starter-count-pill" data-testid="starter-selected-count">
            {selectedCount} of {selectableItems.length} selected
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectableItems.length > 0 && onToggleAll && (
            <button
              type="button"
              className="tf-owned-ws-btn-secondary"
              data-testid="starter-toggle-all-btn"
              onClick={() => onToggleAll(selectableItems.map((i) => i.tpl.key))}
              style={{ fontSize: '0.8rem', padding: '5px 10px' }}
            >
              {selectedCount === selectableItems.length ? 'Unselect all' : 'Select all'}
            </button>
          )}
          {headerExtra}
        </div>
      </div>

      {error && (
        <div className="tf-starter-alert tf-starter-alert--error" role="alert" data-testid="starter-picker-error">
          {error}
        </div>
      )}

      {Array.isArray(skipped) && skipped.length > 0 && (
        <div className="tf-starter-alert tf-starter-alert--warning" role="status" data-testid="starter-skipped-banner">
          <strong>Skipped {skipped.length} item(s):</strong>
          <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
            {skipped.map((item, idx) => (
              <li key={`${item.key || idx}-${idx}`}>
                <code>{item.key}</code>: {formatStarterTaskError(item.code, item.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          Loading starter task templates...
        </div>
      ) : itemsWithState.length === 0 ? (
        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
          No starter task templates found for this category.
        </div>
      ) : (
        <div className="tf-starter-list">
          {itemsWithState.map(({
            tpl,
            title,
            description,
            isAlreadyAdded,
            checked,
            titleLen,
            descLen,
            titleInvalid,
            descInvalid,
          }) => {
            const effort = tpl.effort || 'medium';
            return (
              <div
                key={tpl.key}
                data-testid={`starter-item-${tpl.key}`}
                className={`tf-starter-item ${
                  isAlreadyAdded
                    ? 'tf-starter-item--added'
                    : checked
                      ? 'tf-starter-item--selected'
                      : ''
                }`.trim()}
              >
                <div className="tf-starter-item-top">
                  <label className="tf-starter-check-label">
                    <input
                      type="checkbox"
                      data-testid={`starter-checkbox-${tpl.key}`}
                      checked={isAlreadyAdded ? true : checked}
                      disabled={isAlreadyAdded}
                      onChange={() => onToggleKey && onToggleKey(tpl.key)}
                    />
                    <span>{isAlreadyAdded ? 'Included in project' : 'Include task'}</span>
                  </label>

                  <div className="tf-starter-badges">
                    <span className={`tf-starter-effort tf-starter-effort--${effort}`}>
                      {EFFORT_LABELS[effort] || effort}
                    </span>
                    {isAlreadyAdded && (
                      <span
                        className="tf-starter-added-badge"
                        data-testid={`starter-added-badge-${tpl.key}`}
                      >
                        Already added
                      </span>
                    )}
                  </div>
                </div>

                <div className="tf-starter-fields">
                  <div>
                    <input
                      type="text"
                      aria-label={`Starter task title for ${tpl.key}`}
                      data-testid={`starter-title-${tpl.key}`}
                      className="tf-starter-input"
                      value={title}
                      disabled={isAlreadyAdded}
                      maxLength={STARTER_TASK_CONSTRAINTS.maxTitleLength}
                      onChange={(e) =>
                        onChangeOverride &&
                        onChangeOverride(tpl.key, { title: e.target.value, description })
                      }
                    />
                    <div className={`tf-starter-field-hint ${titleInvalid ? 'tf-starter-field-hint--error' : ''}`}>
                      Title: {titleLen}/{STARTER_TASK_CONSTRAINTS.maxTitleLength} chars (5–80)
                    </div>
                  </div>

                  <div>
                    <textarea
                      rows={2}
                      aria-label={`Starter task description for ${tpl.key}`}
                      data-testid={`starter-desc-${tpl.key}`}
                      className="tf-starter-input"
                      value={description}
                      disabled={isAlreadyAdded}
                      maxLength={STARTER_TASK_CONSTRAINTS.maxDescriptionLength}
                      onChange={(e) =>
                        onChangeOverride &&
                        onChangeOverride(tpl.key, { title, description: e.target.value })
                      }
                    />
                    <div className={`tf-starter-field-hint ${descInvalid ? 'tf-starter-field-hint--error' : ''}`}>
                      Description: {descLen}/{STARTER_TASK_CONSTRAINTS.maxDescriptionLength} chars (20–300)
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StarterTaskPicker;
