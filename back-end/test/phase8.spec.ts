import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { getSecureCvsDir } from '../src/core/middleware/file-upload.middleware';

process.env.AUTH_MODE = 'jwt';
process.env.JWT_SECRET = 'teamforge-jwt-secret-key-development-minimum-32-chars';

import { AppModule } from '../src/app.module';

const PORT = 3346;
const BASE_URL = `http://localhost:${PORT}`;

function request(options: any, postData: any = null): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url || options.path, BASE_URL);
    const reqOptions: http.RequestOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data,
          raw: data,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      const body = typeof postData === 'string' ? postData : JSON.stringify(postData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(body));
      req.write(body);
    }
    req.end();
  });
}

function uploadFileMultipart(
  targetPath: string,
  fieldName: string,
  fileName: string,
  fileContent: Buffer | string,
  contentType: string,
  token?: string,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';
    const contentBuf = Buffer.isBuffer(fileContent) ? fileContent : Buffer.from(fileContent);

    const head = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"`,
      `Content-Type: ${contentType}`,
      '',
      '',
    ].join(crlf);

    const tail = `${crlf}--${boundary}--${crlf}`;

    const headBuf = Buffer.from(head, 'utf8');
    const tailBuf = Buffer.from(tail, 'utf8');
    const totalLength = headBuf.length + contentBuf.length + tailBuf.length;

    const headers: any = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': totalLength,
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: targetPath,
        method: 'POST',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, data: json || data, raw: data });
        });
      },
    );

    req.on('error', reject);
    req.write(headBuf);
    req.write(contentBuf);
    req.write(tailBuf);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Phase 8 Mentor CV Upload & DigiLocker Verification Test Suite...');

  let app: any = null;
  try {
    app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.listen(PORT);
  } catch (err: any) {
    console.error('Fatal error during NestFactory.create:', err);
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Authenticate Personas
    // Applicant: Arjun Sharma (id 2, role collaborator)
    const arjunLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'arjun.sharma@teamforge.io', password: 'password123' },
    );
    const applicantToken = arjunLogin.data?.accessToken;
    const applicantHeaders = { Authorization: `Bearer ${applicantToken}` };

    // Admin: Admin User (id 10)
    const adminLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'admin@teamforge.io', password: 'admin123' },
    );
    const adminToken = adminLogin.data?.accessToken;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // Unrelated User: Jathin (id u-owner)
    const jathinLogin = await request(
      { path: '/auth/login', method: 'POST' },
      { email: 'jathin@example.com', password: 'password123' },
    );
    const unrelatedToken = jathinLogin.data?.accessToken;
    const unrelatedHeaders = { Authorization: `Bearer ${unrelatedToken}` };

    // =========================================================================
    // Check 1: Non-PDF upload rejection
    // =========================================================================
    console.log('\n--- Check 1: Non-PDF Upload Rejection ---');
    const nonPdfRes = await uploadFileMultipart(
      '/uploads/cv',
      'file',
      'resume.txt',
      'This is a plain text resume.',
      'text/plain',
      applicantToken,
    );
    assert(
      nonPdfRes.status === 400 && String(nonPdfRes.data?.message || '').includes('Only PDF'),
      `Non-PDF upload rejected with 400 Bad Request (${nonPdfRes.status}: ${nonPdfRes.data?.message})`,
    );

    // =========================================================================
    // Check 2: Fake PDF with invalid magic bytes rejection
    // =========================================================================
    console.log('\n--- Check 2: Fake PDF (Magic Byte %PDF- Verification) ---');
    const fakePdfContent = Buffer.from('NOTAPDFCONTENT-THISISANEXECUTABLE');
    const fakePdfRes = await uploadFileMultipart(
      '/uploads/cv',
      'file',
      'fake.pdf',
      fakePdfContent,
      'application/pdf',
      applicantToken,
    );
    assert(
      fakePdfRes.status === 400 && String(fakePdfRes.data?.message || '').includes('%PDF-'),
      `Fake PDF with invalid magic bytes rejected with 400 Bad Request (${fakePdfRes.status}: ${fakePdfRes.data?.message})`,
    );

    // =========================================================================
    // Check 3: Valid PDF upload with %PDF- signature
    // =========================================================================
    console.log('\n--- Check 3: Valid PDF Upload with %PDF- Signature ---');
    const validPdfContent = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Arjun Sharma CV) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const validPdfRes = await uploadFileMultipart(
      '/uploads/cv',
      'file',
      'arjun-sharma-cv.pdf',
      validPdfContent,
      'application/pdf',
      applicantToken,
    );
    const uploadedCv = validPdfRes.data;
    assert(
      validPdfRes.status === 201 && uploadedCv?.filename && uploadedCv?.filename.endsWith('.pdf'),
      `Valid PDF uploaded successfully (status 201, filename: ${uploadedCv?.filename})`,
    );

    // Verify file actually exists in secure-cvs directory
    const secureCvPath = path.join(getSecureCvsDir(), uploadedCv.filename);
    assert(
      fs.existsSync(secureCvPath),
      `Uploaded CV is physically stored in secure directory outside public root (${secureCvPath})`,
    );

    // =========================================================================
    // Check 4: DigiLocker Status
    // =========================================================================
    console.log('\n--- Check 4: DigiLocker Sandbox Status ---');
    const digiStatusRes = await request(
      { path: '/mentor-applications/digilocker/status', method: 'GET', headers: applicantHeaders },
    );
    assert(
      digiStatusRes.status === 200 && digiStatusRes.data?.isSimulated === true && digiStatusRes.data?.mode === 'sandbox',
      `DigiLocker status reports simulated sandbox mode (${JSON.stringify(digiStatusRes.data)})`,
    );

    // =========================================================================
    // Check 5: Pulling DigiLocker documents with name matching
    // =========================================================================
    console.log('\n--- Check 5: Pulling DigiLocker Documents & Name Matching ---');
    const pullDocsRes = await request(
      { path: '/mentor-applications/digilocker/pull-documents', method: 'POST', headers: applicantHeaders },
      { applicantName: 'Arjun Sharma' },
    );
    const pulledDocs = pullDocsRes.data?.documents || [];
    const verifiedDoc = pulledDocs.find((d: any) => d.holderName.toLowerCase() === 'arjun sharma');
    const mismatchDoc = pulledDocs.find((d: any) => d.holderName.toLowerCase() !== 'arjun sharma');

    assert(
      pullDocsRes.status === 201 &&
      verifiedDoc?.verificationStatus === 'verified' &&
      mismatchDoc?.verificationStatus === 'mismatch',
      `DigiLocker pulls credentials with matching holder marked 'verified' and non-matching marked 'mismatch'`,
    );

    // =========================================================================
    // Check 6: Mentor application without CV rejected (400)
    // =========================================================================
    console.log('\n--- Check 6: Application Submission Without CV Rejected ---');
    const noCvAppRes = await request(
      { path: '/mentor-applications', method: 'POST', headers: applicantHeaders },
      {
        userId: '2',
        name: 'Arjun Sharma',
        email: 'arjun.sharma@teamforge.io',
        years: 5,
        skills: ['React', 'NestJS'],
        bio: 'Senior full stack mentor with 5 years experience guiding student teams.',
        certificates: pulledDocs,
      },
    );
    assert(
      noCvAppRes.status === 400 && String(noCvAppRes.data?.message || '').includes('CV upload'),
      `Application without CV rejected with 400 Bad Request (${noCvAppRes.status}: ${noCvAppRes.data?.message})`,
    );

    // =========================================================================
    // Check 7: Application without verified DigiLocker document rejected (400)
    // =========================================================================
    console.log('\n--- Check 7: Application Without Verified DigiLocker Document Rejected ---');
    const noCertAppRes = await request(
      { path: '/mentor-applications', method: 'POST', headers: applicantHeaders },
      {
        userId: '2',
        name: 'Arjun Sharma',
        email: 'arjun.sharma@teamforge.io',
        years: 5,
        skills: ['React', 'NestJS'],
        bio: 'Senior full stack mentor with 5 years experience guiding student teams.',
        cvFileName: uploadedCv.filename,
        cvOriginalName: uploadedCv.originalName,
        cvFileSize: uploadedCv.size,
        certificates: [mismatchDoc], // Only mismatch document
      },
    );
    assert(
      noCertAppRes.status === 400,
      `Application with only mismatched/no verified certificates rejected with 400 Bad Request (${noCertAppRes.status}: ${noCertAppRes.data?.message})`,
    );

    // =========================================================================
    // Check 8: Valid mentor application submission (201 Created)
    // =========================================================================
    console.log('\n--- Check 8: Valid Mentor Application Submission ---');
    const validAppRes = await request(
      { path: '/mentor-applications', method: 'POST', headers: applicantHeaders },
      {
        userId: '2',
        name: 'Arjun Sharma',
        email: 'arjun.sharma@teamforge.io',
        years: 5,
        skills: ['React', 'NestJS'],
        bio: 'Senior full stack mentor with 5 years experience guiding student teams.',
        cvFileName: uploadedCv.filename,
        cvOriginalName: uploadedCv.originalName,
        cvFileSize: uploadedCv.size,
        certificates: pulledDocs,
      },
    );
    const createdApp = validAppRes.data;
    assert(
      validAppRes.status === 201 &&
      createdApp?.status === 'pending' &&
      createdApp?.cvFileName === uploadedCv.filename &&
      Array.isArray(createdApp?.certificates) &&
      createdApp?.certificates.length > 0,
      `Valid mentor application created with verified CV and DigiLocker credentials (id: ${createdApp?.id}, status: ${createdApp?.status})`,
    );

    // =========================================================================
    // Check 9: CV Download Authorization (Self vs Admin vs Unrelated Caller)
    // =========================================================================
    console.log('\n--- Check 9: Authorized CV Download ---');
    // Applicant downloading own CV
    const ownDownloadRes = await request(
      { path: `/uploads/cv/${uploadedCv.filename}`, method: 'GET', headers: applicantHeaders },
    );
    assert(
      ownDownloadRes.status === 200 && ownDownloadRes.headers['content-type'] === 'application/pdf',
      `Applicant can download their own CV (status 200, Content-Type: ${ownDownloadRes.headers['content-type']})`,
    );

    // Admin downloading applicant CV
    const adminDownloadRes = await request(
      { path: `/uploads/cv/${uploadedCv.filename}`, method: 'GET', headers: adminHeaders },
    );
    assert(
      adminDownloadRes.status === 200,
      `Platform Administrator can download applicant CV (status 200)`,
    );

    // Unrelated user attempting to download Arjun's CV
    const unauthorizedDownloadRes = await request(
      { path: `/uploads/cv/${uploadedCv.filename}`, method: 'GET', headers: unrelatedHeaders },
    );
    assert(
      unauthorizedDownloadRes.status === 403,
      `Unrelated user is blocked from downloading another user's CV with 403 Forbidden (${unauthorizedDownloadRes.status})`,
    );

    // =========================================================================
    // Check 10: Admin rejection with custom reason
    // =========================================================================
    console.log('\n--- Check 10: Admin Rejection with Custom Reason ---');
    const rejectionReason = 'Requires additional architectural experience in production distributed systems.';
    const rejectRes = await request(
      { path: `/mentor-applications/${createdApp.id}/reject`, method: 'PUT', headers: adminHeaders },
      { reason: rejectionReason },
    );
    assert(
      rejectRes.status === 200 &&
      rejectRes.data?.status === 'rejected' &&
      rejectRes.data?.rejectionReason === rejectionReason,
      `Admin successfully rejected application with custom reason recorded (${rejectRes.data?.rejectionReason})`,
    );

  } catch (err: any) {
    console.error('Test execution exception:', err);
    failed++;
  } finally {
    if (app) {
      await app.close();
    }
  }

  console.log('\n==================================================');
  console.log(`Phase 8 Verification Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
