import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getAllSourceFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'test' && file !== '__tests__' && file !== 'node_modules') {
        getAllSourceFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('RoleStore Architectural Scan Test', () => {
  const srcDir = path.resolve(__dirname, '..');
  const allFiles = getAllSourceFiles(srcDir);

  it('asserts no file outside roleStore.js and storage.js reads or writes role in storage', () => {
    const offendingFiles = [];

    for (const filePath of allFiles) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      if (rel === 'utils/roleStore.js' || rel === 'utils/storage.js') {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      if (
        content.includes('storage.getRole') ||
        content.includes('storage.setRole') ||
        content.includes("localStorage.getItem('teamforge.role')") ||
        content.includes('localStorage.getItem("teamforge.role")') ||
        content.includes("sessionStorage.getItem('teamforge.role')") ||
        content.includes('sessionStorage.getItem("teamforge.role")')
      ) {
        offendingFiles.push(rel);
      }
    }

    expect(offendingFiles).toEqual([]);
  });

  it('asserts no UI component derives displayed role from location.pathname', () => {
    const offendingFiles = [];

    for (const filePath of allFiles) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      if (rel.startsWith('routes/')) {
        // Route guards are allowed to check location.pathname to sync role on deep-links
        continue;
      }
      if (rel === 'services/apiClient.js' || rel === 'App.jsx') {
        // App-level routing / admin mode check
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      if (
        (content.includes('location.pathname.startsWith(\'/owner\')') ||
          content.includes('location.pathname.startsWith(\'/mentor\')') ||
          content.includes('location.pathname.startsWith("/owner")') ||
          content.includes('location.pathname.startsWith("/mentor")')) &&
        (content.includes('currentRole') || content.includes('activeRole'))
      ) {
        offendingFiles.push(rel);
      }
    }

    expect(offendingFiles).toEqual([]);
  });
});
