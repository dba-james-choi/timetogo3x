#!/usr/bin/env python3
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

LOCATION_NAME = "Victoria, BC, Canada"
LATITUDE = 48.4284
LONGITUDE = -123.3656
TIMEZONE = "America/Vancouver"
FORECAST_DAYS = 7
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_PATH = DATA_DIR / "weather.json"

FORECAST_URL = (
    "https://api.open-meteo.com/v1/forecast"
    f"?latitude={LATITUDE}&longitude={LONGITUDE}"
    "&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code"
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,"
    "wind_speed_10m_max,weather_code"
    "&current=temperature_2m,wind_speed_10m,weather_code"
    f"&timezone={TIMEZONE}&forecast_days={FORECAST_DAYS}&wind_speed_unit=kmh"
)

AIR_QUALITY_URL = (
    "https://air-quality-api.open-meteo.com/v1/air-quality"
    f"?latitude={LATITUDE}&longitude={LONGITUDE}"
    "&hourly=pm10,pm2_5"
    "&current=pm10,pm2_5"
    f"&timezone={TIMEZONE}&forecast_days={FORECAST_DAYS}"
)


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=20) as resp:
        return json.load(resp)


def fetch_with_retries(url: str) -> dict:
    last_exc = None
    for attempt in range(3):
        try:
            return fetch_json(url)
        except (urllib.error.URLError, ValueError) as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(2)
    raise RuntimeError(f"failed to fetch {url}: {last_exc}")


def build_weather_payload() -> dict:
    forecast = fetch_with_retries(FORECAST_URL)
    air_quality = fetch_with_retries(AIR_QUALITY_URL)

    hourly_times = forecast["hourly"]["time"]
    hourly_temp = forecast["hourly"]["temperature_2m"]
    hourly_precip = forecast["hourly"]["precipitation_probability"]
    hourly_wind = forecast["hourly"]["wind_speed_10m"]
    hourly_code = forecast["hourly"]["weather_code"]

    aq_times = air_quality["hourly"]["time"]
    aq_pm10 = air_quality["hourly"]["pm10"]
    aq_pm25 = air_quality["hourly"]["pm2_5"]
    aq_map = {t: (aq_pm10[i], aq_pm25[i]) for i, t in enumerate(aq_times)}

    current_time = forecast["current"]["time"]
    start_idx = 0
    for i, t in enumerate(hourly_times):
        if t >= current_time:
            start_idx = i
            break

    hourly_out = []
    for i in range(start_idx, min(start_idx + 24, len(hourly_times))):
        t = hourly_times[i]
        pm10, pm25 = aq_map.get(t, (None, None))
        hourly_out.append(
            {
                "time": t,
                "temperature": hourly_temp[i],
                "precipitation_probability": hourly_precip[i],
                "wind_speed": hourly_wind[i],
                "weather_code": hourly_code[i],
                "pm10": round(pm10, 1) if pm10 is not None else None,
                "pm2_5": round(pm25, 1) if pm25 is not None else None,
            }
        )

    daily_dates = forecast["daily"]["time"]
    daily_out = []
    for i, date in enumerate(daily_dates):
        day_pm10 = [aq_map[t][0] for t in aq_times if t.startswith(date) and aq_map[t][0] is not None]
        day_pm25 = [aq_map[t][1] for t in aq_times if t.startswith(date) and aq_map[t][1] is not None]
        daily_out.append(
            {
                "date": date,
                "temp_max": forecast["daily"]["temperature_2m_max"][i],
                "temp_min": forecast["daily"]["temperature_2m_min"][i],
                "precipitation_probability_max": forecast["daily"]["precipitation_probability_max"][i],
                "wind_speed_max": forecast["daily"]["wind_speed_10m_max"][i],
                "weather_code": forecast["daily"]["weather_code"][i],
                "pm10_avg": round(sum(day_pm10) / len(day_pm10), 1) if day_pm10 else None,
                "pm2_5_avg": round(sum(day_pm25) / len(day_pm25), 1) if day_pm25 else None,
            }
        )

    current = {
        "time": current_time,
        "temperature": forecast["current"]["temperature_2m"],
        "wind_speed": forecast["current"]["wind_speed_10m"],
        "weather_code": forecast["current"]["weather_code"],
        "precipitation_probability": hourly_precip[start_idx] if hourly_precip else None,
        "pm10": air_quality["current"]["pm10"],
        "pm2_5": air_quality["current"]["pm2_5"],
    }

    return {
        "location": LOCATION_NAME,
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "timezone": TIMEZONE,
        "updated_at": current_time,
        "current": current,
        "hourly": hourly_out,
        "daily": daily_out,
    }


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        payload = build_weather_payload()
    except RuntimeError as exc:
        print(f"FAILURE: {exc}", file=sys.stderr)
        return 1

    if not payload["hourly"] or not payload["daily"]:
        print("FAILURE: empty hourly/daily data", file=sys.stderr)
        return 1

    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} ({len(payload['hourly'])} hourly, {len(payload['daily'])} daily)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
