import * as vscode from 'vscode';
import { SearchItemType, SearchProvider, SymbolKindGroup, SymbolSearchItem, mapSymbolKindToGroup } from '../core/types';
import { Debouncer } from '../utils/debouncer';
import { ExclusionPatterns } from '../utils/exclusions';

/**
 * Provides document symbols for searching by scanning each file individually
 * This complements the workspace symbol provider by finding symbols that might be missed
 */
export class DocumentSymbolProvider implements SearchProvider {
    private symbolItems: SymbolSearchItem[] = [];
    private isRefreshing: boolean = false;
    private refreshDebouncer: Debouncer;
    private fileUriCache = new Set<string>();
    
    constructor() {
        // Create a debouncer with 3 second delay to avoid excessive refreshes
        // Using a slightly longer delay than workspace symbols to stagger the operations
        this.refreshDebouncer = new Debouncer(3000);
        
        // Setup automatic reindexing when documents change
        this.setupChangeListeners();
    }
    
    /**
     * Setup workspace change listeners to automatically reindex document symbols
     */
    private setupChangeListeners(): void {
        // Listen for document saves
        vscode.workspace.onDidSaveTextDocument((document) => {
            this.updateDocumentSymbols(document);
        });
        
        // Listen for folder changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.refreshDebouncer.clear(); // Clear any pending updates
            this.refresh(); // Refresh immediately
        });
    }
    
    /**
     * Update symbols for a specific document
     */
    private async updateDocumentSymbols(document: vscode.TextDocument): Promise<void> {
        const uri = document.uri;
        
        // Skip files that should be excluded
        if (ExclusionPatterns.shouldExclude(uri)) {
            return;
        }
        
        // Only process supported languages to avoid unnecessary work
        if (!this.isSupportedLanguage(uri.fsPath)) {
            return;
        }
        
        try {
            // Remove existing symbols for this file
            this.symbolItems = this.symbolItems.filter(item => 
                item.uri.toString() !== uri.toString()
            );
            
            // Get document symbols for the file
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );
            
            if (symbols && symbols.length > 0) {
                // Add the file URI to our cache
                this.fileUriCache.add(uri.toString());
                
                // Process symbols recursively
                this.processSymbols(symbols, uri);
                
                console.log(`Updated ${symbols.length} symbols for ${uri.fsPath}`);
            }
        } catch (error) {
            console.error(`Error updating symbols for ${uri.fsPath}:`, error);
        }
    }
    
    /**
     * Schedule a full refresh operation, debounced to prevent excessive updates
     */
    private scheduleRefresh(): void {
        console.log('Scheduling document symbol index refresh...');
        this.refreshDebouncer.debounce(() => {
            this.refresh();
        });
    }
    
    /**
     * Check if a file is a supported language for symbol indexing
     */
    private isSupportedLanguage(filePath: string): boolean {
        const supportedExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', 
            '.go', '.rb', '.php', '.rust', '.swift', '.html', '.css', '.scss',
            '.sass', '.less', '.json', '.yaml', '.yml', '.toml', '.xml'
        ];
        
        return supportedExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }
    
    /**
     * Get all indexed document symbol items
     */
    public async getItems(): Promise<SymbolSearchItem[]> {
        if (this.symbolItems.length === 0 && !this.isRefreshing) {
            await this.refresh();
        }
        return this.symbolItems;
    }
    
    /**
     * Refresh the document symbol index by scanning documents in the workspace
     * @param force If true, forces refresh even if already refreshing
     */
    public async refresh(force: boolean = false): Promise<void> {
        if (this.isRefreshing && !force) {
            return;
        }
        
        this.isRefreshing = true;
        console.log('Refreshing document symbol index...');
        const startTime = performance.now();
        
        this.symbolItems = [];
        
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                return;
            }
            
            // Find source code files to scan for symbols
            // Focus on common source code extensions to avoid scanning too many files
            const sourceFilePattern = '**/*.{js,jsx,ts,tsx,py,java,c,cpp,cs,go,rb,php,rust,swift}';
            
            // Get exclusion pattern from utility
            const excludePattern = ExclusionPatterns.getExclusionGlob();
            
            for (const folder of vscode.workspace.workspaceFolders) {
                // Find source code files in this workspace folder
                const files = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(folder, sourceFilePattern),
                    excludePattern
                );
                
                console.log(`Found ${files.length} source files in ${folder.name}`);
                
                // Process max 300 files to avoid performance issues
                const filesToProcess = files.slice(0, 300);
                
                // Process files in batches to avoid UI freezes
                const batchSize = 20;
                for (let i = 0; i < filesToProcess.length; i += batchSize) {
                    const batch = filesToProcess.slice(i, i + batchSize);
                    await this.processFileBatch(batch);
                    
                    // Log progress
                    if (i % 100 === 0 && i > 0) {
                        console.log(`Processed ${i} files...`);
                    }
                }
            }
        } catch (error) {
            console.error('Error refreshing document symbol index:', error);
        } finally {
            this.isRefreshing = false;
            
            const endTime = performance.now();
            console.log(`Indexed ${this.symbolItems.length} document symbols in ${endTime - startTime}ms`);
        }
    }
    
    /**
     * Process a batch of files to extract symbols
     */
    private async processFileBatch(files: vscode.Uri[]): Promise<void> {
        for (const uri of files) {
            try {
                // Skip files that should be excluded
                if (ExclusionPatterns.shouldExclude(uri)) {
                    continue;
                }
                
                // Get document symbols using VSCode's document symbol provider
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );
                
                if (!symbols || symbols.length === 0) {
                    continue;
                }
                
                // Process symbols recursively
                this.processSymbols(symbols, uri);
            } catch (error) {
                // Continue with other files if one fails
                console.error(`Error processing file ${uri.fsPath}:`, error);
            }
        }
    }
    
    /**
     * Process symbols recursively
     */
    private processSymbols(symbols: vscode.DocumentSymbol[], uri: vscode.Uri, containerName: string = ''): void {
        for (const symbol of symbols) {
            // Determine symbol group
            const symbolGroup = mapSymbolKindToGroup(symbol.kind);
            
            // Determine if this is a class-like symbol
            const isClass = symbolGroup === SymbolKindGroup.Class;
            
            // Get priority based on symbol kind
            const priority = this.getSymbolPriority(symbol.kind);
            
            // Create a symbol item
            const symbolItem: SymbolSearchItem = {
                id: `symbol:${symbol.name}:${uri.toString()}:${symbol.range.start.line}:${symbol.range.start.character}`,
                label: symbol.name,
                description: `${this.getSymbolKindName(symbol.kind)}${containerName ? ` - ${containerName}` : ''}`,
                detail: uri.fsPath,
                type: isClass ? SearchItemType.Class : SearchItemType.Symbol,
                uri: uri,
                range: symbol.range,
                symbolKind: symbol.kind,
                symbolGroup: symbolGroup,
                priority: priority,
                iconPath: this.getSymbolIcon(symbol.kind),
                action: async () => {
                    // Open document and reveal the symbol's position
                    const document = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(document);
                    
                    // Position the cursor at the symbol and reveal it
                    const range = symbol.selectionRange;
                    editor.selection = new vscode.Selection(range.start, range.start);
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                }
            };
            
            this.symbolItems.push(symbolItem);
            
            // Process children recursively
            if (symbol.children && symbol.children.length > 0) {
                this.processSymbols(symbol.children, uri, symbol.name);
            }
        }
    }
    
    /**
     * Get priority value for a symbol kind
     * Higher values indicate higher priority in search results
     */
    private getSymbolPriority(kind: vscode.SymbolKind): number {
        switch (kind) {
            // Highest priority: Classes and interfaces
            case vscode.SymbolKind.Class:
            case vscode.SymbolKind.Interface:
            case vscode.SymbolKind.Enum:
            case vscode.SymbolKind.Struct:
                return 100;
                
            // High priority: Methods and functions
            case vscode.SymbolKind.Method:
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Constructor:
                return 90;
                
            // Medium-high priority: Properties and fields
            case vscode.SymbolKind.Property:
            case vscode.SymbolKind.Field:
            case vscode.SymbolKind.EnumMember:
                return 70;
                
            // Medium priority: Constants
            case vscode.SymbolKind.Constant:
                return 60;
                
            // Low priority: Variables
            case vscode.SymbolKind.Variable:
                return 40;
                
            // Default priority for other symbols
            default:
                return 50;
        }
    }
    
    /**
     * Get a user-friendly name for a symbol kind
     */
    private getSymbolKindName(kind: vscode.SymbolKind): string {
        switch (kind) {
            case vscode.SymbolKind.File: return 'File';
            case vscode.SymbolKind.Module: return 'Module';
            case vscode.SymbolKind.Namespace: return 'Namespace';
            case vscode.SymbolKind.Package: return 'Package';
            case vscode.SymbolKind.Class: return 'Class';
            case vscode.SymbolKind.Method: return 'Method';
            case vscode.SymbolKind.Property: return 'Property';
            case vscode.SymbolKind.Field: return 'Field';
            case vscode.SymbolKind.Constructor: return 'Constructor';
            case vscode.SymbolKind.Enum: return 'Enum';
            case vscode.SymbolKind.Interface: return 'Interface';
            case vscode.SymbolKind.Function: return 'Function';
            case vscode.SymbolKind.Variable: return 'Variable';
            case vscode.SymbolKind.Constant: return 'Constant';
            case vscode.SymbolKind.String: return 'String';
            case vscode.SymbolKind.Number: return 'Number';
            case vscode.SymbolKind.Boolean: return 'Boolean';
            case vscode.SymbolKind.Array: return 'Array';
            case vscode.SymbolKind.Object: return 'Object';
            case vscode.SymbolKind.Key: return 'Key';
            case vscode.SymbolKind.Null: return 'Null';
            case vscode.SymbolKind.EnumMember: return 'EnumMember';
            case vscode.SymbolKind.Struct: return 'Struct';
            case vscode.SymbolKind.Event: return 'Event';
            case vscode.SymbolKind.Operator: return 'Operator';
            case vscode.SymbolKind.TypeParameter: return 'TypeParameter';
            default: return 'Symbol';
        }
    }
    
    /**
     * Get an icon for a symbol kind
     */
    private getSymbolIcon(kind: vscode.SymbolKind): vscode.ThemeIcon {
        switch (kind) {
            case vscode.SymbolKind.File: return new vscode.ThemeIcon('file');
            case vscode.SymbolKind.Module: return new vscode.ThemeIcon('package');
            case vscode.SymbolKind.Namespace: return new vscode.ThemeIcon('symbol-namespace');
            case vscode.SymbolKind.Package: return new vscode.ThemeIcon('package');
            case vscode.SymbolKind.Class: return new vscode.ThemeIcon('symbol-class');
            case vscode.SymbolKind.Method: return new vscode.ThemeIcon('symbol-method');
            case vscode.SymbolKind.Property: return new vscode.ThemeIcon('symbol-property');
            case vscode.SymbolKind.Field: return new vscode.ThemeIcon('symbol-field');
            case vscode.SymbolKind.Constructor: return new vscode.ThemeIcon('symbol-constructor');
            case vscode.SymbolKind.Enum: return new vscode.ThemeIcon('symbol-enum');
            case vscode.SymbolKind.Interface: return new vscode.ThemeIcon('symbol-interface');
            case vscode.SymbolKind.Function: return new vscode.ThemeIcon('symbol-method');
            case vscode.SymbolKind.Variable: return new vscode.ThemeIcon('symbol-variable');
            case vscode.SymbolKind.Constant: return new vscode.ThemeIcon('symbol-constant');
            case vscode.SymbolKind.String: return new vscode.ThemeIcon('symbol-string');
            case vscode.SymbolKind.Number: return new vscode.ThemeIcon('symbol-numeric');
            case vscode.SymbolKind.Boolean: return new vscode.ThemeIcon('symbol-boolean');
            case vscode.SymbolKind.Array: return new vscode.ThemeIcon('symbol-array');
            case vscode.SymbolKind.Object: return new vscode.ThemeIcon('symbol-object');
            case vscode.SymbolKind.Key: return new vscode.ThemeIcon('symbol-key');
            case vscode.SymbolKind.Null: return new vscode.ThemeIcon('symbol-null');
            case vscode.SymbolKind.EnumMember: return new vscode.ThemeIcon('symbol-enum-member');
            case vscode.SymbolKind.Struct: return new vscode.ThemeIcon('symbol-struct');
            case vscode.SymbolKind.Event: return new vscode.ThemeIcon('symbol-event');
            case vscode.SymbolKind.Operator: return new vscode.ThemeIcon('symbol-operator');
            case vscode.SymbolKind.TypeParameter: return new vscode.ThemeIcon('symbol-parameter');
            default: return new vscode.ThemeIcon('symbol-misc');
        }
    }
} 