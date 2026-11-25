import { Injectable, Logger } from '@nestjs/common';
import { DigiLockerDocument, DigiLockerProvider } from './digilocker-document.interface';

@Injectable()
export class DigiLockerRealProvider implements DigiLockerProvider {
  readonly mode = 'real' as const;
  private readonly logger = new Logger(DigiLockerRealProvider.name);

  get isAvailable(): boolean {
    return Boolean(
      process.env.DIGILOCKER_CLIENT_ID &&
      process.env.DIGILOCKER_CLIENT_SECRET &&
      process.env.DIGILOCKER_REDIRECT_URI
    );
  }

  async getConsentUrl(applicantId: string): Promise<string> {
    if (!this.isAvailable) {
      throw new Error(
        'DigiLocker Real integration is not configured. DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET, and DIGILOCKER_REDIRECT_URI must be provided in environment variables.'
      );
    }
    const clientId = process.env.DIGILOCKER_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.DIGILOCKER_REDIRECT_URI!);
    // Public DigiLocker OAuth2 Authorize endpoint
    return `https://api.digitallocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${encodeURIComponent(applicantId)}`;
  }

  async fetchIssuedDocuments(authCode: string, applicantName: string): Promise<DigiLockerDocument[]> {
    if (!this.isAvailable) {
      throw new Error('DigiLocker Real integration disabled: missing environment variables.');
    }
    this.logger.log(`Exchanging authCode for DigiLocker token: ${authCode.slice(0, 6)}...`);
    // TODO: Connect to official API Setu DigiLocker gateway endpoints once developer requester credentials are provisioned
    // Endpoint: POST https://api.digitallocker.gov.in/public/oauth2/1/token
    // Endpoint: GET https://api.digitallocker.gov.in/public/oauth2/2/xml/issued
    return [];
  }

  verifyDocument(doc: DigiLockerDocument, applicantName: string): DigiLockerDocument {
    const targetName = (applicantName || '').trim().toLowerCase();
    const holder = (doc.holderName || '').trim().toLowerCase();
    if (targetName && holder === targetName) {
      return {
        ...doc,
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString(),
        isSimulated: false,
      };
    }
    return {
      ...doc,
      verificationStatus: 'mismatch',
      mismatchReason: `Name mismatch: ${doc.holderName} !== ${applicantName}`,
      isSimulated: false,
    };
  }
}
