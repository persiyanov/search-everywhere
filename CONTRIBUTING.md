# Contributing to Search Everywhere for VSCode

Thank you for your interest in contributing to the Search Everywhere extension! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run compile
   ```

4. Launch the extension in development mode:
   - Open the project in VSCode
   - Press F5 to start debugging

## Submitting Changes

1. Create a new branch for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test them thoroughly
3. Commit your changes with descriptive commit messages:

   ```bash
   git commit -m "Add feature: description of changes"
   ```

4. Push your branch and create a pull request against the main branch
5. Wait for feedback and address any review comments

## Coding Standards

- Follow the existing code style
- Use TypeScript for all new code
- Document all public classes, methods, and functions
- Keep code modular and maintainable
- Avoid any performance regressions, especially for large workspaces

## Testing Guidelines

Before submitting a pull request, please:

1. Test your changes on multiple file types and large codebases
2. Verify that search functionality works correctly with your changes
3. Check that keyboard shortcuts and commands work as expected
4. Ensure the extension loads and performs efficiently

## Reporting Bugs

When reporting bugs, please include:

1. Extension version
2. VSCode version
3. Operating system
4. Steps to reproduce the issue
5. Expected behavior
6. Actual behavior
7. Any error messages or logs

## Feature Requests

Feature requests are welcome! When suggesting new features:

1. Clearly describe the feature and its use case
2. Explain how it would benefit users
3. If possible, include mockups or examples
4. Indicate if you're willing to implement it yourself

## Documentation

All new features should include:

1. Updates to relevant documentation
2. Updates to the README.md if necessary
3. Changes to the CHANGELOG.md in the appropriate section

## Performance Considerations

Search Everywhere aims to be fast and responsive. When making changes:

1. Consider the impact on search performance
2. Test with large workspaces (1000+ files)
3. Ensure background indexing doesn't impact editor performance
4. Use appropriate debouncing for expensive operations

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

Thank you for contributing to Search Everywhere!
