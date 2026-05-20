import * as vscode from 'vscode';
import { GitExtension, Repository } from './api/git';

const ID: string = 'betterBranchNameDisplayView';
const UNKNOWN: string = '<UNKNOWN>';
const ACTION_SWITCH: string = 'switchToMain';
const ACTION_FETCH: string = 'fetchPrune';

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

    getTreeItem(element: string): vscode.TreeItem {
      const item = new vscode.TreeItem(UNKNOWN);
      if (element === ACTION_SWITCH) {
        item.label = "Ⓜ️ Switch to main";
        item.command = { title: item.label, command: 'betterBranchNameDisplay.switchToMain' };
      } else if (element === ACTION_FETCH) {
        item.label = "🧹 Fetch (Prune)";
        item.command = { title: item.label, command: 'betterBranchNameDisplay.fetchPrune' };
      }
      return item;
    }

    getChildren(element?: string): string[] {
      if (!element) {
        return [ACTION_SWITCH, ACTION_FETCH];
      }
      return [];
    }

    getParent(element: string): vscode.ProviderResult<string> {
      return undefined;
    }

    refresh() {
      // this._onDidChange.fire();
    }
  }

  const provider = new Provider();
  const treeView = vscode.window.createTreeView(ID, {
    treeDataProvider: provider
  });

  treeView.title = UNKNOWN;
  treeView.message = "👆 Current branch";

  context.subscriptions.push(treeView);

  context.subscriptions.push(vscode.commands.registerCommand('betterBranchNameDisplay.fetchPrune', async () => {
    if (!activeRepo) {
      return;
    }

    try {
      await activeRepo.fetch({ prune: true });
    } catch (e: any) {
      const message = `Failed to fetch (prune).\n\n${e.message || e}`;
      vscode.window.showErrorMessage(message, { modal: true });
    }
  }));

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
          ? name
          : `✨ ${name} ✨`;

        if (treeView.title === nameWithEmoji) {
          return;
        }

        treeView.title = nameWithEmoji;
      }
    }
  }
}
