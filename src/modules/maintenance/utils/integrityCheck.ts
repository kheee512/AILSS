import { App, TFile, TFolder, Notice, Modal } from 'obsidian';
import { moment } from 'obsidian';
import type AILSSPlugin from 'main';
import { PathSettings } from '../settings/pathSettings';
import { FrontmatterManager, DefaultFrontmatterConfig } from './frontmatterManager';
import { showConfirmationDialog } from '../../../components/confirmationModal';

interface IntegrityCheckOptions {
    path: string;
    recursive: boolean;
}

interface IntegrityReport {
    timestamp: string;
    checkedPath: string;
    statistics: {
        folderCount: number;
        fileCount: number;
        noteCount: number;
        attachmentCount: number;
    };
    emptyFolders: string[];
    orphanedAttachments: string[];
    invalidFrontmatters: string[];
    invalidFileNames: string[];
}

export class IntegrityCheck {
    private app: App;
    private plugin: AILSSPlugin;
    private frontmatterManager: FrontmatterManager;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.frontmatterManager = new FrontmatterManager();
    }

    async showPathSelectionDialog(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new PathSelectionModal(this.app, {
                title: "경로 입력",
                placeholder: "예: 24/01/22/14 (미입력시 전체 검사)",
                confirmText: "검사",
                cancelText: "취소"
            }, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    async checkIntegrity(): Promise<void> {
        try {
            const result = await this.showPathSelectionDialog();
            // 취소된 경우 종료
            if (result === null) {
                new Notice("무결성 검사가 취소되었습니다.");
                return;
            }

            const options: IntegrityCheckOptions = {
                path: result.trim(),
                recursive: true
            };

            const confirmed = await showConfirmationDialog(this.app, {
                title: "무결성 검사 확인",
                message: `${options.path ? options.path : "전체 vault"}에 대해 무결성 검사를 실행하시겠습니까?`,
                confirmText: "검사",
                cancelText: "취소"
            });

            if (!confirmed) {
                new Notice("무결성 검사가 취소되었습니다.");
                return;
            }

            const report = await this.performIntegrityCheck(options);
            await this.generateReport(report);
            
            new Notice("무결성 검사가 완료되었습니다. 로그 파일을 확인해주세요.");
        } catch (error) {
            console.error("무결성 검사 중 오류 발생:", error);
            new Notice("무결성 검사 중 오류가 발생했습니다.");
        }
    }

    private async performIntegrityCheck(options: IntegrityCheckOptions): Promise<IntegrityReport> {
        const report: IntegrityReport = {
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            checkedPath: options.path || '전체 vault',
            statistics: {
                folderCount: 0,
                fileCount: 0,
                noteCount: 0,
                attachmentCount: 0
            },
            emptyFolders: [],
            orphanedAttachments: [],
            invalidFrontmatters: [],
            invalidFileNames: []
        };

        const rootFolder = options.path
            ? this.app.vault.getAbstractFileByPath(options.path)
            : this.app.vault.getRoot();

        if (!rootFolder) {
            throw new Error("지정된 경로를 찾을 수 없습니다.");
        }

        await this.checkFolder(rootFolder as TFolder, report, options);
        return report;
    }

    private async checkFolder(folder: TFolder, report: IntegrityReport, options: IntegrityCheckOptions): Promise<boolean> {
        let hasValidContent = false;
        report.statistics.folderCount++;

        for (const child of folder.children) {
            if (child instanceof TFolder) {
                if (options.recursive) {
                    const hasContent = await this.checkFolder(child, report, options);
                    if (hasContent) hasValidContent = true;
                }
            } else if (child instanceof TFile) {
                report.statistics.fileCount++;
                if (child.extension === 'md') {
                    report.statistics.noteCount++;
                } else if (this.isAttachmentFile(child)) {
                    report.statistics.attachmentCount++;
                }
                hasValidContent = true;
                await this.checkFile(child, report);
            }
        }

        if (!hasValidContent && folder.path !== '/') {
            report.emptyFolders.push(folder.path);
        }

        return hasValidContent;
    }

    private async checkFile(file: TFile, report: IntegrityReport): Promise<void> {
        // 경로 형식 검사 추가
        if (!PathSettings.PATH_REGEX.test(file.parent?.path || '')) {
            report.invalidFileNames.push(`${file.path} (잘못된 경로 형식)`);
        }

        // 마크다운 파일 검사
        if (file.extension === 'md') {
            // integrity-check 리포트 파일은 프론트매터 검사에서 제외
            if (file.basename.startsWith('integrity-check-')) {
                return;
            }
            
            const content = await this.app.vault.read(file);
            
            // 프론트매터 검사
            const frontmatter = this.frontmatterManager.parseFrontmatter(content);
            if (!frontmatter || !this.isValidFrontmatter(frontmatter)) {
                report.invalidFrontmatters.push(file.path);
            }

            // 첨부파일 링크 검사
            await this.checkAttachments(file, content, report);
        } 
        // 첨부파일 검사
        else if (this.isAttachmentFile(file)) {
            // 먼저 연결된 노트 파일이 있는지 확인
            const isOrphaned = await this.isOrphanedAttachment(file);
            if (isOrphaned) {
                report.orphanedAttachments.push(file.path);
            }
            // 연결된 노트가 있더라도 파일명 형식이 완전히 다른 경우만 보고
            else if (!file.basename.startsWith(this.getBaseNoteName(file))) {
                report.invalidFileNames.push(file.path);
            }
        }
    }

    private getBaseNoteName(file: TFile): string {
        const attachmentNameParts = file.basename.split('-');
        return attachmentNameParts[0];
    }

    private async isOrphanedAttachment(file: TFile): Promise<boolean> {
        const noteName = this.getBaseNoteName(file);
        const parentPath = file.parent?.path || '';
        const possibleNotePath = `${parentPath}/${noteName}.md`;

        const noteFile = this.app.vault.getAbstractFileByPath(possibleNotePath);
        return !(noteFile instanceof TFile);
    }

    private isValidFrontmatter(frontmatter: Record<string, any>): boolean {
        // DefaultFrontmatterConfig 인터페이스의 키들을 가져와서 검사
        const requiredFields: (keyof DefaultFrontmatterConfig)[] = ['activated', 'potentiation', 'tags'];
        
        if (!requiredFields.every(field => frontmatter.hasOwnProperty(field))) {
            return false;
        }

        // tags 배열이 존재하는지 확인
        if (!Array.isArray(frontmatter.tags)) {
            return false;
        }

        // Potentiation이 유효한 범위 내에 있는지 확인
        const potentiation = Number(frontmatter.Potentiation);
        if (isNaN(potentiation) || 
            potentiation < FrontmatterManager.INITIAL_POTENTIATION || 
            potentiation > FrontmatterManager.MAX_POTENTIATION) {
            return false;
        }

        return true;
    }

    private async checkAttachments(file: TFile, content: string, report: IntegrityReport): Promise<void> {
        const linkRegex = /!\[\[(.*?)\]\]/g;
        let match;

        while ((match = linkRegex.exec(content)) !== null) {
            const linkPath = match[1].split('|')[0].trim();
            // .md 확장자가 없는 경우 자동으로 추가
            const fullPath = linkPath.endsWith('.md') ? linkPath : `${linkPath}.md`;
            const linkedFile = this.app.vault.getAbstractFileByPath(fullPath);

            if (!linkedFile) {
                // .md를 제외한 경로로도 한번 더 확인
                const alternateFile = this.app.vault.getAbstractFileByPath(linkPath);
                if (!alternateFile) {
                    report.orphanedAttachments.push(`${file.path} -> ${linkPath} (링크 깨짐)`);
                }
            }
            // 파일이 존재하고 첨부파일인 경우에만 이름 규칙 검사
            else if (linkedFile instanceof TFile && this.isAttachmentFile(linkedFile)) {
                if (!this.isValidAttachmentName(linkedFile)) {
                    report.invalidFileNames.push(linkedFile.path);
                }
            }
        }
    }

    private isAttachmentFile(file: TFile): boolean {
        const attachmentExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'mp3', 'wav', 'mp4', 'webm', 'pdf'];
        return attachmentExtensions.includes(file.extension.toLowerCase());
    }

    private isValidAttachmentName(file: TFile): boolean {
        // Development-1.png 형식이면 true를 반환
        const fileNamePattern = new RegExp(`^[^-]+-\\d+\\.${file.extension}$`);
        const isValid = fileNamePattern.test(file.basename);
        return isValid;
    }

    private async generateReport(report: IntegrityReport): Promise<void> {
        let content = `# 무결성 검사 보고서\n\n`;
        content += `## 검사 정보\n`;
        content += `- 검사 시간: ${report.timestamp}\n`;
        content += `- 검사 경로: ${report.checkedPath}\n\n`;

        content += `## 검사 통계\n`;
        content += `- 검사한 폴더 수: **${report.statistics.folderCount}**개\n`;
        content += `- 검사한 전체 파일 수: **${report.statistics.fileCount}**개\n`;
        content += `- 노트 파일 수: **${report.statistics.noteCount}**개\n`;
        content += `- 첨부 파일 수: **${report.statistics.attachmentCount}**개\n\n`;

        content += `## 빈 폴더 (**${report.emptyFolders.length}**개)\n`;
        report.emptyFolders.forEach(path => {
            content += `- ${path}\n`;
        });

        content += `\n## 고아 첨부파일 (**${report.orphanedAttachments.length}**개)\n`;
        report.orphanedAttachments.forEach(path => {
            content += `- ${path}\n`;
        });

        content += `\n## 잘못된 프론트매터 (**${report.invalidFrontmatters.length}**개)\n`;
        report.invalidFrontmatters.forEach(path => {
            content += `- ${path}\n`;
        });

        content += `\n## 잘못된 첨부파일명 또는 경로 (**${report.invalidFileNames.length}**개)\n`;
        report.invalidFileNames.forEach(path => {
            content += `- ${path}\n`;
        });

        // 총계 섹션 추가
        const totalIssues = report.emptyFolders.length + 
                           report.orphanedAttachments.length + 
                           report.invalidFrontmatters.length + 
                           report.invalidFileNames.length;

        content += `\n## 총계\n`;
        content += `- 전체 문제 수: **${totalIssues}**개\n`;
        content += `  - 빈 폴더: **${report.emptyFolders.length}**개\n`;
        content += `  - 고아 첨부파일: **${report.orphanedAttachments.length}**개\n`;
        content += `  - 잘못된 프론트매터: **${report.invalidFrontmatters.length}**개\n`;
        content += `  - 잘못된 첨부파일명 또는 경로: **${report.invalidFileNames.length}**개\n`;

        const reportFileName = `integrity-check-${moment().format('YYYYMMDD-HHmmss')}.md`;
        await this.app.vault.create(reportFileName, content);
    }
}

class PathSelectionModal extends Modal {
    private resolve: (result: string | null) => void;
    private options: {
        title: string;
        placeholder: string;
        confirmText: string;
        cancelText: string;
    };

    constructor(app: App, options: any, onSubmit: (result: string | null) => void) {
        super(app);
        this.options = options;
        this.resolve = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        const container = contentEl.createDiv({
            cls: "path-selection-modal-container",
            attr: { style: "padding: 2rem;" }
        });

        container.createEl("h3", {
            text: this.options.title,
            attr: { style: "margin: 0 0 1.5rem 0;" }
        });

        const input = container.createEl("input", {
            type: "text",
            attr: {
                placeholder: this.options.placeholder,
                style: "width: 100%; margin-bottom: 2rem;"
            }
        });

        const buttonContainer = container.createDiv({
            attr: { style: "display: flex; justify-content: flex-end; gap: 0.8rem;" }
        });

        const cancelButton = buttonContainer.createEl("button", {
            text: this.options.cancelText
        });
        cancelButton.onclick = () => {
            this.close();
            this.resolve(null);  // 취소시 null 반환
        };

        const confirmButton = buttonContainer.createEl("button", {
            text: this.options.confirmText,
            cls: "mod-cta"
        });
        confirmButton.onclick = () => {
            this.close();
            this.resolve(input.value);  // 빈 문자열 포함 입력값 그대로 반환
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
