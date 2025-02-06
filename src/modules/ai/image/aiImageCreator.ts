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
        console.log('main 메소드 시작', { customPrompt });
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            console.log('활성화된 마크다운 편집기 없음');
            new Notice('활성화된 마크다운 편집기가 없습니다.');
            return;
        }

        const editor = activeView.editor;
        const selectedText = customPrompt || editor.getSelection();
        console.log('선택된 텍스트:', selectedText);

        if (!selectedText && !customPrompt) {
            console.log('프롬프트 없음');
            new Notice('이미지를 생성할 프롬프트를 선택해주세요.');
            return;
        }

        try {
            console.log('이미지 생성 시도:', selectedText || '귀여운 고양이');
            const imageUrls = await this.generateImage(selectedText || '귀여운 고양이');
            console.log('생성된 이미지 URLs:', imageUrls);
            
            for (const imageUrl of imageUrls) {
                console.log('이미지 저장 시도');
                const savedPath = await this.saveImageToVault(imageUrl);
                console.log('저장된 이미지 경로:', savedPath);
                
                if (selectedText) {
                    const selections = editor.listSelections();
                    const lastSelection = selections[selections.length - 1];
                    const endPos = lastSelection.head.line > lastSelection.anchor.line ? 
                        lastSelection.head : lastSelection.anchor;

                    editor.replaceRange(`\n![[${savedPath}]]\n`,
                        {line: endPos.line, ch: editor.getLine(endPos.line).length});
                }
            }
        } catch (error) {
            console.error('이미지 생성 오류:', error);
            if (error instanceof Error) {
                new Notice(`이미지 생성 실패: ${error.message}`);
            } else {
                new Notice('이미지 생성 중 알 수 없는 오류가 발생했습니다.');
            }
        }
    }

    private async generateImage(prompt: string, size: '1024x1024' | '1792x1024' | '1024x1792' = '1024x1024'): Promise<string[]> {
        console.log('generateImage 시작', { prompt, size });
        const apiKey = this.plugin.settings.openAIAPIKey;
        const model = this.plugin.settings.dalleModel;

        console.log('API 설정 확인:', { hasApiKey: !!apiKey, model });
        
        if (!apiKey) {
            throw new Error('OpenAI API 키가 설정되지 않았습니다.');
        }

        new Notice('이미지 생성 시작...');

        const url = 'https://api.openai.com/v1/images/generations';
        const headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };

        // DALL-E 3의 경우 병렬 요청으로 3개 생성
        if (model === 'dall-e-3') {
            const requests = Array(3).fill(null).map(() => {
                const data = {
                    model: model,
                    prompt: prompt,
                    n: 1,
                    size: size,
                    quality: 'hd',
                    response_format: 'url'
                };

                return requestUrl({
                    url: url,
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
            });

            try {
                console.log('DALL-E 3 병렬 요청 시작');
                const responses = await Promise.all(requests);
                const urls = responses.map(response => {
                    const result = response.json as ImageGenerationResponse;
                    if (result.data[0].revised_prompt) {
                        new Notice(`수정된 프롬프트: ${result.data[0].revised_prompt}`, 5000);
                    }
                    return result.data[0].url;
                });
                new Notice('이미지가 성공적으로 생성되었습니다.');
                return urls;
            } catch (error) {
                console.error('API 요청 오류:', error);
                throw new Error(`이미지 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
            }
        } 
        // DALL-E 2의 경우 한 번에 5개 생성
        else {
            const data = {
                model: model,
                prompt: prompt,
                n: 5,
                size: size,
                response_format: 'url'
            };

            try {
                console.log('DALL-E 2 요청 시작', { url, data });
                const response = await requestUrl({
                    url: url,
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(data)
                });
                
                if (response.status === 200) {
                    const result = response.json as ImageGenerationResponse;
                    new Notice('이미지가 성공적으로 생성되었습니다.');
                    return result.data.map(item => item.url);
                } else {
                    throw new Error(`API 응답 오류: ${response.status}`);
                }
            } catch (error) {
                console.error('API 요청 오류:', error);
                throw new Error(`이미지 생성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
            }
        }
    }

    private async saveImageToVault(imageUrl: string): Promise<string> {
        try {
            const response = await requestUrl({
                url: imageUrl,
                method: 'GET'
            });

            const arrayBuffer = response.arrayBuffer;
            const activeFile = this.plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                throw new Error('활성화된 노트를 찾을 수 없습니다.');
            }

            // 현재 노트의 경로에서 파일명을 제외한 디렉토리 경로 가져오기
            const currentFolder = activeFile.parent?.path || '';
            const baseName = activeFile.basename;
            const nextIndex = await this.getNextImageIndex(baseName);
            
            // 현재 노트와 같은 경로에 이미지 저장
            const path = `${currentFolder}${currentFolder ? '/' : ''}${baseName}-${nextIndex}.png`;
            console.log('이미지 저장 경로:', path);
            
            await this.plugin.app.vault.createBinary(path, arrayBuffer);
            
            new Notice(`이미지가 저장되었습니다: ${path}`);
            return path;
        } catch (error) {
            console.error('이미지 저장 중 오류:', error);
            throw new Error(`이미지 저장 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }
}
