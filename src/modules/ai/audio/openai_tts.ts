import { Editor, Notice, requestUrl, RequestUrlParam, TFile } from 'obsidian';
import AILSSPlugin from 'main';
import { PathSettings } from '../../maintenance/settings/pathSettings';
import { moment } from 'obsidian';

export interface TTSOptions {
    model: string;
    voice: string;
    response_format: string;
    speed: number;
}

export const DEFAULT_TTS_OPTIONS: TTSOptions = {
    model: 'tts-1-hd',
    voice: 'nova',
    response_format: 'mp3',
    speed: 1.0
};

export class OpenAITTS {
    private plugin: AILSSPlugin;

    constructor(plugin: AILSSPlugin) {
        this.plugin = plugin;
    }

    /**
     * 선택된 텍스트를 TTS를 통해 오디오로 변환하여 현재 커서 위치에 삽입
     */
    async convertTextToSpeech(editor: Editor, options: Partial<TTSOptions> = {}): Promise<void> {
        try {
            // 선택된 텍스트 가져오기
            const selectedText = editor.getSelection();
            
            if (!selectedText) {
                new Notice('변환할 텍스트를 선택해주세요.');
                return;
            }
            
            // 너무 긴 텍스트 확인 (OpenAI TTS API 제한: 4096자)
            if (selectedText.length > 4096) {
                new Notice('선택된 텍스트가 너무 깁니다. 4096자 이하로 선택해주세요.');
                return;
            }
            
            new Notice('TTS 변환 중...');
            
            // API 키 확인
            if (!this.plugin.settings.openAIAPIKey) {
                new Notice('OpenAI API 키가 설정되지 않았습니다.');
                return;
            }
            
            // 파일 경로 가져오기
            const activeFile = this.plugin.app.workspace.getActiveFile();
            if (!activeFile) {
                new Notice('활성화된 파일이 없습니다.');
                return;
            }
            
            // 현재 문서 경로 구하기
            const folderPath = activeFile.parent?.path || '';
            
            // 설정에서 선택한 TTS 모델과 음성을 사용하는 기본 옵션 생성
            const defaultOptions: TTSOptions = {
                model: this.plugin.settings.ttsModel || DEFAULT_TTS_OPTIONS.model,
                voice: this.plugin.settings.ttsVoice || DEFAULT_TTS_OPTIONS.voice,
                response_format: DEFAULT_TTS_OPTIONS.response_format,
                speed: DEFAULT_TTS_OPTIONS.speed
            };
            
            // 합쳐진 옵션 생성
            const mergedOptions: TTSOptions = {
                ...defaultOptions,
                ...options
            };
            
            // API 호출하여 오디오 생성
            const audioBuffer = await this.generateAudio(selectedText, mergedOptions);
            
            // 파일 이름 생성
            const fileName = await this.generateAudioFileName(activeFile);
            
            // 오디오 파일 저장
            const audioFile = await this.saveAudioFile(audioBuffer, folderPath, fileName);
            
            // 현재 커서 위치에 오디오 링크 삽입
            const audioLink = this.createAudioLink(audioFile);
            editor.replaceSelection(audioLink);
            
            // Notice에 더 자세한 정보 표시
            const ttsInfo = `
💬 TTS 변환 완료:
- 모델: ${mergedOptions.model}
- 음성: ${mergedOptions.voice} 
- 파일: ${fileName}
- 길이: ${Math.round(selectedText.length / 30)}초 (약)
`;
            new Notice(ttsInfo, 5000);
        } catch (error) {
            console.error('TTS 변환 중 오류:', error);
            new Notice(`TTS 변환 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }
    
    /**
     * OpenAI API를 사용하여 텍스트를 오디오로 변환
     */
    private async generateAudio(text: string, options: TTSOptions): Promise<ArrayBuffer> {
        const url = 'https://api.openai.com/v1/audio/speech';
        const headers = {
            'Authorization': `Bearer ${this.plugin.settings.openAIAPIKey}`,
            'Content-Type': 'application/json'
        };
        
        const data = {
            model: options.model,
            input: text,
            voice: options.voice,
            response_format: options.response_format,
            speed: options.speed
        };
        
        const params: RequestUrlParam = {
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data),
            contentType: 'application/json',
            throw: false
        };
        
        try {
            const response = await requestUrl(params);
            
            if (response.status !== 200) {
                const errorBody = response.json;
                throw new Error(`OpenAI API 오류: ${errorBody.error?.message || '알 수 없는 오류'}`);
            }
            
            return response.arrayBuffer;
        } catch (error) {
            console.error('OpenAI TTS API 요청 중 오류:', error);
            throw error;
        }
    }
    
    /**
     * 오디오 파일명 생성
     */
    private async generateAudioFileName(activeFile: TFile): Promise<string> {
        // 현재 노트의 타임스탬프 추출 (파일명이 YYYYMMDDHHmmss.md 형식인 경우)
        const baseTimestamp = activeFile.basename.match(/^(\d{14})/) 
            ? activeFile.basename.substring(0, 14) 
            : moment().format('YYYYMMDDHHmmss');
        
        // 인덱스를 포함한 파일명 생성 (1부터 시작)
        let index = 1;
        let fileName = '';
        const extension = '.mp3';
        
        // 이미 존재하는 파일인지 확인하고 인덱스 증가
        do {
            fileName = `${baseTimestamp}-${index}${extension}`;
            index++;
        } while (await this.plugin.app.vault.adapter.exists(`${activeFile.parent?.path || ''}/${fileName}`));
        
        return fileName;
    }
    
    /**
     * 오디오 파일 저장
     */
    private async saveAudioFile(audioBuffer: ArrayBuffer, folderPath: string, fileName: string): Promise<TFile> {
        const filePath = `${folderPath}/${fileName}`;
        return await this.plugin.app.vault.createBinary(filePath, audioBuffer);
    }
    
    /**
     * 오디오 링크 생성
     */
    private createAudioLink(file: TFile): string {
        return `![[${file.path}]]`;
    }
}
