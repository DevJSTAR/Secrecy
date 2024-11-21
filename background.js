importScripts('crypto.js');

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      isSetup: false,
      protectionEnabled: true,
      theme: 'light',
      protectedSites: [],
      disabledSites: []
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VERIFY_PASSWORD') {
    chrome.storage.local.get(['masterHash', 'isPasscode'], async ({ masterHash, isPasscode }) => {
      try {
        const isValid = await CryptoUtil.verifyPassword(message.password, masterHash);
        sendResponse({ success: isValid });
      } catch (error) {
        sendResponse({ success: false });
      }
    });
    return true;
  }
});

// Update the URL matching function
function isURLMatched(protectedUrl, currentUrl) {
  try {
    const protectedUrlObj = new URL(protectedUrl);
    const currentUrlObj = new URL(currentUrl);
    
    // Get base domains (e.g., "google.com" from "www.google.com")
    const getBaseDomain = (hostname) => {
      const parts = hostname.split('.');
      return parts.length > 2 ? parts.slice(-2).join('.') : hostname;
    };

    const protectedBaseDomain = getBaseDomain(protectedUrlObj.hostname);
    const currentBaseDomain = getBaseDomain(currentUrlObj.hostname);

    // If protected URL has a path, check exact match
    if (protectedUrlObj.pathname !== '/') {
      return currentUrl.startsWith(protectedUrl);
    }

    // Check if base domains match (this will catch all subdomains)
    return currentBaseDomain === protectedBaseDomain;
  } catch {
    return false;
  }
}

// Update the webNavigation listener
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId === 0) {
    try {
      const { protectionEnabled, protectedSites, disabledSites = [] } = await chrome.storage.local.get([
        'protectionEnabled',
        'protectedSites',
        'disabledSites'
      ]);

      if (protectionEnabled && protectedSites?.length > 0) {
        const shouldBlock = protectedSites.some(protectedUrl => 
          isURLMatched(protectedUrl, details.url)
        );

        // Check if site is disabled
        const isDisabled = disabledSites.some(disabledUrl => 
          isURLMatched(disabledUrl, details.url)
        );

        if (shouldBlock && !isDisabled) {
          try {
            await chrome.tabs.sendMessage(details.tabId, { 
              type: 'SHOW_LOCK_SCREEN',
              url: details.url
            });
          } catch (error) {
            // Silently ignore the error
            await chrome.scripting.executeScript({
              target: { tabId: details.tabId },
              files: ['contentScript.js']
            }).catch(() => {}); // Ignore any injection errors
          }
        }
      }
    } catch (error) {
      // Silently ignore any errors
    }
  }
});

// Add theme listener
chrome.storage.onChanged.addListener((changes) => {
  if (changes.theme) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'THEME_CHANGED',
          theme: changes.theme.newValue
        }).catch(() => {}); // Ignore errors for inactive tabs
      });
    });
  }
});

// Update the CHECK_PROTECTION handler
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'CHECK_PROTECTION') {
    try {
      const tab = await chrome.tabs.get(sender.tab.id);
      const { protectionEnabled, protectedSites, disabledSites = [] } = await chrome.storage.local.get([
        'protectionEnabled',
        'protectedSites',
        'disabledSites'
      ]);

      if (protectionEnabled && protectedSites?.length > 0) {
        const shouldBlock = protectedSites.some(protectedUrl => 
          isURLMatched(protectedUrl, tab.url)
        );

        // Check if site is disabled
        const isDisabled = disabledSites.some(disabledUrl => 
          isURLMatched(disabledUrl, tab.url)
        );

        if (shouldBlock && !isDisabled) {
          chrome.tabs.sendMessage(sender.tab.id, { 
            type: 'SHOW_LOCK_SCREEN',
            url: tab.url
          }).catch(() => {}); // Ignore any messaging errors
        }
      }
    } catch (error) {
      // Silently ignore any errors
    }
  }
});

// ... rest of the background.js code ... 