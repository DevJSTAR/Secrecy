class Onboarding {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.checkSetupStatus();
  }

  initializeElements() {
    this.selectHeader = document.getElementById('selectHeader');
    this.customSelect = document.querySelector('.custom-select');
    this.passwordInput = document.getElementById('passwordInput');
    this.masterPassword = document.getElementById('masterPassword');
    this.confirmPassword = document.getElementById('confirmPassword');
    this.setupComplete = document.getElementById('setupComplete');
    this.togglePasswordButtons = document.querySelectorAll('.toggle-password');
  }

  setupEventListeners() {
    if (this.selectHeader) {
      this.selectHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        this.customSelect.classList.toggle('select-open');
      });

      const options = document.querySelectorAll('.select-option');
      options.forEach(option => {
        option.addEventListener('click', (e) => {
          e.stopPropagation();
          const value = option.dataset.value;
          const span = this.selectHeader.querySelector('span');
          if (span) {
            span.textContent = option.textContent;
          }
          this.customSelect.classList.remove('select-open');
          this.updateInputType(value);
        });
      });

      document.addEventListener('click', (e) => {
        if (!this.customSelect.contains(e.target)) {
          this.customSelect.classList.remove('select-open');
        }
      });
    }

    if (this.setupComplete) {
      this.setupComplete.addEventListener('click', async () => {
        try {
          const password = this.masterPassword.value;
          const confirmPassword = this.confirmPassword.value;
          
          this.clearError(this.masterPassword);
          this.clearError(this.confirmPassword);
          
          const isPasscode = this.selectHeader.querySelector('span').textContent.trim().toLowerCase() === 'passcode';
          
          if (isPasscode) {
            ValidationUtil.validatePasscode(password);
            ValidationUtil.validatePasscode(confirmPassword);
            if (password !== confirmPassword) {
              throw new Error('Passcodes do not match');
            }
          } else {
            ValidationUtil.validatePassword(password, confirmPassword);
          }

          const hashedPassword = await CryptoUtil.hashPassword(password);
          await chrome.storage.local.set({
            isSetup: true,
            masterHash: hashedPassword,
            protectionEnabled: true
          });

          document.getElementById('onboarding')?.classList.add('hidden');
          document.getElementById('main')?.classList.remove('hidden');

          new URLManager();
        } catch (error) {
          if (error.message.includes('match')) {
            this.showError(this.confirmPassword, error.message);
          } else {
            this.showError(this.masterPassword, error.message);
          }
        }
      });
    }

    this.togglePasswordButtons.forEach(button => {
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
  }

  async checkSetupStatus() {
    try {
      const { isSetup } = await chrome.storage.local.get('isSetup');
      const onboarding = document.getElementById('onboarding');
      const main = document.getElementById('main');
      
      if (isSetup) {
        onboarding?.classList.add('hidden');
        main?.classList.remove('hidden');
      } else {
        onboarding?.classList.remove('hidden');
        main?.classList.add('hidden');
      }
    } catch (error) {
      // Handle error silently
    }
  }

  showError(input, message) {
    input.classList.add('input-error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    input.parentNode.appendChild(errorDiv);
  }

  clearError(input) {
    input.classList.remove('input-error');
    const existingError = input.parentNode.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
  }

  updateInputType(type) {
    const isPasscode = type === 'passcode';
    this.masterPassword.type = isPasscode ? 'number' : 'password';
    this.confirmPassword.type = isPasscode ? 'number' : 'password';
    this.masterPassword.placeholder = isPasscode ? 'Enter 6-digit passcode' : 'Enter password';
    this.confirmPassword.placeholder = isPasscode ? 'Confirm passcode' : 'Confirm password';
    
    if (isPasscode) {
      this.masterPassword.maxLength = 6;
      this.confirmPassword.maxLength = 6;
    } else {
      this.masterPassword.maxLength = 30;
      this.confirmPassword.maxLength = 30;
    }
    
    chrome.storage.local.set({ isPasscode });
    
    this.clearError(this.masterPassword);
    this.clearError(this.confirmPassword);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Onboarding();
}); 