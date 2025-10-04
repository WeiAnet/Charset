# Chrome字符编码切换器

一个极简的Chrome浏览器扩展，通过右键菜单快速切换网页字符编码。

## 功能特性

- 🔤 **多编码支持**：支持UTF-8、GBK、GB2312、Big5等常用编码
- 🖱️ **右键菜单**：极简操作，无复杂界面
- 💡 **轻量级**：无HTML界面，纯原生交互
- 🚀 **即时生效**：无需手动刷新
- 💾 **智能记忆**：自动记住每个网站的编码设置
- 🌍 **国际化支持**：支持中文和英文界面

## 支持的编码

- Unicode (UTF-8)
- GBK (简体中文)
- GB2312 (简体中文)
- GB18030 (中文国标)
- Big5 (繁体中文)
- ISO-8859-1 (西欧)
- Windows-1252 (西欧)
- Shift_JIS (日文)
- EUC-KR (韩文)

## 使用方法

1. **安装扩展**
   - 打开Chrome浏览器
   - 进入 `chrome://extensions/`
   - 启用"开发者模式"
   - 点击"加载已解压的扩展程序"
   - 选择本扩展的文件夹

2. **切换编码**
   - 在需要切换编码的网页上右键点击
   - 选择"字符编码"菜单项
   - 从子菜单中选择合适的编码
   - 页面将自动刷新并应用新编码

3. **重置编码**
   - 右键选择"字符编码" → "重置为默认"
   - 网站的编码设置将被清除

## 技术架构

### 核心文件

- **manifest.json** - 扩展配置文件，基于Manifest V3标准
- **background.js** - 服务工作脚本，处理右键菜单和网络请求规则
- **content.js** - 内容脚本，处理页面编码检测
- **utils.js** - 工具模块，提供编码处理和存储功能

### 技术特点

- **Manifest V3** - 使用最新的Chrome扩展标准
- **DeclarativeNetRequest API** - 动态修改HTTP响应头实现编码切换
- **Service Worker** - 现代化的后台脚本架构
- **Chrome Storage API** - 持久化存储用户设置
- **国际化支持** - 完整的i18n实现

### 工作原理

1. **编码检测** - 自动检测页面当前编码设置
2. **规则管理** - 使用DeclarativeNetRequest API创建动态规则
3. **头部修改** - 修改HTTP响应头的Content-Type字段
4. **设置存储** - 自动保存每个网站的编码偏好
5. **即时应用** - 页面刷新后立即生效

## 文件结构

```
Charset/
├── manifest.json           # 扩展配置文件
├── background.js          # 后台服务脚本
├── content.js            # 内容脚本
├── utils.js             # 工具模块
├── icons/               # 图标文件夹
│   ├── icon16.png       # 16x16 图标
│   ├── icon32.png       # 32x32 图标
│   ├── icon48.png       # 48x48 图标
│   ├── icon128.png      # 128x128 图标
│   └── icon.svg         # 原始SVG图标
└── _locales/            # 国际化文件
    ├── zh_CN/           # 中文
    │   └── messages.json
    └── en/              # 英文
        └── messages.json
```

## 权限说明

扩展请求的权限及用途：

- **contextMenus** - 创建右键菜单
- **declarativeNetRequest** - 修改HTTP响应头
- **storage** - 保存用户设置
- **activeTab** - 访问当前标签页
- **tabs** - 刷新页面
- **host_permissions: <all_urls>** - 在所有网站上工作

## 开发说明

### 调试模式

在开发者工具控制台中启用调试日志：
```javascript
// 在background script中
console.log('Debug mode enabled');

// 在content script中  
window.pageCharsetManager.debug = true;
```

### 自定义编码

要添加新的编码支持，需要修改以下文件：
1. `utils.js` - 添加到 `SUPPORTED_CHARSETS` 和 `CHARSET_NAMES`
2. `background.js` - 相应更新编码列表
3. `_locales/*/messages.json` - 添加国际化文本

### 构建和打包

扩展已准备就绪，可直接加载到Chrome中使用。

## 故障排除

### 扩展无法加载
- 检查是否启用了开发者模式
- 确认所有必需文件都存在
- 查看Chrome扩展页面的错误信息

### 编码切换无效
- 确认网站允许修改响应头
- 检查是否有其他扩展冲突
- 在开发者工具中查看网络请求

### 右键菜单不显示
- 刷新页面重试
- 检查扩展是否正常运行
- 查看background script的错误日志

## 版本历史

### v1.0.0
- 初始版本
- 支持9种常用字符编码
- 右键菜单操作
- 智能记忆功能
- 完整中英文国际化

## 致谢

感谢Chrome Extensions API的强大功能，让我们能够轻松实现字符编码切换功能。