import { isValidElement } from 'react';
import EmptyState from './EmptyState';
import './DataTable.css';

/**
 * Reusable DataTable component supporting column definitions, custom cell renderers,
 * loading skeleton placeholders, integrated EmptyState, and accessible row click events.
 * 
 * @param {Object} props
 * @param {Array<{
 *   key: string,
 *   header: React.ReactNode,
 *   render?: (row: Object, index: number) => React.ReactNode,
 *   align?: 'left'|'center'|'right',
 *   width?: string,
 *   className?: string,
 *   headerClassName?: string
 * }>} props.columns
 * @param {Array<Object>} props.data
 * @param {string|((row: Object, index: number) => string|number)} [props.keyField='id']
 * @param {boolean} [props.loading=false]
 * @param {number} [props.loadingRows=4]
 * @param {string} [props.loadingMessage='Loading data...']
 * @param {string} [props.emptyTitle='No data available']
 * @param {string} [props.emptyMessage='There are no records to display at this time.']
 * @param {string} [props.emptyActionLabel]
 * @param {() => void} [props.onEmptyAction]
 * @param {React.ReactNode} [props.emptyState]
 * @param {(row: Object, index: number) => void} [props.onRowClick]
 * @param {string|((row: Object, index: number) => string)} [props.rowClassName]
 * @param {string} [props.className='']
 * @param {string} [props.tableClassName='']
 * @param {boolean} [props.bordered=false]
 */
const DataTable = ({
  columns = [],
  data = [],
  keyField = 'id',
  loading = false,
  loadingRows = 4,
  loadingMessage,
  loadingText,
  emptyTitle = 'No data available',
  emptyMessage = 'There are no records to display at this time.',
  emptyActionLabel,
  onEmptyAction,
  emptyState,
  onRowClick,
  rowClassName,
  className = '',
  tableClassName = '',
  bordered = false,
}) => {
  const effectiveLoadingText = loadingText || loadingMessage;

  const getRowKey = (row, index) => {
    if (typeof keyField === 'function') {
      return keyField(row, index);
    }
    return row[keyField] ?? index;
  };

  const getComputedRowClass = (row, index) => {
    let custom = '';
    if (typeof rowClassName === 'function') {
      custom = rowClassName(row, index);
    } else if (typeof rowClassName === 'string') {
      custom = rowClassName;
    }
    return `tf-datatable-row ${onRowClick ? 'tf-datatable-row--clickable' : ''} ${custom}`.trim();
  };

  return (
    <div className={`tf-datatable-wrapper ${bordered ? 'tf-datatable-wrapper--bordered' : ''} ${className}`.trim()}>
      <div className="tf-datatable-scroll">
        <table className={`tf-datatable ${tableClassName}`.trim()}>
          <thead>
            <tr>
              {columns.map((col, idx) => {
                const alignClass = col.align ? `tf-datatable-align-${col.align}` : '';
                return (
                  <th
                    key={col.key || col.accessor || idx}
                    style={col.width ? { width: col.width } : undefined}
                    className={`${alignClass} ${col.headerClassName || ''}`.trim()}
                    scope="col"
                  >
                    {col.header ?? col.label ?? col.title}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              effectiveLoadingText ? (
                <tr className="tf-datatable-loading-row">
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--muted-fg, #6b7280)' }}>
                    <span>{effectiveLoadingText}</span>
                  </td>
                </tr>
              ) : (
                Array.from({ length: loadingRows }).map((_, rIdx) => (
                  <tr key={`skeleton-${rIdx}`} className="tf-datatable-skeleton-row">
                    {columns.map((col, cIdx) => (
                      <td key={`skeleton-cell-${cIdx}`}>
                        <div className="tf-datatable-skeleton-bar" />
                      </td>
                    ))}
                  </tr>
                ))
              )
            ) : data && data.length > 0 ? (
              data.map((row, rIdx) => (
                <tr
                  key={getRowKey(row, rIdx)}
                  className={getComputedRowClass(row, rIdx)}
                  onClick={onRowClick ? () => onRowClick(row, rIdx) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onRowClick(row, rIdx);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((col, cIdx) => {
                    const fieldKey = col.key || col.accessor;
                    const alignClass = col.align ? `tf-datatable-align-${col.align}` : '';
                    let content;
                    if (typeof col.render === 'function') {
                      content = col.render(row, rIdx);
                    } else if (fieldKey && row && row[fieldKey] !== undefined) {
                      content = row[fieldKey];
                    } else {
                      content = null;
                    }

                    // Guard against non-element objects being rendered as string [object Object]
                    if (content !== null && typeof content === 'object' && !isValidElement(content)) {
                      content = content.name || content.title || content.label || JSON.stringify(content);
                    }
                    return (
                      <td
                        key={fieldKey || cIdx}
                        className={`${alignClass} ${col.className || ''}`.trim()}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : null}
          </tbody>
        </table>
      </div>

      {!loading && (!data || data.length === 0) && (
        <div className="tf-datatable-empty-wrap">
          {emptyState || (
            <EmptyState
              title={emptyTitle}
              message={emptyMessage}
              actionLabel={emptyActionLabel}
              onAction={onEmptyAction}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
