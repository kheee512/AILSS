import { App, Notice } from 'obsidian';
import { moment } from 'obsidian';
import type AILSSPlugin from 'main';
import { FrontmatterManager } from '../../maintenance/frontmatterManager';

export class NewNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async createNewNote() {
        const now = moment();
        
        // 폴더 경로 생성 (YY/MM/DD/HH/)
        const folderPath = now.format('YY/MM/DD/HH');

        const frontmatterManager = new FrontmatterManager();
        const noteContent = frontmatterManager.generateFrontmatter({}, false);

        try {
            // 폴더가 존재하지 않을 때만 생성
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }
            
            // 사용 가능한 파일명 찾기
            let fileName = 'untitled.md';
            let counter = 1;
            
            while (await this.app.vault.adapter.exists(`${folderPath}/${fileName}`)) {
                fileName = `untitled-${counter}.md`;
                counter++;
            }
            
            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${fileName}`,
                noteContent
            );

            // 설정에 따라 새 탭에서 파일 열기
            if (this.plugin.settings.openInNewTab) {
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(newFile);
            }

            new Notice(`새 노트가 생성되었습니다`);
            return newFile;
        } catch (error) {
            new Notice('노트 생성 중 오류가 발생했습니다.');
            console.error('Error creating new note:', error);
            throw error;
        }
    }
}
