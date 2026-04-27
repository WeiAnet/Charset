/**
 * Chrome扩展内容脚本 - 完全匹配Chrome原生样式
 */

class PageCharsetManager {
  constructor() {
    this.currentCharset = null;
    this.originalCharset = null;
    this.isInitialized = false;
    this.observer = null;
    this.isCodeFile = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      this.originalCharset = this.detectPageCharset();
      this.currentCharset = this.originalCharset;
      this.checkAndFixCode();

      const hostname = window.location.hostname;
      const response = await chrome.runtime.sendMessage({
        action: 'getCharsetForSite',
        hostname: hostname
      });

      this.setupDOMObserver();
      this.isInitialized = true;
    } catch (error) {
      console.error('Content Script: Error initializing:', error);
    }
  }

  detectPageCharset() {
    const metaCharset = document.querySelector('meta[charset]');
    if (metaCharset) {
      const charset = metaCharset.getAttribute('charset');
      if (charset) return charset.toUpperCase();
    }

    const metaHttpEquiv = document.querySelector('meta[http-equiv="Content-Type"]');
    if (metaHttpEquiv) {
      const content = metaHttpEquiv.getAttribute('content');
      if (content) {
        const match = content.match(/charset=([^;,\s]+)/i);
        if (match) return match[1].toUpperCase();
      }
    }

    if (document.characterSet) return document.characterSet.toUpperCase();
    if (document.charset) return document.charset.toUpperCase();

    return 'UTF-8';
  }

  checkAndFixCode() {
    const url = window.location.href;
    const contentType = document.contentType || '';

    const isJsFile = url.endsWith('.js') || contentType.includes('javascript');
    const isCssFile = url.endsWith('.css') || contentType.includes('css');

    if (isJsFile || isCssFile) {
      this.isCodeFile = true;
      this.fixCodeDisplay();
    }
  }

  fixCodeDisplay() {
    let code = '';
    const oldPre = document.querySelector('pre');
    if (oldPre) {
      code = oldPre.textContent || oldPre.innerText || document.body.textContent || '';
    } else {
      code = document.body.textContent || '';
    }

    if (!code.trim()) return;

    document.head.innerHTML = '';
    document.body.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = `
      * {
        margin: 0;
        padding: 0;
      }
      body {
        font-family: monospace;
        font-size: 13px;
        line-height: 1.2;
        color: #000;
        background: #fff;
        white-space: pre-wrap;
        word-wrap: break-word;
        padding: 8px;
      }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
    `;
    document.head.appendChild(style);

    const newPre = document.createElement('pre');
    newPre.textContent = code;
    document.body.appendChild(newPre);
  }

  setupDOMObserver() {
    if (this.isCodeFile) return;

    const targetNode = document.head || document.documentElement;
    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['charset', 'content']
    };

    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.tagName === 'META' &&
            (target.hasAttribute('charset') ||
              target.getAttribute('http-equiv') === 'Content-Type')) {
            this.handleCharsetChange();
          }
        }
      });
    });

    this.observer.observe(targetNode, config);
  }

  handleCharsetChange() {
    const newCharset = this.detectPageCharset();
    if (newCharset !== this.currentCharset) {
      this.currentCharset = newCharset;
      this.notifyCharsetChange(newCharset);
    }
  }

  async notifyCharsetChange(charset) {
    try {
      await chrome.runtime.sendMessage({
        action: 'charsetDetected',
        hostname: window.location.hostname,
        charset: charset,
        url: window.location.href
      });
    } catch (error) {
      console.error('Content Script: Error notifying charset change:', error);
    }
  }

  async applyCharset(charset) {
    try {
      const hostname = window.location.hostname;
      const response = await chrome.runtime.sendMessage({
        action: 'updateCharset',
        hostname: hostname,
        charset: charset,
        url: window.location.href
      });
      if (response && response.success) {
        this.currentCharset = charset;
      }
    } catch (error) {
      console.error('Content Script: Error applying charset:', error);
    }
  }

  async resetCharset() {
    try {
      const hostname = window.location.hostname;
      const response = await chrome.runtime.sendMessage({
        action: 'removeCharset',
        hostname: hostname,
        url: window.location.href
      });
      if (response && response.success) {
        this.currentCharset = this.originalCharset;
      }
    } catch (error) {
      console.error('Content Script: Error resetting charset:', error);
    }
  }

  getCurrentCharset() {
    return this.currentCharset;
  }

  getOriginalCharset() {
    return this.originalCharset;
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isInitialized = false;
  }
}

let pageCharsetManager = null;

function initializeContentScript() {
  if (window.self !== window.top) return;

  try {
    pageCharsetManager = new PageCharsetManager();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        pageCharsetManager.initialize();
      });
    } else {
      pageCharsetManager.initialize();
    }
  } catch (error) {
    console.error('Content Script: Error during initialization:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'applyCharset':
        if (pageCharsetManager) {
          pageCharsetManager.applyCharset(message.charset);
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Page manager not initialized' });
        }
        break;

      case 'resetCharset':
        if (pageCharsetManager) {
          pageCharsetManager.resetCharset();
          sendResponse({ success: true });
        } else {
          sendResponse({ error: 'Page manager not initialized' });
        }
        break;

      case 'getCurrentCharset':
        if (pageCharsetManager) {
          sendResponse({
            current: pageCharsetManager.getCurrentCharset(),
            original: pageCharsetManager.getOriginalCharset()
          });
        } else {
          sendResponse({ error: 'Page manager not initialized' });
        }
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    sendResponse({ error: error.message });
  }

  return true;
});

window.addEventListener('beforeunload', () => {
  if (pageCharsetManager) {
    pageCharsetManager.destroy();
    pageCharsetManager = null;
  }
});

window.pageCharsetManager = pageCharsetManager;
window.PageCharsetManager = PageCharsetManager;

initializeContentScript();

console.log('Content Script: Loaded');
