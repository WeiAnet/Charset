/**
 * 直接检测页面编码（不依赖pageCharsetManager）
 */
function detectPageCharsetDirect() {
  // 方法1：检查meta charset标签
  const metaCharset = document.querySelector('meta[charset]');
  if (metaCharset) {
    const charset = metaCharset.getAttribute('charset');
    if (charset) {
      return charset.toUpperCase();
    }
  }

  // 方法2：检查http-equiv Content-Type
  const metaHttpEquiv = document.querySelector('meta[http-equiv="Content-Type"]');
  if (metaHttpEquiv) {
    const content = metaHttpEquiv.getAttribute('content');
    if (content) {
      const match = content.match(/charset=([^;,\s]+)/i);
      if (match) {
        return match[1].toUpperCase();
      }
    }
  }

  // 方法3：检查document.characterSet
  if (document.characterSet) {
    return document.characterSet.toUpperCase();
  }

  // 方法4：检查document.charset (已废弃但某些浏览器仍支持)
  if (document.charset) {
    return document.charset.toUpperCase();
  }

  // 默认返回UTF-8
  return 'UTF-8';
}

/**
 * Chrome扩展内容脚本
 * 处理页面编码检测和应用逻辑
 */

// 检查工具类是否已加载
if (typeof window.charsetUtils === 'undefined') {
  console.warn('Content Script: charsetUtils not available');
}

/**
 * 页面编码管理器
 */
class PageCharsetManager {
  constructor() {
    this.currentCharset = null;
    this.originalCharset = null;
    this.isInitialized = false;
    this.observer = null;
  }

  /**
   * 初始化页面编码管理器
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // 检测当前页面编码
      this.originalCharset = this.detectPageCharset();
      this.currentCharset = this.originalCharset;

      // 检查是否有保存的编码设置
      const hostname = window.location.hostname;
      const response = await chrome.runtime.sendMessage({
        action: 'getCharsetForSite',
        hostname: hostname
      });

      if (response && response.charset && response.charset !== this.currentCharset) {
        console.log(`Content Script: Found saved charset ${response.charset} for ${hostname}`);
        // 已保存的编码设置会通过background script的规则自动应用
      }

      // 监听DOM变化以保持编码设置
      this.setupDOMObserver();

      this.isInitialized = true;
      console.log(`Content Script: Initialized for ${hostname}, current charset: ${this.currentCharset}`);
    } catch (error) {
      console.error('Content Script: Error initializing:', error);
    }
  }

  /**
   * 检测页面当前编码
   */
  detectPageCharset() {
    // 方法1：检查meta charset标签
    const metaCharset = document.querySelector('meta[charset]');
    if (metaCharset) {
      const charset = metaCharset.getAttribute('charset');
      if (charset) {
        return charset.toUpperCase();
      }
    }

    // 方法2：检查http-equiv Content-Type
    const metaHttpEquiv = document.querySelector('meta[http-equiv="Content-Type"]');
    if (metaHttpEquiv) {
      const content = metaHttpEquiv.getAttribute('content');
      if (content) {
        const match = content.match(/charset=([^;,\s]+)/i);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }

    // 方法3：检查document.characterSet
    if (document.characterSet) {
      return document.characterSet.toUpperCase();
    }

    // 方法4：检查document.charset (已废弃但某些浏览器仍支持)
    if (document.charset) {
      return document.charset.toUpperCase();
    }

    // 默认返回UTF-8
    return 'UTF-8';
  }

  /**
   * 设置DOM观察器监听编码相关变化
   */
  setupDOMObserver() {
    // 监听head标签的变化
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
            // 编码相关的meta标签被修改
            this.handleCharsetChange();
          }
        } else if (mutation.type === 'childList') {
          // 检查添加的节点中是否有编码相关的meta标签
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const metaTags = node.querySelectorAll ? 
                node.querySelectorAll('meta[charset], meta[http-equiv="Content-Type"]') : 
                [];
              if (metaTags.length > 0 || 
                  (node.tagName === 'META' && 
                   (node.hasAttribute('charset') || 
                    node.getAttribute('http-equiv') === 'Content-Type'))) {
                this.handleCharsetChange();
              }
            }
          });
        }
      });
    });

    this.observer.observe(targetNode, config);
  }

  /**
   * 处理编码变化
   */
  handleCharsetChange() {
    const newCharset = this.detectPageCharset();
    if (newCharset !== this.currentCharset) {
      console.log(`Content Script: Charset changed from ${this.currentCharset} to ${newCharset}`);
      this.currentCharset = newCharset;
      
      // 通知background script
      this.notifyCharsetChange(newCharset);
    }
  }

  /**
   * 通知background script编码变化
   */
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

  /**
   * 应用新的编码设置
   */
  async applyCharset(charset) {
    try {
      const hostname = window.location.hostname;
      
      // 发送消息给background script来更新规则
      const response = await chrome.runtime.sendMessage({
        action: 'updateCharset',
        hostname: hostname,
        charset: charset,
        url: window.location.href
      });

      if (response && response.success) {
        console.log(`Content Script: Successfully applied charset ${charset}`);
        this.currentCharset = charset;
      } else {
        console.error('Content Script: Failed to apply charset');
      }
    } catch (error) {
      console.error('Content Script: Error applying charset:', error);
    }
  }

  /**
   * 重置编码设置
   */
  async resetCharset() {
    try {
      const hostname = window.location.hostname;
      
      const response = await chrome.runtime.sendMessage({
        action: 'removeCharset',
        hostname: hostname,
        url: window.location.href
      });

      if (response && response.success) {
        console.log('Content Script: Successfully reset charset');
        this.currentCharset = this.originalCharset;
      } else {
        console.error('Content Script: Failed to reset charset');
      }
    } catch (error) {
      console.error('Content Script: Error resetting charset:', error);
    }
  }

  /**
   * 获取当前编码
   */
  getCurrentCharset() {
    return this.currentCharset;
  }

  /**
   * 获取原始编码
   */
  getOriginalCharset() {
    return this.originalCharset;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isInitialized = false;
  }
}

// 全局实例
let pageCharsetManager = null;

/**
 * 初始化内容脚本
 */
function initializeContentScript() {
  // 只在主框架中初始化
  if (window.self !== window.top) {
    return;
  }

  try {
    pageCharsetManager = new PageCharsetManager();
    
    // 根据文档状态决定何时初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        pageCharsetManager.initialize();
      });
    } else {
      // 文档已加载完成，直接初始化
      pageCharsetManager.initialize();
    }

    console.log('Content Script: Initialization scheduled');
  } catch (error) {
    console.error('Content Script: Error during initialization:', error);
  }
}

/**
 * 处理来自background script的消息
 */
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
    console.error('Content Script: Error handling message:', error);
    sendResponse({ error: error.message });
  }

  return true; // 保持消息通道开放
});

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (pageCharsetManager) {
    pageCharsetManager.destroy();
    pageCharsetManager = null;
  }
});

// 导出到全局作用域以便调试
window.pageCharsetManager = pageCharsetManager;
window.PageCharsetManager = PageCharsetManager;

// 立即初始化
initializeContentScript();

console.log('Content Script: Loaded');