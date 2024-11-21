document.addEventListener('DOMContentLoaded', () => {
  class PopupManager {
    constructor() {
      this.initializeElements();
      this.setupEventListeners();
      this.loadSettings();
    }

    initializeElements() {
      this.globalToggle = document.getElementById('globalToggle');
      this.themeToggle = document.getElementById('toggleTheme');
      this.urlManager = new URLManager();
    }

    async loadSettings() {
      const { protectionEnabled, theme } = await chrome.storage.local.get([
        'protectionEnabled',
        'theme'
      ]);

      if (this.globalToggle) {
        this.globalToggle.checked = protectionEnabled;
      }
      document.body.className = `${theme || 'light'}-theme`;
    }

    setupEventListeners() {
      this.globalToggle?.addEventListener('change', async (e) => {
        await chrome.storage.local.set({ protectionEnabled: e.target.checked });
      });

      this.themeToggle?.addEventListener('click', async () => {
        const { theme } = await chrome.storage.local.get('theme');
        const newTheme = theme === 'light' ? 'dark' : 'light';
        await chrome.storage.local.set({ theme: newTheme });
        document.body.className = `${newTheme}-theme`;
        const icon = this.themeToggle.querySelector('i');
        icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
      });

      const settingsBtn = document.getElementById('openSettings');
      const settingsModal = document.getElementById('settingsModal');
      const closeSettingsBtn = settingsModal.querySelector('.modal-close');

      settingsBtn?.addEventListener('click', () => {
        settingsModal.classList.add('visible');
      });

      closeSettingsBtn?.addEventListener('click', () => {
        settingsModal.classList.remove('visible');
      });

      settingsModal?.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.remove('visible');
        }
      });

      document.getElementById('changePassword')?.addEventListener('click', () => {
        const modal = document.getElementById('changePasswordModal');
        modal.classList.add('visible');
        
        // Reset form and clear errors
        const inputs = modal.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('input-error');
        });
        modal.querySelectorAll('.modal-error').forEach(err => err.remove());
      });

      document.getElementById('saveNewPassword')?.addEventListener('click', async () => {
        const currentPassword = document.getElementById('currentPassword');
        const newPassword = document.getElementById('newPassword');
        const confirmNewPassword = document.getElementById('confirmNewPassword');
        
        // Clear previous errors
        document.querySelectorAll('.modal-error').forEach(err => err.remove());
        [currentPassword, newPassword, confirmNewPassword].forEach(input => {
            input.classList.remove('input-error');
        });

        try {
            if (!currentPassword.value) {
                showModalError(currentPassword, 'Please enter your current password');
                return;
            }

            if (!newPassword.value) {
                showModalError(newPassword, 'Please enter a new password');
                return;
            }

            if (!confirmNewPassword.value) {
                showModalError(confirmNewPassword, 'Please confirm your new password');
                return;
            }

            // Verify current password
            const response = await chrome.runtime.sendMessage({
                type: 'VERIFY_PASSWORD',
                password: currentPassword.value
            });

            if (!response.success) {
                showModalError(currentPassword, 'Current password is incorrect');
                return;
            }

            // Validate new password
            ValidationUtil.validatePassword(newPassword.value, confirmNewPassword.value);

            // Hash and save new password
            const hashedPassword = await CryptoUtil.hashPassword(newPassword.value);
            await chrome.storage.local.set({ masterHash: hashedPassword });

            // Reset form and show success
            document.getElementById('changePasswordForm').classList.add('hidden');
            currentPassword.value = '';
            newPassword.value = '';
            confirmNewPassword.value = '';
            alert('Password changed successfully');
        } catch (error) {
            if (error.message.includes('match')) {
                showModalError(confirmNewPassword, error.message);
            } else {
                showModalError(newPassword, error.message);
            }
        }
      });

      document.getElementById('settingsImportSites')?.addEventListener('click', () => {
        const urlManager = new URLManager();
        urlManager.importSites();
      });

      document.getElementById('settingsExportSites')?.addEventListener('click', () => {
        const urlManager = new URLManager();
        urlManager.exportSites();
      });

      document.querySelectorAll('#changePasswordForm .toggle-password').forEach(button => {
        button.addEventListener('click', (e) => {
            const container = e.currentTarget.closest('.password-input-container');
            const input = container.querySelector('input');
            const eyeOpen = container.querySelector('.eye-open');
            const eyeClosed = container.querySelector('.eye-closed');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeOpen.classList.add('hidden');
                eyeClosed.classList.remove('hidden');
            } else {
                input.type = 'password';
                eyeOpen.classList.remove('hidden');
                eyeClosed.classList.add('hidden');
            }
        });
      });

      document.querySelector('#changePasswordModal .modal-close')?.addEventListener('click', () => {
        document.getElementById('changePasswordModal').classList.remove('visible');
      });

      document.getElementById('changePasswordModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.remove('visible');
        }
      });
    }
  }

  new PopupManager();
});

function showModalError(input, message) {
    input.classList.add('input-error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'modal-error';
    errorDiv.textContent = message;
    input.parentNode.insertBefore(errorDiv, input.nextSibling);
} 