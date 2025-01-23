import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIImageUtils } from '../ai_utils/aiImageUtils';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { AIBatchProcessor } from '../ai_utils/aiBatchProcessor';
import { AIOCR } from './aiOCR';
import Anthropic from '@anthropic-ai/sdk';

export class AIImageAnalyzer {
    private app: App;
    private plugin: AILSSPlugin;
    private ocr: AIOCR;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.ocr = new AIOCR(app, plugin);
    }

    async main() {
        try {
            new Notice('이미지 분석 프로세스 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            // 선택된 텍스트에서 지시사항과 이미지 링크 분리
            const imageLinks = AIImageUtils.extractImageLinks(selectedText);
            const instruction = selectedText.replace(/!\[\[.*?\]\]/g, '').trim();

            if (imageLinks.length === 0) {
                new Notice('선택된 텍스트에서 이미지를 찾을 수 없습니다.');
                return;
            }

            // 지시사항이 없는 경우 OCR 모드로 전환
            if (!instruction) {
                await this.ocr.main();
                return;
            }

            new Notice(`발견된 이미지 링크: ${imageLinks.length}개`);
            new Notice('이미지 분석을 시작합니다...');

            const analyses = await AIBatchProcessor.processBatch(
                imageLinks,
                async (link, index, total) => {
                    return await this.analyzeImage(link, instruction);
                },
                3,
                '이미지 분석'
            );

            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await AIEditorUtils.updateNoteContent(selectedText, analyses);
            editor.replaceSelection(updatedSelection);

            new Notice('이미지 분석이 완료되었습니다.');
        } catch (error) {
            new Notice('이미지 분석 중 오류가 발생했습니다.');
        }
    }

    private async analyzeImage(imagePath: string, instruction: string): Promise<string> {
        try {
            const { base64Image, mediaType } = await AIImageUtils.processImageForClaude(this.app, imagePath);

            const systemPrompt = `당신은 이미지 분석 전문가입니다.
사용자의 지시사항에 따라 이미지를 정확하게 분석하고 관련 정보를 추출합니다.

주요 지침:
1. 사용자의 지시사항을 정확히 따르기
2. 분석 결과는 명확하고 구조적으로 제시
3. 불필요한 설명이나 부가 정보는 제외
5. 모든 수학 수식은 반드시 $ 기호로 감싸서 출력 (예: $1+1=2$)
6. 복잡한 수식이나 여러 줄의 수식은 $$ 기호로 감싸서 출력
7. 분석 결과는 객관적이고 사실에 기반`;

            const userPrompt = `다음 지시사항에 따라 이미지를 분석해주세요:
${instruction}

분석 결과만 출력하고 다른 설명은 추가하지 마세요.`;

            const anthropic = new Anthropic({
                apiKey: this.plugin.settings.claudeAPIKey,
                dangerouslyAllowBrowser: true
            });

            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4000,
                temperature: 0.3,
                system: systemPrompt,
                messages: [{
                    role: "user",
                    content: [
                        { type: "text", text: userPrompt },
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

        } catch (error) {
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return '이미지 분석 중 오류가 발생했습니다.';
        }
    }
} 