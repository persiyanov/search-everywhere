import * as vscode from 'vscode';

/**
 * Type of search item
 */
export enum SearchItemType {
    File = 'file',
    Command = 'command',
    Symbol = 'symbol',
    Class = 'class',        // Added for specific class filtering
}

/**
 * Category groups for symbols
 */
export enum SymbolKindGroup {
    Class,        // Classes, interfaces, etc.
    Function,     // Methods, functions
    Variable,     // Variables, properties, fields
    Other         // Everything else
}

/**
 * Maps VS Code symbol kinds to our simplified groups
 */
export function mapSymbolKindToGroup(kind: vscode.SymbolKind): SymbolKindGroup {
    switch (kind) {
        case vscode.SymbolKind.Class:
        case vscode.SymbolKind.Interface:
        case vscode.SymbolKind.Struct:
        case vscode.SymbolKind.Enum:
            return SymbolKindGroup.Class;
            
        case vscode.SymbolKind.Function:
        case vscode.SymbolKind.Method:
        case vscode.SymbolKind.Constructor:
            return SymbolKindGroup.Function;
            
        case vscode.SymbolKind.Variable:
        case vscode.SymbolKind.Property:
        case vscode.SymbolKind.Field:
        case vscode.SymbolKind.Constant:
            return SymbolKindGroup.Variable;
            
        default:
            return SymbolKindGroup.Other;
    }
}

/**
 * Base interface for all searchable items
 */
export interface SearchItem {
    id: string;
    label: string;
    description: string;
    detail: string;
    type: SearchItemType;
    iconPath?: vscode.ThemeIcon | vscode.Uri;
    action: () => Promise<void>;
    
    // Optional scores for ranking
    score?: number;         // Fuzzy search score
    activityScore?: number; // User activity score
    priority?: number;      // Higher number = higher priority
}

/**
 * File search item interface
 */
export interface FileSearchItem extends SearchItem {
    type: SearchItemType.File;
    uri: vscode.Uri;
    // Optional relativePath allows for backward compatibility
    relativePath?: string;
}

/**
 * Command search item interface
 */
export interface CommandSearchItem extends SearchItem {
    type: SearchItemType.Command;
    command: string;
    args?: any[];
}

/**
 * Symbol search item interface
 */
export interface SymbolSearchItem extends SearchItem {
    type: SearchItemType.Symbol | SearchItemType.Class;
    uri: vscode.Uri;
    range: vscode.Range;
    symbolKind: vscode.SymbolKind;
    symbolGroup?: SymbolKindGroup;
}

/**
 * Interface for fuzzy searchers
 */
export interface FuzzySearcher {
    name: string;
    search(items: SearchItem[], query: string, limit?: number): Promise<SearchItem[]>;
}

/**
 * Interface for search providers
 */
export interface SearchProvider {
    getItems(): Promise<SearchItem[]>;
    refresh(): Promise<void>;
}

/**
 * Configuration interface for Search Everywhere
 */
export interface SearchEverywhereConfig {
    indexing: {
        includeFiles: boolean;
        includeSymbols: boolean;
        includeCommands: boolean;
    };
    activity: {
        enabled: boolean;
        weight: number;
    };
    performance: {
        maxResults: number;
    };
    fuzzySearch: {
        library: string;
    };
    preview: {
        enabled: boolean;
    };
    // Global exclusions that apply to all providers (files, symbols, etc.)
    exclusions?: string[];
    // Debug mode for detailed logging
    debug?: boolean;
} 