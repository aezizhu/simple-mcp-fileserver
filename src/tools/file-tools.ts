/**
 * File Operation Tools
 * 
 * Professional file system tools for MCP FileBridge.
 * Provides secure and efficient file operations with comprehensive validation.
 * 
 * @author aezizhu
 * @version 1.0.0
 */

import { readFile, writeFile, readdir, stat, access, constants, mkdir } from 'fs/promises';
import { join, extname, basename, dirname, resolve } from 'path';
import mime from 'mime-types';
import { Tool, Content, ContentType, Logger } from '@/types/mcp';

export class FileOperationTools {
  private readonly logger: Logger;
  private readonly maxFileSize = 50 * 1024 * 1024; // 50MB
  private readonly allowedExtensions = [
    // Text files
    '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
    '.css', '.scss', '.sass', '.less', '.html', '.htm', '.xml', '.yaml', '.yml', '.toml',
    '.ini', '.cfg', '.conf', '.log', '.csv', '.tsv', '.sql', '.sh', '.bat', '.ps1',
    // Code files
    '.php', '.rb', '.go', '.rs', '.kt', '.swift', '.dart', '.scala', '.clj', '.hs',
    '.lua', '.perl', '.r', '.matlab', '.octave', '.julia', '.nim', '.zig', '.crystal',
    // Config files
    '.gitignore', '.dockerignore', '.env', '.editorconfig', '.prettierrc', '.eslintrc',
    // Documentation
    '.rst', '.adoc', '.tex', '.bib', '.org', '.wiki',
    // Data files
    '.geojson', '.gpx', '.kml', '.rss', '.atom', '.opml', '.vcf', '.ics'
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get all file operation tools
   */
  public getTools(): Tool[] {
    return [
      {
        name: 'read_file',
        description: 'Read a text or binary file from the filesystem with smart encoding detection',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file to read (absolute or relative)'
            },
            encoding: {
              type: 'string',
              enum: ['utf8', 'base64', 'binary', 'auto'],
              default: 'auto',
              description: 'File encoding (auto-detects by default)'
            },
            max_size: {
              type: 'number',
              default: 1048576, // 1MB
              minimum: 1024,
              maximum: 52428800, // 50MB
              description: 'Maximum file size to read in bytes'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to a file with automatic directory creation',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path where to write the file'
            },
            content: {
              type: 'string',
              description: 'Content to write to the file'
            },
            encoding: {
              type: 'string',
              enum: ['utf8', 'base64'],
              default: 'utf8',
              description: 'Content encoding'
            },
            create_dirs: {
              type: 'boolean',
              default: true,
              description: 'Create parent directories if they don\'t exist'
            },
            backup: {
              type: 'boolean',
              default: false,
              description: 'Create backup of existing file'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List directory contents with detailed file information',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to list'
            },
            recursive: {
              type: 'boolean',
              default: false,
              description: 'List files recursively in subdirectories'
            },
            include_hidden: {
              type: 'boolean',
              default: false,
              description: 'Include hidden files and directories'
            },
            filter_extension: {
              type: 'string',
              description: 'Filter files by extension (e.g., ".txt", ".js")'
            },
            sort_by: {
              type: 'string',
              enum: ['name', 'size', 'modified', 'type'],
              default: 'name',
              description: 'Sort files by specified criteria'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_file_info',
        description: 'Get detailed information about a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file or directory'
            },
            include_content_preview: {
              type: 'boolean',
              default: false,
              description: 'Include a preview of file content (first 500 chars)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_files',
        description: 'Search for files by name pattern or content',
        inputSchema: {
          type: 'object',
          properties: {
            directory: {
              type: 'string',
              description: 'Directory to search in'
            },
            pattern: {
              type: 'string',
              description: 'File name pattern (supports wildcards like *.js)'
            },
            content_search: {
              type: 'string',
              description: 'Search for text content within files'
            },
            case_sensitive: {
              type: 'boolean',
              default: false,
              description: 'Case sensitive search'
            },
            max_results: {
              type: 'number',
              default: 50,
              minimum: 1,
              maximum: 500,
              description: 'Maximum number of results to return'
            }
          },
          required: ['directory']
        }
      }
    ];
  }

  /**
   * Execute read file tool
   */
  public async executeReadFile(args: {
    path: string;
    encoding?: 'utf8' | 'base64' | 'binary' | 'auto';
    max_size?: number;
  }): Promise<{ content: Content[] }> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Reading file', { path: args.path });
      
      // Validate and resolve path
      const filePath = resolve(args.path);
      await this.validateFileAccess(filePath, 'read');
      
      const stats = await stat(filePath);
      const maxSize = args.max_size || 1048576; // 1MB default
      
      if (stats.size > maxSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxSize})`);
      }

      // Auto-detect encoding if needed
      let encoding = args.encoding || 'auto';
      if (encoding === 'auto') {
        encoding = this.detectEncoding(filePath);
      }

      // Read file content
      const content = await readFile(filePath, encoding as BufferEncoding);
      const ext = extname(filePath).toLowerCase();
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      const duration = Date.now() - startTime;
      this.logger.info('File read completed', { 
        path: args.path, 
        size: stats.size,
        encoding,
        duration: `${duration}ms`
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: this.formatFileContent({
            path: filePath,
            filename: basename(filePath),
            size: stats.size,
            encoding,
            mimeType,
            extension: ext,
            modified: stats.mtime.toISOString(),
            content: content.toString()
          })
        }]
      };

    } catch (error) {
      this.logger.error('File read failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Execute write file tool
   */
  public async executeWriteFile(args: {
    path: string;
    content: string;
    encoding?: 'utf8' | 'base64';
    create_dirs?: boolean;
    backup?: boolean;
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Writing file', { path: args.path });
      
      const filePath = resolve(args.path);
      const encoding = args.encoding || 'utf8';
      
      // Create parent directories if needed
      if (args.create_dirs !== false) {
        const dir = dirname(filePath);
        await mkdir(dir, { recursive: true });
      }

      // Create backup if requested and file exists
      if (args.backup) {
        try {
          await access(filePath, constants.F_OK);
          const backupPath = `${filePath}.backup.${Date.now()}`;
          const existingContent = await readFile(filePath);
          await writeFile(backupPath, existingContent);
          this.logger.info('Backup created', { original: filePath, backup: backupPath });
        } catch (error) {
          // File doesn't exist, no backup needed
        }
      }

      // Write file
      await writeFile(filePath, args.content, encoding);
      const stats = await stat(filePath);
      
      this.logger.info('File written successfully', { 
        path: args.path, 
        size: stats.size,
        encoding
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: `✅ File written successfully\n\nDetails:\n• Path: ${filePath}\n• Size: ${this.formatBytes(stats.size)}\n• Encoding: ${encoding}\n• Modified: ${stats.mtime.toISOString()}`
        }]
      };

    } catch (error) {
      this.logger.error('File write failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Execute list directory tool
   */
  public async executeListDirectory(args: {
    path: string;
    recursive?: boolean;
    include_hidden?: boolean;
    filter_extension?: string;
    sort_by?: 'name' | 'size' | 'modified' | 'type';
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Listing directory', { path: args.path });
      
      const dirPath = resolve(args.path);
      await access(dirPath, constants.F_OK | constants.R_OK);
      
      const items = await this.listDirectoryRecursive(
        dirPath,
        args.recursive || false,
        args.include_hidden || false,
        args.filter_extension
      );

      // Sort items
      const sortBy = args.sort_by || 'name';
      items.sort((a, b) => {
        switch (sortBy) {
          case 'size':
            return b.size - a.size;
          case 'modified':
            return new Date(b.modified).getTime() - new Date(a.modified).getTime();
          case 'type':
            return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
          default:
            return a.name.localeCompare(b.name);
        }
      });

      this.logger.info('Directory listing completed', { 
        path: args.path, 
        itemCount: items.length 
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: this.formatDirectoryListing(dirPath, items, args)
        }]
      };

    } catch (error) {
      this.logger.error('Directory listing failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Execute get file info tool
   */
  public async executeGetFileInfo(args: {
    path: string;
    include_content_preview?: boolean;
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Getting file info', { path: args.path });
      
      const filePath = resolve(args.path);
      await access(filePath, constants.F_OK);
      
      const stats = await stat(filePath);
      const ext = extname(filePath).toLowerCase();
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      
      const fileInfo = {
        path: filePath,
        name: basename(filePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        sizeFormatted: this.formatBytes(stats.size),
        extension: ext || 'none',
        mimeType,
        permissions: stats.mode.toString(8),
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        isReadable: await this.checkAccess(filePath, constants.R_OK),
        isWritable: await this.checkAccess(filePath, constants.W_OK),
        isExecutable: await this.checkAccess(filePath, constants.X_OK),
      };

      // Add content preview if requested and it's a text file
      let contentPreview = '';
      if (args.include_content_preview && stats.isFile() && stats.size < 10240) { // 10KB limit
        try {
          if (this.isTextFile(filePath)) {
            const content = await readFile(filePath, 'utf8');
            contentPreview = content.substring(0, 500);
            if (content.length > 500) {
              contentPreview += '...';
            }
          }
        } catch (error) {
          contentPreview = 'Preview unavailable';
        }
      }

      return {
        content: [{
          type: ContentType.TEXT,
          text: this.formatFileInfo(fileInfo, contentPreview)
        }]
      };

    } catch (error) {
      this.logger.error('Get file info failed', error as Error, { path: args.path });
      throw error;
    }
  }

  /**
   * Execute search files tool
   */
  public async executeSearchFiles(args: {
    directory: string;
    pattern?: string;
    content_search?: string;
    case_sensitive?: boolean;
    max_results?: number;
  }): Promise<{ content: Content[] }> {
    try {
      this.logger.info('Searching files', { 
        directory: args.directory,
        pattern: args.pattern,
        contentSearch: args.content_search
      });
      
      const dirPath = resolve(args.directory);
      await access(dirPath, constants.F_OK | constants.R_OK);
      
      const maxResults = args.max_results || 50;
      const results: Array<{
        path: string;
        name: string;
        size: number;
        modified: string;
        matchType: 'name' | 'content';
        matchDetails?: string;
      }> = [];

      await this.searchInDirectory(
        dirPath,
        args.pattern,
        args.content_search,
        args.case_sensitive || false,
        results,
        maxResults
      );

      this.logger.info('File search completed', { 
        directory: args.directory,
        resultsFound: results.length
      });

      return {
        content: [{
          type: ContentType.TEXT,
          text: this.formatSearchResults(dirPath, results, args)
        }]
      };

    } catch (error) {
      this.logger.error('File search failed', error as Error, { directory: args.directory });
      throw error;
    }
  }

  /**
   * Validate file access permissions
   */
  private async validateFileAccess(filePath: string, operation: 'read' | 'write'): Promise<void> {
    try {
      await access(filePath, constants.F_OK);
      
      if (operation === 'read') {
        await access(filePath, constants.R_OK);
      } else if (operation === 'write') {
        await access(filePath, constants.W_OK);
      }
    } catch (error) {
      throw new Error(`File access denied: ${filePath}`);
    }
  }

  /**
   * Detect appropriate encoding for file
   */
  private detectEncoding(filePath: string): 'utf8' | 'base64' {
    const ext = extname(filePath).toLowerCase();
    
    // Text files use UTF-8
    if (this.allowedExtensions.includes(ext) || this.isTextFile(filePath)) {
      return 'utf8';
    }
    
    // Binary files use base64
    return 'base64';
  }

  /**
   * Check if file is likely a text file
   */
  private isTextFile(filePath: string): boolean {
    const ext = extension(filePath).toLowerCase();
    const mimeType = mime.lookup(filePath);
    
    return this.allowedExtensions.includes(ext) || 
           (mimeType ? mimeType.startsWith('text/') : false);
  }

  /**
   * Check file access permissions
   */
  private async checkAccess(filePath: string, mode: number): Promise<boolean> {
    try {
      await access(filePath, mode);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List directory contents recursively
   */
  private async listDirectoryRecursive(
    dirPath: string,
    recursive: boolean,
    includeHidden: boolean,
    filterExtension?: string
  ): Promise<Array<{
    name: string;
    path: string;
    type: 'file' | 'directory';
    size: number;
    modified: string;
    extension: string;
    mimeType: string;
  }>> {
    const items = await readdir(dirPath, { withFileTypes: true });
    const results: any[] = [];

    for (const item of items) {
      // Skip hidden files if not requested
      if (!includeHidden && item.name.startsWith('.')) {
        continue;
      }

      const itemPath = join(dirPath, item.name);
      const stats = await stat(itemPath);
      const ext = extname(item.name).toLowerCase();
      
      // Apply extension filter
      if (filterExtension && ext !== filterExtension.toLowerCase()) {
        continue;
      }

      const fileInfo = {
        name: item.name,
        path: itemPath,
        type: item.isDirectory() ? 'directory' as const : 'file' as const,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        extension: ext || 'none',
        mimeType: mime.lookup(itemPath) || 'application/octet-stream'
      };

      results.push(fileInfo);

      // Recurse into subdirectories
      if (recursive && item.isDirectory()) {
        const subItems = await this.listDirectoryRecursive(
          itemPath,
          true,
          includeHidden,
          filterExtension
        );
        results.push(...subItems);
      }
    }

    return results;
  }

  /**
   * Search in directory for files matching criteria
   */
  private async searchInDirectory(
    dirPath: string,
    namePattern?: string,
    contentSearch?: string,
    caseSensitive: boolean = false,
    results: any[] = [],
    maxResults: number = 50
  ): Promise<void> {
    if (results.length >= maxResults) return;

    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      if (results.length >= maxResults) break;

      const itemPath = join(dirPath, item.name);
      
      if (item.isDirectory()) {
        // Recurse into subdirectories
        await this.searchInDirectory(
          itemPath,
          namePattern,
          contentSearch,
          caseSensitive,
          results,
          maxResults
        );
      } else {
        const stats = await stat(itemPath);
        let matches = false;
        let matchType: 'name' | 'content' = 'name';
        let matchDetails = '';

        // Check name pattern
        if (namePattern) {
          const pattern = caseSensitive ? namePattern : namePattern.toLowerCase();
          const name = caseSensitive ? item.name : item.name.toLowerCase();
          
          if (this.matchesPattern(name, pattern)) {
            matches = true;
            matchType = 'name';
            matchDetails = `Name matches pattern: ${namePattern}`;
          }
        }

        // Check content search
        if (!matches && contentSearch && this.isTextFile(itemPath) && stats.size < 1048576) { // 1MB limit
          try {
            const content = await readFile(itemPath, 'utf8');
            const searchText = caseSensitive ? contentSearch : contentSearch.toLowerCase();
            const fileContent = caseSensitive ? content : content.toLowerCase();
            
            if (fileContent.includes(searchText)) {
              matches = true;
              matchType = 'content';
              
              // Find context around match
              const index = fileContent.indexOf(searchText);
              const start = Math.max(0, index - 50);
              const end = Math.min(content.length, index + searchText.length + 50);
              matchDetails = `Content match: ...${content.substring(start, end)}...`;
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }

        if (matches || (!namePattern && !contentSearch)) {
          results.push({
            path: itemPath,
            name: item.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            matchType,
            matchDetails
          });
        }
      }
    }
  }

  /**
   * Check if name matches pattern (supports wildcards)
   */
  private matchesPattern(name: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(name);
  }

  /**
   * Format file content for display
   */
  private formatFileContent(info: {
    path: string;
    filename: string;
    size: number;
    encoding: string;
    mimeType: string;
    extension: string;
    modified: string;
    content: string;
  }): string {
    const sections = [
      '📄 File Content',
      '='.repeat(80),
      '',
      '📋 File Information:',
      `   • Path: ${info.path}`,
      `   • Filename: ${info.filename}`,
      `   • Size: ${this.formatBytes(info.size)}`,
      `   • Type: ${info.mimeType}`,
      `   • Extension: ${info.extension || 'none'}`,
      `   • Encoding: ${info.encoding}`,
      `   • Modified: ${info.modified}`,
      '',
      '📝 Content:',
      '-'.repeat(40),
      info.content,
      '-'.repeat(40),
      '',
      `✅ File read completed successfully`
    ];

    return sections.join('\n');
  }

  /**
   * Format directory listing for display
   */
  private formatDirectoryListing(dirPath: string, items: any[], options: any): string {
    const sections = [
      '📁 Directory Listing',
      '='.repeat(80),
      '',
      `📂 Directory: ${dirPath}`,
      `📊 Total Items: ${items.length}`,
      `🔄 Recursive: ${options.recursive ? 'Yes' : 'No'}`,
      `👁️ Hidden Files: ${options.include_hidden ? 'Included' : 'Excluded'}`,
      `🔍 Filter: ${options.filter_extension || 'None'}`,
      `📈 Sort By: ${options.sort_by || 'name'}`,
      '',
      '📋 Items:',
      '-'.repeat(80)
    ];

    if (items.length === 0) {
      sections.push('   (No items found)');
    } else {
      for (const item of items) {
        const icon = item.type === 'directory' ? '📁' : '📄';
        const size = item.type === 'directory' ? '' : ` (${this.formatBytes(item.size)})`;
        sections.push(`   ${icon} ${item.name}${size}`);
        sections.push(`      Path: ${item.path}`);
        sections.push(`      Modified: ${item.modified}`);
        if (item.type === 'file') {
          sections.push(`      Type: ${item.mimeType}`);
        }
        sections.push('');
      }
    }

    sections.push('-'.repeat(80));
    return sections.join('\n');
  }

  /**
   * Format file info for display
   */
  private formatFileInfo(info: any, contentPreview: string): string {
    const sections = [
      '📋 File Information',
      '='.repeat(80),
      '',
      `📄 ${info.name}`,
      '',
      '🔍 Details:',
      `   • Path: ${info.path}`,
      `   • Type: ${info.type}`,
      `   • Size: ${info.sizeFormatted} (${info.size} bytes)`,
      `   • Extension: ${info.extension}`,
      `   • MIME Type: ${info.mimeType}`,
      `   • Permissions: ${info.permissions}`,
      '',
      '📅 Timestamps:',
      `   • Created: ${info.created}`,
      `   • Modified: ${info.modified}`,
      `   • Accessed: ${info.accessed}`,
      '',
      '🔐 Access Rights:',
      `   • Readable: ${info.isReadable ? '✅' : '❌'}`,
      `   • Writable: ${info.isWritable ? '✅' : '❌'}`,
      `   • Executable: ${info.isExecutable ? '✅' : '❌'}`,
    ];

    if (contentPreview) {
      sections.push('', '👀 Content Preview:', '-'.repeat(40), contentPreview, '-'.repeat(40));
    }

    return sections.join('\n');
  }

  /**
   * Format search results for display
   */
  private formatSearchResults(dirPath: string, results: any[], options: any): string {
    const sections = [
      '🔍 File Search Results',
      '='.repeat(80),
      '',
      `📂 Search Directory: ${dirPath}`,
      `🎯 Name Pattern: ${options.pattern || 'None'}`,
      `📝 Content Search: ${options.content_search || 'None'}`,
      `🔤 Case Sensitive: ${options.case_sensitive ? 'Yes' : 'No'}`,
      `📊 Results Found: ${results.length}`,
      `📈 Max Results: ${options.max_results || 50}`,
      '',
      '📋 Results:',
      '-'.repeat(80)
    ];

    if (results.length === 0) {
      sections.push('   No files found matching the criteria.');
    } else {
      for (const result of results) {
        const icon = result.matchType === 'content' ? '📝' : '📄';
        sections.push(`   ${icon} ${result.name}`);
        sections.push(`      Path: ${result.path}`);
        sections.push(`      Size: ${this.formatBytes(result.size)}`);
        sections.push(`      Modified: ${result.modified}`);
        sections.push(`      Match: ${result.matchDetails || result.matchType}`);
        sections.push('');
      }
    }

    sections.push('-'.repeat(80));
    return sections.join('\n');
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
