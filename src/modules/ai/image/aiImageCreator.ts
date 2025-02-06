import { requestUrl, RequestUrlParam, Notice, TFile, MarkdownView } from 'obsidian';
import AILSSPlugin from '../../../../main';

interface ImageGenerationResponse {
    created: number;
    data: Array<{
        url: string;
        revised_prompt?: string;
    }>;
}

export class AIImageCreator {
    constructor(private plugin: AILSSPlugin) {}

    private async getNextImageIndex(baseName: string): Promise<number> {
        const files = this.plugin.app.vault.getFiles();
        let maxIndex = 0;
        const pattern = new RegExp(`^${baseName}-(\\d+)\\.png$`);

        for (const file of files) {
            const match = file.name.match(pattern);
            if (match) {
                const index = parseInt(match[1]);
                maxIndex = Math.max(maxIndex, index);
            }
        }

        return maxIndex + 1;
    }

    private getCurrentNoteName(): string {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            throw new Error('활성화된 노트가 없습니다.');
        }
        return activeFile.basename;
    }

    async main(customPrompt?: string) {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('활성화된 마크다운 편집기가 없습니다.');
            return;
        }

        const editor = activeView.editor;
        const selectedText = customPrompt || editor.getSelection();

        if (!selectedText && !customPrompt) {
            new Notice('이미지를 생성할 프롬프트를 선택해주세요.');
            return;
        }

        try {
            const imageUrl = await this.generateImage(selectedText || '귀여운 고양이');
            if (imageUrl) {
                const savedPath = await this.saveImageToVault(imageUrl);
                if (selectedText) {
                    // 선택된 텍스트의 위치 정보 저장
                    const selections = editor.listSelections();
                    const lastSelection = selections[selections.length - 1];
                    const endPos = lastSelection.head.line > lastSelection.anchor.line ? 
                        lastSelection.head : lastSelection.anchor;

                    // 이미지 링크 삽입
                    editor.replaceRange(`\n![[${savedPath}]]\n`,
                        {line: endPos.line, ch: editor.getLine(endPos.line).length});
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                new Notice(`이미지 생성 실패: ${error.message}`);
            } else {
                new Notice('이미지 생성 중 알 수 없는 오류가 발생했습니다.');
            }
        }
    }

    private async generateImage(prompt: string, size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'): Promise<string> {
        const apiKey = this.plugin.settings.openAIAPIKey;
        const model = this.plugin.settings.dalleModel;

        if (!apiKey) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        new Notice('이미지 생성 시작...');

        const url = 'https://api.openai.com/v1/images/generations';
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };

        const data = {
            model: model,
            prompt: prompt,
            n: 1,
            size: size,
            quality: model === 'dall-e-3' ? 'standard' : undefined,
            response_format: 'url'
        };

        const params: RequestUrlParam = {
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        };

        try {
            const response = await requestUrl(params);
            
            if (response.status === 200) {
                const result = response.json as ImageGenerationResponse;
                
                if (result.data[0].revised_prompt) {
                    new Notice(`수정된 프롬프트: ${result.data[0].revised_prompt}`, 5000);
                }
                
                new Notice('이미지가 성공적으로 생성되었습니다.');
                return result.data[0].url;
            } else {
                throw new Error(`API 응답 오류: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`이미지 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }

    private async saveImageToVault(imageUrl: string): Promise<string> {
        try {
            const response = await requestUrl({
                url: imageUrl,
                method: 'GET'
            });

            const arrayBuffer = response.arrayBuffer;
            const baseName = this.getCurrentNoteName();
            const nextIndex = await this.getNextImageIndex(baseName);
            const path = `attachments/${baseName}-${nextIndex}.png`;
            
            await this.plugin.app.vault.createBinary(path, arrayBuffer);
            
            new Notice(`이미지가 저장되었습니다: ${path}`);
            return path;
        } catch (error) {
            throw new Error(`이미지 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }
}
