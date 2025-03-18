import * as vscode from 'vscode';
import { getConfiguration } from './config';
import Logger from './logging';
import { minimatch } from 'minimatch';

/**
 * Utility for managing exclusion patterns that are shared across providers
 */
export class ExclusionPatterns {
    /**
     * Get the default exclusion patterns plus any user-configured ones
     */
    public static getExclusionPatterns(): string[] {
        const defaultPatterns = [
            // Common version control directories
            '**/node_modules/**',
            '**/.git/**', 
            '**/.svn/**',
            '**/.hg/**',
            
            // Build output directories
            '**/bin/**', 
            '**/build/**',
            '**/dist/**',
            '**/target/**',
            '**/out/**',
            
            // Package directories
            '**/packages/**',
            '**/vendor/**',
            
            // IDE directories
            '**/.idea/**',
            '**/.vs/**',
            '**/.vscode/**',
            
            // Binary files
            '**/*.pyc',
            '**/*.class',
            '**/*.o',
            '**/*.obj',
            '**/*.exe',
            '**/*.dll',
            '**/*.so',
            '**/*.dylib',
            
            // Temporary and backup files
            '**/*.tmp',
            '**/*.bak',
            '**/*~',
            '**/.DS_Store',
            
            // Large data files
            '**/*.zip',
            '**/*.tar',
            '**/*.gz',
            '**/*.rar',
            '**/*.7z',
            '**/*.jar',
            '**/*.war',
            '**/*.ear',
            '**/*.iso',
            '**/*.pdf',
            '**/*.docx',
            '**/*.xlsx',
            
            // Media files
            '**/*.jpg',
            '**/*.jpeg',
            '**/*.png',
            '**/*.gif',
            '**/*.svg',
            '**/*.ico',
            '**/*.mp3',
            '**/*.mp4',
            '**/*.wav',
            '**/*.avi',
            
            // Log files
            '**/*.log'
        ];
        
        // Add any user-configured exclude patterns from settings
        const config = getConfiguration();
        if (config.exclusions && Array.isArray(config.exclusions)) {
            const allPatterns = [...defaultPatterns, ...config.exclusions];
            Logger.debug(`Loaded exclusion patterns - Default: ${defaultPatterns.length}, User: ${config.exclusions.length}, Total: ${allPatterns.length}`);
            if (config.debug && config.exclusions.length > 0) {
                Logger.debug(`User-configured exclusions: ${config.exclusions.join(', ')}`);
            }
            return allPatterns;
        }
        
        Logger.debug(`Loaded exclusion patterns - Default: ${defaultPatterns.length}, User: 0, Total: ${defaultPatterns.length}`);
        return defaultPatterns;
    }
    
    /**
     * Get the exclusion pattern string for use with vscode.workspace.findFiles
     */
    public static getExclusionGlob(): string {
        const patterns = this.getExclusionPatterns();
        const glob = `{${patterns.join(',')}}`;
        Logger.debug(`Generated exclusion glob pattern with ${patterns.length} patterns`);
        return glob;
    }
    
    /**
     * Check if a URI should be excluded based on the current exclusion patterns
     */
    public static shouldExclude(uri: vscode.Uri): boolean {
        // Don't exclude non-file URIs (like symbols)
        if (uri.scheme !== 'file') {
            Logger.debug(`Skipping exclusion check for non-file URI: ${uri.toString()} (scheme: ${uri.scheme})`);
            return false;
        }

        // Get relative path from workspace root
        const relativePath = vscode.workspace.asRelativePath(uri);
        
        // Check against each pattern
        const patterns = this.getExclusionPatterns();
        
        for (const pattern of patterns) {
            const matches = minimatch(relativePath, pattern, {
                dot: true,        // Match dot files
                matchBase: true,  // Match basename if pattern has no slashes
                nocase: true,     // Case insensitive matching
                nocomment: true,  // Don't treat leading # as comments
                nonegate: true,   // Don't treat leading ! as negation
                noglobstar: false // Enable ** matching (default, but being explicit)
            });

            if (matches) {
                Logger.debug(`Excluded: ${relativePath} (matched pattern: ${pattern})`);
                return true;
            }
        }
        Logger.debug(`Included: ${relativePath}`);
        return false;
    }
} 