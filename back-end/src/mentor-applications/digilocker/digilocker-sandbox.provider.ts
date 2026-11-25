import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DigiLockerDocument, DigiLockerProvider, CredentialStatus } from './digilocker-document.interface';

const HONORIFICS = new Set([
  'mr',
  'mrs',
  'ms',
  'miss',
  'dr',
  'prof',
  'professor',
  'shri',
  'smt',
  'sir',
  'madam',
  'er',
  'ca',
  'md',
  'phd',
]);

/**
 * Normalises a name by trimming, lowercasing, collapsing spaces,
 * stripping dots and common punctuation, and removing honorifics.
 */
export function normalizeDigiLockerTokens(name: string): string[] {
  if (!name || typeof name !== 'string') return [];
  const lower = name.toLowerCase().trim();
  const stripped = lower.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ');
  return stripped
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !HONORIFICS.has(t));
}

/**
 * Compares two names for DigiLocker credential verification:
 * Returns true if equal token sets or exact normalised match.
 * Rejects substring matches (e.g., "Ali" vs "Alice" or "John" vs "Johnathan").
 */
export function isDigiLockerNameMatch(nameA: string, nameB: string): boolean {
  const tokensA = normalizeDigiLockerTokens(nameA);
  const tokensB = normalizeDigiLockerTokens(nameB);

  if (tokensA.length === 0 || tokensB.length === 0) {
    return false;
  }

  // 1. Exact normalised string match
  if (tokensA.join(' ') === tokensB.join(' ')) {
    return true;
  }

  // 2. Equal token sets (token set equality / reordered tokens)
  if (tokensA.length === tokensB.length) {
    const sortedA = [...tokensA].sort().join(' ');
    const sortedB = [...tokensB].sort().join(' ');
    if (sortedA === sortedB) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class DigiLockerSandboxProvider implements DigiLockerProvider {
  readonly mode = 'sandbox' as const;
  readonly isAvailable = true;

  async getConsentUrl(applicantId: string): Promise<string> {
    return `/mentor/apply?digilocker_consent=sandbox&applicantId=${encodeURIComponent(applicantId)}`;
  }

  async fetchIssuedDocuments(_token: string, applicantName: string): Promise<DigiLockerDocument[]> {
    const cleanName = (applicantName || 'Applicant').trim();
    const docs: DigiLockerDocument[] = [
      {
        id: 'dl-doc-1',
        documentType: 'DEGREE_CERTIFICATE',
        docType: 'DEGREE_CERTIFICATE',
        documentNumber: 'DEG-IITB-2023-88492',
        docNumber: 'DEG-IITB-2023-88492',
        docTitle: 'Bachelor of Technology in Computer Science & Engineering',
        title: 'Bachelor of Technology in Computer Science & Engineering',
        name: 'Bachelor of Technology in Computer Science & Engineering',
        issuer: 'Indian Institute of Technology Bombay',
        issueDate: '2023-06-25',
        holderName: cleanName,
        status: CredentialStatus.UNVERIFIED,
        verificationStatus: 'unverified',
        isSimulated: true,
      },
      {
        id: 'dl-doc-2',
        documentType: 'COURSE_CERTIFICATE',
        docType: 'COURSE_CERTIFICATE',
        documentNumber: 'CERT-STAN-2024-11029',
        docNumber: 'CERT-STAN-2024-11029',
        docTitle: 'Advanced Cloud Architecture & Distributed Systems Specialization',
        title: 'Advanced Cloud Architecture & Distributed Systems Specialization',
        name: 'Advanced Cloud Architecture & Distributed Systems Specialization',
        issuer: 'Stanford Online / Coursera',
        issueDate: '2024-03-14',
        holderName: cleanName,
        status: CredentialStatus.UNVERIFIED,
        verificationStatus: 'unverified',
        isSimulated: true,
      },
      {
        id: 'dl-doc-3',
        documentType: 'DIPLOMA_CERTIFICATE',
        docType: 'DIPLOMA_CERTIFICATE',
        documentNumber: 'DIP-IIITH-2024-34901',
        docNumber: 'DIP-IIITH-2024-34901',
        docTitle: 'Executive Diploma in Artificial Intelligence & Machine Learning (Demo Mismatch Example)',
        title: 'Executive Diploma in Artificial Intelligence & Machine Learning (Demo Mismatch Example)',
        name: 'Executive Diploma in Artificial Intelligence & Machine Learning (Demo Mismatch Example)',
        issuer: 'IIIT Hyderabad',
        issueDate: '2024-11-05',
        holderName: 'Kavita Verma (Demo Mismatch Example)',
        status: CredentialStatus.NAME_MISMATCH,
        verificationStatus: 'mismatch',
        mismatchReason: 'Holder name does not match your profile name',
        isSimulated: true,
      },
    ];

    return docs.map((d) => this.verifyDocument(d, cleanName));
  }

  verifyDocument(doc: DigiLockerDocument, applicantName: string): DigiLockerDocument {
    const isMatch = isDigiLockerNameMatch(applicantName, doc.holderName);

    if (isMatch) {
      return {
        ...doc,
        status: CredentialStatus.VERIFIED,
        verificationStatus: 'verified',
        verificationId: doc.verificationId || `DL-SBX-${randomUUID().slice(0, 8).toUpperCase()}`,
        verifiedAt: doc.verifiedAt || new Date().toISOString(),
        isSimulated: true,
      };
    } else {
      return {
        ...doc,
        status: CredentialStatus.NAME_MISMATCH,
        verificationStatus: 'mismatch',
        mismatchReason: 'Holder name does not match your profile name',
        isSimulated: true,
      };
    }
  }
}
