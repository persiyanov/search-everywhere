declare module 'fuzzaldrin-plus' {
    export function filter(candidates: any[], query: string, options?: { key?: string; maxResults?: number }): any[];
    export function score(string: string, query: string): number;
}

declare module 'fuzzysort' {
    export interface KeyOptions {
        key: string;
        allowTypo?: boolean;
        threshold?: number;
        limit?: number;
    }

    export interface KeysOptions<T> {
        keys: string[];
        allowTypo?: boolean;
        threshold?: number;
        limit?: number;
    }

    export interface Result {
        target: string;
        score: number;
        indexes: number[];
        obj?: any;
    }

    export function go<T>(search: string, targets: T[], options?: KeysOptions<T>): Array<Result & { obj: T }>;
    export function highlight(result: Result, tag?: string): string | null;
} 