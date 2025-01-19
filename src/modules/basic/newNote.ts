import { App, TFile } from 'obsidian';
import { moment } from 'obsidian';

export class NewNote {
    constructor(private app: App) {}

    async createNewNote() {
        const now = moment();
        
        // 폴더 경로 생성 (YY/MM/DD/HH/)
        const folderPath = now.format('YY/MM/DD/HH');
        
        // ID 생성 (YYMMDDHHmmss)
        const noteId = now.format('YYMMDDHHmmss');
        
        // ISO 형식의 현재 시각
        const activatedTime = now.format('YYYY-MM-DDTHH:mm:ss');

        // 프론트매터와 내용 생성
        const noteContent = `---
ID: ${noteId}
Potentiation: 0
Activated: ${activatedTime}
tags:
  - Initial
---
`;

        try {
            // 폴더가 없으면 생성
            await this.app.vault.createFolder(folderPath);
            
            // 노트 생성
            const newFile = await this.app.vault.create(
                `${folderPath}/${noteId}.md`,
                noteContent
            );

            return newFile;
        } catch (error) {
            console.error('Error creating new note:', error);
            throw error;
        }
    }
}
