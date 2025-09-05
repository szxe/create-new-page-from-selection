const { Plugin, TFile, normalizePath } = require('obsidian');

module.exports = class CreateNewPageFromSelection extends Plugin {
  async onload() {
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view.file instanceof TFile)) return;
        const selection = editor.getSelection();
        if (!selection.trim()) return;

        menu.addItem((item) => {
          item
            .setTitle("新建页面")
            .setIcon("document")
            .onClick(async () => {
              await this.createNoteFromSelection(view.file, selection, editor);
            });
        });
      })
    );
  }

  async createNoteFromSelection(currentFile, selectedText, editor) {
    const { vault, workspace } = this.app;

    const folderName = currentFile.basename;
    const folderPath = normalizePath(currentFile.parent.path + "/" + folderName);

    if (!vault.getAbstractFileByPath(folderPath)) {
      await vault.createFolder(folderPath);
    }

    const newFileName = selectedText.trim() + ".md";
    const newFilePath = normalizePath(folderPath + "/" + newFileName);

    let newFile = vault.getAbstractFileByPath(newFilePath);
    if (!newFile) {
      newFile = await vault.create(newFilePath, "");
    }

    const relativePath = normalizePath(folderName + "/" + newFileName.replace(/\.md$/, ""));
    const linkText = `[[${relativePath}|${selectedText.trim()}]]`;

    editor.replaceSelection(linkText);

    const leaf = workspace.getLeaf(false);
    await leaf.openFile(newFile, { active: true });
  }

  onunload() {}
}
