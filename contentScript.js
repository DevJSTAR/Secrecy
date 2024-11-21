let currentTheme = 'light';
let isPasscode = false;
let lockScreenActive = false;

// Get initial theme and passcode status
chrome.storage.local.get(['theme', 'isPasscode'], ({ theme, isPasscode: isPass }) => {
  currentTheme = theme || 'light';
  isPasscode = isPass;
});

function createLockScreen(url) {
  // Get URL details
  const urlObj = new URL(url);
  const isFullDomain = urlObj.pathname === '/';
  const displayText = isFullDomain ? urlObj.hostname : url;
  
  // Replace entire document content
  document.documentElement.innerHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap">
      <style>
        :root {
          --primary-color: #7C3AED;
          --primary-gradient: #9333EA;
          --text-color: #1F2937;
          --background: #F9FAFB;
          --card-background: #FFFFFF;
          --border-color: #E5E7EB;
          --error-color: #EF4444;
          --primary-shadow: rgba(124, 58, 237, 0.2);
        }
        
        .dark-theme {
          --primary-color: #8B5CF6;
          --primary-gradient: #7C3AED;
          --text-color: #F3F4F6;
          --background: #111827;
          --card-background: #1F2937;
          --border-color: #374151;
        }
        
        body {
          margin: 0;
          font-family: 'Poppins', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background-color: var(--background);
          color: var(--text-color);
        }
        
        .lock-container {
          background: var(--card-background);
          padding: 2rem;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          text-align: center;
          max-width: 400px;
          width: 90%;
        }

        .logo {
          width: 64px;
          height: 64px;
          margin-bottom: 1rem;
        }

        h2 {
          font-size: 24px;
          font-weight: 600;
          margin: 0 0 0.5rem;
          background: linear-gradient(135deg, var(--primary-color), var(--primary-gradient));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .protected-url {
          font-size: 14px;
          color: var(--text-color);
          opacity: 0.8;
          margin-bottom: 1.5rem;
          word-break: break-all;
        }
        
        input {
          width: 100%;
          padding: 12px;
          border: 1.5px solid var(--border-color);
          border-radius: 12px;
          font-size: 14px;
          margin-bottom: 1rem;
          box-sizing: border-box;
          font-family: 'Poppins', sans-serif;
          background: transparent;
          color: var(--text-color);
          -webkit-text-security: disc !important;
        }

        input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-shadow);
        }
        
        button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, var(--primary-color), var(--primary-gradient));
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Poppins', sans-serif;
        }
        
        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
        }

        .error {
          animation: shake 0.5s;
          border-color: var(--error-color) !important;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      </style>
    </head>
    <body class="${currentTheme}-theme">
      <div class="lock-container">
        <img src="${chrome.runtime.getURL(`images/logo${currentTheme === 'dark' ? '2' : ''}.png`)}" alt="Logo" class="logo">
        <h2>Protected ${isFullDomain ? 'Domain' : 'Page'}</h2>
        <div class="protected-url">${displayText}</div>
        <input type="password" id="unlock-input" placeholder="Enter your ${isPasscode ? 'passcode' : 'password'}" autocomplete="off">
        <button id="unlock-button">Unlock</button>
      </div>
      <script>
        document.getElementById('unlock-input').focus();
      </script>
    </body>
    </html>
  `;

  setupLockScreen();
}

function setupLockScreen() {
  const unlockButton = document.querySelector('#unlock-button');
  const unlockInput = document.querySelector('#unlock-input');
  
  if (isPasscode) {
    unlockInput.type = 'number';
    unlockInput.maxLength = 6;
  }

  unlockButton.addEventListener('click', async () => {
    const password = unlockInput.value;
    const response = await chrome.runtime.sendMessage({
      type: 'VERIFY_PASSWORD',
      password
    });
    
    if (response.success) {
      sessionStorage.setItem('unlocked', 'true');
      window.onbeforeunload = null;
      location.replace(location.href);
    } else {
      unlockInput.classList.add('error');
      setTimeout(() => unlockInput.classList.remove('error'), 1000);
    }
  });

  unlockInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      unlockButton.click();
    }
  });

  unlockInput.focus();
}

// Listen for messages
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'SHOW_LOCK_SCREEN') {
    // Check if already unlocked in this session
    if (sessionStorage.getItem('unlocked') === 'true') {
      return;
    }

    // Check if site is disabled
    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    const currentUrl = window.location.href;
    const currentOrigin = window.location.origin + '/';
    const currentHostname = new URL(currentUrl).hostname;
    
    // Don't show lock screen if site is disabled (check all formats)
    if (disabledSites.some(site => {
      try {
        const siteUrl = new URL(site);
        return currentHostname === siteUrl.hostname || 
               currentUrl === site || 
               currentOrigin === site;
      } catch {
        return false;
      }
    })) {
      sessionStorage.setItem('unlocked', 'true');
      return;
    }

    lockScreenActive = true;
    createLockScreen(window.location.href);
  } else if (message.type === 'THEME_CHANGED') {
    currentTheme = message.theme;
    if (!sessionStorage.getItem('unlocked')) {
      createLockScreen(window.location.href);
    }
  }
});

// Add this at document start to prevent initial load bypass
if (!sessionStorage.getItem('unlocked')) {
  chrome.runtime.sendMessage({ type: 'CHECK_PROTECTION' });
}