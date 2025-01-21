import { App, TFile } from 'obsidian';
import { FileCountManager } from '../utils/fileCountManager';
import type AILSSPlugin from 'main';

export class PathSettings {
    // 기본 경로 포맷
    static readonly PATH_FORMAT = 'YY/MM/DD/HH/mm';
    
    // 특수 폴더명
    static readonly DEACTIVATED_ROOT = 'deactivated';
    
    // 폴더 깊이 제한
    static readonly MAX_FOLDER_DEPTH = 8; // YY/MM/DD/HH/mm 구조에 맞춰 증가
    
    // 파일 관련 설정
    static readonly DEFAULT_FILE_EXTENSION = '.md';
    static readonly DEFAULT_UNTITLED = 'untitled';
    
    // 최대 노트 개수 제한
    static readonly MAX_NOTES = 1000; 
    
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
} 