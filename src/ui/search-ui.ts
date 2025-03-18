import * as vscode from 'vscode';
import { SearchItem, SearchItemType } from '../core/types';
import { SearchService } from '../core/search-service';
import { getConfiguration } from '../utils/config';

/**
 * Filter categories for search results
 */
export enum FilterCategory {
    All = 'all',
    Classes = 'classes',
    Files = 'files',
    Symbols = 'symbols',
    Actions = 'actions',
    Text = 'text'  // For future implementation
}

/**
 * Manages the VSCode UI for search everywhere
 */
export class SearchUI {
    private quickPick: vscode.QuickPick<SearchQuickPickItem>;
    private searchDebounce: NodeJS.Timeout | undefined;
    private lastQuery: string = '';
    private config = getConfiguration();
    private previewDisposables: vscode.Disposable[] = [];
    
    // Active filter category
    private activeFilter: FilterCategory = FilterCategory.All;
    
    // Custom buttons for filter categories
    private filterButtons: Map<FilterCategory, vscode.QuickInputButton> = new Map();
    
    // Prefixes for button tooltips
    private readonly ACTIVE_PREFIX = '● '; // Filled circle for active filter
    private readonly INACTIVE_PREFIX = '○ '; // Empty circle for inactive filter
    
    /**
     * Initialize the search UI
     */
    constructor(private searchService: SearchService) {
        // Create quick pick UI
        this.quickPick = vscode.window.createQuickPick<SearchQuickPickItem>();
        this.quickPick.placeholder = 'Type to search everywhere (files, classes, symbols...)';
        this.quickPick.matchOnDescription = false;
        this.quickPick.matchOnDetail = false;
        this.quickPick.ignoreFocusOut = false;
        
        // Create filter category buttons
        this.createFilterButtons();
        
        // Set initial buttons
        this.updateFilterButtons();
        
        // Set up event handlers
        this.quickPick.onDidChangeValue(this.onDidChangeValue.bind(this));
        this.quickPick.onDidAccept(this.onDidAccept.bind(this));
        this.quickPick.onDidHide(this.onDidHide.bind(this));
        this.quickPick.onDidTriggerButton(this.onDidTriggerButton.bind(this));
        
        // Add preview handler
        this.quickPick.onDidChangeActive(this.onDidChangeActive.bind(this));
        
        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('searchEverywhere.preview')) {
                this.config = getConfiguration();
            }
        });
    }
    
    /**
     * Create filter buttons for each category
     */
    private createFilterButtons(): void {
        // Define icons for each category
        this.filterButtons.set(FilterCategory.All, {
            iconPath: new vscode.ThemeIcon('search'),
            tooltip: this.INACTIVE_PREFIX + 'All'
        });
        
        this.filterButtons.set(FilterCategory.Classes, {
            iconPath: new vscode.ThemeIcon('symbol-class'),
            tooltip: this.INACTIVE_PREFIX + 'Classes'
        });
        
        this.filterButtons.set(FilterCategory.Files, {
            iconPath: new vscode.ThemeIcon('file'),
            tooltip: this.INACTIVE_PREFIX + 'Files'
        });
        
        this.filterButtons.set(FilterCategory.Symbols, {
            iconPath: new vscode.ThemeIcon('symbol-method'),
            tooltip: this.INACTIVE_PREFIX + 'Symbols'
        });
        
        this.filterButtons.set(FilterCategory.Actions, {
            iconPath: new vscode.ThemeIcon('run'),
            tooltip: this.INACTIVE_PREFIX + 'Actions'
        });
    }
    
    /**
     * Update the filter buttons in the UI based on the active filter
     */
    private updateFilterButtons(): void {
        // Create all filter buttons with updated states
        const buttons: vscode.QuickInputButton[] = [];
        const filterNames: string[] = []; // Collect names for the placeholder text
        
        // Add buttons in the desired order
        const orderedFilters = [
            FilterCategory.All,
            FilterCategory.Classes,
            FilterCategory.Files, 
            FilterCategory.Symbols,
            FilterCategory.Actions
        ];
        
        for (const filter of orderedFilters) {
            // Get the base filter button
            const baseButton = this.filterButtons.get(filter);
            if (!baseButton) {continue;}
            
            const isActive = filter === this.activeFilter;
            const filterName = filter.charAt(0).toUpperCase() + filter.slice(1);
            
            // Track filter name (with highlighting if active)
            filterNames.push(isActive ? `[${filterName}]` : filterName);
            
            // Get base name without the prefix
            const baseName = (baseButton.tooltip || '').replace(this.ACTIVE_PREFIX, '').replace(this.INACTIVE_PREFIX, '');
            
            // Create a modified button with visual indicator for the active filter
            const button: vscode.QuickInputButton = {
                // Use dramatically different icons for active vs inactive filters
                iconPath: isActive 
                    ? this.getActiveIcon(filter)
                    : baseButton.iconPath,
                // Add visual distinguisher to the tooltip text
                tooltip: isActive 
                    ? this.ACTIVE_PREFIX + baseName
                    : this.INACTIVE_PREFIX + baseName
            };
            
            buttons.push(button);
        }
        
        // Update the QuickPick interface
        this.quickPick.buttons = buttons;
        
        // Update placeholder text with filter information
        if (this.activeFilter !== FilterCategory.All) {
            const activeFilterName = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1);
            this.quickPick.placeholder = `Searching in ${activeFilterName} only. Type to search...`;
        } else {
            this.quickPick.placeholder = 'Type to search everywhere (files, classes, symbols...)';
        }
    }
    
    /**
     * Get a visually distinct active icon
     */
    private getActiveIcon(filter: FilterCategory): vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri } {
        // Use strongly contrasting icons for active state
        switch (filter) {
            case FilterCategory.All:
                return new vscode.ThemeIcon('search', new vscode.ThemeColor('focusBorder'));
                
            case FilterCategory.Classes:
                return new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor('focusBorder'));
                
            case FilterCategory.Files:
                return new vscode.ThemeIcon('files', new vscode.ThemeColor('focusBorder')); // Plural 'files' icon is different
                
            case FilterCategory.Symbols:
                return new vscode.ThemeIcon('symbol-field', new vscode.ThemeColor('focusBorder')); // Different symbol icon
                
            case FilterCategory.Actions:
                return new vscode.ThemeIcon('play', new vscode.ThemeColor('focusBorder')); // Use 'play' instead of 'run'
                
            default:
                return new vscode.ThemeIcon('search', new vscode.ThemeColor('focusBorder'));
        }
    }
    
    /**
     * Handle button clicks for category filters
     */
    private onDidTriggerButton(button: vscode.QuickInputButton): void {
        // Extract the base tooltip without prefixes
        const tooltip = button.tooltip || '';
        const baseTooltip = tooltip
            .replace(this.ACTIVE_PREFIX, '')
            .replace(this.INACTIVE_PREFIX, '');
        
        // Find which filter button was clicked
        for (const [category, filterButton] of this.filterButtons.entries()) {
            const buttonBaseTooltip = (filterButton.tooltip || '')
                .replace(this.ACTIVE_PREFIX, '')
                .replace(this.INACTIVE_PREFIX, '');
                
            if (buttonBaseTooltip === baseTooltip) {
                // Set the active filter
                this.activeFilter = category;
                
                // Clear search debounce
                if (this.searchDebounce) {
                    clearTimeout(this.searchDebounce);
                }
                
                // Update title to show active filter
                this.updateTitle();
                
                // Update buttons to highlight the active one
                this.updateFilterButtons();
                
                // Perform search with current query
                this.performSearch(this.lastQuery);
                break;
            }
        }
    }
    
    /**
     * Update the title of the quick pick to reflect the active filter
     */
    private updateTitle(): void {
        const filterName = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1);
        
        if (this.activeFilter === FilterCategory.All) {
            this.quickPick.title = 'Search Everywhere';
        } else {
            // Use special characters for emphasis since codicons don't work in title
            this.quickPick.title = `⟪ ${filterName} ⟫`;
        }
    }
    
    /**
     * Show the search dialog
     */
    public show(): void {
        // Always reset to "All" filter when opening
        this.activeFilter = FilterCategory.All;
        
        // Clear any previous search query
        this.quickPick.value = '';
        this.lastQuery = '';
        
        // Refresh configuration
        this.config = getConfiguration();
        
        // Update buttons to reflect the active filter
        this.updateFilterButtons();
        
        // Update title
        this.updateTitle();
        
        // Show the quick pick
        this.quickPick.show();
        
        // When opened with no query, show most-used items
        this.performSearch('');
    }
    
    /**
     * Handle user typing in the search box
     */
    private onDidChangeValue(value: string): void {
        // Clear any scheduled search
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
        
        // Don't search again if the query hasn't changed
        if (value === this.lastQuery) {
            return;
        }
        
        this.lastQuery = value;
        
        // Show "Searching..." when query changes
        this.quickPick.busy = true;
        
        // Debounce to avoid excessive searches while typing
        this.searchDebounce = setTimeout(() => {
            this.performSearch(value);
        }, 50); // Very short delay for responsiveness
    }
    
    /**
     * Execute search and update UI
     */
    private async performSearch(query: string): Promise<void> {
        try {
            this.quickPick.busy = true;
            
            // Perform search
            const results = await this.searchService.search(query);
            
            // Apply category filters
            const filteredResults = this.applyCategoryFilter(results);
            
            // Map to QuickPickItems
            const items = filteredResults.map(item => this.createQuickPickItem(item));
            
            // Group items by type
            this.quickPick.items = this.groupItemsByType(items);
            
        } catch (error) {
            console.error('Error performing search:', error);
            this.quickPick.placeholder = 'Error performing search';
        } finally {
            this.quickPick.busy = false;
        }
    }
    
    /**
     * Apply the active category filter to search results
     */
    private applyCategoryFilter(items: SearchItem[]): SearchItem[] {
        // If "All" is selected, return all items
        if (this.activeFilter === FilterCategory.All) {
            return items;
        }
        
        // Otherwise, filter based on the selected category
        return items.filter(item => {
            switch (this.activeFilter) {
                case FilterCategory.Classes:
                    return item.type === SearchItemType.Class;
                    
                case FilterCategory.Files:
                    return item.type === SearchItemType.File;
                    
                case FilterCategory.Symbols:
                    return item.type === SearchItemType.Symbol;
                    
                case FilterCategory.Actions:
                    return item.type === SearchItemType.Command;
                    
                default:
                    return true;
            }
        });
    }
    
    /**
     * Handle user selecting an item
     */
    private async onDidAccept(): Promise<void> {
        const selectedItems = this.quickPick.selectedItems;
        if (selectedItems.length > 0) {
            const selectedItem = selectedItems[0];
            
            // Close the quick pick
            this.quickPick.hide();
            
            // Execute the action
            try {
                if (selectedItem.originalItem) {
                    await selectedItem.originalItem.action();
                }
            } catch (error) {
                console.error('Error executing action:', error);
                vscode.window.showErrorMessage(`Error executing action: ${error}`);
            }
        }
    }
    
    /**
     * Handle user closing the dialog
     */
    private onDidHide(): void {
        // Clear any scheduled search
        if (this.searchDebounce) {
            clearTimeout(this.searchDebounce);
        }
        
        // Clear quick pick items to free memory
        this.quickPick.items = [];
        
        // Dispose of any preview disposables
        this.disposePreviewDisposables();
    }
    
    /**
     * Dispose of preview-related disposables
     */
    private disposePreviewDisposables(): void {
        for (const disposable of this.previewDisposables) {
            disposable.dispose();
        }
        this.previewDisposables = [];
    }
    
    /**
     * Handle selection changes for previewing
     */
    private onDidChangeActive(items: readonly SearchQuickPickItem[]): void {
        // Skip if preview is disabled or no items are selected
        if (!this.config.preview.enabled || items.length === 0) {
            return;
        }
        
        // Get the selected item
        const selectedItem = items[0];
        
        // Skip separators and items without an original item
        if (selectedItem.kind === vscode.QuickPickItemKind.Separator || !selectedItem.originalItem) {
            return;
        }
        
        // Clear previous preview disposables
        this.disposePreviewDisposables();
        
        // Handle different types of items
        const item = selectedItem.originalItem;
        
        // Only preview items that have a URI and can be opened in the editor
        if ('uri' in item && item.uri instanceof vscode.Uri) {
            this.previewItem(item as SearchItem & { uri: vscode.Uri });
        }
    }
    
    /**
     * Preview a search item in the editor
     */
    private async previewItem(item: SearchItem & { uri: vscode.Uri }): Promise<void> {
        try {
            // Open the document
            const document = await vscode.workspace.openTextDocument(item.uri);
            
            // Define preview options
            const options: vscode.TextDocumentShowOptions = {
                preserveFocus: true, // Keep focus on the search dialog
                preview: true        // Show in preview tab
            };
            
            // Add range if available (for symbols)
            if ('range' in item && item.range instanceof vscode.Range) {
                options.selection = item.range;
            }
            
            // Show the document
            const editor = await vscode.window.showTextDocument(document, options);
            
            // Highlight the range if available
            if ('range' in item && item.range instanceof vscode.Range) {
                // Create decoration type for highlighting
                const decorationType = vscode.window.createTextEditorDecorationType({
                    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
                    borderColor: new vscode.ThemeColor('editor.findMatchHighlightBorder')
                });
                
                // Apply decoration
                editor.setDecorations(decorationType, [item.range]);
                
                // Add to disposables to clean up when selection changes
                this.previewDisposables.push(decorationType);
            }
        } catch (error) {
            console.error('Error previewing item:', error);
        }
    }
    
    /**
     * Convert a SearchItem to a QuickPickItem
     */
    private createQuickPickItem(item: SearchItem): SearchQuickPickItem {
        // Enhance the label based on the active filter
        let label = item.label;
        
        // Get relative path for description if item has a URI
        let description = item.description || '';
        let detail = '';
        
        if ('uri' in item && item.uri instanceof vscode.Uri) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(item.uri);
            if (workspaceFolder) {
                // Get the relative path from the workspace root
                description = vscode.workspace.asRelativePath(item.uri);
                
                // Add line number for symbols and classes
                if (('range' in item) && 
                    (item.type === SearchItemType.Symbol || item.type === SearchItemType.Class)) {
                    const symbolItem = item as { range: vscode.Range };
                    const lineNumber = symbolItem.range.start.line + 1; // Convert to 1-based line number
                    description = `${description}:${lineNumber}`;
                }
                
                // Don't show the absolute path in the detail field
                // We'll keep detail empty or use it for other information
            }
        } else {
            // For non-file items, keep the original detail
            detail = item.detail || '';
        }

        return {
            label: label,
            description: description,
            detail: detail,
            iconPath: item.iconPath instanceof vscode.ThemeIcon ? item.iconPath : undefined,
            originalItem: item,
            type: item.type
        };
    }
    
    /**
     * Group items by type for better organization
     */
    private groupItemsByType(items: SearchQuickPickItem[]): SearchQuickPickItem[] {
        const groupedItems: SearchQuickPickItem[] = [];
        
        // Group items by type
        const itemsByType = new Map<SearchItemType, SearchQuickPickItem[]>();
        for (const item of items) {
            if (!itemsByType.has(item.type)) {
                itemsByType.set(item.type, []);
            }
            itemsByType.get(item.type)!.push(item);
        }
        
        // Define the order of types for display
        const typeOrder: SearchItemType[] = [
            SearchItemType.Class,
            SearchItemType.File,
            SearchItemType.Symbol,
            SearchItemType.Command
        ];
        
        // Add section headers and items in the defined order
        for (const type of typeOrder) {
            const typeItems = itemsByType.get(type);
            
            // Skip empty sections
            if (!typeItems || typeItems.length === 0) {
                continue;
            }
            
            // Create a more visually distinct header for the active filter's section
            const typeName = this.getTypeName(type);
            const isActiveFilterSection = 
                (this.activeFilter === FilterCategory.Classes && type === SearchItemType.Class) ||
                (this.activeFilter === FilterCategory.Files && type === SearchItemType.File) ||
                (this.activeFilter === FilterCategory.Symbols && type === SearchItemType.Symbol) ||
                (this.activeFilter === FilterCategory.Actions && type === SearchItemType.Command);
                
            const headerPrefix = isActiveFilterSection ? '▶ ' : '';
                
            // Add section header with enhanced visual distinction for active filter
            groupedItems.push({
                label: `${headerPrefix}${typeName} (${typeItems.length})`,
                kind: vscode.QuickPickItemKind.Separator,
                type: type
            });
            
            // Add items
            groupedItems.push(...typeItems);
        }
        
        return groupedItems;
    }
    
    /**
     * Get a user-friendly name for a search item type
     */
    private getTypeName(type: SearchItemType): string {
        switch (type) {
            case SearchItemType.File:
                return 'Files';
            case SearchItemType.Symbol:
                return 'Symbols';
            case SearchItemType.Class:
                return 'Classes';
            case SearchItemType.Command:
                return 'Actions';
            default:
                return 'Items';
        }
    }
}

/**
 * Extended QuickPickItem with search-specific properties
 */
interface SearchQuickPickItem extends vscode.QuickPickItem {
    originalItem?: SearchItem;
    type: SearchItemType;
} 