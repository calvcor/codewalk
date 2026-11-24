import * as path from 'path';
import * as vscode from 'vscode';
import { i18n } from './i18n';
import { Tour, TourStep } from './types';

class TourTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
  }
}

export class TourTreeDataProvider
  implements vscode.TreeDataProvider<TourTreeItem>
{
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    TourTreeItem | undefined | void
  >();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tour: Tour | null = null;
  private listening = false;

  public update(tour: Tour | null): void {
    this.tour = tour;
    this._onDidChangeTreeData.fire();
  }

  public setListening(listening: boolean): void {
    this.listening = listening;
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: TourTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: TourTreeItem): TourTreeItem[] {
    if (element) {
      return [];
    }

    if (!this.tour) {
      const m = i18n.messages;
      const empty = new TourTreeItem(
        this.listening ? m.listeningTitle : m.noTourTitle
      );
      empty.description = this.listening ? m.listeningDesc : m.noTourDesc;
      empty.iconPath = new vscode.ThemeIcon(
        this.listening ? 'radio-tower' : 'info',
        this.listening ? new vscode.ThemeColor('charts.green') : undefined
      );
      empty.command = {
        command: 'codewalk.requestTour',
        title: m.requestNewTourTitle,
      };
      return [empty];
    }

    const items: TourTreeItem[] = [];
    const pendingCount = this.tour.questions.filter((q) => !q.answer).length;

    const header = new TourTreeItem(this.tour.title);
    header.description = `${this.tour.currentStepIndex + 1}/${this.tour.steps.length}${
      pendingCount > 0 ? ` · ${i18n.messages.pendingCount(pendingCount)}` : ''
    }`;
    header.iconPath = new vscode.ThemeIcon(
      'book',
      new vscode.ThemeColor('charts.blue')
    );
    if (this.tour.summary) {
      header.tooltip = new vscode.MarkdownString(this.tour.summary);
    }
    items.push(header);

    this.tour.steps.forEach((step: TourStep, index: number) => {
      const item = new TourTreeItem(`${index + 1}. ${step.title}`);
      const basename = path.basename(step.file);
      const lineRef =
        step.startLine === step.endLine
          ? `${step.startLine}`
          : `${step.startLine}-${step.endLine}`;
      item.description = `${basename}:${lineRef}`;

      const isCurrent = index === this.tour!.currentStepIndex;
      const isVisited = this.tour!.visitedStepIds.includes(step.id);
      const hasPendingQuestion = this.tour!.questions.some(
        (q) => q.stepId === step.id && !q.answer
      );

      if (isCurrent) {
        item.iconPath = new vscode.ThemeIcon(
          'play-circle',
          new vscode.ThemeColor('charts.purple')
        );
      } else if (hasPendingQuestion) {
        item.iconPath = new vscode.ThemeIcon(
          'question',
          new vscode.ThemeColor('charts.yellow')
        );
      } else if (isVisited) {
        item.iconPath = new vscode.ThemeIcon(
          'check',
          new vscode.ThemeColor('charts.green')
        );
      } else {
        item.iconPath = new vscode.ThemeIcon('circle-outline');
      }

      const md = new vscode.MarkdownString(
        `**${step.title}**\n\n\`${step.file}:${lineRef}\`\n\n${step.explanation}`
      );
      md.isTrusted = true;
      item.tooltip = md;

      item.command = {
        command: 'codewalk.goToStep',
        title: 'Go to Step',
        arguments: [index],
      };

      items.push(item);
    });

    return items;
  }
}
