import './SearchBar.css';

/**
 * Reusable controlled search bar with clear button.
 * @param {Object} props
 * @param {string} props.value
 * @param {(e: React.ChangeEvent<HTMLInputElement>) => void} props.onChange
 * @param {string} [props.placeholder='Search...']
 * @param {() => void} [props.onClear]
 * @param {string} [props.className='']
 * @param {string} [props.type='search']
 */
const SearchBar = ({
  value = '',
  onChange,
  placeholder = 'Search...',
  onClear,
  className = '',
  type = 'search',
  ...rest
}) => {
  return (
    <div className={`tf-searchbar ${className}`.trim()}>
      <span className="tf-searchbar-icon" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type={type}
        className="tf-searchbar-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...rest}
      />
      {value && onClear && (
        <button
          type="button"
          className="tf-searchbar-clear"
          onClick={onClear}
          aria-label="Clear search"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBar;

