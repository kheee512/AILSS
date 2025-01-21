import { App, Editor, Notice, MarkdownView, TFile } from 'obsidian';
import AILSSPlugin from '../../../../main';
import Anthropic from '@anthropic-ai/sdk';

export class AIImageInspect {
    private app: App;
    private plugin: AILSSPlugin;
    private activeSelections: Map<string, {
        processing: boolean
    }> = new Map();

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main(): Promise<void> {
        try {
            const editor = this.getActiveEditor();
            const selectedText = editor.getSelection().trim();
            const fromLine = editor.getCursor('from').line;

            // 현재 선택에 대한 고유 ID 생성
            const selectionId = `${fromLine}-${Date.now()}`;

            // 이미 처리 중인 선택인지 확인
            if (this.isProcessing(fromLine)) {
                throw new Error("이미 처리 중인 선택입니다.");
            }

            // 현재 선택을 처리 중으로 표시
            this.activeSelections.set(selectionId, {
                processing: true
            });

            const imageLinks = this.extractImageLinks(selectedText);
            if (imageLinks.length === 0) {
                throw new Error("선택된 텍스트에서 이미지를 찾을 수 없습니다.");
            }

            new Notice('이미지 분석 중...');
            
            const analyses = await Promise.all(
                imageLinks.map(async (link, index) => {
                    new Notice(`이미지 분석 진행 중... (${index + 1}/${imageLinks.length})`);
                    return await this.analyzeImage(link);
                })
            );

            // AI 분석 결과를 에디터에 삽입
            const analysisContent = analyses.join('\n\n');
            editor.replaceSelection(selectedText + '\n\n' + analysisContent);

            new Notice("이미지 분석이 완료되었습니다.");

            // 작업 완료 후 선택 정보 업데이트
            this.activeSelections.set(selectionId, {
                processing: false
            });

            // 일정 시간 후 선택 정보 제거
            setTimeout(() => {
                this.activeSelections.delete(selectionId);
            }, 5000);

        } catch (error) {
            this.activeSelections.clear();
            console.error("오류 발생:", error);
            new Notice(`오류: ${error instanceof Error ? error.message : String(error)}`);
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
            const base64Image = this.arrayBufferToBase64(imageArrayBuffer);

            const systemPrompt = `당신은 이미지를 분석하고 핵심 내용을 추출하는 전문가입니다.

분석 지침:
1. 이미지의 핵심 내용을 명확하고 간결하게 설명
2. 수학/과학 관련 수식은 LaTeX 형식으로 변환 ($로 감싸서 표현)
3. 모든 내용은 불렛 포인트(-)로 구조화
4. 중요한 키워드나 개념은 강조
5. 불필요한 설명이나 반복은 제외`;

            const userPrompt = `이미지를 분석하고 다음 형식으로 정리해주세요:

- 핵심 내용
    - 주요 개념이나 주제
    - 중요한 수식이나 정의
    - 핵심 키워드
- 상세 설명
    - 구체적인 내용 분석
    - 관련 개념들과의 연결성
- 참고사항
    - 특별히 주목할 점
    - 추가 학습 포인트`;

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
                throw new Error('지원되지 않는 이미지 형식입니다.');
            }

            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 2000,
                temperature: 0.3,
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

            if (response.content && response.content[0] && 'text' in response.content[0]) {
                return response.content[0].text;
            }

            throw new Error('AI 응답을 받지 못했습니다.');

        } catch (error: any) {
            console.error('이미지 분석 오류:', error);
            return `이미지 분석 중 오류가 발생했습니다: ${error.message}`;
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

    private getActiveEditor(): Editor {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (!activeLeaf) {
            throw new Error("활성화된 뷰를 찾을 수 없습니다.");
        }

        const { view } = activeLeaf;
        if (!(view instanceof MarkdownView)) {
            throw new Error("마크다운 편집기를 찾을 수 없습니다.");
        }

        return view.editor;
    }

    private isProcessing(line: number): boolean {
        for (const [_, selection] of this.activeSelections) {
            if (selection.processing) {
                return true;
            }
        }
        return false;
    }
} 