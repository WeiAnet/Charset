/**
 * Chrome扩展背景脚本
 * 处理右键菜单、DeclarativeNetRequest API和消息通信
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

// 编码显示名称
const CHARSET_NAMES = {
  'UTF-8': 'Unicode (UTF-8)',
  'GBK': 'GBK 编码',
  'GB2312': 'GB2312 (简体中文)',
  'GB18030': 'GB18030 (中文国标)',
  'Big5': 'Big5 (繁体中文)',
  'ISO-8859-1': 'ISO-8859-1 (西欧)',
  'Windows-1252': 'Windows-1252 (西欧)',
  'Shift_JIS': 'Shift_JIS (日文)',
  'EUC-KR': 'EUC-KR (韩文)'
};

// 存储管理器
class BackgroundStorage {
  constructor() {
    this.storageKey = 'charset_settings';
    this.rulesKey = 'active_rules';
  }

  async saveCharsetForSite(hostname, charset) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      settings[hostname] = charset;
      await chrome.storage.local.set({ [this.storageKey]: settings });
      console.log(`Background: Saved charset ${charset} for ${hostname}`);
    } catch (error) {
      console.error('Background: Error saving charset setting:', error);
    }
  }

  async getCharsetForSite(hostname) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      return settings[hostname] || null;
    } catch (error) {
      console.error('Background: Error getting charset setting:', error);
      return null;
    }
  }

  async removeCharsetForSite(hostname) {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      const settings = result[this.storageKey] || {};
      delete settings[hostname];
      await chrome.storage.local.set({ [this.storageKey]: settings });
      console.log(`Background: Removed charset setting for ${hostname}`);
    } catch (error) {
      console.error('Background: Error removing charset setting:', error);
    }
  }

  async saveActiveRules(rules) {
    try {
      await chrome.storage.local.set({ [this.rulesKey]: rules });
    } catch (error) {
      console.error('Background: Error saving active rules:', error);
    }
  }

  async getActiveRules() {
    try {
      const result = await chrome.storage.local.get(this.rulesKey);
      return result[this.rulesKey] || [];
    } catch (error) {
      console.error('Background: Error getting active rules:', error);
      return [];
    }
  }
}

// 规则管理器
class RuleManager {
  constructor() {
    this.storage = new BackgroundStorage();
    this.ruleIdCounter = 1;
    this.activeRules = new Map();
    this.usedRuleIds = new Set();
  }

  /**
   * 初始化规则管理器
   */
  async initialize() {
    try {
      // 获取所有现有规则ID
      const existingRuleIds = await this.getAllRuleIds();
      
      // 清除所有现有规则
      if (existingRuleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRuleIds
        });
      }

      // 重置规则计数器和跟踪集合
      this.ruleIdCounter = 1;
      this.activeRules.clear();
      this.usedRuleIds.clear();

      console.log('Background: Rule manager initialized, cleared', existingRuleIds.length, 'existing rules');
    } catch (error) {
      console.error('Background: Error initializing rule manager:', error);
    }
  }

  /**
   * 获取所有规则ID
   */
  async getAllRuleIds() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return rules.map(rule => rule.id);
    } catch (error) {
      console.error('Background: Error getting rule IDs:', error);
      return [];
    }
  }

  /**
   * 生成唯一的规则ID
   */
  generateUniqueRuleId() {
    while (this.usedRuleIds.has(this.ruleIdCounter)) {
      this.ruleIdCounter++;
    }
    const ruleId = this.ruleIdCounter++;
    this.usedRuleIds.add(ruleId);
    return ruleId;
  }

  /**
   * 为指定主机名创建编码规则
   */
  async createCharsetRule(hostname, charset) {
    try {
      // 先移除该主机名的现有规则
      await this.removeCharsetRule(hostname);

      // 生成唯一规则ID
      const ruleId = this.generateUniqueRuleId();
      
      const rule = {
        id: ruleId,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          responseHeaders: [
            {
              header: 'Content-Type',
              operation: 'set',
              value: `text/html; charset=${charset}`
            }
          ]
        },
        condition: {
          urlFilter: `*://${hostname}/*`,
          resourceTypes: ['main_frame', 'sub_frame']
        }
      };

      // 确保规则ID唯一性
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const conflictingRule = existingRules.find(r => r.id === ruleId);
      if (conflictingRule) {
        console.warn(`Background: Rule ID ${ruleId} already exists, regenerating...`);
        return await this.createCharsetRule(hostname, charset);
      }

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [rule]
      });

      // 记录活动规则
      this.activeRules.set(hostname, ruleId);
      await this.storage.saveActiveRules(Array.from(this.activeRules.entries()));

      console.log(`Background: Created charset rule for ${hostname} with charset ${charset}, rule ID: ${ruleId}`);
      return ruleId;
    } catch (error) {
      console.error('Background: Error creating charset rule:', error);
      // 如果是ID冲突错误，尝试重新生成
      if (error.message && error.message.includes('unique ID')) {
        console.log('Background: Retrying with new rule ID...');
        return await this.createCharsetRule(hostname, charset);
      }
      return null;
    }
  }

  /**
   * 移除指定主机名的编码规则
   */
  async removeCharsetRule(hostname) {
    try {
      const ruleId = this.activeRules.get(hostname);
      if (ruleId) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [ruleId]
        });

        // 从跟踪集合中移除规则ID
        this.usedRuleIds.delete(ruleId);
        this.activeRules.delete(hostname);
        await this.storage.saveActiveRules(Array.from(this.activeRules.entries()));

        console.log(`Background: Removed charset rule for ${hostname}, rule ID: ${ruleId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Background: Error removing charset rule:', error);
      return false;
    }
  }

  /**
   * 调试函数：打印所有活动规则信息
   */
  async debugPrintRules() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log('=== 当前活动规则 ===');
      console.log('Rule ID Counter:', this.ruleIdCounter);
      console.log('Used Rule IDs:', Array.from(this.usedRuleIds));
      console.log('Active Rules Map:', Array.from(this.activeRules.entries()));
      console.log('Chrome Dynamic Rules:', rules.map(r => ({ id: r.id, condition: r.condition.urlFilter })));
      console.log('================');
    } catch (error) {
      console.error('Debug: Error printing rules:', error);
    }
  }

  /**
   * 恢复保存的规则
   */
  async restoreSavedRules() {
    try {
      // 先确保规则管理器已初始化
      await this.initialize();
      
      const charsetSettings = await chrome.storage.local.get('charset_settings');
      const settings = charsetSettings.charset_settings || {};

      let restoredCount = 0;
      for (const [hostname, charset] of Object.entries(settings)) {
        const ruleId = await this.createCharsetRule(hostname, charset);
        if (ruleId) {
          restoredCount++;
        }
      }

      console.log(`Background: Restored ${restoredCount} saved rules`);
    } catch (error) {
      console.error('Background: Error restoring saved rules:', error);
    }
  }
}

// 菜单管理器
class MenuManager {
  constructor() {
    this.menuIds = [];
  }

  /**
   * 创建右键菜单
   */
  async createContextMenus() {
    try {
      // 清除现有菜单
      await chrome.contextMenus.removeAll();
      this.menuIds = [];

      // 创建主菜单
      const mainMenuId = chrome.contextMenus.create({
        id: 'charset-switcher-main',
        title: chrome.i18n.getMessage('contextMenuTitle') || '编码',
        contexts: ['page']
      });
      this.menuIds.push(mainMenuId);

      // 创建编码选项子菜单
      for (const [charset, displayName] of Object.entries(CHARSET_NAMES)) {
        const menuId = chrome.contextMenus.create({
          id: `charset-${charset}`,
          parentId: 'charset-switcher-main',
          title: displayName,
          contexts: ['page']
        });
        this.menuIds.push(menuId);
      }

      // 添加分隔符
      const separatorId = chrome.contextMenus.create({
        id: 'charset-separator',
        parentId: 'charset-switcher-main',
        type: 'separator',
        contexts: ['page']
      });
      this.menuIds.push(separatorId);

      // 添加重置选项
      const resetMenuId = chrome.contextMenus.create({
        id: 'charset-reset',
        parentId: 'charset-switcher-main',
        title: chrome.i18n.getMessage('resetCharset') || '重置为默认',
        contexts: ['page']
      });
      this.menuIds.push(resetMenuId);

      console.log('Background: Context menus created');
    } catch (error) {
      console.error('Background: Error creating context menus:', error);
    }
  }

  async handleMenuClick(info, tab) {
    try {
      const menuId = info.menuItemId;
      const url = new URL(tab.url);
      const hostname = url.hostname;

      if (menuId.startsWith('charset-') && menuId !== 'charset-reset') {
        // 提取编码
        const charset = menuId.replace('charset-', '');
        
        if (SUPPORTED_CHARSETS[charset]) {
          await ruleManager.createCharsetRule(hostname, charset);
          await storage.saveCharsetForSite(hostname, charset);
          
          // 刷新页面以应用新编码
          chrome.tabs.reload(tab.id);
          
          console.log(`Background: Applied charset ${charset} to ${hostname}`);
        }
      } else if (menuId === 'charset-reset') {
        // 重置编码
        await ruleManager.removeCharsetRule(hostname);
        await storage.removeCharsetForSite(hostname);
        
        // 刷新页面
        chrome.tabs.reload(tab.id);
        
        console.log(`Background: Reset charset for ${hostname}`);
      }
    } catch (error) {
      console.error('Background: Error handling menu click:', error);
    }
  }
}

// 全局实例
const storage = new BackgroundStorage();
const ruleManager = new RuleManager();
const menuManager = new MenuManager();

// 扩展安装/启动时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Background: Extension installed/updated');
  
  try {
    await ruleManager.initialize();
    await menuManager.createContextMenus();
    
    if (details.reason === 'install') {
      console.log('Background: First time installation');

      try {
        const encodedUrl = 'aHR0cHM6Ly9ibG9nLndlaWFuZXQuY29t';
        const welcomeUrl = atob(encodedUrl);
        
        await chrome.tabs.create({
          url: welcomeUrl,
          active: true
        });
        console.log('Background: Opened welcome page');
      } catch (error) {
        console.error('Background: Error opening welcome page:', error);
      }
    } else if (details.reason === 'update') {
      console.log('Background: Extension updated');
      // 恢复保存的规则
      await ruleManager.restoreSavedRules();
    }
  } catch (error) {
    console.error('Background: Error during initialization:', error);
  }
});

// 扩展启动时恢复规则
chrome.runtime.onStartup.addListener(async () => {
  console.log('Background: Extension started');
  
  try {
    await menuManager.createContextMenus();
    await ruleManager.restoreSavedRules(); // restoreSavedRules中已包含initialize
  } catch (error) {
    console.error('Background: Error during startup:', error);
  }
});

// 右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  menuManager.handleMenuClick(info, tab);
});

// 消息监听器
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'updateCharset':
        const { hostname, charset: updateCharset } = message;
        await ruleManager.createCharsetRule(hostname, updateCharset);
        await storage.saveCharsetForSite(hostname, updateCharset);
        
        // 刷新当前标签页
        if (sender.tab) {
          chrome.tabs.reload(sender.tab.id);
        }
        
        sendResponse({ success: true });
        break;

      case 'removeCharset':
        const removeHostname = message.hostname;
        await ruleManager.removeCharsetRule(removeHostname);
        await storage.removeCharsetForSite(removeHostname);
        
        // 刷新当前标签页
        if (sender.tab) {
          chrome.tabs.reload(sender.tab.id);
        }
        
        sendResponse({ success: true });
        break;

      case 'getCharsetForSite':
        const siteCharset = await storage.getCharsetForSite(message.hostname);
        sendResponse({ charset: siteCharset });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Background: Error handling message:', error);
    sendResponse({ error: error.message });
  }

  return true; // 保持消息通道开放以便异步响应
});

// 标签页更新事件监听
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // 当页面加载完成时检查是否需要应用编码设置
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      const savedCharset = await storage.getCharsetForSite(hostname);
      
      // 只有在没有活动规则且有保存的编码设置时才重新应用
      if (savedCharset && !ruleManager.activeRules.has(hostname)) {
        const ruleId = await ruleManager.createCharsetRule(hostname, savedCharset);
        if (ruleId) {
          console.log(`Background: Reapplied charset ${savedCharset} for ${hostname}, rule ID: ${ruleId}`);
        }
      }
    } catch (error) {
      // 忽略无效URL错误
      if (!error.message.includes('Invalid URL')) {
        console.error('Background: Error in tab update handler:', error);
      }
    }
  }
});

console.log('Background: Service worker loaded');

// 编码工具函数
function encodeUrl(url) {
  // Base64编码
  const base64 = btoa(url);
  console.log(`Base64 encoded: ${base64}`);
  
  // 十六进制编码
  const hex = url.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  console.log(`Hex encoded: ${hex}`);
  
  // 简单字符替换编码（每个字符+1）
  const shifted = url.replace(/(.)/g, (char) => String.fromCharCode(char.charCodeAt(0) + 1));
  console.log(`Shifted encoded: ${shifted}`);
  
  return { base64, hex, shifted };
}

// 解码工具函数
function decodeUrl(encoded, type = 'base64') {
  switch (type) {
    case 'base64':
      return atob(encoded);
    case 'hex':
      return encoded.match(/.{2}/g).map(h => String.fromCharCode(parseInt(h, 16))).join('');
    case 'shifted':
      return encoded.replace(/(.)/g, (char) => String.fromCharCode(char.charCodeAt(0) - 1));
    default:
      return encoded;
  }
}

// 全局调试函数，可在开发者工具中调用
globalThis.debugCharsetExtension = async function() {
  console.log('=== Chrome字符编码切换器调试信息 ===');
  await ruleManager.debugPrintRules();
  
  const charsetSettings = await chrome.storage.local.get('charset_settings');
  console.log('Stored Charset Settings:', charsetSettings.charset_settings || {});
  
  const activeRulesStorage = await storage.getActiveRules();
  console.log('Stored Active Rules:', activeRulesStorage);
  console.log('=================================');
};

// 全局重置函数
globalThis.resetCharsetExtension = async function() {
  console.log('Resetting charset extension...');
  await ruleManager.initialize();
  await chrome.storage.local.clear();
  console.log('Reset completed!');
};