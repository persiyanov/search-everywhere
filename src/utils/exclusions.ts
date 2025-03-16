import * as vscode from 'vscode';
import { getConfiguration } from './config';

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
            return [...defaultPatterns, ...config.exclusions];
        }
        
        return defaultPatterns;
    }
    
    /**
     * Get the exclusion pattern string for use with vscode.workspace.findFiles
     */
    public static getExclusionGlob(): string {
        const patterns = this.getExclusionPatterns();
        return `{${patterns.join(',')}}`;
    }
    
    /**
     * Check if a URI should be excluded based on the current exclusion patterns
     */
    public static shouldExclude(uri: vscode.Uri): boolean {
        const patterns = this.getExclusionPatterns();
        const path = uri.fsPath;
        
        // Check if path matches any exclusion pattern
        for (const pattern of patterns) {
            // Handle glob patterns by converting to a simple check
            // This is a simplified approach - not a full glob implementation
            const simplifiedPattern = pattern
                .replace(/\*\*/g, '') // Remove ** wildcards
                .replace(/\*/g, '')   // Remove * wildcards
                .replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
                
            if (simplifiedPattern && path.includes(simplifiedPattern)) {
                return true;
            }
        }
        
        return false;
    }
} 