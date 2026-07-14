"""Create the static AKShare market snapshot used by the Netlify front end."""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import _load_market  # noqa: E402


def main():
    try:
        data = _load_market()
    except Exception as error:
        # A temporary upstream failure should not make the scheduled workflow fail.
        # The existing JSON is intentionally preserved for the front end.
        print(f"Market providers unavailable; keeping the previous snapshot: {type(error).__name__}")
        return
    if not data.get("indices"):
        print("No usable index data; keeping the previous snapshot.")
        return
    china_time = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S CST")
    data.update({
        "mode": "akshare",
        "freshness": data.get("freshness") or "定时快照（约30分钟延时）",
        "data_time": china_time,
        "source": f"{data.get('source', 'AKShare')} · GitHub Actions 定时快照",
        "service_notice": f"{data.get('service_notice', '')} 此数据由 GitHub Actions 在交易日定时采集；可能因排程或上游接口延后。".strip(),
    })
    output = ROOT / "data" / "live-market.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
