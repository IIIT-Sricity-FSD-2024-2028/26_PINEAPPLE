import { jest } from '@jest/globals';
import { isSafeHttpUrl, assertSafeHttpUrl } from './url.util';
import { BadRequestException } from '@nestjs/common';

describe('url.util unit tests', () => {
  describe('isSafeHttpUrl', () => {
    it('accepts standard https URLs', () => {
      expect(isSafeHttpUrl('https://example.com')).toBe(true);
      expect(isSafeHttpUrl('https://sub.domain.org/path/page?q=test#hash')).toBe(true);
    });

    it('accepts standard http URLs', () => {
      expect(isSafeHttpUrl('http://example.com')).toBe(true);
      expect(isSafeHttpUrl('http://localhost:3000/api')).toBe(true);
    });

    it('rejects javascript: URLs', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('javascript:void(0)')).toBe(false);
    });

    it('rejects mixed-case scheme JAVASCRIPT: URLs', () => {
      expect(isSafeHttpUrl('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('JavaScriPt:alert(document.cookie)')).toBe(false);
    });

    it('rejects data: URLs', () => {
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeHttpUrl('DATA:text/plain;base64,SGVsbG8=')).toBe(false);
    });

    it('rejects ftp: URLs', () => {
      expect(isSafeHttpUrl('ftp://files.example.com/file.zip')).toBe(false);
      expect(isSafeHttpUrl('FTP://files.example.com')).toBe(false);
    });

    it('rejects empty and whitespace-only strings', () => {
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('   ')).toBe(false);
      expect(isSafeHttpUrl(null)).toBe(false);
      expect(isSafeHttpUrl(undefined)).toBe(false);
      expect(isSafeHttpUrl(12345)).toBe(false);
    });

    it('rejects URLs exceeding 2048 characters', () => {
      const validBase = 'https://example.com/';
      const longUrl2048 = validBase + 'a'.repeat(2048 - validBase.length);
      expect(longUrl2048.length).toBe(2048);
      expect(isSafeHttpUrl(longUrl2048)).toBe(true);

      const longUrl2049 = validBase + 'a'.repeat(2049 - validBase.length);
      expect(longUrl2049.length).toBe(2049);
      expect(isSafeHttpUrl(longUrl2049)).toBe(false);
    });

    it('rejects URLs with no host', () => {
      expect(isSafeHttpUrl('http://')).toBe(false);
      expect(isSafeHttpUrl('https://')).toBe(false);
      expect(isSafeHttpUrl('http:///')).toBe(false);
      expect(isSafeHttpUrl('http:///path')).toBe(false);
    });
  });

  describe('assertSafeHttpUrl', () => {
    it('does not throw for valid URL', () => {
      expect(() => assertSafeHttpUrl('https://github.com/teamforge')).not.toThrow();
    });

    it('throws BadRequestException with INVALID_URL code on invalid URL', () => {
      const mockAudit = { log: jest.fn() };
      let error: any;
      try {
        assertSafeHttpUrl('javascript:alert(1)', 'proofLink', 'user-123', mockAudit);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(BadRequestException);
      const res = error.getResponse();
      expect(res.statusCode).toBe(400);
      expect(res.code).toBe('INVALID_URL');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INVALID_URL_REJECTED',
          actor: 'user-123',
          target: 'proofLink',
          details: { userId: 'user-123', field: 'proofLink' },
        }),
      );
    });
  });
});
