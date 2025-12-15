import * as vscode from "vscode";
import { GitExtension, Repository } from "./api/git";

// export function deactivate() {}

export async function activate(context: vscode.ExtensionContext) {
  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
  if (!gitExtension) {
    vscode.window.showWarningMessage("Git extension not found");
    return;
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const inputBox = vscode.scm.inputBox;  // ok to use global source control

  const git = gitExtension.exports.getAPI(1);

  git.repositories.forEach(repo => {
    const e = repo.state.onDidChange(() => updateInputBoxPlaceholder(repo));
    context.subscriptions.push(e);
    updateInputBoxPlaceholder(repo);
  });

  function updateInputBoxPlaceholder(repo: Repository) {
    const branchName = repo.state.HEAD?.name ?? "<UNKNOWN>";
    inputBox.placeholder = `"${branchName}" Branch (Ctrl+Enter to commit)`;
  }
}
