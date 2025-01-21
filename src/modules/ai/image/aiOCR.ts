import { App, Notice, TFile } from 'obsidian';
import AILSSPlugin from '../../../../main';
import Anthropic from '@anthropic-ai/sdk';

export class AIImageAnalysis {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            console.log('이미지 분석 프로세스 시작');
            const activeFile = this.app.workspace.getActiveFile();
            if (!activeFile) {
                console.log('활성화된 노트를 찾을 수 없음');
                new Notice('활성화된 노트가 없습니다.');
                return;
            }

            const editor = this.app.workspace.activeEditor?.editor;
            if (!editor) {
                console.log('에디터를 찾을 수 없음');
                new Notice('에디터를 찾을 수 없습니다.');
                return;
            }

            const selectedText = editor.getSelection();
            if (!selectedText) {
                console.log('선택된 텍스트 없음');
                new Notice('이미지를 선택해주세요.');
                return;
            }

            const imageLinks = this.extractImageLinks(selectedText);
            console.log(`발견된 이미지 링크: ${imageLinks.length}개`, imageLinks);

            if (imageLinks.length === 0) {
                console.log('이미지 링크를 찾을 수 없음');
                new Notice('선택된 텍스트에서 이미지를 찾을 수 없습니다.');
                return;
            }

            new Notice('이미지 분석을 시작합니다...');
            const totalImages = imageLinks.length;
            
            const BATCH_SIZE = 3; // 한 번에 처리할 최대 이미지 수
            const imageAnalyses: string[] = [];
            
            for (let i = 0; i < imageLinks.length; i += BATCH_SIZE) {
                const batch = imageLinks.slice(i, i + BATCH_SIZE);
                new Notice(`이미지 분석 배치 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, imageLinks.length)}/${imageLinks.length})`);
                
                const batchAnalyses = await Promise.all(
                    batch.map(async (link, index) => {
                        console.log(`이미지 분석 시작 (${i + index + 1}/${imageLinks.length}): ${link}`);
                        new Notice(`이미지 분석 진행 중... (${i + index + 1}/${imageLinks.length})`);
                        const analysis = await this.analyzeImage(link);
                        console.log(`이미지 분석 완료 (${i + index + 1}/${imageLinks.length})`);
                        return analysis;
                    })
                );
                
                imageAnalyses.push(...batchAnalyses);
                
                // 배치 사이에 잠시 대기
                if (i + BATCH_SIZE < imageLinks.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log('모든 이미지 분석 완료, 노트 업데이트 시작');
            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await this.updateNoteContent(selectedText, imageAnalyses);
            editor.replaceSelection(updatedSelection);

            console.log('이미지 분석 프로세스 완료');
            new Notice('이미지 분석이 완료되었습니다.');
        } catch (error) {
            console.error('이미지 분석 중 오류 발생:', error);
            new Notice('이미지 분석 중 오류가 발생했습니다.');
        }
    }

    private extractImageLinks(content: string): string[] {
        const imageRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp))\]\]/g;
        const matches = [...content.matchAll(imageRegex)];
        return matches.map(match => match[1]);
    }

    private async analyzeImage(imagePath: string): Promise<string> {
        try {
            console.log(`이미지 파일 읽기 시작: ${imagePath}`);
            
            const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
            if (!(imageFile instanceof TFile)) {
                console.error(`이미지 파일을 찾을 수 없음: ${imagePath}`);
                throw new Error('이미지 파일을 찾을 수 없습니다.');
            }

            const imageArrayBuffer = await this.app.vault.readBinary(imageFile);
            const maxSizeInBytes = 20 * 1024 * 1024; // 20MB
            if (imageArrayBuffer.byteLength > maxSizeInBytes) {
                throw new Error(`이미지 크기가 제한(20MB)을 초과합니다: ${(imageArrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            }

            console.log('이미지 파일을 base64로 변환 중');
            const base64Image = this.arrayBufferToBase64(imageArrayBuffer);
            
            if (!base64Image || base64Image.length === 0) {
                throw new Error('이미지 변환에 실패했습니다.');
            }

            console.log('이미지 정보:', {
                크기: `${(imageArrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`,
                확장자: imageFile.extension,
                경로: imagePath
            });

            const systemPrompt = `당신은 이미지에서 텍스트를 완벽하게 추출하는 OCR 전문가입니다.

주요 지침:
1. 이미지에 포함된 모든 텍스트를 원본 형식 그대로 추출
2. 수학 수식은 LaTeX 형식으로 정확히 변환
3. 특수 기호, 첨자, 위첨자 등을 정확히 표현
4. 줄바꿈과 단락 구분을 원본과 동일하게 유지
5. 텍스트의 순서와 구조를 원본 그대로 보존
6. 손글씨, 인쇄물 구분 없이 모든 텍스트를 추출
7. 모든 수학 수식은 반드시 $ 기호로 감싸서 출력 (예: $1+1=2$)
8. 복잡한 수식이나 여러 줄의 수식은 $$ 기호로 감싸서 출력`;

            const userPrompt = `이미지에서 모든 텍스트를 추출해주세요.

다음 요소들을 정확히 포함해주세요:
- 모든 텍스트 (손글씨, 인쇄물)
- 수학 수식은 반드시 $ 또는 $$ 기호로 감싸서 표현
- 특수 기호 및 문자
- 원본의 줄바꿈과 단락 구분

원본 텍스트만 출력하고 다른 설명은 추가하지 마세요.`;

            const anthropic = new Anthropic({
                apiKey: this.plugin.settings.claudeAPIKey,
                dangerouslyAllowBrowser: true
            });

            const mimeTypes = {
                'jpg': 'image/jpeg' as const,
                'jpeg': 'image/jpeg' as const,
                'png': 'image/png' as const,
                'gif': 'image/gif' as const,
                'webp': 'image/webp' as const
            };
            
            const mediaType = mimeTypes[imageFile.extension as keyof typeof mimeTypes];
            if (!mediaType) {
                console.error(`지원되지 않는 이미지 형식: ${imageFile.extension}`);
                throw new Error('지원되지 않는 이미지 형식입니다.');
            }

            console.log('API 요청 설정:', {
                모델: "claude-3-5-sonnet-20241022",
                최대_토큰: 4000,
                온도: 0.25,
                이미지_경로: imagePath
            });

            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4000,
                temperature: 0.25,
                system: systemPrompt,
                messages: [{
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: userPrompt
                        },
                        {
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: mediaType,
                                data: base64Image
                            }
                        }
                    ]
                }]
            });

            console.log('Claude API 응답 수신 완료');
            
            // 토큰 사용량 상세 로깅 추가
            const inputTokens = response.usage?.input_tokens ?? 0;
            const outputTokens = response.usage?.output_tokens ?? 0;
            const totalTokens = inputTokens + outputTokens;
            const estimatedCost = (totalTokens / 1000) * 0.015; // Claude 3 Sonnet 기준 $0.015/1K tokens

            console.log('토큰 사용량 상세:', {
                입력_토큰: inputTokens,
                출력_토큰: outputTokens,
                총_토큰: totalTokens,
                예상_비용_USD: `$${estimatedCost.toFixed(4)}`,
                모델: "claude-3-5-sonnet-20241022",
                최대_토큰: 4000,
                온도: 0.25,
                이미지_경로: imagePath
            });

            if (response.content && response.content[0] && 'text' in response.content[0]) {
                console.log('이미지 분석 결과 생성 완료');
                return response.content[0].text;
            }

            console.error('AI 응답 형식 오류');
            throw new Error('AI 응답을 받지 못했습니다.');

        } catch (error: any) {
            console.error('이미지 분석 상세 오류:', {
                메시지: error.message,
                타입: error.type,
                상세: error.error?.message || '알 수 없는 오류',
                스택: error.stack
            });

            if (error.message.includes('크기가 제한')) {
                return '이미지 크기가 너무 큽니다. 20MB 이하의 이미지를 사용해주세요.';
            } else if (error.error?.type === 'invalid_request_error') {
                return '이미지 분석 요청이 거부되었습니다. 다른 이미지를 시도해주세요.';
            } else if (error.message.includes('이미지 변환')) {
                return '이미지 처리 중 오류가 발생했습니다. 이미지 형식을 확인해주세요.';
            }
            
            return '이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private async updateNoteContent(content: string, analyses: string[]): Promise<string> {
        console.log('노트 내용 업데이트 시작');
        const imageRegex = /!\[\[([^/\]]+\.(png|jpg|jpeg|gif|webp))\]\]/g;
        let lastIndex = 0;
        let result = '';
        let analysisIndex = 0;

        const matches = [...content.matchAll(imageRegex)];
        
        for (const match of matches) {
            result += content.slice(lastIndex, match.index);
            result += match[0];
            
            let analysis = analyses[analysisIndex];
            
            result += '\n\n';
            result += analysis;
            result += '\n\n';
            
            lastIndex = match.index! + match[0].length;
            analysisIndex++;
        }

        result += content.slice(lastIndex);
        return result;
    }
}
