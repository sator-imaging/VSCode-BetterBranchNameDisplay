import * as vscode from 'vscode';
import { GitExtension, Repository } from './api/git';

const ID: string = 'betterBranchNameDisplayView';
const UNKNOWN: string = '<UNKNOWN>';

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
    // members required for dynamic update
    private _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChange.event;

    private readonly treeItem: vscode.TreeItem;
    private branchName: string = UNKNOWN;

    constructor() {
      const item = new vscode.TreeItem(UNKNOWN);
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;  // auto-fit
      item.iconPath = new vscode.ThemeIcon('git-branch');
      this.treeItem = item;
    }

    getTreeItem(element: string): vscode.TreeItem {
      if (element !== this.branchName) {
        this.branchName = element;
        this.treeItem.label = element;
      }
      return this.treeItem;
    }

    getChildren(): string[] {
      return [this.branchName];
    }

    setLabel(label: string) {
      this.getTreeItem(label);
      this._onDidChange.fire();  // update UI automatically
    }
  }

  const provider = new Provider();
  const treeView = vscode.window.createTreeView(ID, {
    treeDataProvider: provider
  });

  treeView.title = UNKNOWN;
  treeView.message = '👆 Current branch name is dynamically updated on git change';

  git.repositories.forEach(repo => {
    const subs = repo.state.onDidChange(() => onRepoChange(repo));
    context.subscriptions.push(subs);

    onRepoChange(repo);
  });

  context.subscriptions.push(treeView);

  function onRepoChange(repo: Repository) {
    const name = repo.state.HEAD?.name;
    if (name) {
      treeView.title = name;
      provider.setLabel(name);
    }
  }
}
