import * as vscode from 'vscode';
import { SearchEverywhereConfig } from '../core/types';

/**
 * Get extension configuration
 */
export function getConfiguration(): SearchEverywhereConfig {
    const config = vscode.workspace.getConfiguration('searchEverywhere');

    return {
        indexing: {
            includeFiles: config.get<boolean>('indexing.includeFiles', true),
            includeSymbols: config.get<boolean>('indexing.includeSymbols', true),
            includeCommands: config.get<boolean>('indexing.includeCommands', true),
            includeText: config.get<boolean>('indexing.includeText', true)
        },
        activity: {
            enabled: config.get<boolean>('activity.enabled', true),
            weight: config.get<number>('activity.weight', 0.5)
        },
        performance: {
            maxResults: config.get<number>('performance.maxResults', 100),
            maxTextResults: config.get<number>('performance.maxTextResults', 20)
        },
        fuzzySearch: {
            library: config.get<string>('fuzzySearch.library', 'fuzzysort')
        },
        preview: {
            enabled: config.get<boolean>('preview.enabled', true)
        },
        exclusions: config.get<string[]>('exclusions', []),
        debug: config.get<boolean>('debug', false)
    };
}
