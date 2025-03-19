import * as vscode from 'vscode';
import { FuzzySearcher, SearchEverywhereConfig, SearchItem, SearchItemType, SearchProvider } from './types';
import { FileSearchProvider } from '../providers/file-provider';
import { CommandSearchProvider } from '../providers/command-provider';
import { SymbolSearchProvider } from '../providers/symbol-provider';
import { DocumentSymbolProvider } from '../providers/document-symbol-provider';
import { TextSearchProvider } from '../providers/text-provider';
import { getConfiguration } from '../utils/config';
import { SearchFactory } from '../search/search-factory';
import { Debouncer } from '../utils/debouncer';

/**
 * Main service for coordinating search functionality
 */
export class SearchService {
    private providers: Map<string, SearchProvider> = new Map();
    private searcher: FuzzySearcher;
    private config: SearchEverywhereConfig;
    private allItems: SearchItem[] = [];
    private recentlyModifiedFiles: Map<string, number> = new Map(); // Uri -> timestamp
    private activityDebouncer: Debouncer;
    private indexUpdateDebouncer: Debouncer;

    /**
     * Initialize the search service
     */
    constructor(private context: vscode.ExtensionContext) {
        // Get initial configuration
        this.config = getConfiguration();

        // Create the searcher based on configuration
        this.searcher = SearchFactory.createSearcher(this.config.fuzzySearch.library);

        // Set up debouncers
        this.activityDebouncer = new Debouncer(500);
        this.indexUpdateDebouncer = new Debouncer(3500); // Wait a bit longer than provider refresh

        // Register search providers
        this.registerProviders();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('searchEverywhere')) {
                this.config = getConfiguration();

                // Update searcher if library changed
                if (e.affectsConfiguration('searchEverywhere.fuzzySearch.library')) {
                    this.searcher = SearchFactory.createSearcher(this.config.fuzzySearch.library);
                }

                // Refresh providers if indexing settings changed
                if (e.affectsConfiguration('searchEverywhere.indexing')) {
                    this.refreshIndex();
                }
            }
        });

        // Track file activity
        this.trackFileActivity();

        // Watch for file changes to update indexes
        this.watchFileChanges();

        // Initial index
        this.refreshIndex();
    }

    /**
     * Watch for file changes to update the indexes
     */
    private watchFileChanges(): void {
        // Watch for file saves - the providers will refresh internally, we need to collect their results
        vscode.workspace.onDidSaveTextDocument(() => {
            console.log('File saved, scheduling index update...');
            this.scheduleIndexUpdate();
        });

        // Watch for file deletions, renames, etc.
        vscode.workspace.onDidCloseTextDocument(() => {
            console.log('File closed, scheduling index update...');
            this.scheduleIndexUpdate();
        });
    }

    /**
     * Schedule an index update, debounced to avoid too many updates
     */
    private scheduleIndexUpdate(): void {
        this.indexUpdateDebouncer.debounce(() => {
            console.log('Updating search index after file changes...');
            // Pull the latest items from all providers without forcing a full refresh
            this.updateIndexFromProviders();
        });
    }

    /**
     * Update the index by getting the latest items from all providers
     * This is faster than a full refresh because it doesn't force providers to re-index
     */
    private async updateIndexFromProviders(): Promise<void> {
        // Temporary map to deduplicate items
        const deduplicationMap = new Map<string, SearchItem>();

        // Collect latest items from all providers
        for (const [name, provider] of this.providers.entries()) {
            try {
                const items = await provider.getItems();

                console.log(`Got ${items.length} items from ${name} provider after file change`);

                // Deduplicate items as they come in
                for (const item of items) {
                    const dedupeKey = this.getDeduplicationKey(item);

                    if (!deduplicationMap.has(dedupeKey)) {
                        deduplicationMap.set(dedupeKey, item);
                    }
                }
            } catch (error) {
                console.error(`Error getting items from ${name} provider:`, error);
            }
        }

        // Update the allItems array with the latest items
        this.allItems = Array.from(deduplicationMap.values());

        console.log(`Index update completed: ${this.allItems.length} items (after deduplication)`);
    }

    /**
     * Track user file activity to boost recently modified files in search results
     */
    private trackFileActivity(): void {
        // Track document saves
        vscode.workspace.onDidSaveTextDocument(document => {
            this.trackDocumentActivity(document.uri);
        });

        // Track active editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document) {
                this.trackDocumentActivity(editor.document.uri);
            }
        });
    }

    /**
     * Track document activity
     */
    private trackDocumentActivity(uri: vscode.Uri): void {
        this.activityDebouncer.debounce(() => {
            // Record the timestamp when this file was accessed
            this.recentlyModifiedFiles.set(uri.toString(), Date.now());

            // Keep only the 20 most recent files
            if (this.recentlyModifiedFiles.size > 20) {
                // Get all entries sorted by timestamp (oldest first)
                const entries = [...this.recentlyModifiedFiles.entries()]
                    .sort((a, b) => a[1] - b[1]);

                // Remove the oldest entry
                this.recentlyModifiedFiles.delete(entries[0][0]);
            }
        });
    }

    /**
     * Register all search providers
     */
    private registerProviders(): void {
        // Add file provider
        if (this.config.indexing.includeFiles) {
            this.providers.set('files', new FileSearchProvider());
        }

        // Add symbol providers
        if (this.config.indexing.includeSymbols) {
            this.providers.set('symbols', new SymbolSearchProvider());
            this.providers.set('docSymbols', new DocumentSymbolProvider());
        }

        // Add command provider
        if (this.config.indexing.includeCommands) {
            this.providers.set('commands', new CommandSearchProvider());
        }

        // Add text search provider
        if (this.config.indexing.includeText) {
            this.providers.set('text', new TextSearchProvider());
        }
    }

    /**
     * Refresh all search indexes
     * @param force If true, forces a complete reindex even if the provider is already refreshing
     */
    public async refreshIndex(force: boolean = false): Promise<void> {
        // Clear existing items
        this.allItems = [];

        // Refresh providers based on configuration
        this.providers.clear();
        this.registerProviders();

        // Temporary map to deduplicate items
        const deduplicationMap = new Map<string, SearchItem>();

        // Collect items from all providers
        for (const [name, provider] of this.providers.entries()) {
            try {
                // If force is true, we'll manually call refresh on each provider
                if (force) {
                    console.log(`Forcing refresh of ${name} provider...`);
                    await provider.refresh();
                }

                const items = await provider.getItems();

                console.log(`Got ${items.length} items from ${name} provider`);

                // Deduplicate items as they come in
                for (const item of items) {
                    const dedupeKey = this.getDeduplicationKey(item);

                    if (!deduplicationMap.has(dedupeKey)) {
                        deduplicationMap.set(dedupeKey, item);
                    }
                }
            } catch (error) {
                console.error(`Error getting items from ${name} provider:`, error);
            }
        }

        // Convert the deduplication map to the array
        this.allItems = Array.from(deduplicationMap.values());

        console.log(`Indexing completed: ${this.allItems.length} items (after deduplication)`);
    }

    /**
     * Generate a key for deduplicating search items
     */
    private getDeduplicationKey(item: SearchItem): string {
        // Normalize the label by removing parentheses from method names
        const normalizedLabel = item.label.replace(/\(\)$/, '');

        if (item.type === SearchItemType.Symbol && 'uri' in item && 'range' in item) {
            // For symbols, deduplicate based on name, uri, and position
            const symbolItem = item as { uri: vscode.Uri, range: vscode.Range };

            return `symbol:${normalizedLabel}:${symbolItem.uri.toString()}:${symbolItem.range.start.line}:${symbolItem.range.start.character}`;
        } else if (item.type === SearchItemType.Class && 'uri' in item && 'range' in item) {
            // For classes, deduplicate based on name, uri, and position
            const classItem = item as { uri: vscode.Uri, range: vscode.Range };

            return `class:${normalizedLabel}:${classItem.uri.toString()}:${classItem.range.start.line}:${classItem.range.start.character}`;
        } else if (item.type === SearchItemType.File && 'uri' in item) {
            // For files, deduplicate based on URI
            const fileItem = item as { uri: vscode.Uri };

            return `file:${fileItem.uri.toString()}`;
        } else if (item.type === SearchItemType.Command && 'command' in item) {
            // For commands, deduplicate based on command id
            const cmdItem = item as { command: string };

            return `command:${cmdItem.command}`;
        }

        // Fallback to the item ID with normalized label
        return `${item.type}:${normalizedLabel}:${item.id.split(':').slice(1).join(':')}`;
    }

    /**
     * Search for items matching the query
     */
    public async search(query: string): Promise<SearchItem[]> {
        // If nothing indexed yet, refresh
        if (this.allItems.length === 0) {
            await this.refreshIndex();
        }
        let results: SearchItem[] = [];

        // Get text search results if enabled (these are always on-demand)
        if (this.config.indexing.includeText && query.trim()) {
            try {
                const textProvider = this.providers.get('text') as TextSearchProvider;

                if (textProvider) {
                    const textResults = await textProvider.search(query);

                    results = [...textResults];
                }
            } catch (error) {
                console.error('Error performing text search:', error);
            }
        }
        // If no query, return all indexed items
        if (!query.trim()) {
            // Sort by priority for empty queries
            const sortedItems = [...this.allItems];

            this.sortResultsByPriority(sortedItems);

            return sortedItems.slice(0, this.config.performance.maxResults);
        }
        // Perform fuzzy search on indexed items
        const fuzzyResults = await this.searcher.search(
            this.allItems,
            query,
            this.config.performance.maxResults
        );

        // Combine fuzzy and text results
        results = [...results, ...fuzzyResults];
        // Boost recently modified files
        if (this.config.activity.enabled && this.recentlyModifiedFiles.size > 0) {
            this.boostRecentlyModifiedItems(results);
        }
        // Apply priority-based sorting as a tie-breaker
        this.sortResultsByPriority(results);

        // Limit to max results
        return results.slice(0, this.config.performance.maxResults);
    }

    /**
     * Sort search results by score and priority
     * This ensures that higher priority items (like classes and methods)
     * appear before lower priority items (like variables) when scores are similar
     */
    private sortResultsByPriority(results: SearchItem[]): void {
        results.sort((a, b) => {
            // If both items have scores and they differ significantly
            if ('score' in a && 'score' in b &&
                typeof a.score === 'number' && typeof b.score === 'number' &&
                Math.abs(a.score - b.score) > 0.1) {
                // Sort by score (higher score first)
                return b.score - a.score;
            }

            // If scores are similar or not available, use priority as tie-breaker
            const priorityA = a.priority || 50; // Default priority if not specified
            const priorityB = b.priority || 50;

            return priorityB - priorityA; // Higher priority first
        });
    }

    /**
     * Boost items related to recently modified files
     */
    private boostRecentlyModifiedItems(results: SearchItem[]): void {
        const activityWeight = this.config.activity.weight;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

        for (const item of results) {
            // Check if this item is related to a recently modified file
            if (item.type === SearchItemType.File && 'uri' in item) {
                const fileItem = item as { uri: vscode.Uri };
                const timestamp = this.recentlyModifiedFiles.get(fileItem.uri.toString());

                if (timestamp) {
                    // Calculate a recency score (1.0 for just modified, decreasing over time)
                    const age = now - timestamp;
                    const recencyScore = Math.max(0, 1 - (age / oneHour));

                    // Apply the recency boost based on configuration weight
                    const boost = 1 + (recencyScore * activityWeight);

                    // Boost the result's score if it has one
                    if ('score' in item && typeof item.score === 'number') {
                        item.score *= boost;
                    }
                }
            }
            // Boost symbols from recently modified files
            else if (item.type === SearchItemType.Symbol && 'uri' in item) {
                const symbolItem = item as { uri: vscode.Uri };
                const timestamp = this.recentlyModifiedFiles.get(symbolItem.uri.toString());

                if (timestamp) {
                    const age = now - timestamp;
                    const recencyScore = Math.max(0, 1 - (age / oneHour));
                    const boost = 1 + (recencyScore * activityWeight * 0.5); // Slightly less boost for symbols

                    if ('score' in item && typeof item.score === 'number') {
                        item.score *= boost;
                    }
                }
            }
        }
    }

    /**
     * Run benchmarks for different search libraries
     */
    public async runBenchmarks(query: string): Promise<Record<string, number>> {
        const benchmarks: Record<string, number> = {};
        const searchers = SearchFactory.getAllSearchers();

        for (const searcher of searchers) {
            const startTime = performance.now();

            // Run search 5 times and take average
            for (let i = 0; i < 5; i++) {
                await searcher.search(this.allItems, query, 100);
            }

            const endTime = performance.now();
            const averageTime = (endTime - startTime) / 5;

            benchmarks[searcher.name] = averageTime;
        }

        return benchmarks;
    }
}
