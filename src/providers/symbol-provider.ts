import * as vscode from 'vscode';
import { SearchItemType, SearchProvider, SymbolKindGroup, SymbolSearchItem, mapSymbolKindToGroup } from '../core/types';
import { Debouncer } from '../utils/debouncer';
import { ExclusionPatterns } from '../utils/exclusions';

/**
 * Provides workspace symbols for searching using VSCode's symbol providers
 */
export class SymbolSearchProvider implements SearchProvider {
    private symbolItems: SymbolSearchItem[] = [];
    private isRefreshing: boolean = false;
    private refreshDebouncer: Debouncer;
    
    constructor() {
        // Create a debouncer with 2 second delay to avoid excessive refreshes
        this.refreshDebouncer = new Debouncer(2000);
        
        // Setup automatic reindexing when documents change
        this.setupChangeListeners();
    }
    
    /**
     * Setup workspace change listeners to automatically reindex symbols
     */
    private setupChangeListeners(): void {
        // Listen for document saves - best time to update symbols
        vscode.workspace.onDidSaveTextDocument(() => {
            this.scheduleRefresh();
        });
        
        // Listen for document changes (optional, can cause heavy load)
        // Only track significant changes (50+ characters changed)
        vscode.workspace.onDidChangeTextDocument((event) => {
            // Only reindex if significant changes were made
            if (event.contentChanges.length > 0) {
                const changeSize = event.contentChanges.reduce(
                    (sum, change) => sum + change.text.length, 0
                );
                
                // If it's a significant change (e.g., added a function or class)
                if (changeSize > 50) {
                    this.scheduleRefresh();
                }
            }
        });
        
        // Listen for document closes (could be save, delete, or rename)
        vscode.workspace.onDidCloseTextDocument(() => {
            this.scheduleRefresh();
        });
        
        // Listen for folder changes
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            this.refreshDebouncer.clear(); // Clear any pending updates
            this.refresh(); // Refresh immediately
        });
    }
    
    /**
     * Schedule a refresh operation, debounced to prevent excessive updates
     */
    private scheduleRefresh(): void {
        console.log('Scheduling symbol index refresh...');
        this.refreshDebouncer.debounce(() => {
            this.refresh();
        });
    }
    
    /**
     * Get all indexed workspace symbol items
     */
    public async getItems(): Promise<SymbolSearchItem[]> {
        if (this.symbolItems.length === 0 && !this.isRefreshing) {
            await this.refresh();
        }
        return this.symbolItems;
    }
    
    /**
     * Refresh the workspace symbol index
     * This uses VSCode's built-in workspace symbol provider which indexes ALL symbols
     * @param force If true, forces refresh even if already refreshing
     */
    public async refresh(force: boolean = false): Promise<void> {
        if (this.isRefreshing && !force) {
            return;
        }
        
        this.isRefreshing = true;
        console.log('Refreshing workspace symbol index...');
        const startTime = performance.now();
        
        this.symbolItems = [];
        
        try {
            // First, get all basic workspace symbols with an empty query
            // This typically returns all exported/public symbols
            const basicSymbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                ''
            ) || [];
            
            // Then try with wildcard queries to ensure we get a comprehensive set
            // These patterns help find symbols that might not be returned with an empty query
            const queryPatterns = ['*', 'a*', 'b*', 'c*', 'd*', 'e*', 'f*', 'g*', 'h*', 'i*', 
                                  'j*', 'k*', 'l*', 'm*', 'n*', 'o*', 'p*', 'q*', 'r*', 's*', 
                                  't*', 'u*', 'v*', 'w*', 'x*', 'y*', 'z*', '_*', '$*'];
            
            // We'll collect all symbols here
            const allSymbols: vscode.SymbolInformation[] = [...basicSymbols];
            const symbolIds = new Set(basicSymbols.map(s => this.getSymbolId(s)));
            
            // Run each query and add unique symbols
            for (const pattern of queryPatterns) {
                const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                    'vscode.executeWorkspaceSymbolProvider',
                    pattern
                ) || [];
                
                // Only add new unique symbols
                for (const symbol of symbols) {
                    const id = this.getSymbolId(symbol);
                    if (!symbolIds.has(id)) {
                        symbolIds.add(id);
                        allSymbols.push(symbol);
                    }
                }
            }
            
            console.log(`Found ${allSymbols.length} total workspace symbols (before filtering)`);
            
            // Filter out symbols from excluded paths
            const filteredSymbols = allSymbols.filter(symbol => 
                !ExclusionPatterns.shouldExclude(symbol.location.uri)
            );
            
            console.log(`Filtered to ${filteredSymbols.length} symbols after applying exclusions`);
            
            // Convert all symbols to SearchItems
            this.symbolItems = filteredSymbols.map(symbol => this.convertToSearchItem(symbol));
        } catch (error) {
            console.error('Error refreshing symbol index:', error);
        } finally {
            this.isRefreshing = false;
            
            const endTime = performance.now();
            console.log(`Indexed ${this.symbolItems.length} symbols in ${endTime - startTime}ms`);
        }
    }
    
    /**
     * Generate a unique ID for a symbol
     */
    private getSymbolId(symbol: vscode.SymbolInformation): string {
        return `symbol:${symbol.name}:${symbol.location.uri.toString()}:${symbol.location.range.start.line}:${symbol.location.range.start.character}`;
    }
    
    /**
     * Convert a SymbolInformation to a SearchItem
     */
    private convertToSearchItem(symbol: vscode.SymbolInformation): SymbolSearchItem {
        // Determine symbol group
        const symbolGroup = mapSymbolKindToGroup(symbol.kind);
        
        // Determine if this is a class-like symbol
        const isClass = symbolGroup === SymbolKindGroup.Class;
        
        // Get priority based on symbol kind
        const priority = this.getSymbolPriority(symbol.kind);
        
        return {
            id: this.getSymbolId(symbol),
            label: symbol.name,
            description: `${this.getSymbolKindName(symbol.kind)}${symbol.containerName ? ` - ${symbol.containerName}` : ''}`,
            detail: symbol.location.uri.fsPath,
            type: isClass ? SearchItemType.Class : SearchItemType.Symbol,
            uri: symbol.location.uri,
            range: symbol.location.range,
            symbolKind: symbol.kind,
            symbolGroup: symbolGroup,
            priority: priority,
            iconPath: this.getSymbolIcon(symbol.kind),
            action: async () => {
                // Open document and reveal the symbol's position
                const document = await vscode.workspace.openTextDocument(symbol.location.uri);
                const editor = await vscode.window.showTextDocument(document);
                
                // Position the cursor and reveal the range
                const range = symbol.location.range;
                editor.selection = new vscode.Selection(range.start, range.start);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            }
        };
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