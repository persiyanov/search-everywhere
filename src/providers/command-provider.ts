import * as vscode from 'vscode';
import { CommandSearchItem, SearchItemType, SearchProvider } from '../core/types';

/**
 * Provides VSCode commands for searching
 */
export class CommandSearchProvider implements SearchProvider {
    /**
     * Get all indexed command items
     */
    public async getItems(): Promise<CommandSearchItem[]> {
        // For commands, we always refresh to ensure we have the latest
        return this.getCommandItems();
    }
    
    /**
     * Refresh the command index
     */
    public async refresh(): Promise<void> {
        // Nothing to persist for commands, so refresh is the same as getItems
    }
    
    /**
     * Get all commands as search items
     */
    private async getCommandItems(): Promise<CommandSearchItem[]> {
        const commandItems: CommandSearchItem[] = [];
        
        try {
            // Get all available commands
            const commands = await vscode.commands.getCommands(true);
            
            // Filter out internal commands
            const filteredCommands = commands.filter(cmd => {
                return !cmd.startsWith('_') && // Internal command
                       !cmd.startsWith('vscode.') && // VS Code internal
                       !cmd.startsWith('workbench.') && // VS Code workbench
                       !cmd.startsWith('editor.') && // Editor commands
                       !cmd.includes('.'); // Often internal namespaced commands
            });
            
            // Create command items
            for (const command of filteredCommands) {
                const commandItem: CommandSearchItem = {
                    id: `command:${command}`,
                    label: this.formatCommandName(command),
                    description: `Command`,
                    detail: command, // Add the command id as the detail
                    type: SearchItemType.Command,
                    command: command,
                    iconPath: new vscode.ThemeIcon('terminal-bash'),
                    action: async () => {
                        await vscode.commands.executeCommand(command);
                    }
                };
                
                commandItems.push(commandItem);
            }
        } catch (error) {
            console.error('Error getting commands:', error);
        }
        
        return commandItems;
    }
    
    /**
     * Format a command ID to a readable name
     */
    private formatCommandName(command: string): string {
        // Split camelCase and kebab-case commands
        let name = command.replace(/([a-z])([A-Z])/g, '$1 $2');
        name = name.replace(/-/g, ' ');
        
        // Capitalize first letter of each word
        name = name.replace(/\b\w/g, (c) => c.toUpperCase());
        
        return name;
    }
} 