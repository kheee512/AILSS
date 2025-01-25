import { App, TFile } from 'obsidian';
import { FileCountManager } from '../utils/fileCountManager';
import type AILSSPlugin from 'main';

export class PathSettings {
    // 기본 경로 포맷
    static readonly PATH_FORMAT = 'YY/MM/DD/HH';
    
    // 특수 폴더명
    static readonly DEACTIVATED_ROOT = 'deactivated';
    
    // 폴더 깊이 제한
    static readonly MAX_FOLDER_DEPTH = 6; // deactivated/태그이름/YY-MM/DD/HH 구조 고려
    
    // 파일 관련 설정
    static readonly DEFAULT_FILE_EXTENSION = '.md';
    static readonly DEFAULT_UNTITLED = 'untitled';
    
    // 최대 노트 개수 제한
    // 성능 테스트 10,000 완료 (2025-01-25)
    static readonly MAX_NOTES = 10000; 
    
    // 경로 포맷 관련 정규식 수정
    static readonly PATH_REGEX = /^\d{2}\/\d{2}\/\d{2}\/\d{2}\//;
    
    // 경로 생성 헬퍼 메서드
    static getTimestampedPath(date: moment.Moment): string {
        return date.format(PathSettings.PATH_FORMAT);
    }
    
    // 파일명 생성 헬퍼 메서드
    static getDefaultFileName(counter: number = 0): string {
        return counter === 0 
            ? `${PathSettings.DEFAULT_UNTITLED}${PathSettings.DEFAULT_FILE_EXTENSION}`
            : `${PathSettings.DEFAULT_UNTITLED}-${counter}${PathSettings.DEFAULT_FILE_EXTENSION}`;
    }
    
    // 노트 개수 확인 메서드 수정
    static async checkNoteLimit(app: App, plugin: AILSSPlugin): Promise<boolean> {
        const fileCountManager = FileCountManager.getInstance(app, plugin);
        const noteCount = await fileCountManager.getNoteCount();
        return noteCount < this.MAX_NOTES;
    }
    
    // 경로 검증 헬퍼 메서드 추가
    static isValidPath(path: string): boolean {
        return this.PATH_REGEX.test(path);
    }
} 