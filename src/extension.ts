import * as vscode from 'vscode';
import { GitExtension, Repository } from './api/git';

const ID: string = 'betterBranchNameDisplayView';

// export function deactivate() { }

export async function activate(context: vscode.ExtensionContext) {
  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) return;
  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const git = gitExtension.exports.getAPI(1);
  if (!git) {
    vscode.window.showWarningMessage('Git extension not found');
    return;
  }

  class Provider implements vscode.TreeDataProvider<string> {
    // required for dynamic update
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    readonly unknownBranchName: string = '<UNKNOWN>';
    private branchName: string = this.unknownBranchName;

    constructor() {
      git.repositories.forEach(repo => {
        const subs = repo.state.onDidChange(() => this.onRepoChange(repo));
        context.subscriptions.push(subs);

        this.onRepoChange(repo);
      });
    }

    private onRepoChange(repo: Repository) {
      const name = repo.state.HEAD?.name;
      if (name && name !== this.branchName) {
        this.branchName = name;
        this._onDidChange.fire();  // update UI automatically
      }
    }

    getTreeItem(element: string): vscode.TreeItem {
      const item = new vscode.TreeItem(element);
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;  // auto-fit
      // item.iconPath = new vscode.ThemeIcon('git-branch');
      return item;
    }

    getChildren(): string[] {
      return [this.branchName];
    }
  }

  const provider = new Provider();
  vscode.window.registerTreeDataProvider(ID, provider);
}
