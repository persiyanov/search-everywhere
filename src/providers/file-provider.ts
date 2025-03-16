import * as vscode from 'vscode';
import { FileSearchItem, SearchItemType, SearchProvider } from '../core/types';
import { ExclusionPatterns } from '../utils/exclusions';

/**
 * Provides file search items from the workspace
 */
export class FileSearchProvider implements SearchProvider {
    private fileItems: FileSearchItem[] = [];
    private isRefreshing: boolean = false;
    
    constructor() {
        // Listen for changes in workspace files
        vscode.workspace.onDidCreateFiles(() => this.refresh());
        vscode.workspace.onDidDeleteFiles(() => this.refresh());
        vscode.workspace.onDidRenameFiles(() => this.refresh());
    }
    
    /**
     * Get all indexed file items
     */
    public async getItems(): Promise<FileSearchItem[]> {
        if (this.fileItems.length === 0 && !this.isRefreshing) {
            await this.refresh();
        }
        return this.fileItems;
    }
    
    /**
     * Refresh the file index
     */
    public async refresh(): Promise<void> {
        if (this.isRefreshing) {
            return;
        }
        
        this.isRefreshing = true;
        console.log('Refreshing file index...');
        const startTime = performance.now();
        
        this.fileItems = [];
        
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                console.log('No workspace folders found');
                return;
            }
            
            // Get exclusion glob pattern from utility
            const excludePattern = ExclusionPatterns.getExclusionGlob();
            
            // Process each workspace folder
            for (const folder of vscode.workspace.workspaceFolders) {
                console.log(`Indexing files in workspace folder: ${folder.name}`);
                
                // Find all files in the workspace folder
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, '**/*.*'),
                    excludePattern
                );
                
                console.log(`Found ${files.length} files in ${folder.name}`);
                
                // Process files in batches to avoid UI freezes
                const batchSize = 1000;
                for (let i = 0; i < files.length; i += batchSize) {
                    const batch = files.slice(i, i + batchSize);
                    this.processFileBatch(batch, folder);
                    
                    // Log progress for large workspaces
                    if (i > 0 && i % 5000 === 0) {
                        console.log(`Processed ${i} files...`);
                        // Allow UI thread to breathe
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing file index:', error);
        } finally {
            this.isRefreshing = false;
            
            const endTime = performance.now();
            console.log(`Indexed ${this.fileItems.length} files in ${endTime - startTime}ms`);
        }
    }
    
    /**
     * Process a batch of files
     */
    private processFileBatch(files: vscode.Uri[], workspaceFolder: vscode.WorkspaceFolder): void {
        for (const uri of files) {
            try {
                // Create a relative path for display
                let relativePath = uri.fsPath;
                const workspacePath = workspaceFolder.uri.fsPath;
                
                if (relativePath.startsWith(workspacePath)) {
                    relativePath = relativePath.substring(workspacePath.length);
                    // Remove leading slash or backslash
                    if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                        relativePath = relativePath.substring(1);
                    }
                }
                
                // Get file name
                const fileName = uri.fsPath.split(/[\/\\]/).pop() || '';
                
                // Add file item
                this.fileItems.push({
                    id: `file:${uri.toString()}`,
                    label: fileName,
                    description: relativePath,
                    detail: uri.fsPath,
                    type: SearchItemType.File,
                    uri: uri,
                    iconPath: this.getFileIcon(fileName),
                    action: async () => {
                        // Open the file in editor
                        await vscode.window.showTextDocument(uri);
                    }
                });
            } catch (error) {
                console.error(`Error processing file ${uri.fsPath}:`, error);
            }
        }
    }
    
    /**
     * Get an icon for a file based on extension
     */
    private getFileIcon(fileName: string): vscode.ThemeIcon {
        const extension = fileName.split('.').pop()?.toLowerCase();
        
        // Return appropriate icon based on file extension
        switch (extension) {
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
                return new vscode.ThemeIcon('file-code');
            case 'json':
                return new vscode.ThemeIcon('file-json');
            case 'md':
                return new vscode.ThemeIcon('markdown');
            case 'html':
            case 'htm':
                return new vscode.ThemeIcon('html');
            case 'css':
            case 'scss':
            case 'sass':
            case 'less':
                return new vscode.ThemeIcon('file-css');
            case 'xml':
                return new vscode.ThemeIcon('file-xml');
            case 'py':
                return new vscode.ThemeIcon('python');
            case 'cs':
                return new vscode.ThemeIcon('c-sharp');
            case 'java':
                return new vscode.ThemeIcon('java');
            case 'c':
            case 'cpp':
            case 'h':
            case 'hpp':
                return new vscode.ThemeIcon('file-code');
            case 'php':
                return new vscode.ThemeIcon('file-code');
            case 'go':
                return new vscode.ThemeIcon('file-code');
            case 'rb':
                return new vscode.ThemeIcon('ruby');
            case 'rust':
            case 'rs':
                return new vscode.ThemeIcon('file-code');
            case 'sh':
            case 'bash':
                return new vscode.ThemeIcon('terminal');
            case 'yaml':
            case 'yml':
                return new vscode.ThemeIcon('file-yaml');
            case 'toml':
                return new vscode.ThemeIcon('file-text');
            case 'sql':
                return new vscode.ThemeIcon('file-text');
            case 'ps1':
                return new vscode.ThemeIcon('terminal-powershell');
            case 'git':
            case 'gitignore':
            case 'gitattributes':
                return new vscode.ThemeIcon('git');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
} 