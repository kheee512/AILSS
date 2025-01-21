import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { NewNote } from './src/modules/command/create/newNote';
import { LinkNote } from './src/modules/command/create/linkNote';
import { UpdateTags } from './src/modules/command/update/updateTags';
import { AILSSSettingTab } from './src/modules/settings/settingTab';
import { RenameAttachments } from './src/modules/command/update/renameAttachments';
import { Potentiate } from './src/modules/command/update/potentiate';
import { DeleteLink } from './src/modules/command/delete/deleteLink';
import { DeleteCurrentNote } from './src/modules/command/delete/deleteCurrentNote';
import { CleanEmptyFolders } from './src/modules/command/delete/cleanEmptyFolders';
import { DeactivateNotes } from './src/modules/command/move/deactivateNotes';
import { ActivateNotes } from './src/modules/command/move/activateNotes';

import { AILSSSettings, DEFAULT_SETTINGS } from './src/modules/settings/settings';

// Remember to rename these classes and interfaces!

export default class AILSSPlugin extends Plugin {
	settings: AILSSSettings;
	private newNoteManager: NewNote;
	private linkNoteManager: LinkNote;
	private updateTagsManager: UpdateTags;
	private renameAttachmentsManager: RenameAttachments;
	private potentiateManager: Potentiate;
	private deleteLinkManager: DeleteLink;
	private deleteCurrentNoteManager: DeleteCurrentNote;
	private cleanEmptyFoldersManager: CleanEmptyFolders;
	private deactivateNotesManager: DeactivateNotes;
	private activateNotesManager: ActivateNotes;

	async onload() {
		await this.loadSettings();
		
		this.newNoteManager = new NewNote(this.app, this);
		this.linkNoteManager = new LinkNote(this.app, this);
		this.updateTagsManager = new UpdateTags(this.app, this);
		this.renameAttachmentsManager = new RenameAttachments(this.app);
		this.potentiateManager = new Potentiate(this.app, this);
		this.deleteLinkManager = new DeleteLink(this.app, this);
		this.deleteCurrentNoteManager = new DeleteCurrentNote(this.app, this);
		this.cleanEmptyFoldersManager = new CleanEmptyFolders(this.app);
		this.deactivateNotesManager = new DeactivateNotes(this.app);
		this.activateNotesManager = new ActivateNotes(this.app);

		// 리본 메뉴에 새 노트 생성 아이콘 추가
		this.addRibbonIcon('file-plus', '새 노트 생성', () => {
			this.newNoteManager.createNewNote();
		});

		// 리본 메뉴에 링크 노트 생성 아이콘 추가
		this.addRibbonIcon('link', '링크 노트 생성', () => {
			this.linkNoteManager.createLinkNote();
		});

		// 리본 메뉴에 연결된 노트 태그 업데이트 아이콘 추가
		this.addRibbonIcon('tag', '연결된 노트 태그 업데이트', () => {
			this.updateTagsManager.updateCurrentNoteTags();
		});

		// 리본 메뉴에 첨부파일 이름 변경 아이콘 추가
		this.addRibbonIcon('file-edit', '첨부파일 이름 변경', () => {
			this.renameAttachmentsManager.renameAttachments();
		});

		// 리본 메뉴에 강화 아이콘 추가
		this.addRibbonIcon('arrow-up-circle', '노트 강화', () => {
			this.potentiateManager.potentiateNote();
		});

		// 리본 메뉴에 노트 삭제 아이콘 추가
		this.addRibbonIcon('trash', '현재 노트 삭제', () => {
			this.deleteCurrentNoteManager.deleteNote();
		});

		// 리본 메뉴에 빈 폴더 정리 아이콘 추가
		this.addRibbonIcon('trash-2', '빈 폴더 정리', () => {
			this.cleanEmptyFoldersManager.cleanEmptyFoldersInVault();
		});

		// 리본 메뉴에 비활성화 아이콘 추가
		this.addRibbonIcon('archive', '태그로 노트 비활성화', () => {
			this.deactivateNotesManager.deactivateNotesByTag();
		});

		// 리본 메뉴에 활성화 아이콘 추가
		this.addRibbonIcon('archive-restore', '노트 활성화', () => {
			this.activateNotesManager.activateNotes();
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

		// 커맨드 추가
		this.addCommand({
			id: 'rename-attachments',
			name: '첨부파일 이름 변경',
			callback: () => this.renameAttachmentsManager.renameAttachments()
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

		// 빈 폴더 정리 명령어 추가
		this.addCommand({
			id: 'clean-empty-folders',
			name: '빈 폴더 정리',
			callback: () => this.cleanEmptyFoldersManager.cleanEmptyFoldersInVault()
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

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
		
					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new AILSSSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		const loadedData = await this.loadData();
		// 기본 설정값으로 초기화
		this.settings = {
			...DEFAULT_SETTINGS,
			...loadedData
		};

		await this.saveSettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

