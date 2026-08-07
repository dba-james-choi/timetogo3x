# timetogo3x

QQQM, SOXX, SPYM, BTC-USD 최근 1개월 일봉(몽테인 차트) 차트를 보여주는 정적 웹페이지입니다.
상단 "🌤 날씨" 버튼으로 Victoria, BC, Canada의 24시간/주간 날씨 페이지로 이동할 수 있습니다.
GitHub Actions가 자동으로 데이터를 갱신합니다.

운영 관련 세부사항(cron 스케줄, GitHub Actions 제약, 날씨 데이터 소스 등)은
[`docs/OPERATIONS.md`](docs/OPERATIONS.md) 참고.

## 구성

- `index.html` / `style.css` / `app.js` — 홈(차트) 페이지 프론트엔드 (TradingView `lightweight-charts` 사용)
- `weather.html` / `weather.js` — 날씨 페이지 프론트엔드
- `data/*.json` — 종목별 일봉 데이터 (Yahoo Finance), `data/weather.json` — 날씨 데이터 (Open-Meteo)
- `scripts/fetch_data.py` — 종목 데이터 수집 스크립트 (평일 하루 2회)
- `scripts/fetch_weather.py` — 날씨 데이터 수집 스크립트 (매일 2회)
- `.github/workflows/update-data.yml` / `update-weather.yml` — 자동 갱신 워크플로우

## 로컬 데이터 갱신

```bash
python3 scripts/fetch_data.py
python3 scripts/fetch_weather.py
```

## 배포 (GitHub Pages)

1. GitHub 저장소 Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `main` / `/(root)`
4. 저장 후 몇 분 내 `https://<username>.github.io/timetogo3x/` 에서 확인 가능

## 수동으로 데이터 갱신 트리거

저장소의 Actions 탭 → `Update ETF Daily Data` 또는 `Update Weather Data` 워크플로우 →
`Run workflow` 로 즉시 실행할 수 있습니다.
