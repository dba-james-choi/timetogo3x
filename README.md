# timetogo3x

QQQM, SOXX, SPYM 최근 1개월 일봉(캔들스틱) 차트를 보여주는 정적 웹페이지입니다.
GitHub Actions가 매일(평일) 자동으로 데이터를 갱신합니다.

## 구성

- `index.html` / `style.css` / `app.js` — 프론트엔드 (TradingView `lightweight-charts` 사용)
- `data/*.json` — 종목별 일봉 데이터 (Yahoo Finance)
- `scripts/fetch_data.py` — 데이터 수집 스크립트
- `.github/workflows/update-data.yml` — 매일 자동 갱신 워크플로우

## 로컬 데이터 갱신

```bash
python3 scripts/fetch_data.py
```

## 배포 (GitHub Pages)

1. GitHub 저장소 Settings → Pages
2. Source: `Deploy from a branch`
3. Branch: `main` / `/(root)`
4. 저장 후 몇 분 내 `https://<username>.github.io/timetogo3x/` 에서 확인 가능

## 수동으로 데이터 갱신 트리거

저장소의 Actions 탭 → `Update ETF Daily Data` 워크플로우 → `Run workflow` 로 즉시 실행할 수 있습니다.
