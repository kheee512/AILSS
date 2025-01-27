import { App, TFile } from 'obsidian';

export class RemoveNoteLinks {
    constructor(private app: App) {}

    async removeLinksToFile(targetFile: TFile): Promise<void> {
        // 현재 노트를 참조하는 모든 노트 찾기
        const linkedFiles = this.app.metadataCache.resolvedLinks;
        
        for (const [sourcePath, links] of Object.entries(linkedFiles)) {
            if (links[targetFile.path]) {
                const sourceFile = this.app.vault.getAbstractFileByPath(sourcePath);
                if (sourceFile instanceof TFile) {
                    await this.convertLinksToText(sourceFile, targetFile.basename);
                }
            }
        }
    }

    private async convertLinksToText(sourceFile: TFile, targetBasename: string): Promise<void> {
        let content = await this.app.vault.read(sourceFile);
        
        // 특수 문자를 이스케이프 처리
        const escapedBasename = targetBasename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // 경로를 포함한 위키링크 패턴들
        const wikiLinkPattern = new RegExp(`\\[\\[(?:[^\\]|]*?/)*${escapedBasename}(?:\\|([^\\]]+))?\\]\\]`, 'g');
        const embedLinkPattern = new RegExp(`!\\[\\[(?:[^\\]|]*?/)*${escapedBasename}(?:\\|([^\\]]+))?\\]\\]`, 'g');

        // 위키링크 처리
        content = content.replace(wikiLinkPattern, (match, alias) => {
            return alias || targetBasename;
        });

        // 임베드 링크 처리
        content = content.replace(embedLinkPattern, (match, alias) => {
            return alias || targetBasename;
        });

        await this.app.vault.modify(sourceFile, content);
    }
}
