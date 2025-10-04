/**
 * 字符编码切换工具模块
 * 提供编码检测、转换和存储功能
 */

// 支持的字符编码列表
const SUPPORTED_CHARSETS = {
  'UTF-8': 'UTF-8',
  'GBK': 'GBK',
  'GB2312': 'GB2312',
  'GB18030': 'GB18030',
  'Big5': 'Big5',
  'ISO-8859-1': 'ISO-8859-1',
  'Windows-1252': 'Windows-1252',
  'Shift_JIS': 'Shift_JIS',
  'EUC-KR': 'EUC-KR'
};

// 常用编码的显示名称
const CHARSET_NAMES = {
  'UTF-8': 'Unicode (UTF-8)',
  'GBK': 'GBK (简体中文)',
  'GB2312': 'GB2312 (简体中文)',
  'GB18030': 'GB18030 (中文国标)',
  'Big5': 'Big5 (繁体中文)',
  'ISO-8859-1': 'ISO-8859-1 (西欧)',
  'Windows-1252': 'Windows-1252 (西欧)',
  'Shift_JIS': 'Shift_JIS (日文)',
  'EUC-KR': 'EUC-KR (韩文)'
};

/**
 * 存储工具类
 */
class CharsetStorage {
  constructor() {
    this.storageKey = 'charset_settings';
    this.globalKey = 'global_charset';
  }

  /**
   * 保存网站的编码设置
   * @param {string} hostname - 网站域名
   * @param {string} charset - 字符编码
   */
  async saveCharsetForSite(hostname, charset) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      settings[hostname] = charset;
      await chrome.storage.local.set({ [this.storageKey]: settings });
      console.log(`Saved charset ${charset} for ${hostname}`);
    } catch (error) {
      console.error('Error saving charset setting:', error);
    }
  }

  /**
   * 获取网站的编码设置
   * @param {string} hostname - 网站域名
   * @returns {Promise<string|null>} 字符编码或null
   */
  async getCharsetForSite(hostname) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      return settings[hostname] || null;
    } catch (error) {
      console.error('Error getting charset setting:', error);
      return null;
    }
  }

  /**
   * 删除网站的编码设置
   * @param {string} hostname - 网站域名
   */
  async removeCharsetForSite(hostname) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      delete settings[hostname];
      await chrome.storage.local.set({ [this.storageKey]: settings });
      console.log(`Removed charset setting for ${hostname}`);
    } catch (error) {
      console.error('Error removing charset setting:', error);
    }
  }

  /**
   * 获取所有网站的编码设置
   * @returns {Promise<Object>} 编码设置对象
   */
  async getAllCharsetSettings() {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || {};
    } catch (error) {
      console.error('Error getting all charset settings:', error);
      return {};
    }
  }

  /**
   * 保存全局默认编码
   * @param {string} charset - 字符编码
   */
  async saveGlobalCharset(charset) {
    try {
      await chrome.storage.local.set({ [this.globalKey]: charset });
      console.log(`Saved global charset: ${charset}`);
    } catch (error) {
      console.error('Error saving global charset:', error);
    }
  }

  /**
   * 获取全局默认编码
   * @returns {Promise<string>} 字符编码
   */
  async getGlobalCharset() {
    try {
      const result = await chrome.storage.local.get(this.globalKey);
      return result[this.globalKey] || 'UTF-8';
    } catch (error) {
      console.error('Error getting global charset:', error);
      return 'UTF-8';
    }
  }
}

/**
 * 编码工具类
 */
class CharsetUtils {
  constructor() {
    this.storage = new CharsetStorage();
  }

  /**
   * 检测页面当前编码
   * @returns {string} 当前编码
   */
  detectCurrentCharset() {
    // 从meta标签检测
    const metaCharset = document.querySelector('meta[charset]');
    if (metaCharset) {
      return metaCharset.getAttribute('charset').toUpperCase();
    }

    // 从http-equiv检测
    const metaHttpEquiv = document.querySelector('meta[http-equiv="Content-Type"]');
    if (metaHttpEquiv) {
      const content = metaHttpEquiv.getAttribute('content');
      const match = content.match(/charset=([^;]+)/i);
      if (match) {
        return match[1].toUpperCase();
      }
    }

    // 默认返回UTF-8
    return 'UTF-8';
  }

  /**
   * 获取支持的编码列表
   * @returns {Object} 编码列表
   */
  getSupportedCharsets() {
    return SUPPORTED_CHARSETS;
  }

  /**
   * 获取编码的显示名称
   * @param {string} charset - 字符编码
   * @returns {string} 显示名称
   */
  getCharsetDisplayName(charset) {
    return CHARSET_NAMES[charset] || charset;
  }

  /**
   * 验证编码是否有效
   * @param {string} charset - 字符编码
   * @returns {boolean} 是否有效
   */
  isValidCharset(charset) {
    return charset in SUPPORTED_CHARSETS;
  }

  /**
   * 获取当前页面的hostname
   * @returns {string} hostname
   */
  getCurrentHostname() {
    return window.location.hostname;
  }

  /**
   * 应用编码到页面
   * @param {string} charset - 字符编码
   */
  async applyCharsetToPage(charset) {
    try {
      const hostname = this.getCurrentHostname();
      
      // 保存编码设置
      await this.storage.saveCharsetForSite(hostname, charset);
      
      // 通知background script更新规则
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'updateCharset',
          hostname: hostname,
          charset: charset,
          url: window.location.href
        });
      }
      
      console.log(`Applied charset ${charset} to ${hostname}`);
    } catch (error) {
      console.error('Error applying charset:', error);
    }
  }

  /**
   * 重置页面编码为默认
   */
  async resetCharsetForPage() {
    try {
      const hostname = this.getCurrentHostname();
      
      // 删除编码设置
      await this.storage.removeCharsetForSite(hostname);
      
      // 通知background script移除规则
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'removeCharset',
          hostname: hostname,
          url: window.location.href
        });
      }
      
      console.log(`Reset charset for ${hostname}`);
    } catch (error) {
      console.error('Error resetting charset:', error);
    }
  }
}

// 创建全局实例
const charsetUtils = new CharsetUtils();
const charsetStorage = new CharsetStorage();

// 导出到全局作用域
if (typeof window !== 'undefined') {
  window.CharsetUtils = CharsetUtils;
  window.CharsetStorage = CharsetStorage;
  window.charsetUtils = charsetUtils;
  window.charsetStorage = charsetStorage;
  window.SUPPORTED_CHARSETS = SUPPORTED_CHARSETS;
  window.CHARSET_NAMES = CHARSET_NAMES;
}