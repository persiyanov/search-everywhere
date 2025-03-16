<div style="text-align: center;">
  <img src="assets/icon.png" alt="Search Everywhere Icon" width="100" height="100">
</div>

# Search Everywhere for VSCode

A fast, fuzzy "Search Everywhere" feature for VSCode, inspired by the IntelliJ/PyCharm functionality. This extension provides a unified search interface for files, classes, symbols, and commands with intelligent prioritization and filtering.

## Features

- **Fast Fuzzy Search** across multiple sources:
  - Files in your workspace
  - Classes (classes, interfaces, enums)
  - Symbols (functions, methods, variables)
  - Commands/Actions in VSCode
  
- **PyCharm-Style Navigation**:
  - Tab-style filter categories (All, Classes, Files, Symbols, Actions)
  - Dedicated "Classes" filter for quick class navigation
  - Clean UI with category headers and line numbers
  - Instant results as you type
  - Filter reset when reopening the dialog

- **Intelligent Prioritization**:
  - Classes and methods prioritized over variables
  - Personalized results based on your activity
  - Cleaner results with duplicate removal
  - Relative file paths for better readability

- **Optimized Performance**:
  - Fast startup and search times
  - Background indexing to avoid UI freezes
  - Configurable fuzzy search libraries
  - Automatic exclusion of binary and output files
  
## Usage

1. Press `Shift+Shift` to open the search dialog
2. Use the filter buttons at the top to select what to search for:
   - **All**: Search everything
   - **Classes**: Search only classes, interfaces, and structs
   - **Files**: Search only files
   - **Symbols**: Search methods, functions, and other symbols
   - **Actions**: Search available commands
3. Start typing to search within the selected category
4. Results update in real-time as you type
5. Select an item to open/execute it

## Configuration

### Indexing Options

Control what gets indexed and included in search results:

```json
"searchEverywhere.indexing.includeFiles": true,
"searchEverywhere.indexing.includeSymbols": true,
"searchEverywhere.indexing.includeCommands": true
```

### Exclusion Patterns

Configure global exclusion patterns that apply to all search providers (files, symbols, etc.):

```json
"searchEverywhere.exclusions": [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/*.min.js"
]
```

These patterns are added to the built-in exclusions, which already filter out common binary files, build directories, and system files.

### Activity Tracking

Configure how user activity affects search results:

```json
"searchEverywhere.activity.enabled": true,
"searchEverywhere.activity.weight": 0.5
```

The weight value (0-1) determines how much your activity influences the results:
- `0`: Only relevance to search query matters
- `1`: Only frequency of use matters
- `0.5`: Equal balance between relevance and frequency

### Performance Settings

Optimize performance based on your needs:

```json
"searchEverywhere.performance.maxResults": 100
```

### Fuzzy Search Library

Choose between different fuzzy search implementations:

```json
"searchEverywhere.fuzzySearch.library": "fuzzysort"
```

Available options:
- `fuzzysort`: Generally faster, especially for large datasets
- `fuzzaldrin-plus`: May provide better relevance for certain queries

## Keyboard Shortcuts

- `Shift+Shift`: Open Search Everywhere

## Roadmap

- Add persistent activity history across sessions
- Add text search capability
- Add benchmark visualization
- Add custom search result templates
- Add search history
- Improve scoring algorithms for better relevance

## Development

### Building the Extension

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Package
npm run package
```

### Testing the Extension

1. Press F5 in VSCode to launch a development host with the extension loaded
2. Run the "Search Everywhere" command

## License

MIT

## Acknowledgements

Inspired by JetBrains' "Search Everywhere" functionality in IntelliJ IDEA, PyCharm, and other IDEs.

Built by Cursor with ❤️, under human supervision.
