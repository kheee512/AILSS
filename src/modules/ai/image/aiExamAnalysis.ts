import { App, Notice, TFile } from 'obsidian';
import AILSSPlugin from '../../../../main';
import Anthropic from '@anthropic-ai/sdk';

export class AIExamAnalysis {
    private app: App;
    private plugin: AILSSPlugin;

    constructor(app: App, plugin: AILSSPlugin) {
        this.app = app;
        this.plugin = plugin;
    }

    async main() {
        try {
            console.log('문제 분석 프로세스 시작');
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

            new Notice('문제 분석을 시작합니다...');
            const totalImages = imageLinks.length;
            
            const BATCH_SIZE = 3;
            const imageAnalyses: string[] = [];
            
            for (let i = 0; i < imageLinks.length; i += BATCH_SIZE) {
                const batch = imageLinks.slice(i, i + BATCH_SIZE);
                new Notice(`문제 분석 배치 처리 중... (${i + 1}-${Math.min(i + BATCH_SIZE, imageLinks.length)}/${imageLinks.length})`);
                
                const batchAnalyses = await Promise.all(
                    batch.map(async (link, index) => {
                        console.log(`문제 분석 시작 (${i + index + 1}/${imageLinks.length}): ${link}`);
                        new Notice(`문제 분석 진행 중... (${i + index + 1}/${imageLinks.length})`);
                        const analysis = await this.analyzeExam(link);
                        console.log(`문제 분석 완료 (${i + index + 1}/${imageLinks.length})`);
                        return analysis;
                    })
                );
                
                imageAnalyses.push(...batchAnalyses);
                
                if (i + BATCH_SIZE < imageLinks.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log('모든 문제 분석 완료, 노트 업데이트 시작');
            new Notice('분석된 내용을 노트에 추가하는 중...');
            const updatedSelection = await this.updateNoteContent(selectedText, imageAnalyses);
            editor.replaceSelection(updatedSelection);

            console.log('문제 분석 프로세스 완료');
            new Notice('문제 분석이 완료되었습니다.');
        } catch (error) {
            console.error('문제 분석 중 오류 발생:', error);
            new Notice('문제 분석 중 오류가 발생했습니다.');
        }
    }

    private extractImageLinks(content: string): string[] {
        const imageRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp))\]\]/g;
        const matches = [...content.matchAll(imageRegex)];
        return matches.map(match => match[1]);
    }

    private async analyzeExam(imagePath: string): Promise<string> {
        try {
            console.log(`이미지 파일 읽기 시작: ${imagePath}`);
            
            const imageFile = this.app.vault.getAbstractFileByPath(imagePath);
            if (!(imageFile instanceof TFile)) {
                console.error(`이미지 파일을 찾을 수 없음: ${imagePath}`);
                throw new Error('이미지 파일을 찾을 수 없습니다.');
            }

            const imageArrayBuffer = await this.app.vault.readBinary(imageFile);
            const maxSizeInBytes = 20 * 1024 * 1024;
            if (imageArrayBuffer.byteLength > maxSizeInBytes) {
                throw new Error(`이미지 크기가 제한(20MB)을 초과합니다: ${(imageArrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            }

            const base64Image = this.arrayBufferToBase64(imageArrayBuffer);
            
            if (!base64Image || base64Image.length === 0) {
                throw new Error('이미지 변환에 실패했습니다.');
            }

            const systemPrompt = `당신은 시험 문제 분석 전문가입니다. 문제의 내용을 상세히 분석하고, 수식은 반드시 Obsidian 호환 LaTeX 형식($...$, $$...$$)으로 작성해주세요. 모든 계산 과정을 빠짐없이 보여주고 반드시 최종 답을 구해야 합니다:

### 상세 풀이 과정
1단계: [문제 해석]
* 문제에서 구해야 할 것: [명확한 목표]
* 주어진 값들: [모든 주어진 값을 나열]
* 사용할 공식: [관련 공식을 LaTeX로]
* 적용 방법: [공식 적용 방법 설명]

2단계: [초기 계산]
* 사용할 공식: $[공식]$
* 주어진 값 대입: 
  $[값을 대입한 식]$
* 계산 과정:
  $[첫 번째 계산 단계]$
  $[두 번째 계산 단계]$
  $[세 번째 계산 단계]$
* 중간 결과: $[결과값]$ [단위]

3단계: [중간 계산]
* 다음 단계 공식: $[공식]$
* 이전 결과값 대입:
  $[대입식]$
* 상세 계산:
  $[첫 번째 계산]$
  $[두 번째 계산]$
  $[세 번째 계산]$
* 중간 결과: $[결과값]$ [단위]

4단계: [최종 계산]
* 최종 공식: $[공식]$
* 계산 과정:
  $[모든 계산 과정을 한 줄도 빠짐없이]$
  $[각각의 계산 단계를]$
  $[수식으로 표현]$
* 최종 결과: $[결과값]$ [단위]

### 최종 답
$[최종 답]$ [단위]
[답에 대한 간단한 설명이나 검증]

### 검산 과정
* 방법: [검산 방법 설명]
* 계산:
  $[검산 과정을 단계별로]$
  $[수식으로 표현]$
* 검증 결과: [일치 여부 확인]

### 대체 풀이 방법
1단계: [설명]
* 공식: $[공식]$
* 계산:
  $[첫 번째 계산]$
  $[두 번째 계산]$
  $[세 번째 계산]$
* 중간 결과: $[결과값]$ [단위]

[모든 단계를 같은 형식으로 계속...]
최종 답: $[결과값]$ [단위]`;   

            const userPrompt = `이 문제를 분석해주세요. 특히:
1. 문제의 핵심 요구사항
2. 주어진 조건들
3. 풀이에 필요한 핵심 개념
4. 단계별 해결 방법
5. 최종 답변
에 초점을 맞춰주세요.`;

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
            
            const inputTokens = response.usage?.input_tokens ?? 0;
            const outputTokens = response.usage?.output_tokens ?? 0;
            const totalTokens = inputTokens + outputTokens;
            const estimatedCost = (totalTokens / 1000) * 0.015;

            console.log('토큰 사용량 상세:', {
                입력_토큰: inputTokens,
                출력_토큰: outputTokens,
                총_토큰: totalTokens,
                예상_비용_USD: `$${estimatedCost.toFixed(4)}`
            });

            if (response.content && response.content[0] && 'text' in response.content[0]) {
                const analysis = response.content[0].text;
                return `## 문제 분석 결과\n${analysis}`;
            }

            throw new Error('AI 응답을 받지 못했습니다.');

        } catch (error: any) {
            console.error('문제 분석 상세 오류:', error);
            return '문제 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
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
            result += '\n\n';
            result += analyses[analysisIndex];
            result += '\n\n';
            
            lastIndex = match.index! + match[0].length;
            analysisIndex++;
        }

        result += content.slice(lastIndex);
        return result;
    }
} 