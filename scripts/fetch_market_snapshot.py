"""Create the static AKShare market snapshot used by the Netlify front end."""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app import _load_market  # noqa: E402


def main():
    data = _load_market()
    china_time = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M:%S CST")
    data.update({
        "mode": "akshare",
        "freshness": "定时快照（约30分钟延时）",
        "data_time": china_time,
        "source": "AKShare（GitHub Actions 定时快照）",
        "service_notice": "此数据由 GitHub Actions 在交易日定时采集；可能因排程或上游接口延后。",
    })
    output = ROOT / "data" / "live-market.json"
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
