const TICKERS = ["QQQM", "SOXX", "SPYM"];

function formatUpdatedAt(iso) {
  if (!iso) return "데이터 없음";
  const d = new Date(iso);
  return `업데이트: ${d.toLocaleString("ko-KR", { timeZone: "UTC" })} UTC`;
}

async function loadTicker(ticker) {
  const card = document.querySelector(`.chart-card[data-ticker="${ticker}"]`);
  const chartEl = card.querySelector('[data-role="chart"]');
  const updatedEl = card.querySelector('[data-role="updated-at"]');

  let data;
  try {
    const res = await fetch(`data/${ticker}.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    updatedEl.textContent = "데이터를 불러오지 못했습니다";
    chartEl.textContent = "첫 GitHub Actions 실행 후 데이터가 표시됩니다.";
    return;
  }

  updatedEl.textContent = formatUpdatedAt(data.updated_at);

  if (!data.candles || data.candles.length === 0) {
    chartEl.textContent = "표시할 데이터가 없습니다. 첫 GitHub Actions 실행을 기다려 주세요.";
    return;
  }

  const chart = LightweightCharts.createChart(chartEl, {
    layout: {
      background: { color: "transparent" },
      textColor: "#d1d5db",
    },
    grid: {
      vertLines: { color: "rgba(255,255,255,0.06)" },
      horzLines: { color: "rgba(255,255,255,0.06)" },
    },
    timeScale: { borderColor: "rgba(255,255,255,0.15)" },
    rightPriceScale: { borderColor: "rgba(255,255,255,0.15)" },
    autoSize: true,
  });

  const series = chart.addCandlestickSeries({
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: false,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
  });

  series.setData(
    data.candles.map((c) => ({
      time: c.date,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  );

  chart.timeScale().fitContent();
}

TICKERS.forEach(loadTicker);
