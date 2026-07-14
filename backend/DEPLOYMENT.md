# 免费 AKShare 行情服务部署说明

Netlify 只托管前端和 JavaScript Functions，不能直接运行 AKShare 的 Python 依赖。本目录已经包含可部署的 FastAPI 服务与 Dockerfile。

## 部署目标

选择支持 Docker 的免费 Python 托管服务，创建公开 Web Service，并将本目录 `backend/` 作为构建上下文。

服务启动后必须满足：

- `GET /health` 返回 `ok: true`。
- `GET /api/market` 返回 `mode: "akshare"`、数据时间、来源、指数、市场宽度和行业数据。
- 配置 `ALLOWED_ORIGINS` 为 Netlify 站点域名；首轮联调可临时设置为 `*`，上线前应收紧到实际域名。
- 设置 `CACHE_TTL_SECONDS=60`，避免高频请求上游数据源。

## 连接 Netlify

在 Netlify Site Configuration 的环境变量中设置：

```text
MARKET_API_URL=https://你的免费AKShare服务域名
```

重新发布后，市场页点击“加载真实行情”会通过 `/.netlify/functions/market` 获取数据。服务异常时页面继续显示教学快照，并明确标注真实行情不可用。

## 数据边界

AKShare 与其底层公开数据源的时效、可用性和展示许可可能变化。页面只显示“准实时”及实际时间戳，不承诺交易所授权实时行情，不提供个股买卖建议。
