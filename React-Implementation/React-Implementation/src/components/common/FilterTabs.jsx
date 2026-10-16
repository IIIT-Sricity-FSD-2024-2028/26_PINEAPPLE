import './FilterTabs.css';

/**
 * Reusable tab / filter pills component.
 * @param {Object} props
 * @param {Array<{ id: string, label: string, count?: number|string } | string>} props.tabs
 * @param {string} props.activeTab
 * @param {(tabId: string) => void} props.onChange
 * @param {string} [props.className='']
 * @param {string} [props.ariaLabel='Filters']
 */
const FilterTabs = ({ tabs = [], activeTab, onChange, className = '', ariaLabel = 'Filters' }) => {
  return (
    <div className={`tf-filter-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const id = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const count = typeof tab === 'object' ? tab.count : undefined;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tf-filter-tab ${isActive ? 'active is-active' : ''}`}
            onClick={() => onChange(id)}
          >
            <span>{label}</span>
            {count !== undefined && count !== null && (
              <span className="tf-filter-tab-count">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default FilterTabs;
