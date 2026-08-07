const TICKERS = ["QQQM", "SOXX", "SPYM", "BTC-USD"];

const UP_COLOR = "#22c55e";
const DOWN_COLOR = "#ef4444";

function formatUpdatedAt(iso) {
  if (!iso) return "데이터 없음";
  const d = new Date(iso);
  return `업데이트: ${d.toLocaleString("ko-KR", { timeZone: "UTC" })} UTC`;
}

function formatPct(pct) {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function formatMonthDay(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function rsiColorFor(rsi) {
  if (rsi >= 70) return DOWN_COLOR;
  if (rsi <= 30) return UP_COLOR;
  return "#60a5fa";
}

async function loadTicker(ticker) {
  const card = document.querySelector(`.chart-card[data-ticker="${ticker}"]`);
  const chartEl = card.querySelector('[data-role="chart"]');
  const priceEl = card.querySelector('[data-role="last-price"]');
  const periodBadge = card.querySelector('[data-role="period-badge"]');
  const peakBadge = card.querySelector('[data-role="peak-badge"]');
  const rsiBadge = card.querySelector('[data-role="rsi-badge"]');
  const lowestBadge = card.querySelector('[data-role="lowest-badge"]');
  const rsiChartEl = card.querySelector('[data-role="rsi-chart"]');
  const rsiValueEl = card.querySelector('[data-role="rsi-value"]');
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

  const candles = data.candles || [];
  if (candles.length === 0) {
    chartEl.textContent = "표시할 데이터가 없습니다. 첫 GitHub Actions 실행을 기다려 주세요.";
    return;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  const peak = candles.reduce((max, c) => (c.close > max.close ? c : max), candles[0]);
  const trough = candles.reduce((min, c) => (c.close < min.close ? c : min), candles[0]);

  const periodPct = ((last.close - first.close) / first.close) * 100;
  const peakPct = ((last.close - peak.close) / peak.close) * 100;
  const trendColor = periodPct >= 0 ? UP_COLOR : DOWN_COLOR;
  const peakColor = peakPct >= 0 ? UP_COLOR : DOWN_COLOR;

  priceEl.textContent = `$${last.close.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  periodBadge.textContent = `${formatPct(periodPct)} (1M)`;
  periodBadge.style.background = hexToRgba(trendColor, 0.18);
  periodBadge.style.color = trendColor;

  peakBadge.textContent = `고점(${formatMonthDay(peak.date)}) 대비 ${formatPct(peakPct)}`;
  peakBadge.style.color = peakColor;

  if (last.rsi !== null && last.rsi !== undefined) {
    rsiBadge.textContent = `오늘 RSI(14) ${last.rsi.toFixed(1)}`;
    rsiBadge.style.color = rsiColorFor(last.rsi);
  } else {
    rsiBadge.textContent = "RSI(14) 데이터 부족";
  }

  if (trough.date === last.date) {
    lowestBadge.textContent = "⚠ 최근 1개월 최저치";
    lowestBadge.hidden = false;
  } else {
    lowestBadge.hidden = true;
  }

  const chart = LightweightCharts.createChart(chartEl, {
    layout: {
      background: { color: "transparent" },
      textColor: "#9ca3af",
    },
    grid: {
      vertLines: { color: "rgba(255,255,255,0.04)" },
      horzLines: { color: "rgba(255,255,255,0.06)" },
    },
    timeScale: { borderColor: "rgba(255,255,255,0.12)" },
    rightPriceScale: { borderColor: "rgba(255,255,255,0.12)" },
    autoSize: true,
  });

  const areaSeries = chart.addAreaSeries({
    lineColor: trendColor,
    lineWidth: 2,
    topColor: hexToRgba(trendColor, 0.35),
    bottomColor: hexToRgba(trendColor, 0.02),
    priceLineVisible: false,
  });
  areaSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.32 } });
  areaSeries.setData(candles.map((c) => ({ time: c.date, value: c.close })));

  areaSeries.createPriceLine({
    price: first.close,
    color: "rgba(156,163,175,0.7)",
    lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    axisLabelVisible: true,
  });

  const volumeSeries = chart.addHistogramSeries({
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    color: "rgba(148,163,184,0.35)",
  });
  volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
  volumeSeries.setData(
    candles.map((c) => ({ time: c.date, value: c.volume || 0, color: "rgba(148,163,184,0.35)" }))
  );

  chart.timeScale().fitContent();

  const rsiPoints = candles
    .filter((c) => c.rsi !== null && c.rsi !== undefined)
    .map((c) => ({ time: c.date, value: c.rsi }));

  if (rsiPoints.length > 0) {
    const lastRsi = rsiPoints[rsiPoints.length - 1].value;
    const rsiColor = rsiColorFor(lastRsi);
    rsiValueEl.textContent = lastRsi.toFixed(1);
    rsiValueEl.style.color = rsiColor;

    const rsiChart = LightweightCharts.createChart(rsiChartEl, {
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      timeScale: { visible: false },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.12)",
        scaleMargins: { top: 0.15, bottom: 0.15 },
      },
      handleScroll: false,
      handleScale: false,
      autoSize: true,
    });

    const rsiSeries = rsiChart.addLineSeries({
      color: rsiColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    rsiSeries.setData(rsiPoints);

    rsiSeries.createPriceLine({
      price: 70,
      color: "rgba(239,68,68,0.5)",
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "rgba(34,197,94,0.5)",
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      axisLabelVisible: true,
    });

    rsiChart.timeScale().fitContent();
  } else {
    rsiValueEl.textContent = "데이터 부족";
    rsiChartEl.textContent = "";
  }
}

TICKERS.forEach(loadTicker);
