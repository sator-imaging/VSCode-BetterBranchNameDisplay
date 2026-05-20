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

    getChildren(element?: string): string[] {
      // NOTE: Always returns empty. When returning branch name,
      //       extension will show unnecessary duplicate text as a tree view item.
      // if (!element && this.branchName !== UNKNOWN) {
      //   return [this.branchName];
      // }
      return [];
    }

    getParent(element: string): vscode.ProviderResult<string> {
      return undefined;
    }

    getBranchName(): string {
      return this.branchName;
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
  treeView.message = "👆 Current branch  Ⓜ️ Switch to main";

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.command = 'betterBranchNameDisplay.switchToMain';

  context.subscriptions.push(treeView, statusBarItem);

  context.subscriptions.push(vscode.commands.registerCommand('betterBranchNameDisplay.switchToMain', async () => {
    if (!activeRepo) {
      return;
    }

    const currentBranch = activeRepo.state.HEAD?.name;
    if (currentBranch === 'main' || currentBranch === 'master') {
      const answer = await vscode.window.showInformationMessage('Do you want to pull with prune?', { modal: true }, 'Yes');
      if (answer !== 'Yes') {
        return;
      }

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Pulling with prune...',
        cancellable: false
      }, async () => {
        try {
          await activeRepo!.fetch({ prune: true });
          await activeRepo!.pull();
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to pull with prune: ${e.message || e}`, { modal: true });
        }
      });
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
      const subs = repo.state.onDidChange(() => {
        if (repo.ui.selected) {
          onRepoChange(repo);
        }
      });
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

    if (!activeRepo && git.repositories.length > 0) {
      const selected = git.repositories.find(r => r.ui.selected);
      onRepoChange(selected || git.repositories[0]);
    }

    DISPOSABLES.forEach(d => context.subscriptions.push(d));

    async function onRepoChange(repo: Repository) {
      activeRepo = repo;
      const rawName = repo.state.HEAD?.name;
      const name = rawName?.replace(/\//g, ' / ');
      if (name) {
        const nameWithEmoji = (rawName === 'main' || rawName === 'master')
          ? `Ⓜ️ ${name}`
          : `✨ ${name}`;

        if (treeView.title === nameWithEmoji) {
          return;
        }

        treeView.title = nameWithEmoji;
        provider.setLabel(nameWithEmoji);

        statusBarItem.text = nameWithEmoji;
        statusBarItem.tooltip = (rawName === 'main' || rawName === 'master')
          ? 'Pull with prune'
          : 'Switch to main/master branch';
        statusBarItem.show();

        if (rawName === 'main' || rawName === 'master') {
          if (treeView.visible) {
            await new Promise(resolve => setTimeout(resolve, 310));
            await vscode.commands.executeCommand(`${ID}.focus`);
            await vscode.commands.executeCommand('workbench.action.collapseSection');
          }
        } else {
          await treeView.reveal(nameWithEmoji, { expand: true, select: false, focus: false });
        }
      } else {
        statusBarItem.hide();
      }
    }
  }
}
