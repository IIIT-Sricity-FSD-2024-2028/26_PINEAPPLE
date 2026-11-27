/**
 * Returns visual styles and icons for a Trust Label.
 */
export function getTrustLabelConfig(label) {
  switch (label) {
    case 'Trusted contributor':
      return {
        variant: 'success',
        icon: '★',
        bg: '#ecfdf5',
        color: '#065f46',
        border: '#a7f3d0',
      };
    case 'Reliable':
      return {
        variant: 'primary',
        icon: '✓',
        bg: '#eff6ff',
        color: '#1e40af',
        border: '#bfdbfe',
      };
    case 'Rising':
      return {
        variant: 'info',
        icon: '↗',
        bg: '#f5f3ff',
        color: '#5b21b6',
        border: '#ddd6fe',
      };
    case 'New member':
      return {
        variant: 'secondary',
        icon: '🌱',
        bg: '#f0fdfa',
        color: '#115e59',
        border: '#99f6e4',
      };
    case 'Getting started':
    default:
      return {
        variant: 'secondary',
        icon: '•',
        bg: '#f8fafc',
        color: '#475569',
        border: '#e2e8f0',
      };
  }
}

/**
 * Returns visual styles for a Standing Band.
 */
export function getStandingBandConfig(band) {
  switch (band) {
    case 'Good standing':
      return {
        variant: 'success',
        bg: '#ecfdf5',
        color: '#047857',
        border: '#a7f3d0',
      };
    case 'Fair standing':
      return {
        variant: 'warning',
        bg: '#fffbeb',
        color: '#b45309',
        border: '#fde68a',
      };
    case 'Low standing':
    default:
      return {
        variant: 'danger',
        bg: '#fff1f2',
        color: '#be123c',
        border: '#fecdd3',
      };
  }
}
