import * as vscode from 'vscode';
import { GitExtension, Repository } from './api/git';

const ID: string = 'betterBranchNameDisplayView';
const UNKNOWN: string = '<UNKNOWN>';

const DISPOSABLES: Set<vscode.Disposable> = new Set<vscode.Disposable>();

// export function deactivate() { }

export async function activate(context: vscode.ExtensionContext) {
  let activeRepo: Repository | undefined;

  const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!gitExtension) {
    return;
  }
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
      // item.iconPath = new vscode.ThemeIcon('git-branch');
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
      return []; //[this.branchName];
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
  treeView.message = '👆 Current branch name';

  context.subscriptions.push(treeView);

  context.subscriptions.push(vscode.commands.registerCommand('betterBranchNameDisplay.switchToMain', async () => {
    if (!activeRepo) {
      return;
    }

    try {
      await activeRepo.checkout('main');
    } catch (e: any) {
      try {
        await activeRepo.checkout('master');
      } catch (e2: any) {
        const message = `Failed to switch to 'main' or 'master' branch.\n\n[main]: ${e.message || e}\n\n[master]: ${e2.message || e2}`;
        vscode.window.showErrorMessage(message, { modal: true });
      }
    }
  }));

  setupEvents();

  function setupEvents() {
    DISPOSABLES.forEach(d => d.dispose());
    DISPOSABLES.clear();

    const onRepositoryOpen = git.onDidOpenRepository(_ => setupEvents());
    DISPOSABLES.add(onRepositoryOpen);

    git.repositories.forEach(repo => {
      const subs = repo.state.onDidChange(() => onRepoChange(repo));
      DISPOSABLES.add(subs);

      const uiSubs = repo.ui.onDidChange(() => {
        if (repo.ui.selected) {
          onRepoChange(repo);
        }
      });
      DISPOSABLES.add(uiSubs);

      if (repo.ui.selected) {
        onRepoChange(repo);
      }
    });

    // if no repo is selected (e.g. at startup), use the first one if available
    if (!activeRepo && git.repositories.length > 0) {
      onRepoChange(git.repositories[0]);
    }

    DISPOSABLES.forEach(d => context.subscriptions.push(d));

    function onRepoChange(repo: Repository) {
      activeRepo = repo;
      const name = repo.state.HEAD?.name?.replace(/\//g, ' / ');
      if (name) {
        const nameWithEmoji = (name === 'main' || name === 'master')
          ? name
          : `✨ ${name} ✨`;

        treeView.title = nameWithEmoji;
        provider.setLabel(nameWithEmoji);
      }
    }
  }
}
