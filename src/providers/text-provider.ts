import * as vscode from 'vscode';
import { SearchItemType, SearchProvider, TextMatchItem } from '../core/types';
import { ExclusionPatterns } from '../utils/exclusions';
import Logger from '../utils/logging';

/**
 * Interface for text search results
 */
interface TextSearchMatch {
    uri: vscode.Uri;
    range: vscode.Range;
    preview: {
        text: string;
        matches?: Array<{ text: string }>;
    };
}

/**
 * Provides text search results from file contents
 */
export class TextSearchProvider implements SearchProvider {
    private isSearching: boolean = false;
    private lastQuery: string = '';
    private searchResults: TextMatchItem[] = [];
    private searchCancellation: vscode.CancellationTokenSource | null = null;

    constructor() {
        // No indexing needed, searches are performed on demand
    }

    /**
     * Get the current search results
     */
    public async getItems(): Promise<TextMatchItem[]> {
        return this.searchResults;
    }

    /**
     * Refresh implementation (required by SearchProvider interface)
     * For text search, refreshing does nothing as searches are on-demand
     */
    public async refresh(): Promise<void> {
        // Text searches are performed on demand, so no need to refresh
        this.searchResults = [];

        return Promise.resolve();
    }

    /**
     * Perform a text search with the given query
     */
    public async search(query: string): Promise<TextMatchItem[]> {
        // If query is empty, return empty results
        if (!query.trim()) {
            this.searchResults = [];

            return this.searchResults;
        }

        // If we're already searching with the same query, return the current results
        if (this.isSearching && this.lastQuery === query) {
            return this.searchResults;
        }

        // If we're searching with a different query, cancel the current search
        if (this.isSearching) {
            this.cancelSearch();
        }

        // Start a new search
        this.lastQuery = query;
        this.isSearching = true;
        this.searchResults = [];

        try {
            // Create cancellation token for this search
            this.searchCancellation = new vscode.CancellationTokenSource();

            // Set up the search options
            const searchOptions = {
                useIgnoreFiles: true,
                useGlobalIgnoreFiles: true,
                maxResults: 1000, // We'll limit the results per file later
                exclude: this.getExclusionGlobPattern(),
            };

            // Perform the search
            Logger.debug(`Starting text search for: ${query}`);
            const startTime = performance.now();

            // Use VS Code's search API
            const searchResults = await vscode.workspace.findFiles(
                '**/*',
                searchOptions.exclude,
                searchOptions.maxResults,
                this.searchCancellation.token
            );

            // We need to manually search the files
            for (const uri of searchResults) {
                if (this.searchCancellation?.token.isCancellationRequested) {
                    break;
                }

                await this.searchInFile(uri, query);
            }

            const endTime = performance.now();

            Logger.debug(`Text search completed in ${endTime - startTime}ms, found ${this.searchResults.length} results`);

            return this.searchResults;
        } catch (error) {
            Logger.debug(`Error performing text search: ${error}`);

            return this.searchResults;
        } finally {
            this.isSearching = false;
            this.searchCancellation = null;
        }
    }

    /**
     * Search for text within a file
     */
    private async searchInFile(uri: vscode.Uri, query: string): Promise<void> {
        try {
            // Skip excluded files
            if (ExclusionPatterns.shouldExclude(uri)) {
                return;
            }

            // Read the file content
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();

            // Simple search implementation
            const lines = text.split('\n');
            const queryLower = query.toLowerCase();

            // Search each line
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                const line = lines[lineIndex];
                const lineTextLower = line.toLowerCase();

                // Check if line contains the query
                if (lineTextLower.includes(queryLower)) {
                    // Find the character position of the match
                    const charIndex = lineTextLower.indexOf(queryLower);

                    // Create a range for the match
                    const startPos = new vscode.Position(lineIndex, charIndex);
                    const endPos = new vscode.Position(lineIndex, charIndex + query.length);
                    const range = new vscode.Range(startPos, endPos);

                    // Create a match object
                    const match: TextSearchMatch = {
                        uri: uri,
                        range: range,
                        preview: {
                            text: line,
                            matches: [{ text: line.substring(charIndex, charIndex + query.length) }]
                        }
                    };

                    // Process the match
                    this.processResult(match, query);
                }
            }
        } catch (error) {
            Logger.debug(`Error searching in file ${uri.toString()}: ${error}`);
        }
    }

    /**
     * Get a glob pattern string for exclusions
     */
    private getExclusionGlobPattern(): string {
        return ExclusionPatterns.getExclusionGlob();
    }

    /**
     * Process a search result
     */
    private processResult(result: TextSearchMatch, query: string): void {
        // Skip if not a match
        if (!result.preview || result.preview.text === undefined) {
            return;
        }

        // Skip if this is from an excluded file
        if (ExclusionPatterns.shouldExclude(result.uri)) {
            return;
        }

        // Get the range of the match
        const range = result.range;

        // Create a search item for this match
        const searchItem: TextMatchItem = {
            id: `text-match:${result.uri.toString()}:${range.start.line}:${range.start.character}`,
            type: SearchItemType.TextMatch,
            label: this.formatMatchLabel(result.preview.text, query),
            description: vscode.workspace.asRelativePath(result.uri),
            detail: `Line ${range.start.line + 1}`,
            uri: result.uri,
            range: range,
            lineText: result.preview.text,
            matchText: result.preview.matches?.[0]?.text || query,
            score: 1.0, // Default score
            action: async () => {
                try {
                    const document = await vscode.workspace.openTextDocument(result.uri);
                    const editor = await vscode.window.showTextDocument(document);

                    // Reveal the range
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

                    // Select the text
                    editor.selection = new vscode.Selection(range.start, range.end);
                } catch (error) {
                    Logger.debug(`Error opening text match: ${error}`);
                }
            },
            // Icon for text matches
            iconPath: new vscode.ThemeIcon('file-text'),
            priority: 30 // Lower priority than files and symbols
        };

        // Add to results
        this.searchResults.push(searchItem);
    }

    /**
     * Format the label for a match to highlight the matched text
     */
    private formatMatchLabel(text: string, query: string): string {
        return text.trim();
    }

    /**
     * Cancel any in-progress search
     */
    public cancelSearch(): void {
        if (this.searchCancellation) {
            this.searchCancellation.cancel();
            this.searchCancellation.dispose();
            this.searchCancellation = null;
        }
        this.isSearching = false;
    }
}
