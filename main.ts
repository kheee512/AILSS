import { Plugin, TFile } from 'obsidian';
import { NewNote } from './src/modules/command/create/newNote';
import { LinkNote } from './src/modules/command/create/linkNote';
import { UpdateTags } from './src/modules/command/update/updateTags';
import { Potentiate } from './src/modules/command/update/potentiate';
import { DeleteLink } from './src/modules/command/delete/deleteLink';
import { DeleteCurrentNote } from './src/modules/command/delete/deleteCurrentNote';
import { DeactivateNotes } from './src/modules/command/move/deactivateNotes';
import { ActivateNotes } from './src/modules/command/move/activateNotes';
import { GraphManager } from './src/modules/maintenance/utils/graph/graphManager';
import { AILSSSettings, DEFAULT_SETTINGS, AILSSSettingTab } from './src/modules/maintenance/settings/settings';
import { AIOCR } from './src/modules/ai/image/aiOCR';
import { AIImageAnalysis } from './src/modules/ai/image/aiImageAnalysis';
import { AIImageAnalyzer } from './src/modules/ai/image/aiImageAnalyzer';
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
	
	private potentiateManager: Potentiate;
	private deleteLinkManager: DeleteLink;
	private deleteCurrentNoteManager: DeleteCurrentNote;
	
	private deactivateNotesManager: DeactivateNotes;
	private activateNotesManager: ActivateNotes;
	private pendingRename: boolean = false;
	private renameTimeout: number | null = null;
	private graphManager: GraphManager;
	private aiOCR: AIOCR;
	private aiImageAnalysis: AIImageAnalysis;
	private aiImageAnalyzer: AIImageAnalyzer;
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
		this.aiImageAnalyzer = new AIImageAnalyzer(this.app, this);
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

		this.addRibbonIcon('delete', '링크 삭제', () => {
			this.deleteLinkManager.deleteLink();
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

		this.addRibbonIcon('image-plus', '이미지 분석기', () => {
			this.aiImageAnalyzer.main();
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
			icon: 'tags',
			callback: () => this.updateTagsManager.updateCurrentNoteTags()
		});

		// 강화 명령어 추가
		this.addCommand({
			id: 'potentiate-note',
			name: '노트 강화',
			icon: 'zap',
			callback: () => this.potentiateManager.potentiateNote()
		});

		// 링크 삭제 명령어 추가
		this.addCommand({
			id: 'delete-link',
			name: '선택한 링크와 파일 삭제',
			icon: 'delete',
			editorCallback: () => this.deleteLinkManager.deleteLink()
		});

		// 노트 삭제 명령어 추가
		this.addCommand({
			id: 'delete-current-note',
			name: '현재 노트 삭제',
			icon: 'trash',
			callback: () => this.deleteCurrentNoteManager.deleteNote()
		});

		// 비활성화 명령어 추가
		this.addCommand({
			id: 'deactivate-notes-by-tag',
			name: '태그로 노트 비활성화',
			icon: 'folder-output',
			callback: () => this.deactivateNotesManager.deactivateNotesByTag()
		});

		// 활성화 명령어 추가
		this.addCommand({
			id: 'activate-notes',
			name: '노트 활성화',
			icon: 'folder-input',
			callback: () => this.activateNotesManager.activateNotes()
		});

		// AI 명령어 추가
		this.addCommand({
			id: 'ai-ocr-analysis',
			name: 'OCR 분석',
			icon: 'file-scan',
			editorCallback: () => this.aiOCR.main()
		});

		this.addCommand({
			id: 'ai-image-analysis',
			name: '이미지 분석',
			icon: 'image',
			editorCallback: () => this.aiImageAnalysis.main()
		});

		this.addCommand({
			id: 'ai-image-analyzer',
			name: '이미지 분석기',
			icon: 'image-plus',
			editorCallback: () => this.aiImageAnalyzer.main()
		});

		this.addCommand({
			id: 'ai-answer',
			name: 'AI 답변',
			icon: 'message-circle-question',
			editorCallback: () => this.aiAnswer.main()
		});

		this.addCommand({
			id: 'ai-link-note',
			name: 'AI 링크 노트',
			icon: 'link-2',
			editorCallback: () => this.aiLinkNote.createAILinkNote()
		});

		this.addCommand({
			id: 'ai-latex-math',
			name: 'LaTeX 변환',
			icon: 'sigma',
			editorCallback: () => this.aiLatexMath.main()
		});

		this.addCommand({
			id: 'ai-visualizer',
			name: '다이어그램 생성',
			icon: 'bar-chart',
			editorCallback: () => this.aiVisualizer.main()
		});

		// 구조화 명령어 추가
		this.addCommand({
			id: 'ai-structure-note',
			name: '노트 구조화',
			icon: 'list',
			editorCallback: () => this.aiStructureNote.main()
		});
	}

	onunload() {
		if (this.renameTimeout) {
			window.clearTimeout(this.renameTimeout);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

