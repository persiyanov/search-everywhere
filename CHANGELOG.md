# Change Log

All notable changes to the "Search Everywhere" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.3] - 2025-03-20

### Added

- Automatic preview of search results while navigating (similar to VSCode's built-in search)
- Configuration option to enable/disable preview functionality
- Highlight for symbols in preview mode

## [0.1.2] - 2025-03-19

### Fixed

- Fixed real-time reindexing issue where new or modified symbols weren't appearing in search results
- Improved file change detection and index synchronization between providers

## [0.1.0] - 2025-03-16

### Added

- PyCharm-style tabbed filter UI (All, Classes, Files, Symbols, Actions)
- Dedicated "Classes" filter for quick class navigation
- Line numbers in search results for better context
- Visual indicators for active filter
- Intelligent prioritization (classes > methods > variables)
- Relative path display for cleaner results
- Robust deduplication to prevent duplicate search results

### Changed

- Reset filter to "All" when reopening the search dialog
- Clear search query when reopening
- Improved UI with cleaner visual organization
- Better symbols categorization

### Fixed

- Fixed duplicate results from multiple symbol providers
- Fixed activity tracking to avoid memory leaks
- Removed unused code and settings for better performance
