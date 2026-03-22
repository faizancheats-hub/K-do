import * as vscode from "vscode";
import type { AgentTool } from "../ToolRegistry";

export class RunTerminalTool implements AgentTool<{ command: string }, string> {
  readonly definition = {
    name: "run_terminal",
    description: "Run a shell command in the integrated terminal after explicit confirmation",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"]
    }
  };

  async execute(input: { command: string }): Promise<string> {
    const confirmed = await vscode.window.showWarningMessage(
      `Run terminal command?\n${input.command}`,
      { modal: true },
      "Run"
    );
    if (confirmed !== "Run") {
      return "Terminal command cancelled by user.";
    }

    const terminal = vscode.window.createTerminal("Kodo Agent");
    terminal.show(true);
    terminal.sendText(input.command, true);
    return "Terminal command sent.";
  }
}
