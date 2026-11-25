import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SafeLink from '../components/common/SafeLink';
import { isSafeHttpUrl, isExternalUrl } from '../utils/urlUtil';

describe('SafeLink Component & URL Security Validator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('isSafeHttpUrl validator', () => {
    it('accepts valid http and https URLs', () => {
      expect(isSafeHttpUrl('https://github.com/teamforge')).toBe(true);
      expect(isSafeHttpUrl('http://example.com/demo')).toBe(true);
      expect(isSafeHttpUrl('https://sub.domain.org/path?q=1&v=2#hash')).toBe(true);
    });

    it('rejects malicious or unsupported schemes', () => {
      expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false);
      expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeHttpUrl('ftp://ftp.example.com/file')).toBe(false);
    });

    it('rejects malformed or empty URLs', () => {
      expect(isSafeHttpUrl('')).toBe(false);
      expect(isSafeHttpUrl('   ')).toBe(false);
      expect(isSafeHttpUrl('not-a-url')).toBe(false);
      expect(isSafeHttpUrl('http:///no-host')).toBe(false);
    });

    it('rejects URLs exceeding 2048 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2040);
      expect(isSafeHttpUrl(longUrl)).toBe(false);
    });
  });

  describe('isExternalUrl validator', () => {
    it('identifies external destinations and rejects invalid URLs', () => {
      expect(isExternalUrl('https://google.com')).toBe(true);
      expect(isExternalUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('SafeLink component rendering', () => {
    it('renders safe HTTPS URL as clickable anchor', () => {
      render(
        <SafeLink href="https://github.com/teamforge/repo">
          View Repository
        </SafeLink>
      );

      const anchor = screen.getByTestId('safelink-anchor');
      expect(anchor).toBeDefined();
      expect(anchor.tagName).toBe('A');
      expect(anchor.getAttribute('href')).toBe('https://github.com/teamforge/repo');
      expect(screen.getByText('View Repository')).toBeDefined();
      expect(screen.queryByTestId('safelink-plain')).toBeNull();
    });

    it('renders dangerous javascript: link as plain text, never as clickable anchor', () => {
      render(
        <SafeLink href="javascript:alert('XSS')">
          Dangerous Link
        </SafeLink>
      );

      expect(screen.queryByTestId('safelink-anchor')).toBeNull();
      const plain = screen.getByTestId('safelink-plain');
      expect(plain).toBeDefined();
      expect(plain.tagName).toBe('SPAN');
      expect(screen.getByText('Dangerous Link')).toBeDefined();
    });

    it('renders dangerous data: URI as plain text', () => {
      render(
        <SafeLink href="data:text/html,<script>evil()</script>">
          Data URI Link
        </SafeLink>
      );

      expect(screen.queryByTestId('safelink-anchor')).toBeNull();
      const plain = screen.getByTestId('safelink-plain');
      expect(plain).toBeDefined();
    });

    it('renders URL exceeding 2048 characters as plain text', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2040);
      render(
        <SafeLink href={longUrl}>
          Excessive Length Link
        </SafeLink>
      );

      expect(screen.queryByTestId('safelink-anchor')).toBeNull();
      expect(screen.getByTestId('safelink-plain')).toBeDefined();
    });
  });

  describe('External Outbound Confirmation Modal Flow', () => {
    it('opens confirmation modal on clicking external link', () => {
      render(
        <SafeLink href="https://external-site.com/docs">
          External Documentation
        </SafeLink>
      );

      const anchor = screen.getByTestId('safelink-anchor');
      fireEvent.click(anchor);

      // Modal dialog should be displayed
      const dialog = screen.getByTestId('safelink-dialog');
      expect(dialog).toBeDefined();

      // Destination domain and full URL should be shown
      const domainEl = screen.getByTestId('safelink-domain');
      expect(domainEl.textContent).toContain('external-site.com');

      const fullUrlEl = screen.getByTestId('safelink-full-url');
      expect(fullUrlEl.textContent).toContain('https://external-site.com/docs');

      expect(screen.getByTestId('safelink-cancel-btn')).toBeDefined();
      expect(screen.getByTestId('safelink-continue-btn')).toBeDefined();
    });

    it('closes modal when Cancel button is clicked without navigating', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <SafeLink href="https://external-site.com/docs">
          External Documentation
        </SafeLink>
      );

      fireEvent.click(screen.getByTestId('safelink-anchor'));
      expect(screen.getByTestId('safelink-dialog')).toBeDefined();

      fireEvent.click(screen.getByTestId('safelink-cancel-btn'));
      expect(screen.queryByTestId('safelink-dialog')).toBeNull();
      expect(windowOpenSpy).not.toHaveBeenCalled();
    });

    it('opens external URL via window.open and closes modal when Continue is clicked', () => {
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      render(
        <SafeLink href="https://external-site.com/docs">
          External Documentation
        </SafeLink>
      );

      fireEvent.click(screen.getByTestId('safelink-anchor'));
      expect(screen.getByTestId('safelink-dialog')).toBeDefined();

      fireEvent.click(screen.getByTestId('safelink-continue-btn'));
      expect(screen.queryByTestId('safelink-dialog')).toBeNull();
      expect(windowOpenSpy).toHaveBeenCalledWith(
        'https://external-site.com/docs',
        '_blank',
        'noopener noreferrer'
      );
    });
  });
});
