import { MarkdownView, Plugin, TFile } from 'obsidian';
import { NewNote } from './src/modules/command/create/newNote';
import { LinkNote } from './src/modules/command/create/linkNote';
import { UpdateTags } from './src/modules/command/update/updateTags';
import { RenameAttachments } from './src/modules/maintenance/utils/renameAttachments';
import { Potentiate } from './src/modules/command/update/potentiate';
import { DeleteLink } from './src/modules/command/delete/deleteLink';
import { DeleteCurrentNote } from './src/modules/command/delete/deleteCurrentNote';
import { DeactivateNotes } from './src/modules/command/move/deactivateNotes';
import { ActivateNotes } from './src/modules/command/move/activateNotes';
import { GraphManager } from './src/modules/maintenance/utils/graph/graphManager';
import { AILSSSettings, DEFAULT_SETTINGS, AILSSSettingTab } from './src/modules/maintenance/settings/settings';
import { AIOCR } from './src/modules/ai/image/aiOCR';
import { AIImageAnalysis } from './src/modules/ai/image/aiImageAnalysis';
import { AIAnswer } from './src/modules/ai/text/aiAnswer';
import { AILinkNote } from './src/modules/ai/text/aiLinkNote';
import { AILatexMath } from './src/modules/ai/text/aiLatexMath';
import { AIVisualizer } from './src/modules/ai/text/aiVisualizer';
import { FileCountManager } from './src/modules/maintenance/utils/fileCountManager';
import { AIStructureNote } from './src/modules/ai/text/aiStructureNote';



export default class AILSSPlugin extends Plugin {
	settings: AILSSSettings;
	private newNoteManager: NewNote;
	private linkNoteManager: LinkNote;
	private updateTagsManager: UpdateTags;
	private renameAttachmentsManager: RenameAttachments;
	private potentiateManager: Potentiate;
	private deleteLinkManager: DeleteLink;
	private deleteCurrentNoteManager: DeleteCurrentNote;
	
	private deactivateNotesManager: DeactivateNotes;
	private activateNotesManager: ActivateNotes;
	private pendingRename: boolean = false;
	private renameTimeout: NodeJS.Timeout | null = null;
	private graphManager: GraphManager;
	private aiOCR: AIOCR;
	private aiImageAnalysis: AIImageAnalysis;
	private aiAnswer: AIAnswer;
	private aiLinkNote: AILinkNote;
	private aiLatexMath: AILatexMath;
	private aiVisualizer: AIVisualizer;
	private fileCountManager: FileCountManager;
	private aiStructureNote: AIStructureNote;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AILSSSettingTab(this.app, this));
		
		this.newNoteManager = new NewNote(this.app, this);
		this.linkNoteManager = new LinkNote(this.app, this);
		this.updateTagsManager = new UpdateTags(this.app, this);
		this.renameAttachmentsManager = new RenameAttachments(this.app);
		this.potentiateManager = new Potentiate(this.app, this);
		this.deleteLinkManager = new DeleteLink(this.app, this);
		this.deleteCurrentNoteManager = new DeleteCurrentNote(this.app, this);
		
		this.deactivateNotesManager = new DeactivateNotes(this.app, this);
		this.activateNotesManager = new ActivateNotes(this.app, this);

		// GraphManager 초기화
		this.graphManager = new GraphManager(this.app, this);

		// AI 모듈 초기화
		this.aiOCR = new AIOCR(this.app, this);
		this.aiImageAnalysis = new AIImageAnalysis(this.app, this);
		this.aiAnswer = new AIAnswer(this.app, this);
		this.aiLinkNote = new AILinkNote(this.app, this);
		this.aiLatexMath = new AILatexMath(this.app, this);
		this.aiVisualizer = new AIVisualizer(this.app, this);

		// FileCountManager 초기화
		this.fileCountManager = FileCountManager.getInstance(this.app, this);

		// AIStructureNote 초기화
		this.aiStructureNote = new AIStructureNote(this.app, this);

		// 리본 메뉴에 새 노트 생성 아이콘 추가
		this.addRibbonIcon('file-plus', '새 노트 생성', () => {
			this.newNoteManager.createNewNote();
		});

		// 리본 메뉴에 링크 노트 생성 아이콘 추가
		this.addRibbonIcon('square-arrow-out-up-right', '링크 노트 생성', () => {
			this.linkNoteManager.createLinkNote();
		});

		// 리본 메뉴에 연결된 노트 태그 업데이트 아이콘 추가
		this.addRibbonIcon('tags', '연결된 노트 태그 업데이트', () => {
			this.updateTagsManager.updateCurrentNoteTags();
		});

		// 리본 메뉴에 강화 아이콘 추가
		this.addRibbonIcon('zap', '노트 강화', () => {
			this.potentiateManager.potentiateNote();
		});

		// 리본 메뉴에 노트 삭제 아이콘 추가
		this.addRibbonIcon('trash', '현재 노트 삭제', () => {
			this.deleteCurrentNoteManager.deleteNote();
		});

		// 리본 메뉴에 비활성화 아이콘 추가
		this.addRibbonIcon('folder-output', '태그로 노트 비활성화', () => {
			this.deactivateNotesManager.deactivateNotesByTag();
		});

		// 리본 메뉴에 활성화 아이콘 추가
		this.addRibbonIcon('folder-input', '노트 활성화', () => {
			this.activateNotesManager.activateNotes();
		});

		// AI 리본 메뉴 추가
		this.addRibbonIcon('file-scan', 'OCR 분석', () => {
			this.aiOCR.main();
		});

		this.addRibbonIcon('image', '이미지 분석', () => {
			this.aiImageAnalysis.main();
		});

		this.addRibbonIcon('message-circle-question', 'AI 답변', () => {
			this.aiAnswer.main();
		});

		this.addRibbonIcon('link-2', 'AI 링크 노트', () => {
			this.aiLinkNote.createAILinkNote();
		});

		this.addRibbonIcon('sigma', 'LaTeX 변환', () => {
			this.aiLatexMath.main();
		});

		this.addRibbonIcon('bar-chart', '다이어그램 생성', () => {
			this.aiVisualizer.main();
		});

		// 리본 메뉴에 구조화 아이콘 추가
		this.addRibbonIcon('list', '노트 구조화', () => {
			this.aiStructureNote.main();
		});

		// 새 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-new-note',
			name: '새 노트 생성',
			icon: 'file-plus',
			callback: () => this.newNoteManager.createNewNote()
		});

		// 선택 텍스트로 링크 노트 생성 명령어 추가
		this.addCommand({
			id: 'create-link-note',
			name: '선택한 텍스트로 새 노트 생성',
			icon: 'link',
			editorCallback: () => this.linkNoteManager.createLinkNote()
		});

		// 커맨드 추가
		this.addCommand({
			id: 'update-linked-notes-tags',
			name: '연결된 노트 태그 업데이트',
			callback: () => this.updateTagsManager.updateCurrentNoteTags()
		});

		// 강화 명령어 추가
		this.addCommand({
			id: 'potentiate-note',
			name: '노트 강화',
			callback: () => this.potentiateManager.potentiateNote()
		});

		// 링크 삭제 명령어 추가
		this.addCommand({
			id: 'delete-link',
			name: '선택한 링크와 파일 삭제',
			editorCallback: () => this.deleteLinkManager.deleteLink()
		});

		// 노트 삭제 명령어 추가
		this.addCommand({
			id: 'delete-current-note',
			name: '현재 노트 삭제',
			callback: () => this.deleteCurrentNoteManager.deleteNote()
		});

		// 비활성화 명령어 추가
		this.addCommand({
			id: 'deactivate-notes-by-tag',
			name: '태그로 노트 비활성화',
			callback: () => this.deactivateNotesManager.deactivateNotesByTag()
		});

		// 활성화 명령어 추가
		this.addCommand({
			id: 'activate-notes',
			name: '노트 활성화',
			callback: () => this.activateNotesManager.activateNotes()
		});

		// AI 명령어 추가
		this.addCommand({
			id: 'ai-ocr-analysis',
			name: 'OCR 분석',
			editorCallback: () => this.aiOCR.main()
		});

		this.addCommand({
			id: 'ai-image-analysis',
			name: '이미지 분석',
			editorCallback: () => this.aiImageAnalysis.main()
		});

		this.addCommand({
			id: 'ai-answer',
			name: 'AI 답변',
			editorCallback: () => this.aiAnswer.main()
		});

		this.addCommand({
			id: 'ai-link-note',
			name: 'AI 링크 노트',
			editorCallback: () => this.aiLinkNote.createAILinkNote()
		});

		this.addCommand({
			id: 'ai-latex-math',
			name: 'LaTeX 변환',
			editorCallback: () => this.aiLatexMath.main()
		});

		this.addCommand({
			id: 'ai-visualizer',
			name: '다이어그램 생성',
			editorCallback: () => this.aiVisualizer.main()
		});

		// 구조화 명령어 추가
		this.addCommand({
			id: 'ai-structure-note',
			name: '노트 구조화',
			editorCallback: () => this.aiStructureNote.main()
		});

		// 파일 생성 이벤트 리스너 추가
		this.registerEvent(
			this.app.vault.on('create', async (file) => {
				if (!(file instanceof TFile)) return;
				
				// 첨부 파일 확장자 체크
				const attachmentExtensions = [
					// 이미지
					'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp',
					// 문서
					'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
					// 오디오
					'mp3', 'wav', 'ogg', 'm4a',
					// 비디오
					'mp4', 'webm', 'mov', 'avi',
					// 기타
					'zip', 'rar', '7z',
					'txt', 'csv', 'json',
				];
				
				const fileExtension = file.extension.toLowerCase();
				
				if (!attachmentExtensions.includes(fileExtension)) return;
				
				// 현재 활성화된 파일 가져오기
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return;
				
				// 현재 파일의 내용 가져오기
				const content = await this.app.vault.read(activeFile);
				
				// 방금 생성된 파일이 현재 문서에 포함되어 있는지 확인
				const fileNamePattern = new RegExp(`!\\[\\[.*${file.path}.*\\]\\]`);
				
				// 이미 대기 중인 이름 변경 작업이 있다면 취소
				if (this.renameTimeout) {
					clearTimeout(this.renameTimeout);
				}
				
				// 새로운 이름 변경 작업 예약
				this.renameTimeout = setTimeout(async () => {
					if (!this.pendingRename) {
						this.pendingRename = true;
						try {
							const updatedContent = await this.app.vault.read(activeFile);
							if (fileNamePattern.test(updatedContent)) {
								await this.renameAttachmentsManager.renameAttachments();
							}
						} finally {
							this.pendingRename = false;
							this.renameTimeout = null;
						}
					}
				}, 2000);
			})
		);
	}

	onunload() {
		if (this.renameTimeout) {
			clearTimeout(this.renameTimeout);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

