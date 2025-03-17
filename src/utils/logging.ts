import * as vscode from 'vscode';

class Logger {
    private static outputChannel: vscode.OutputChannel;

    public static initialize() {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Search Everywhere');
        }
    }

    public static log(message: string) {
        this.ensureInitialized();
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    public static debug(message: string) {
        const config = vscode.workspace.getConfiguration('searchEverywhere');
        if (config.get<boolean>('debug', false)) {
            this.log(`[DEBUG] ${message}`);
        }
    }

    private static ensureInitialized() {
        if (!this.outputChannel) {
            this.initialize();
        }
    }

    public static show() {
        this.ensureInitialized();
        this.outputChannel.show();
    }
}

export default Logger; 