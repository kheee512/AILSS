import { App, Notice, requestUrl } from 'obsidian';
import AILSSPlugin from '../../../../main';
import { AIImageUtils } from '../ai_utils/aiImageUtils';
import { AIEditorUtils } from '../ai_utils/aiEditorUtils';
import { AIBatchProcessor } from '../ai_utils/aiBatchProcessor';
import Anthropic from '@anthropic-ai/sdk';


export class AIOCR {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            //console.log('이미지 분석 프로세스 시작');
            new Notice('OCR 분석 프로세스 시작');
            const editor = AIEditorUtils.getActiveEditor(this.app);
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                //console.log('선택된 텍스트 없음');
                new Notice('이미지를 선택해주세요.');
                return;
            }

            const imageLinks = AIImageUtils.extractImageLinks(selectedText);
            //console.log(`발견된 이미지 링크: ${imageLinks.length}개`, imageLinks);
            new Notice(`발견된 이미지 링크: ${imageLinks.length}개`);

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
            new Notice('이미지 분석 중 오류가 발생했습니다.');
        }
    }

    private async analyzeImage(imagePath: string): Promise<string> {
        try {
            const { base64Image, mediaType } = await AIImageUtils.processImageForVision(this.app, imagePath);

            if (this.plugin.settings.selectedVisionModel === 'openai') {
                return await this.analyzeWithOpenAI(base64Image);
            } else {
                return await this.analyzeWithClaude(base64Image, mediaType);
            }

        } catch (error: any) {
            new Notice('이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return '이미지 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        }
    }

    private async analyzeWithClaude(base64Image: string, mediaType: string): Promise<string> {
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
                            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
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
    }

    private async analyzeWithOpenAI(base64Image: string): Promise<string> {
        const url = 'https://api.openai.com/v1/chat/completions';
        const headers = {
            'Authorization': `Bearer ${this.plugin.settings.openAIAPIKey}`,
            'Content-Type': 'application/json'
        };

        const data = {
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `당신은 OCR 전문가입니다. 이미지에서 모든 텍스트를 정확하게 추출하고, 수식은 LaTeX 형식으로 변환합니다. 
                    모든 수학 수식은 $ 또는 $$ 기호로 감싸서 표현해야 합니다.`
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `이미지에서 모든 텍스트를 추출해주세요. 수식은 LaTeX로 변환하고, 줄바꿈과 단락 구분을 유지해주세요. 
                            원본 텍스트만 출력하고 다른 설명은 추가하지 마세요.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        };

        const response = await requestUrl({
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });

        if (response.status === 200) {
            return response.json.choices[0].message.content.trim();
        }

        throw new Error('OpenAI API 응답을 받지 못했습니다.');
    }
}
