import { App, Notice } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIImageUtils } from '../ai_utils/aiImageUtils';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { AIBatchProcessor } from '../ai_utils/aiBatchProcessor';
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
            //console.log('이미지 분석 프로세스 시작');
            new Notice('이미지 분석 프로세스 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                //console.log('선택된 텍스트 없음');
                new Notice('이미지를 선택해주세요.');
                return;
            }

            const imageLinks = AIImageUtils.extractImageLinks(selectedText);
            console.log(`발견된 이미지 링크: ${imageLinks.length}개`, imageLinks);

            if (imageLinks.length === 0) {
                //console.log('이미지 링크를 찾을 수 없음');
                new Notice('선택된 텍스트에서 이미지를 찾을 수 없습니다.');
                return;
            }

            new Notice('이미지 분석을 시작합니다...');
            
            const analyses = await AIBatchProcessor.processBatch(
                imageLinks,
                async (link, index, total) => {
                    //console.log(`이미지 분석 시작 (${index + 1}/${total}): ${link}`);
                    new Notice(`이미지 분석 시작 (${index + 1}/${total}): ${link}`);
                    return await this.analyzeImage(link);
                },
                3,
                '이미지 분석'
            );

            //console.log('모든 이미지 분석 완료, 노트 업데이트 시작');
            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await AIEditorUtils.updateNoteContent(selectedText, analyses);
            editor.replaceSelection(updatedSelection);

            //console.log('이미지 분석 프로세스 완료');
            new Notice('이미지 분석이 완료되었습니다.');
        } catch (error) {
            //console.error('이미지 분석 중 오류 발생:', error);
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        }
    }

    private async analyzeImage(imagePath: string): Promise<string> {
        try {
            const { base64Image, mediaType } = await AIImageUtils.processImageForClaude(this.app, imagePath);

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

            console.log('Claude API 요청 시작');
            const response = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 4000,
                temperature: 0.25,
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

            //console.log('Claude API 응답 수신 완료');
            new Notice('Claude API 응답 수신 완료');
            
            const inputTokens = response.usage?.input_tokens ?? 0;
            const outputTokens = response.usage?.output_tokens ?? 0;
            const totalTokens = inputTokens + outputTokens;
            const estimatedCost = (totalTokens / 1000) * 0.015;

            new Notice(`토큰 사용량:
입력: ${inputTokens}
출력: ${outputTokens}
총: ${totalTokens}
비용: $${estimatedCost.toFixed(4)}`);

            //console.log('토큰 사용량 상세:', {
            //    입력_토큰: inputTokens,
            //    출력_토큰: outputTokens,
            //    총_토큰: totalTokens,
            //    예상_비용_USD: `$${estimatedCost.toFixed(4)}`
            //});

            if (response.content && response.content[0] && 'text' in response.content[0]) {
                return response.content[0].text;
            }

            throw new Error('AI 응답을 받지 못했습니다.');

        } catch (error: any) {
            //console.error('이미지 분석 상세 오류:', error);
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return '이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }
} 