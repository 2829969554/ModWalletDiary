# 工作约定

## 默认修改路径

**默认路径（唯一默认）**：
`C:\Users\28299\Documents\HBuilderProjects\ModWalletDiary`（HBuilderX 打包目录）

- 除非我（用户）主动要求切换，否则所有源码/配置修改都在这个目录下进行。
- 备用开发目录 `C:\Users\28299\Desktop\ABC\ModWalletDiary` 仅在明确要求时才使用。

## 输出规范

- 每次回复都要带上当前路径提醒（例如：`当前路径：C:\Users\28299\Documents\HBuilderProjects\ModWalletDiary`）。
- 涉及修改时，先说明将要改动的文件。

## 项目要点

- ModWalletDiary（钱包日记）：纯前端离线记账 App，AES 加密 + localStorage，支持浏览器与 HBuilderX 5+ runtime（安卓 APK）。
- 打包配置：`manifest.json`；启动前协议页：`version.html`（`#yinsi` / `#xieyi` 锚点定位隐私政策 / 服务协议）；隐私弹窗：`androidPrivacy.json`。
- 静态资源引用带版本号参数（如 `?v=20261021e`），改动静态文件后需同步 bump，否则 WebView / 浏览器缓存旧文件。
