class URLManager {
  constructor() {
    this.sitesList = document.getElementById('sitesList');
    this.addSiteButton = document.getElementById('addSite');
    this.setupEventListeners();
    this.loadSites();
  }

  async setupEventListeners() {
    this.addSiteButton?.addEventListener('click', () => this.showAddSiteDialog());
    
    document.getElementById('importSites')?.addEventListener('click', () => this.importSites());
    document.getElementById('exportSites')?.addEventListener('click', () => this.exportSites());
  }

  async loadSites() {
    if (!this.sitesList) return;
    
    const { protectedSites } = await chrome.storage.local.get('protectedSites');
    this.sitesList.innerHTML = '';
    
    for (const site of protectedSites || []) {
      this.addSiteToList(site);
    }
  }

  validateUrl(url) {
    try {
      const urlObj = new URL(url);
      // Check if domain has at least one dot and valid TLD
      const domainParts = urlObj.hostname.split('.');
      if (domainParts.length < 2 || domainParts[domainParts.length - 1].length < 2) {
        throw new Error('Please enter a valid domain (e.g., example.com)');
      }
      return true;
    } catch (error) {
      return error.message;
    }
  }

  showModalError(input, message) {
    const wrapper = input.closest('.input-wrapper');
    wrapper.classList.add('has-error');
    
    const existingError = wrapper.querySelector('.modal-error');
    if (existingError) existingError.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'modal-error';
    errorDiv.textContent = message;
    wrapper.appendChild(errorDiv);
    input.classList.add('input-error');
  }

  clearModalError(input) {
    const wrapper = input.closest('.input-wrapper');
    wrapper.classList.remove('has-error');
    const existingError = wrapper.querySelector('.modal-error');
    if (existingError) existingError.remove();
    input.classList.remove('input-error');
  }

  truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      if (domain.length > 30) {
        domain = domain.substring(0, 27) + '...';
      }
      return domain;
    } catch {
      return url;
    }
  }

  async addSiteToList(site) {
    const siteElement = document.createElement('div');
    siteElement.className = 'site-item';
    
    const favicon = `https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(site)}`;
    
    // Get disabled sites to set initial toggle state
    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    const isEnabled = !disabledSites.some(disabled => {
      try {
        const disabledUrl = new URL(disabled);
        const siteUrl = new URL(site);
        return disabledUrl.hostname === siteUrl.hostname;
      } catch {
        return disabled === site;
      }
    });
    
    siteElement.innerHTML = `
      <div class="site-info">
        <img src="${favicon}" alt="" class="site-favicon">
        <span class="site-url" title="${site}">${this.truncateUrl(site)}</span>
      </div>
      <div class="site-actions">
        <label class="checkbox-container" title="Enable protection for this site">
          <input type="checkbox" class="site-toggle" ${isEnabled ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
        <button class="icon-button remove-site" title="Remove site">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;

    // Add toggle event listener
    const toggle = siteElement.querySelector('.site-toggle');
    toggle.addEventListener('change', async (e) => {
      const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
      const siteUrl = new URL(site);
      const siteOrigin = siteUrl.origin + '/';
      
      if (!e.target.checked) {
        // Disable site
        if (!disabledSites.includes(siteOrigin)) {
          disabledSites.push(siteOrigin);
        }
      } else {
        // Enable site
        const index = disabledSites.findIndex(disabled => {
          try {
            const disabledUrl = new URL(disabled);
            return disabledUrl.hostname === siteUrl.hostname;
          } catch {
            return disabled === site || disabled === siteOrigin;
          }
        });
        if (index !== -1) {
          disabledSites.splice(index, 1);
        }
      }
      
      await chrome.storage.local.set({ disabledSites });
    });

    // Add remove button event listener
    const removeBtn = siteElement.querySelector('.remove-site');
    removeBtn.addEventListener('click', () => this.removeSite(site));

    this.sitesList?.appendChild(siteElement);
  }

  async showAddSiteDialog() {
    const modal = document.getElementById('addSiteModal');
    const input = document.getElementById('siteUrl');
    const closeBtn = modal.querySelector('.modal-close');
    const confirmBtn = document.getElementById('confirmAdd');

    modal.classList.add('visible');
    input.value = '';
    input.focus();

    const handleClose = () => {
      modal.classList.remove('visible');
      input.value = '';
      this.clearModalError(input);
    };

    const handleAdd = async () => {
      let url = input.value.trim();
      
      if (!url) {
        this.showModalError(input, 'Please enter a website URL');
        return;
      }

      // Add https:// if no protocol is specified
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      const validationResult = this.validateUrl(url);
      if (validationResult !== true) {
        this.showModalError(input, validationResult);
        return;
      }

      const { protectedSites = [] } = await chrome.storage.local.get('protectedSites');
      if (protectedSites.includes(url)) {
        this.showModalError(input, 'This website is already protected');
        return;
      }

      protectedSites.push(url);
      await chrome.storage.local.set({ protectedSites });
      this.addSiteToList(url);
      handleClose();
    };

    closeBtn.onclick = handleClose;
    confirmBtn.onclick = handleAdd;
    modal.onclick = (e) => {
      if (e.target === modal) handleClose();
    };

    input.onkeyup = (e) => {
      if (e.key === 'Enter') handleAdd();
      if (e.key === 'Escape') handleClose();
      this.clearModalError(input);
    };
  }

  async removeSite(url) {
    const { protectedSites = [] } = await chrome.storage.local.get('protectedSites');
    const updatedSites = protectedSites.filter(site => site !== url);
    await chrome.storage.local.set({ protectedSites: updatedSites });
    await this.loadSites();
  }

  async importSites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target.result);
          
          if (!data.sites || !Array.isArray(data.sites)) {
            throw new Error('Invalid file format: Expected sites array');
          }
          
          const validUrls = data.sites.filter(url => {
            try {
              new URL(url);
              return true;
            } catch {
              return false;
            }
          });

          if (validUrls.length === 0) {
            throw new Error('No valid URLs found in the file');
          }

          await chrome.storage.local.set({ 
            protectedSites: validUrls,
            disabledSites: Array.isArray(data.disabledSites) ? data.disabledSites : []
          });
          this.loadSites();
        } catch (error) {
          alert('Error importing sites: ' + error.message);
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  async exportSites() {
    const { protectedSites = [], disabledSites = [] } = await chrome.storage.local.get(['protectedSites', 'disabledSites']);
    
    const exportData = {
      sites: protectedSites,
      disabledSites: disabledSites
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'protected-sites.json';
    a.click();
    
    URL.revokeObjectURL(url);
  }
} 