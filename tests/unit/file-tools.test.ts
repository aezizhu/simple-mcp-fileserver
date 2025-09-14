/**
 * File Tools Unit Tests
 *
 * Comprehensive unit tests for file operation tools.
 * Tests file reading, writing, directory listing, and search functionality.
 *
 * @author aezizhu
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileOperationTools } from '../../src/tools/file-tools';
import { Logger } from '../../src/types/mcp';

describe('FileOperationTools', () => {
  let fileTools: FileOperationTools;
  let mockLogger: Logger;
  let testDir: string;
  let testFile: string;
  let testImage: string;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as Logger;

    fileTools = new FileOperationTools(mockLogger);
    testDir = join(tmpdir(), 'mcp-filebridge-test-' + Date.now());
    testFile = join(testDir, 'test.txt');
    testImage = join(testDir, 'test.jpg');
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('executeReadFile', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testFile, 'Hello, World!\nThis is a test file.');
    });

    it('should read a text file successfully', async () => {
      const result = await fileTools.executeReadFile({
        path: testFile,
        encoding: 'utf8'
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toContain('Hello, World!');
      expect(result.content[0].text).toContain('test.txt');
      expect(mockLogger.info).toHaveBeenCalledWith('File read completed', expect.any(Object));
    });

    it('should handle non-existent files', async () => {
      const nonexistentFile = join(testDir, 'nonexistent.txt');

      await expect(fileTools.executeReadFile({
        path: nonexistentFile
      })).rejects.toThrow('File access denied');

      expect(mockLogger.error).toHaveBeenCalledWith('File read failed', expect.any(Error), expect.any(Object));
    });

    it('should respect max_size limit', async () => {
      await expect(fileTools.executeReadFile({
        path: testFile,
        max_size: 5 // Very small limit
      })).rejects.toThrow('File too large');

      expect(mockLogger.error).toHaveBeenCalledWith('File read failed', expect.any(Error), expect.any(Object));
    });

    it('should auto-detect encoding', async () => {
      const result = await fileTools.executeReadFile({
        path: testFile,
        encoding: 'auto'
      });

      expect(result.content[0].text).toContain('utf8');
    });
  });

  describe('executeWriteFile', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
    });

    it('should write a file successfully', async () => {
      const content = 'New content to write';
      const newFile = join(testDir, 'new-file.txt');

      const result = await fileTools.executeWriteFile({
        path: newFile,
        content,
        encoding: 'utf8'
      });

      expect(result.content[0].text).toContain('✅ File written successfully');
      expect(result.content[0].text).toContain('new-file.txt');

      // Verify file was actually written
      const writtenContent = await fs.readFile(newFile, 'utf8');
      expect(writtenContent).toBe(content);

      expect(mockLogger.info).toHaveBeenCalledWith('File written successfully', expect.any(Object));
    });

    it('should create directories automatically', async () => {
      const nestedFile = join(testDir, 'nested', 'dir', 'file.txt');

      await fileTools.executeWriteFile({
        path: nestedFile,
        content: 'Nested content',
        create_dirs: true
      });

      const writtenContent = await fs.readFile(nestedFile, 'utf8');
      expect(writtenContent).toBe('Nested content');
    });

    it('should create backup when requested', async () => {
      const backupFile = join(testDir, 'backup.txt');
      await fs.writeFile(backupFile, 'Original content');

      await fileTools.executeWriteFile({
        path: backupFile,
        content: 'New content',
        backup: true
      });

      // Check backup was created
      const backupFiles = await fs.readdir(testDir);
      const backupPattern = backupFiles.find(file => file.startsWith('backup.txt.backup.'));
      expect(backupPattern).toBeDefined();

      const backupContent = await fs.readFile(join(testDir, backupPattern!), 'utf8');
      expect(backupContent).toBe('Original content');

      expect(mockLogger.info).toHaveBeenCalledWith('Backup created', expect.any(Object));
    });

    it('should handle write errors', async () => {
      const invalidPath = '/invalid/path/file.txt';

      await expect(fileTools.executeWriteFile({
        path: invalidPath,
        content: 'content'
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('File write failed', expect.any(Error), expect.any(Object));
    });
  });

  describe('executeListDirectory', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Create test files and directories
      await fs.writeFile(join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(join(testDir, 'file2.js'), 'content2');
      await fs.writeFile(join(testDir, '.hidden.txt'), 'hidden');
      await fs.mkdir(join(testDir, 'subdir'));
      await fs.writeFile(join(testDir, 'subdir', 'nested.txt'), 'nested');
    });

    it('should list directory contents', async () => {
      const result = await fileTools.executeListDirectory({
        path: testDir
      });

      expect(result.content[0].text).toContain('📁 Directory Listing');
      expect(result.content[0].text).toContain(testDir);
      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).toContain('file2.js');
      expect(result.content[0].text).toContain('subdir');

      expect(mockLogger.info).toHaveBeenCalledWith('Directory listing completed', expect.any(Object));
    });

    it('should filter by extension', async () => {
      const result = await fileTools.executeListDirectory({
        path: testDir,
        filter_extension: '.txt'
      });

      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).not.toContain('file2.js');
    });

    it('should exclude hidden files when requested', async () => {
      const result = await fileTools.executeListDirectory({
        path: testDir,
        include_hidden: false
      });

      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).not.toContain('.hidden.txt');
    });

    it('should include hidden files when requested', async () => {
      const result = await fileTools.executeListDirectory({
        path: testDir,
        include_hidden: true
      });

      expect(result.content[0].text).toContain('.hidden.txt');
    });

    it('should sort by different criteria', async () => {
      const result = await fileTools.executeListDirectory({
        path: testDir,
        sort_by: 'name'
      });

      expect(result.content[0].text).toContain('📈 Sort By: name');
    });

    it('should handle non-existent directories', async () => {
      const nonexistentDir = join(testDir, 'nonexistent');

      await expect(fileTools.executeListDirectory({
        path: nonexistentDir
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Directory listing failed', expect.any(Error), expect.any(Object));
    });
  });

  describe('executeGetFileInfo', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(testFile, 'Test content for file info');
    });

    it('should get file information', async () => {
      const result = await fileTools.executeGetFileInfo({
        path: testFile
      });

      expect(result.content[0].text).toContain('📋 File Information');
      expect(result.content[0].text).toContain('test.txt');
      expect(result.content[0].text).toContain('file');
      expect(result.content[0].text).toContain('Readable: ✅');

      expect(mockLogger.info).toHaveBeenCalledWith('Get file info', expect.any(Object));
    });

    it('should include content preview when requested', async () => {
      const result = await fileTools.executeGetFileInfo({
        path: testFile,
        include_content_preview: true
      });

      expect(result.content[0].text).toContain('👀 Content Preview');
      expect(result.content[0].text).toContain('Test content for file info');
    });

    it('should handle directory information', async () => {
      const result = await fileTools.executeGetFileInfo({
        path: testDir
      });

      expect(result.content[0].text).toContain('directory');
    });

    it('should handle non-existent files', async () => {
      const nonexistentFile = join(testDir, 'nonexistent.txt');

      await expect(fileTools.executeGetFileInfo({
        path: nonexistentFile
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('Get file info failed', expect.any(Error), expect.any(Object));
    });
  });

  describe('executeSearchFiles', () => {
    beforeEach(async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Create test files with different content
      await fs.writeFile(join(testDir, 'test1.txt'), 'This file contains search content');
      await fs.writeFile(join(testDir, 'test2.txt'), 'Another file with different content');
      await fs.writeFile(join(testDir, 'script.js'), 'console.log("JavaScript file");');
      await fs.mkdir(join(testDir, 'subdir'));
      await fs.writeFile(join(testDir, 'subdir', 'nested.txt'), 'Nested file with search content');
    });

    it('should search files by name pattern', async () => {
      const result = await fileTools.executeSearchFiles({
        directory: testDir,
        pattern: '*.txt'
      });

      expect(result.content[0].text).toContain('🔍 File Search Results');
      expect(result.content[0].text).toContain('test1.txt');
      expect(result.content[0].text).toContain('test2.txt');
      expect(result.content[0].text).not.toContain('script.js');

      expect(mockLogger.info).toHaveBeenCalledWith('File search completed', expect.any(Object));
    });

    it('should search files by content', async () => {
      const result = await fileTools.executeSearchFiles({
        directory: testDir,
        content_search: 'search content'
      });

      expect(result.content[0].text).toContain('test1.txt');
      expect(result.content[0].text).toContain('nested.txt');
      expect(result.content[0].text).not.toContain('test2.txt');
    });

    it('should handle case insensitive search', async () => {
      const result = await fileTools.executeSearchFiles({
        directory: testDir,
        content_search: 'Search Content',
        case_sensitive: false
      });

      expect(result.content[0].text).toContain('test1.txt');
    });

    it('should respect max results limit', async () => {
      const result = await fileTools.executeSearchFiles({
        directory: testDir,
        pattern: '*.txt',
        max_results: 1
      });

      // Should only show 1 result
      const content = result.content[0].text;
      expect(content.split('📄').length).toBeLessThanOrEqual(3); // Header + 1 result + footer
    });

    it('should handle non-existent directories', async () => {
      const nonexistentDir = join(testDir, 'nonexistent');

      await expect(fileTools.executeSearchFiles({
        directory: nonexistentDir,
        pattern: '*.txt'
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith('File search failed', expect.any(Error), expect.any(Object));
    });

    it('should handle empty search results', async () => {
      const result = await fileTools.executeSearchFiles({
        directory: testDir,
        pattern: '*.nonexistent'
      });

      expect(result.content[0].text).toContain('No files found');
    });
  });

  describe('Error Handling', () => {
    it('should handle permission errors', async () => {
      // This test would require setting up files with specific permissions
      // For now, we'll test with non-existent paths
      const invalidPath = '/root/invalid/path.txt';

      await expect(fileTools.executeReadFile({
        path: invalidPath
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should sanitize error messages', async () => {
      // Test that sensitive information is not logged
      const sensitivePath = '/secret/path/with/sensitive/info.txt';

      await expect(fileTools.executeReadFile({
        path: sensitivePath
      })).rejects.toThrow();

      // Verify logger was called but sensitive path should be sanitized in logs
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle large files appropriately', async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Create a large file
      const largeContent = 'A'.repeat(1000000); // 1MB file
      const largeFile = join(testDir, 'large.txt');
      await fs.writeFile(largeFile, largeContent);

      // Should succeed with reasonable limits
      const result = await fileTools.executeReadFile({
        path: largeFile,
        max_size: 2000000 // 2MB limit
      });

      expect(result.content[0].text).toContain('large.txt');
      expect(result.content[0].text).toContain('1,000,000 bytes');
    });

    it('should handle many files in directory', async () => {
      await fs.mkdir(testDir, { recursive: true });

      // Create many files
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(fs.writeFile(join(testDir, `file${i}.txt`), `Content ${i}`));
      }
      await Promise.all(promises);

      const result = await fileTools.executeListDirectory({
        path: testDir
      });

      expect(result.content[0].text).toContain('100');
    });
  });
});
