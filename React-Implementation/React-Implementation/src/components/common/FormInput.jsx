import './FormInput.css';

/**
 * Reusable controlled form input / textarea with validation message support.
 * @param {Object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {string|number} props.value
 * @param {(e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => void} props.onChange
 * @param {string} [props.type='text']
 * @param {string} [props.placeholder='']
 * @param {string} [props.error='']
 * @param {string} [props.helperText='']
 * @param {boolean} [props.required=false]
 * @param {boolean} [props.multiline=false]
 * @param {number} [props.rows=3]
 * @param {boolean} [props.disabled=false]
 */
const FormInput = ({
  label,
  name,
  id,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  error = '',
  helperText = '',
  required = false,
  multiline = false,
  rows = 3,
  disabled = false,
  className = '',
  children,
  options = null,
  ...rest
}) => {
  const inputId = id || name;
  return (
    <div className={`tf-form-group ${error ? 'tf-form-group--error' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="tf-form-label">
          {label} {required && <span className="tf-form-required">*</span>}
        </label>
      )}

      {options || type === 'select' || children ? (
        <select
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="tf-form-control"
          {...rest}
        >
          {options
            ? options.map((opt) => {
                const optVal = typeof opt === 'object' ? opt.value : opt;
                const optLbl = typeof opt === 'object' ? opt.label : opt;
                return (
                  <option key={optVal} value={optVal}>
                    {optLbl}
                  </option>
                );
              })
            : children}
        </select>
      ) : multiline ? (
        <textarea
          id={inputId}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className="tf-form-control tf-form-control--textarea"
          {...rest}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className="tf-form-control"
          {...rest}
        />
      )}

      {error ? (
        <p className="tf-form-error">{error}</p>
      ) : helperText ? (
        <p className="tf-form-helper">{helperText}</p>
      ) : null}
    </div>
  );
};

export default FormInput;
