#!/usr/bin/env python3
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

TICKERS = ["QQQM", "SOXX", "SPYM", "BTC-USD"]
RANGE = "3mo"
INTERVAL = "1d"
KEEP_DAYS = 35  # buffer beyond 1 calendar month to survive weekends/holidays
RSI_PERIOD = 14
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}


def calculate_rsi(closes: list, period: int = RSI_PERIOD) -> list:
    """Wilder's smoothed RSI. Returns a list the same length as closes,
    with None for indices before the first full period is available."""
    rsi = [None] * len(closes)
    if len(closes) <= period:
        return rsi

    gains = []
    losses = []
    for i in range(1, period + 1):
        change = closes[i] - closes[i - 1]
        gains.append(max(change, 0))
        losses.append(max(-change, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    rsi[period] = 100.0 if avg_loss == 0 else 100 - (100 / (1 + avg_gain / avg_loss))

    for i in range(period + 1, len(closes)):
        change = closes[i] - closes[i - 1]
        gain = max(change, 0)
        loss = max(-change, 0)
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
        rsi[i] = 100.0 if avg_loss == 0 else 100 - (100 / (1 + avg_gain / avg_loss))

    return rsi


def fetch_chart(ticker: str) -> dict:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?range={RANGE}&interval={INTERVAL}"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        payload = json.load(resp)

    result = payload.get("chart", {}).get("result")
    if not result:
        error = payload.get("chart", {}).get("error")
        raise RuntimeError(f"{ticker}: no result in response ({error})")

    result = result[0]
    timestamps = result.get("timestamp") or []
    quote = result.get("indicators", {}).get("quote", [{}])[0]

    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    # Build the full (untrimmed) candle list first so RSI has enough lookback
    # before we cut down to the display window below.
    full_candles = []
    for i, ts in enumerate(timestamps):
        o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        if None in (o, h, l, c):
            continue
        full_candles.append(
            {
                "date": datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                "open": round(o, 4),
                "high": round(h, 4),
                "low": round(l, 4),
                "close": round(c, 4),
                "volume": volumes[i] if i < len(volumes) else None,
            }
        )

    rsi_values = calculate_rsi([c["close"] for c in full_candles])
    for candle, rsi in zip(full_candles, rsi_values):
        candle["rsi"] = round(rsi, 2) if rsi is not None else None

    cutoff = datetime.now(timezone.utc) - timedelta(days=KEEP_DAYS)
    candles = [c for c in full_candles if datetime.strptime(c["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc) >= cutoff]

    return {
        "ticker": ticker,
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "candles": candles,
    }


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    for ticker in TICKERS:
        data = None
        for attempt in range(3):
            try:
                data = fetch_chart(ticker)
                break
            except (urllib.error.URLError, RuntimeError, ValueError) as exc:
                if attempt == 2:
                    failures.append(f"{ticker}: {exc}")
                else:
                    time.sleep(2)

        if data is None:
            continue
        if not data["candles"]:
            failures.append(f"{ticker}: no candles parsed")
            continue

        out_path = DATA_DIR / f"{ticker}.json"
        out_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out_path} ({len(data['candles'])} candles)")

    if failures:
        print("FAILURES:", "; ".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
