const { Plugin, PluginSettingTab, Setting, FuzzySuggestModal, Modal, Notice, TFile, FuzzyMatch, requestUrl } = require('obsidian');

const BANNER_CLASS = 'js-banner';

const DEFAULT_SETTINGS = {
  bannerFieldName: 'banner',
  hideProperties: true,
  fadeEffect: false,
  fadeIntensity: 50,
  roundCorners: true
};

// --- HELPER CLASSES ---

// Settings Tab Class
class JSBannerSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'JS Banner' });

    new Setting(containerEl)
      .setName('Banner field name (banner is default)')
      .setDesc('The name of the YAML field to use for the banner link.')
      .addText(text => text
        .setPlaceholder('banner')
        .setValue(this.plugin.settings.bannerFieldName)
        .onChange(async (value) => {
          this.plugin.settings.bannerFieldName = value.trim() || 'banner';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Hide note properties')
      .setDesc('If enabled, the banner will hide the default note properties/metadata view.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.hideProperties)
        .onChange(async (value) => {
          this.plugin.settings.hideProperties = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'Appearance' });
    
    new Setting(containerEl)
        .setName('Enable rounded corners')
        .setDesc('Applies rounded corners to the banner.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.roundCorners)
            .onChange(async (value) => {
                this.plugin.settings.roundCorners = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('Enable fade effect')
        .setDesc('Adds a smooth gradient at the bottom of the banner to blend it with the note content.')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.fadeEffect)
            .onChange(async (value) => {
                this.plugin.settings.fadeEffect = value;
                await this.plugin.saveSettings();
                this.display(); 
            }));
    
    if (this.plugin.settings.fadeEffect) {
        new Setting(containerEl)
            .setName('Fade intensity')
            .setDesc('How much of the banner should be covered by the fade effect.')
            .addSlider(slider => slider
                .setLimits(0, 100, 5)
                .setValue(this.plugin.settings.fadeIntensity)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fadeIntensity = value;
                    await this.plugin.saveSettings();
                }));
    }

    containerEl.createEl('h3', { text: 'Per-Note Banner Styling' });
    const docsEl = containerEl.createEl('p');
    docsEl.innerHTML = `
      You can style the banner on a per-note basis by adding these YAML keys:
      <ul>
        <li><b>banner</b>: Internal link or website link to your banner image file, this can also be set with the plugin command</li>
        <li><b>banner-height</b>: Set a custom height in pixels (e.g., <code>300</code>).</li>
        <li><b>banner-type</b>: Control how the image fits. Use <code>cover</code> (default) to fill the space by cropping, or <code>contain</code> to fit the entire image inside.</li>
        <li><b>banner-x</b>: Set the horizontal focal point (<code>0</code>=left, <code>1</code>=right). Only works with <code>banner-type: cover</code>.</li>
        <li><b>banner-y</b>: Set the vertical focal point (<code>0</code>=top, <code>1</code>=bottom). Only works with <code>banner-type: cover</code>.</li>
      </ul>
    `;
  }
}

// Modal to choose banner source
class BannerSourceModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Set banner from...' });
        const buttonContainer = contentEl.createDiv({ cls: 'js-banner-button-container' });
        const localButton = buttonContainer.createEl('button', { text: 'Local Vault Image' });
        const remoteButton = buttonContainer.createEl('button', { text: 'Remote URL' });

        localButton.addEventListener('click', () => {
            this.close();
            new ThumbnailSuggestModal(this.app, this.plugin).open();
        });
        remoteButton.addEventListener('click', () => {
            this.close();
            new URLInputModal(this.app, this.plugin).open();
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}

// Suggester with Thumbnails
class ThumbnailSuggestModal extends FuzzySuggestModal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.setPlaceholder('Search for an image...');
    }

    onOpen() {
        super.onOpen();
        this.modalEl.classList.add('js-banner-thumbnail-modal');
    }

    getItems() {
        return this.app.vault.getFiles().filter(file => /^(png|jpg|jpeg|gif|bmp|svg)$/i.test(file.extension));
    }

    getItemText(item) {
        return item.path;
    }
    
    renderSuggestion(match, el) {
        el.empty();
        const container = el.createDiv({ cls: 'js-banner-suggestion-item' });
        
        container.createEl('img', {
            attr: { src: this.app.vault.adapter.getResourcePath(match.item.path) },
            cls: 'js-banner-suggestion-thumbnail'
        });

        const textContainer = container.createDiv({ cls: 'js-banner-suggestion-text' });
        textContainer.setText(match.item.path);
    }

    async onChooseItem(item) {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice('Cannot set banner, no active file.');
            return;
        }
        const linkText = this.app.metadataCache.fileToLinktext(item, activeFile.path, true);
        await this.plugin.setBannerInFrontmatter(`"[[${linkText}]]"`);
    }
}


// Modal for remote URL
class URLInputModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
    }
    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Enter image URL' });
        const input = contentEl.createEl('input', { type: 'text', placeholder: 'https://...' });
        input.style.width = '100%';
        contentEl.createEl('br');
        const button = contentEl.createEl('button', { text: 'Set Banner' });
        button.style.marginTop = '10px';
        const setBanner = async () => { // Make async
            const url = input.value;
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                await this.plugin.setBannerInFrontmatter(url); // await this call
                this.close();
            } else {
                new Notice('Please enter a valid URL beginning with http or https.');
            }
        };
        button.addEventListener('click', setBanner);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                setBanner();
            }
        });
    }
    onClose() {
        this.contentEl.empty();
    }
}


// --- MAIN PLUGIN CLASS ---

class JSBannerPlugin extends Plugin {

  async onload() {
    console.log('Loading JS Banner plugin');
    
    await this.loadSettings();
    this.addSettingTab(new JSBannerSettingTab(this.app, this));

    this.addCommand({
      id: 'js-banner-set-banner',
      name: 'Set banner',
      callback: () => {
        new BannerSourceModal(this.app, this).open();
      }
    });

    this.scheduleBannerRender = this.debounce(this.renderBannerForActiveFile, 10);
    this.app.workspace.onLayoutReady(() => this.scheduleBannerRender());
    this.registerEvent(this.app.workspace.on('file-open', () => this.scheduleBannerRender()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleBannerRender()));
    this.registerEvent(this.app.workspace.on('js-banner:settings-updated', () => this.scheduleBannerRender()));
  }

  onunload() {
    console.log('Unloading JS Banner plugin');
    this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
      this.removeBannerFromLeaf(leaf);
    });
  }
  
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.app.workspace.trigger('js-banner:settings-updated');
  }

  // --- Make async and add automatic refresh ---
  async setBannerInFrontmatter(bannerValue) {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
        new Notice('No active file to set banner on.');
        return;
    }
    await this.app.fileManager.processFrontMatter(activeFile, (fm) => {
        fm[this.settings.bannerFieldName] = bannerValue;
    });
    new Notice('Banner updated!');
    this.renderBannerForActiveFile(); // Refresh the banner view
  }

  async renderBannerForActiveFile() {
    const leaf = this.app.workspace.activeLeaf;
    if (!leaf) return;

    setTimeout(async () => {
      this.removeBannerFromLeaf(leaf);
      const file = leaf.view.file;
      if (!file) return;
      const fileCache = this.app.metadataCache.getFileCache(file);
      if (fileCache && fileCache.frontmatter && fileCache.frontmatter[this.settings.bannerFieldName]) {
        await this.addBannerToView(leaf.view, file, fileCache.frontmatter);
      }
    }, 10);
  }

  async addBannerToView(view, file, frontmatter) {
    const mode = view.getMode ? view.getMode() : 'preview';
    let targetEl;
    if (mode === 'preview') {
      targetEl = view.containerEl.querySelector('.markdown-preview-view');
    } else if (mode === 'source' && view.containerEl.querySelector('.is-live-preview')) {
      targetEl = view.containerEl.querySelector('.cm-sizer');
    } else {
      return;
    }
    if (!targetEl) return;
    
    if (this.settings.hideProperties) {
        const propertiesEl = view.containerEl.querySelector('.metadata-container');
        if (propertiesEl) {
          propertiesEl.style.display = 'none';
        }
    }
    
    const bannerLink = frontmatter[this.settings.bannerFieldName];
    let bannerUrl;

    if (typeof bannerLink === 'string' && (bannerLink.startsWith('http://') || bannerLink.startsWith('https://'))) {
        try {
            const response = await requestUrl({ url: bannerLink });
            const buffer = response.arrayBuffer;
            const mimeType = response.headers['content-type'] || 'image/jpeg';
            const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
            bannerUrl = `data:${mimeType};base64,${base64}`;
        } catch (error) {
            console.error('JS Banner: Failed to fetch remote image.', error);
            new Notice('JS Banner: Failed to load remote image. See console for details.');
            return;
        }
    } else {
        const linkMatch = String(bannerLink).match(/\[\[(.*?)\]\]/);
        if (!linkMatch) return;
        const bannerPath = linkMatch[1];
        const bannerFile = this.app.metadataCache.getFirstLinkpathDest(bannerPath, file.path);
        if (!bannerFile) return;
        bannerUrl = this.app.vault.adapter.getResourcePath(bannerFile.path);
    }
    
    if (!bannerUrl) return;

    const bannerElement = createEl('div', { cls: BANNER_CLASS });
    targetEl.prepend(bannerElement);
    
    // Add rounded corners class if enabled ---
    if (this.settings.roundCorners) {
        bannerElement.classList.add('rounded-corners');
    }
    
    const bannerImage = bannerElement.createEl('img', { attr: { src: bannerUrl } });
    
    // Add banner-type support ---
    const bannerType = frontmatter['banner-type'] || 'cover';
    bannerImage.style.objectFit = bannerType;

    if (frontmatter['banner-height']) bannerElement.style.height = `${frontmatter['banner-height']}px`;
    const bannerX = frontmatter['banner-x'] || 0.5;
    const bannerY = frontmatter['banner-y'] || 0.5;
    bannerImage.style.objectPosition = `${bannerX * 100}% ${bannerY * 100}%`;

    if (this.settings.fadeEffect) {
        bannerElement.classList.add('with-fade');
        bannerElement.style.setProperty('--js-banner-fade-height', `${this.settings.fadeIntensity}%`);
    }
  }

  removeBannerFromLeaf(leaf) {
    if (leaf && leaf.view && leaf.view.containerEl) {
      const existingBanner = leaf.view.containerEl.querySelector(`.${BANNER_CLASS}`);
      if (existingBanner) existingBanner.remove();

      if (this.settings.hideProperties) {
          const propertiesEl = leaf.view.containerEl.querySelector('.metadata-container');
          if (propertiesEl) propertiesEl.style.display = '';
      }
    }
  }
  debounce(func, timeout = 100) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
  }
}

module.exports = JSBannerPlugin;