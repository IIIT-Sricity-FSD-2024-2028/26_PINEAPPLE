export const CREDENTIAL_STATUS = {
  VERIFIED: 'verified',
  NAME_MISMATCH: 'name_mismatch',
  UNVERIFIED: 'unverified',
  FAILED: 'failed',
};

export const CREDENTIAL_STATUS_LABELS = {
  [CREDENTIAL_STATUS.VERIFIED]: 'Verified',
  [CREDENTIAL_STATUS.NAME_MISMATCH]: 'Name Mismatch',
  [CREDENTIAL_STATUS.UNVERIFIED]: 'Unverified',
  [CREDENTIAL_STATUS.FAILED]: 'Verification Failed',
};

export const CREDENTIAL_STATUS_BADGES = {
  [CREDENTIAL_STATUS.VERIFIED]: 'verified',
  [CREDENTIAL_STATUS.NAME_MISMATCH]: 'name-mismatch',
  [CREDENTIAL_STATUS.UNVERIFIED]: 'unverified',
  [CREDENTIAL_STATUS.FAILED]: 'danger',
};

export default CREDENTIAL_STATUS;
