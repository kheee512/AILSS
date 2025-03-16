import { App, Notice, TFile } from 'obsidian';
import type AILSSPlugin from '../../../../main';
import { showConfirmationDialog } from '../../../components/confirmationModal';

export class UnlinkNotes {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async unlinkSelectedNotes() {
        try {
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('활성화된 노트가 없습니다.');
                return;
            }

            const editor = this.app.workspace.activeEditor?.editor;
            if (!editor) {
                new Notice('에디터를 찾을 수 없습니다.');
                return;
            }

            const selectedText = editor.getSelection();
            if (!selectedText) {
                new Notice('텍스트가 선택되지 않았습니다.');
                return;
            }

            // 노트 링크만 찾기 (첨부파일 링크 제외)
            const links = this.findNoteLinks(selectedText);
            
            if (links.length === 0) {
                new Notice('선택된 텍스트에서 노트 링크를 찾을 수 없습니다.');
                return;
            }

            // 링크 해제 전 확인
            const confirmMessage = `${links.length}개의 노트 링크를 해제하시겠습니까?\n\n${links.map(link => `- ${link.originalText}`).join('\n')}`;
            
            const confirmed = await showConfirmationDialog(this.app, {
                title: "노트 링크 해제 확인",
                message: confirmMessage,
                confirmText: "해제",
                cancelText: "취소"
            });

            if (!confirmed) {
                new Notice("작업이 취소되었습니다.");
                return;
            }

            // 링크 해제 처리
            let modifiedText = selectedText;
            for (const link of links) {
                modifiedText = modifiedText.replace(link.originalText, link.displayText);
            }

            editor.replaceSelection(modifiedText);
            new Notice(`${links.length}개의 노트 링크가 해제되었습니다.`);

        } catch (error) {
            new Notice('작업 실패: ' + error.message);
        }
    }

    private findNoteLinks(text: string): Array<{originalText: string, displayText: string}> {
        const links: Array<{originalText: string, displayText: string}> = [];
        
        // 노트 링크 찾기 ([[...]] 형식이지만 ![[...]] 형식은 제외)
        const regex = /(?<!!)\[\[(.*?)\]\]/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const originalText = match[0]; // [[...]] 전체 텍스트
            const linkContent = match[1]; // ... 부분 (타임스탬프 ID 또는 타임스탬프 ID|별칭)
            
            let displayText;
            if (linkContent.includes('|')) {
                // 별칭이 있는 경우: [[타임스탬프 ID|별칭]] -> 별칭
                displayText = linkContent.split('|')[1];
            } else {
                // 별칭이 없는 경우: [[타임스탬프 ID]] -> 타임스탬프 ID
                displayText = linkContent;
            }
            
            links.push({
                originalText,
                displayText
            });
        }

        return links;
    }
} 