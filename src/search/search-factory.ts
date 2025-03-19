import { FuzzySearcher } from '../core/types';
import { FuzzysortAdapter } from './fuzzysort-adapter';
import { FuzzaldrinAdapter } from './fuzzaldrin-adapter';

/**
 * Factory for creating fuzzy search instances
 */
export class SearchFactory {
    /**
     * Create a searcher based on the library name
     */
    public static createSearcher(library: string): FuzzySearcher {
        switch (library) {
            case 'fuzzaldrin-plus':
                return new FuzzaldrinAdapter();

            case 'fuzzysort':

            default:
                return new FuzzysortAdapter();
        }
    }

    /**
     * Get all available searchers for benchmarking
     */
    public static getAllSearchers(): FuzzySearcher[] {
        return [
            new FuzzysortAdapter(),
            new FuzzaldrinAdapter()
        ];
    }
}
