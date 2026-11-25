export enum CredentialStatus {
  VERIFIED = 'verified',
  NAME_MISMATCH = 'name_mismatch',
  UNVERIFIED = 'unverified',
  FAILED = 'failed',
}

export type CredentialStatusType = 'verified' | 'name_mismatch' | 'unverified' | 'failed';

export interface DigiLockerDocument {
  id: string;
  issuer: string;
  documentType: string;
  documentNumber: string;
  holderName: string;
  issueDate: string;
  status: CredentialStatusType;
  verificationStatus?: CredentialStatusType | 'mismatch'; // for backward compatibility
  verificationId?: string;
  verifiedAt?: string;
  mismatchReason?: string;
  isSimulated?: boolean;
  // Aliases for seamless rendering
  title?: string;
  name?: string;
  docType?: string;
  docTitle?: string;
  docNumber?: string;
}

export interface DigiLockerProvider {
  readonly mode: 'sandbox' | 'real';
  readonly isAvailable: boolean;
  getConsentUrl(applicantId: string): Promise<string>;
  fetchIssuedDocuments(authCodeOrConsentToken: string, applicantName: string): Promise<DigiLockerDocument[]>;
  verifyDocument(doc: DigiLockerDocument, applicantName: string): DigiLockerDocument;
}
