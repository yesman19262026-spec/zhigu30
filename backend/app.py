import os
import time
from datetime import datetime
from threading import Lock

import akshare as ak
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="知股30天行情服务", version="1.0.0")

origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_cache = {"at": 0.0, "data": None}
_cache_lock = Lock()
INDEX_NAMES = {"上证指数", "深证成指", "创业板指", "科创50", "北证50"}


def _float(value, default=0.0):
    try:
        if pd.isna(value):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _column(frame, names):
    for name in names:
        if name in frame.columns:
            return name
    return None


def _load_market():
    index_frame = ak.stock_zh_index_spot_em(symbol="沪深重要指数")
    stock_frame = ak.stock_zh_a_spot_em()

    name_col = _column(index_frame, ["名称", "指数名称"])
    code_col = _column(index_frame, ["代码", "指数代码"])
    last_col = _column(index_frame, ["最新价", "最新"])
    pct_col = _column(index_frame, ["涨跌幅"])

    indices = []
    for _, row in index_frame.iterrows():
        name = str(row.get(name_col, ""))
        if name in INDEX_NAMES:
            indices.append({
                "code": str(row.get(code_col, "")),
                "name": name,
                "last": _float(row.get(last_col)),
                "change_pct": _float(row.get(pct_col)),
            })

    stock_pct_col = _column(stock_frame, ["涨跌幅"])
    pct = pd.to_numeric(stock_frame[stock_pct_col], errors="coerce").dropna() if stock_pct_col else pd.Series(dtype=float)
    breadth = {
        "up_count": int((pct > 0).sum()),
        "flat_count": int((pct == 0).sum()),
        "down_count": int((pct < 0).sum()),
        "limit_up_count": int((pct >= 9.8).sum()),
        "limit_down_count": int((pct <= -9.8).sum()),
    }

    amount_col = _column(stock_frame, ["成交额"])
    amount_billion = _float(pd.to_numeric(stock_frame[amount_col], errors="coerce").sum() / 100_000_000) if amount_col else 0.0

    sectors = []
    try:
        sector_frame = ak.stock_board_industry_name_em()
        sector_name_col = _column(sector_frame, ["板块名称", "名称"])
        sector_pct_col = _column(sector_frame, ["涨跌幅"])
        if sector_name_col and sector_pct_col:
            cleaned = sector_frame[[sector_name_col, sector_pct_col]].copy()
            cleaned[sector_pct_col] = pd.to_numeric(cleaned[sector_pct_col], errors="coerce")
            cleaned = cleaned.dropna().sort_values(sector_pct_col, ascending=False)
            selected = pd.concat([cleaned.head(3), cleaned.tail(2)]).drop_duplicates()
            sectors = [{"name": str(row[sector_name_col]), "change_pct": _float(row[sector_pct_col])} for _, row in selected.iterrows()]
    except Exception:
        sectors = []

    now = datetime.now().astimezone()
    return {
        "mode": "akshare",
        "freshness": "准实时",
        "data_time": now.strftime("%Y-%m-%d %H:%M:%S %Z"),
        "source": "AKShare",
        "upstream_source": "AKShare接口标注的公开数据源",
        "indices": indices,
        "breadth": breadth,
        "turnover": {"amount_billion": round(amount_billion, 2), "ratio_5d": 0, "ratio_20d": 0},
        "sectors": sectors,
        "summary": {
            "title": "先记录盘面事实，再形成解释",
            "text": f"上涨{breadth['up_count']}家、下跌{breadth['down_count']}家。请同时核验指数、市场宽度、成交活跃度和行业分布。",
        },
    }


@app.get("/health")
def health():
    return {"ok": True, "provider": "akshare", "cached": _cache["data"] is not None}


@app.get("/api/market")
def market():
    ttl = max(30, int(os.getenv("CACHE_TTL_SECONDS", "60")))
    now = time.time()
    if _cache["data"] and now - _cache["at"] < ttl:
        return _cache["data"]
    with _cache_lock:
        now = time.time()
        if _cache["data"] and now - _cache["at"] < ttl:
            return _cache["data"]
        try:
            data = _load_market()
            _cache.update({"at": now, "data": data})
            return data
        except Exception as error:
            if _cache["data"]:
                stale = dict(_cache["data"])
                stale["freshness"] = "缓存数据"
                stale["is_stale"] = True
                stale["service_notice"] = "上游暂不可用，已返回最近快照"
                return stale
            return {
                "mode": "unavailable",
                "freshness": "不可用",
                "data_time": datetime.now().astimezone().isoformat(),
                "source": "AKShare",
                "upstream_source": "不可用",
                "indices": [],
                "breadth": {},
                "turnover": {},
                "sectors": [],
                "summary": {"title": "市场数据暂不可用", "text": "课程和学习记录不受影响，请稍后重试。"},
                "service_notice": type(error).__name__,
            }
