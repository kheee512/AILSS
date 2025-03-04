import { App, Modal } from 'obsidian';

interface ConfirmationModalOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
}

export class ConfirmationModal extends Modal {
    private resolve: (value: boolean) => void;
    private options: ConfirmationModalOptions;

    constructor(app: App, options: ConfirmationModalOptions, resolve: (value: boolean) => void) {
        super(app);
        this.options = {
            title: '확인',
            confirmText: 'Yes',
            cancelText: 'No',
            ...options
        };
        this.resolve = resolve;
    }

    onOpen() {
        const {contentEl} = this;
        
        const container = contentEl.createDiv({
            cls: "confirmation-modal-container",
            attr: { style: "padding: 2rem;" }
        });

        if (this.options.title) {
            container.createEl("h3", {
                text: this.options.title,
                cls: "modal-title",
                attr: { 
                    style: "margin: 0 0 1.5rem 0; font-size: 1.3em; font-weight: 600;" 
                }
            });
        }

        const messageContainer = container.createDiv({
            cls: "modal-message-container",
            attr: { 
                style: "white-space: pre-wrap; line-height: 1.6; margin-bottom: 2rem; color: var(--text-normal);" 
            }
        });

        const messageParts = this.options.message.split('\n\n');
        
        if (messageParts.length > 1) {
            messageContainer.createDiv({
                text: messageParts[0],
                attr: { 
                    style: "font-weight: 600; margin-bottom: 1rem; padding: 0.5rem; background-color: var(--background-modifier-hover);" 
                }
            });

            messageContainer.createDiv({
                text: messageParts[1]
            });
        } else {
            messageContainer.createSpan({
                text: this.options.message
            });
        }

        const buttonContainer = container.createDiv({
            cls: "modal-button-container",
            attr: { 
                style: "display: flex; justify-content: flex-end; gap: 0.8rem;" 
            }
        });

        const cancelButton = buttonContainer.createEl("button", {
            text: this.options.cancelText,
            attr: { 
                style: "padding: 0.6rem 1.2rem; border-radius: 4px;" 
            }
        });
        cancelButton.addEventListener("click", () => {
            this.close();
            this.resolve(false);
        });

        const confirmButton = buttonContainer.createEl("button", {
            text: this.options.confirmText,
            cls: "mod-cta",
            attr: { 
                style: "padding: 0.6rem 1.2rem; border-radius: 4px;" 
            }
        });
        confirmButton.addEventListener("click", () => {
            this.close();
            this.resolve(true);
        });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

export function showConfirmationDialog(app: App, options: ConfirmationModalOptions): Promise<boolean> {
    return new Promise(resolve => {
        new ConfirmationModal(app, options, resolve).open();
    });
} 