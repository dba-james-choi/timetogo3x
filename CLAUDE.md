# timetogo3x

QQQM/SOXX/SPYM/BTC-USD 일봉(몽테인 차트)을 보여주는 정적 웹페이지. GitHub Actions가 평일마다
Yahoo Finance에서 데이터를 받아 `data/*.json`을 갱신하고, GitHub Pages로 배포된다.
BTC-USD는 주말에도 거래되므로 다른 종목보다 캔들 수가 더 많다.

세 페이지(홈/날씨/뉴스)는 서로 상단 nav 버튼으로 연결되고 `style.css`를 공유한다.

## 구성

- `index.html` / `style.css` / `app.js` — 홈(차트) 페이지 (lightweight-charts, 몽테인/에어리어 차트 + 거래량 바 + RSI(14) + MA(200))
- `weather.html` / `weather.js` — 날씨 페이지 (Victoria BC 24시간 + 7일, 강수확률/미세먼지/초미세먼지/바람, Open-Meteo)
- `news.html` / `news.js` — 뉴스 페이지 (Saanich/Victoria/Vancouver/Canada 각 top 3, Google News RSS)
- `data/*.json` — 종목별 일봉 데이터, `data/weather.json` — 날씨 데이터, `data/news.json` — 뉴스 데이터
- `scripts/fetch_data.py` / `fetch_weather.py` / `fetch_news.py` — 데이터 수집 스크립트
- `.github/workflows/update-data.yml` — 종목 자동 갱신 (하루 두 번, DST 대응)
- `.github/workflows/update-weather.yml` — 날씨 자동 갱신 (하루 두 번, UTC 00:00/12:00 고정)
- `.github/workflows/update-news.yml` — 뉴스 자동 갱신 (하루 한 번, Victoria 아침 6시 기준 DST 대응)

## 작업 전 참고

- cron 스케줄이 왜 두 개인지, GitHub Actions 60일 비활성화 규칙, 데이터 소스의 한계 등
  운영 관련 세부사항은 **[`docs/OPERATIONS.md`](docs/OPERATIONS.md)** 참고 — 워크플로우나
  스케줄을 건드리기 전에 먼저 읽을 것.
