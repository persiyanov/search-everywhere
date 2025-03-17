// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { SearchService } from './core/search-service';
import { SearchUI } from './ui/search-ui';
import Logger from './utils/logging';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	Logger.initialize();
	Logger.debug('Search Everywhere extension activated');
	
	console.log('Activating Search Everywhere extension...');
	
	// Create the search service
	const searchService = new SearchService(context);
	
	// Create the search UI
	const searchUI = new SearchUI(searchService);
	
	// Register search command
	const searchDisposable = vscode.commands.registerCommand('search-everywhere.search', () => {
		searchUI.show();
	});
	
	// Register rebuild index command
	const rebuildDisposable = vscode.commands.registerCommand('search-everywhere.rebuildIndex', async () => {
		// Show progress notification
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Rebuilding Search Indexes...',
				cancellable: false
			},
			async (progress) => {
				progress.report({ increment: 0 });
				
				try {
					// Force refresh all indexes
					await searchService.refreshIndex(true);
					
					// Show success message
					vscode.window.showInformationMessage('Search Everywhere indexes rebuilt successfully!');
				} catch (error) {
					// Show error message
					vscode.window.showErrorMessage(`Failed to rebuild indexes: ${error}`);
				}
				
				progress.report({ increment: 100 });
			}
		);
	});
	
	// Add commands to context
	context.subscriptions.push(searchDisposable, rebuildDisposable);
	
	console.log('Search Everywhere extension activated');
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('Search Everywhere extension deactivated');
}
