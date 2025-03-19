import { FuzzySearcher, SearchItem } from '../core/types';
// @ts-ignore - Import with require to avoid TypeScript issues
const fuzzaldrinPlus = require('fuzzaldrin-plus');

/**
 * Adapter for the fuzzaldrin-plus library
 */
export class FuzzaldrinAdapter implements FuzzySearcher {
    public readonly name = 'fuzzaldrin-plus';

    /**
     * Search items using fuzzaldrin-plus
     */
    public async search(items: SearchItem[], query: string, limit = 100): Promise<SearchItem[]> {
        if (!query.trim()) {
            return items.slice(0, limit);
        }

        const startTime = performance.now();

        // Create searchable objects
        const searchableItems = items.map(item => ({
            originalItem: item,
            searchText: `${item.label} ${item.description || ''} ${item.detail || ''}`,
        }));

        // Perform the search
        // @ts-ignore - Cast to any to avoid TypeScript issues
        const results = fuzzaldrinPlus.filter(searchableItems, query, {
            key: 'searchText',
            maxResults: limit * 2
        });

        // Map results back to items and calculate scores
        const foundItems = results.map((result: any) => {
            const item = result.originalItem;
            // @ts-ignore - Cast to any to avoid TypeScript issues
            const score = fuzzaldrinPlus.score(result.searchText, query) / 100;

            item.score = score;

            return item;
        });

        const endTime = performance.now();

        console.log(`Fuzzaldrin search took ${endTime - startTime}ms for ${items.length} items`);

        return foundItems.slice(0, limit);
    }
}
