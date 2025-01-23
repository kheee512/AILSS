import { App, Notice } from 'obsidian';
import { moment } from 'obsidian';
import type AILSSPlugin from 'main';
import { FrontmatterManager } from '../../maintenance/utils/frontmatterManager';
import { PathSettings } from '../../maintenance/settings/pathSettings';
import { MarkdownView } from 'obsidian';

export class NewNote {
    constructor(
        private app: App,
        private plugin: AILSSPlugin
    ) {}

    async createNewNote() {
        // 노트 개수 제한 확인
        if (!(await PathSettings.checkNoteLimit(this.app, this.plugin))) {
            new Notice(`노트 개수가 최대 제한(${PathSettings.MAX_NOTES}개)에 도달했습니다.`);
            return;
        }

        const now = moment();
        
        // 폴더 경로 생성 (YY/MM/DD/HH/)
        const folderPath = PathSettings.getTimestampedPath(now);

        const frontmatterManager = new FrontmatterManager();
        const noteContent = frontmatterManager.generateFrontmatter({}, false) + '\n- ';

        try {
            // 폴더가 존재하지 않을 때만 생성
            if (!(await this.app.vault.adapter.exists(folderPath))) {
                await this.app.vault.createFolder(folderPath);
            }
            
            // 사용 가능한 파일명 찾기
            let fileName = PathSettings.getDefaultFileName();
            let counter = 1;
            
            while (await this.app.vault.adapter.exists(`${folderPath}/${fileName}`)) {
                fileName = PathSettings.getDefaultFileName(counter);
                counter++;
            }
            
            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${fileName}`,
                noteContent
            );

            // 항상 새 탭에서 파일 열기
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(newFile);
            
            // 커서를 불렛포인트 뒤로 이동
            const view = leaf.view as MarkdownView;
            if (view.editor) {
                const lastLine = view.editor.lastLine();
                const lineLength = view.editor.getLine(lastLine).length;
                view.editor.setCursor({ line: lastLine, ch: lineLength });
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
