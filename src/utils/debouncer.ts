/**
 * A utility class for debouncing function calls
 */
export class Debouncer {
    private timeout: NodeJS.Timeout | null = null;

    /**
     * Create a new debouncer
     * @param delay The delay in milliseconds
     */
    constructor(private delay: number) {}

    /**
     * Debounce a function call
     * @param fn The function to debounce
     */
    public debounce(fn: () => void): void {
        // Clear any existing timeout
        if (this.timeout) {
            clearTimeout(this.timeout);
        }

        // Set a new timeout
        this.timeout = setTimeout(() => {
            fn();
            this.timeout = null;
        }, this.delay);
    }

    /**
     * Clear any pending debounced calls
     */
    public clear(): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }
}
