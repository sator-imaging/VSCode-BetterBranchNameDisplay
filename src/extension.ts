import * as vscode from "vscode";

interface GitExtension {
  getAPI(version: number): GitAPI;
}

interface GitAPI {
  repositories: Repository[];
}

interface Repository {
  state: {
    HEAD: Branch | undefined;
  };
  onDidChangeHEAD: vscode.Event<void>;
}

interface Branch {
  name?: string;
}


// export function deactivate() {}

export function activate(context: vscode.ExtensionContext) {
  const inputBox = vscode.scm.inputBox;  // ok to use global source control

  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  if (!gitExtension) {
    vscode.window.showWarningMessage("Git extension not found");
    return;
  }

  const git = gitExtension.getAPI(1);

  git.repositories.forEach(repo => {
    setupRepo(repo);
    updateInputBoxPlaceholder(repo);
  });

  function setupRepo(repo: Repository) {
    repo.onDidChangeHEAD(() => updateInputBoxPlaceholder(repo));
  }

  function updateInputBoxPlaceholder(repo: Repository) {
    const branchName = repo.state.HEAD?.name ?? "<UNKNOWN>";
    inputBox.placeholder = `"${branchName}" Branch (Ctrl+Enter to commit)`;
  }
}
