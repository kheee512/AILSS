import { App, Notice, TFile } from 'obsidian';

export class AIImageUtils {
    static async processImage(app: App, imagePath: string): Promise<{
        base64Image: string,
        mediaType: string,
        imageFile: TFile
    }> {
        try {
            new Notice(`이미지 파일 읽기 시작: ${imagePath}`);
            
            // 현재 활성화된 파일의 경로 가져오기
            const activeFile = app.workspace.getActiveFile();
            const imageFile = await this.findImageFile(app, imagePath, activeFile?.parent?.path);
            
            if (!imageFile) {
                throw new Error('이미지 파일을 찾을 수 없습니다.');
            }

            const imageArrayBuffer = await app.vault.readBinary(imageFile);
            const maxSizeInBytes = 20 * 1024 * 1024;
            if (imageArrayBuffer.byteLength > maxSizeInBytes) {
                throw new Error(`이미지 크기가 제한(20MB)을 초과합니다: ${(imageArrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            }

            const base64Image = AIImageUtils.arrayBufferToBase64(imageArrayBuffer);
            
            if (!base64Image || base64Image.length === 0) {
                throw new Error('이미지 변환에 실패했습니다.');
            }

            const mediaType = AIImageUtils.getMimeType(imageFile.extension);
            
            return {
                base64Image,
                mediaType,
                imageFile
            };
        } catch (error) {
            new Notice('이미지 처리 중 오류:', error);
            throw error;
        }
    }

    private static async findImageFile(app: App, imageName: string, currentPath?: string): Promise<TFile | null> {
        // 1. 현재 노트 경로에서 이미지 찾기
        if (currentPath) {
            const imagePathInCurrent = `${currentPath}/${imageName}`;
            const fileInCurrent = app.vault.getAbstractFileByPath(imagePathInCurrent);
            if (fileInCurrent instanceof TFile) {
                return fileInCurrent;
            }
        }

        // 2. vault 최상단에서 이미지 찾기
        const fileInRoot = app.vault.getAbstractFileByPath(imageName);
        if (fileInRoot instanceof TFile) {
            return fileInRoot;
        }

        return null;
    }

    static arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    static getMimeType(extension: string): string {
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        
        const mediaType = mimeTypes[extension as keyof typeof mimeTypes];
        if (!mediaType) {
            throw new Error('지원되지 않는 이미지 형식입니다.');
        }
        
        return mediaType;
    }

    static extractImageLinks(content: string): string[] {
        const imageRegex = /!\[\[([^\]]+\.(png|jpg|jpeg|gif|webp))\]\]/g;
        const matches = [...content.matchAll(imageRegex)];
        return matches.map(match => match[1]);
    }

    static async processImageForVision(app: App, imagePath: string): Promise<{
        base64Image: string,
        mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        imageFile: TFile
    }> {
        const result = await this.processImage(app, imagePath);
        return {
            ...result,
            mediaType: result.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
        };
    }
}