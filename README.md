# 知股30天

面向零基础投资者的免费、公益投教 PWA。移动端体验接近小程序，可部署到 Netlify，也可添加到手机桌面。

## 已实现

- 五个底部入口：今日、课程、市场、实验室、我的。
- 完整 30 天课程地图与每日测验。
- 本地学习进度、错题记录与能力进度。
- 市场观察页、演示快照和 GitHub Actions 驱动的 AKShare 延时快照。
- 估值情景、财报红旗和 K 线语境实验。
- PWA 安装、离线缓存和 Netlify Functions 代理。

## 本地预览

最简单的方式：双击项目根目录的 `start-local-preview.cmd`。它会构建页面、打开预览服务，并在浏览器中打开页面；保留随后出现的 PowerShell 窗口，关闭它即停止预览。

也可以在项目目录手动运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\local-preview.ps1
```

访问 `http://127.0.0.1:4173`。本地版使用原创教学快照、虚构模拟盘口和合成 K 线数据；不读取真实行情接口。

## Netlify 部署

`netlify.toml` 会先运行零依赖构建脚本，再只发布 `dist/` 中的前端资源；课程策划文档与 AKShare 后端源码不会被公开托管。配置已包含单页路由、Functions 和安全响应头。

如果使用 Netlify Drop 上传压缩包，请上传根目录的 `知股30天-Netlify部署包.zip`。该包内的课程数据已合并进主程序，不依赖单独的课程数据文件；上传后若浏览器仍显示旧页面，请强制刷新一次。

### 免费定时行情（推荐）

本项目不需要 Docker。公开 GitHub 仓库中的 Actions 会在工作日中国市场时段每约 30 分钟运行一次 AKShare，生成 `data/live-market.json`；Netlify 监听该仓库并自动重新部署。页面显示的是带时间戳的延时快照，不是逐笔实时行情。

首次把项目推送到 GitHub 后，依次在 GitHub 打开 **Actions → 更新 AKShare 行情快照 → Run workflow**，等待它生成首个快照；再在 Netlify 选择 **Add new site → Import an existing project → GitHub**，选择该仓库并发布。之后无需填写任何密钥或后端地址。

仅用 Netlify Drop 上传压缩包也能显示已有快照，但不会自动接收 GitHub 的后续更新；要自动更新，请把 Netlify 与 GitHub 仓库连接。

### 可选的独立行情服务

如未来自行部署了 HTTPS 行情服务，可在 `market-config.js` 中设置 `MARKET_API_URL`，页面会优先读取该服务的 `/api/market`。这不是免费定时快照方案的必需项。

## AKShare 后端

后端位于 `backend/`，需要 Python 3.11+：

```powershell
python -m venv .venv
.venv\Scripts\pip install -r backend\requirements.txt
$env:ALLOWED_ORIGINS='http://localhost:4173,https://你的站点.netlify.app'
.venv\Scripts\uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

正式部署时应为后端配置 HTTPS、缓存、访问频率和允许来源。AKShare 与底层数据接口异常时，服务会返回最近成功快照。普通免费使用无需运行此后端。

## 重要说明

本产品只用于投资者教育，不提供个股推荐、买卖时点、目标价或收益承诺。市场数据必须展示来源、时间与延迟状态。
