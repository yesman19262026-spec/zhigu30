const DEMO = {
  mode: "demo",
  freshness: "演示数据",
  data_time: "Netlify演示快照（非真实行情）",
  source: "内置教学样本",
  upstream_source: "无",
  indices: [
    { code: "000001", name: "上证指数", last: 3248.16, change_pct: 0.62 },
    { code: "399001", name: "深证成指", last: 10286.43, change_pct: 0.91 },
    { code: "399006", name: "创业板指", last: 2084.77, change_pct: -0.18 },
    { code: "000688", name: "科创50", last: 986.24, change_pct: 1.12 },
    { code: "899050", name: "北证50", last: 1125.69, change_pct: -0.44 }
  ],
  breadth: { up_count: 2864, flat_count: 126, down_count: 2173, limit_up_count: 54, limit_down_count: 8 },
  turnover: { amount_billion: 10342, ratio_5d: 1.08, ratio_20d: 1.15 },
  sectors: [
    { name: "半导体", change_pct: 2.46 },
    { name: "软件服务", change_pct: 1.72 },
    { name: "电力设备", change_pct: 0.83 },
    { name: "银行", change_pct: -0.31 },
    { name: "食品饮料", change_pct: -1.08 }
  ],
  summary: {
    title: "指数与市场宽度需要一起看",
    text: "当前为演示快照。配置AKShare服务地址后会切换到带来源和时间戳的市场数据。"
  }
};

export default async () => {
  const upstream = process.env.MARKET_API_URL;
  if (upstream) {
    try {
      const url = `${upstream.replace(/\/$/, "")}/api/market`;
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ZhiGu30/1.0" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`upstream ${response.status}`);
      const data = await response.json();
      return new Response(JSON.stringify(data), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30, stale-while-revalidate=120" } });
    } catch (error) {
      return new Response(JSON.stringify({ ...DEMO, service_notice: "AKShare服务暂不可用，已切换演示数据" }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
    }
  }
  return new Response(JSON.stringify(DEMO), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
};
