import { App, TFile, Notice } from 'obsidian';
import { PathSettings } from '../../settings/pathSettings';
import { FrontmatterManager } from '../frontmatterManager';
import type AILSSPlugin from 'main';

export class ReformatNotes {
    private app: App;
    private plugin: AILSSPlugin;
    private frontmatterManager: FrontmatterManager;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.frontmatterManager = new FrontmatterManager();
    }

    async reformatAllNotes() {
        const files = this.app.vault.getMarkdownFiles();
        let processedCount = 0;
        const totalFiles = files.length;

        new Notice(`노트 재포맷 시작: 총 ${totalFiles}개 파일`);

        for (const file of files) {
            try {
                await this.reformatSingleNote(file);
                processedCount++;
                
                if (processedCount % 100 === 0) {
                    new Notice(`진행 중: ${processedCount}/${totalFiles} 파일 처리됨`);
                }
            } catch (error) {
                console.error(`Error processing ${file.path}:`, error);
                new Notice(`오류 발생: ${file.path} 처리 중 실패`);
            }
        }

        new Notice(`노트 재포맷 완료: ${processedCount}개 파일 처리됨`);
    }

    private async reformatSingleNote(file: TFile) {
        try {
            // 파일 내용 읽기
            const content = await this.app.vault.read(file);
            
            // 프론트매터 파싱 및 업데이트
            const updatedContent = await this.updateNoteFrontmatter(content);
            
            // 새 경로 생성
            const newPath = await this.generateNewPath(file);
            
            // 내용이 변경되었다면 저장
            if (content !== updatedContent) {
                await this.app.vault.modify(file, updatedContent);
            }
            
            // 경로가 변경되었다면 디렉토리 생성 후 이동
            if (file.path !== newPath) {
                // 새 경로의 디렉토리 부분만 추출
                const newDir = newPath.substring(0, newPath.lastIndexOf('/'));
                
                // 디렉토리가 없다면 생성
                if (!await this.app.vault.adapter.exists(newDir)) {
                    await this.app.vault.createFolder(newDir);
                }
                
                // 파일 이동
                await this.app.fileManager.renameFile(file, newPath);
            }
        } catch (error) {
            console.error(`Error processing ${file.path}:`, error);
            throw error;
        }
    }

    private async updateNoteFrontmatter(content: string): Promise<string> {
        const frontmatter = this.frontmatterManager.parseFrontmatter(content);
        if (!frontmatter) return content;

        // Created 필드를 제외한 새로운 객체 생성
        const { Created, ...restFrontmatter } = frontmatter;

        // 프론트매터 업데이트
        const updatedContent = this.frontmatterManager.updateFrontmatter(content, restFrontmatter);
        
        // Created 필드가 여전히 존재하는지 확인하고 제거
        if (updatedContent.includes('Created:')) {
            return updatedContent.replace(/Created:.*\n/, '');
        }

        return updatedContent;
    }

    private async generateNewPath(file: TFile): Promise<string> {
        // 기존 경로에서 날짜 정보 추출
        const match = file.path.match(/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})00\//);
        if (!match) return file.path;

        const [_, year, month, day, hour] = match;
        // YY/MM/DD/HH 형식으로 변환
        const newPath = `${year.slice(2)}/${month}/${day}/${hour}/${file.name}`;
        
        return newPath;
    }
}
