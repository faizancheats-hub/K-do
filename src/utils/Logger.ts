import * as vscode from "vscode";

export class Logger {
  private static channel = vscode.window.createOutputChannel("Kodo");

  static info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  static warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  static error(message: string, error?: unknown): void {
    this.channel.appendLine(`[error] ${message}`);
    if (error) {
      this.channel.appendLine(String(error));
    }
  }

  static show(): void {
    this.channel.show(true);
  }
}
