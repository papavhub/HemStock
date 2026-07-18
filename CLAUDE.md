# HemStock — CLAUDE.md

주식 매매기준 모니터링 및 멘탈 관리 대시보드.  
GitHub Pages(정적 사이트)로 배포되며, 백엔드 서버 없이 운영된다.

---

## 기술 스택

| 역할 | 기술 |
|---|---|
| UI 프레임워크 | React 18 + Vite |
| 스타일링 | Tailwind CSS (라이트/다크 테마 토글, 블룸버그 터미널 스타일) |
| 차트 | Recharts (AreaChart, BarChart, LineChart, PieChart) |
| 게이지 | 자체 구현 SVG 반원 GaugeMeter 컴포넌트 (바늘 + 색상 밴드) |
| 상태 유지 | LocalStorage (체크리스트, 트레이딩 저널 로그, 매매여부) |
| 데이터 자동갱신 | GitHub Actions + Python (매일 04:00 KST) |
| 배포 | GitHub Pages (`/HemStock/` base path) |

---

## 프로젝트 구조

```
HemStock/
├── .github/workflows/
│   └── update-nps.yml           # 매일 04:00 KST 자동 실행 (전체 데이터 수집 + Pages 배포)
├── scripts/
│   ├── fetch_nps.py             # 국민연금 DART OpenAPI 수집 (D001 공시, flr_nm=국민연금공단)
│   ├── fetch_market_data.py     # VIX·금리·DXY·S&P500·KOSPI·BTC·USDKRW 등 (yfinance)
│   ├── fetch_breadth.py         # KOSPI 주요 80종목 신고가·신저가 비율 + ADR MA10 (yfinance)
│   ├── fetch_kr_rates.py        # 한국 국채 10Y·3Y 금리 (한국은행 ECOS API)
│   ├── fetch_macro.py           # HY스프레드·버핏지수(FRED) + 신용잔고·예탁금(BOK ECOS)
│   └── requirements.txt
├── public/
│   └── data/
│       ├── nps.json             # 국민연금 포트폴리오 + 변동 히스토리 (90일 누적)
│       ├── market.json          # VIX·금리·DXY·지수·USDKRW·BTC·GOLD 시계열
│       ├── breadth.json         # 신고가·신저가 종목 수 시계열 + ADR MA10 시계열
│       ├── kr_rates.json        # 한국 국채 10Y·3Y 금리 시계열
│       └── macro.json           # HY스프레드·버핏지수·신용융자잔고·투자자예탁금
├── src/
│   ├── pages/
│   │   └── Dashboard.jsx        # 메인 대시보드 (단일 페이지, 전체 위젯 포함)
│   ├── main.jsx
│   └── index.css                # Tailwind + live-dot 애니메이션 등 커스텀
├── index.html
├── vite.config.js               # base: '/HemStock/' 필수
├── tailwind.config.js
└── package.json
```

---

## 위젯 구성 (현재 구현 완료)

### 실시간 API 위젯 (클라이언트 fetch, API 키 불필요)

| 위젯 함수 | 데이터 출처 | 핵심 판단 기준 |
|---|---|---|
| `CnnFngWidget` | CNN Markets graphdata API | 주식 공포탐욕지수 0~100 / SVG 반원 게이지 |
| `FearAndGreedWidget` | alternative.me/fng API | 코인 공포탐욕지수 0~100 / SVG 반원 게이지 |
| `UsdKrwWidget` | open.er-api.com + market.json | USD/KRW / 전일比 절대변동폭 ▲▼ |
| `BitcoinWidget` | CoinGecko API + market.json | BTC 24h 변동률 / 위험자산 선호도 |

### GitHub Actions 자동갱신 위젯 (매일 04:00 KST)

| 위젯 함수 | 데이터 파일 | 핵심 판단 기준 |
|---|---|---|
| `NpsWidget` | `nps.json` | 국민연금 보유종목 지분율 + 90일 변동 히스토리 |
| `FedWidget` | `market.json` | 미·한 국채금리 / DXY / 전일比 절대변동폭 ▲▼ (상승=빨강, 하락=파랑) |
| `IndicesWidget` | `market.json` | KOSPI·KOSDAQ·S&P500·NASDAQ 미니카드 + 3개월 추이 |
| `GoldWidget` | `market.json` | 금 선물 가격 + 3개월 추이 |
| `BreadthWidget` | `breadth.json` | KOSPI 80종목 52주 신고가·신저가 비율 |
| `KrFngWidget` | `market.json` + `breadth.json` | 자체 복합 산출 한국장 공포탐욕지수 (5개 컴포넌트 가중합산) |
| `HySpreadWidget` | `macro.json` (`hy_spread`) | ICE BofA HY OAS 스프레드 라인 차트 / 300·500·800bp 기준선 |
| `BuffettWidget` | `macro.json` (`buffett_us`) | 미국 버핏 지수 에어리어 차트 / 80·120·160% 기준선 |
| `AdrWidget` | `breadth.json` (`adr_series`) | ADR MA10 프로그레스바 + 60일 라인 차트 / 75·120 기준선 |
| `CreditWidget` | `macro.json` (`deposit`, `credit`) | 투자자예탁금(Bar) + 신용융자잔고(Line) ComposedChart |

### 사이드바

| 기능 | 저장소 | 설명 |
|---|---|---|
| 오늘 매매 여부 | LocalStorage | 매매함/안함/관망 토글, 당일만 유효 |
| 매매 기준 체크리스트 | LocalStorage JSON 배열 | 항목 추가/삭제/체크/초기화 버튼 |
| 트레이딩 저널 | LocalStorage JSON 배열 | 기록하기 버튼 → `[YYYY-MM-DD] 내용` 누적 로그 |

---

## 데이터 흐름

```
GitHub Actions (매일 UTC 19:00 = KST 04:00)
  ├── fetch_nps.py          → public/data/nps.json
  ├── fetch_market_data.py  → public/data/market.json
  ├── fetch_breadth.py      → public/data/breadth.json  (adr_series, adr_latest 포함)
  ├── fetch_kr_rates.py     → public/data/kr_rates.json
  └── fetch_macro.py        → public/data/macro.json    (hy_spread, buffett_us, deposit, credit)
           ↓ git commit & push
  Vite 빌드 → GitHub Pages 배포
           ↓
  브라우저: 정적 JSON fetch + 실시간 API 병합 표시
```

### nps.json 구조

```json
{
  "updated_at": "YYYY-MM-DD HH:MM KST",
  "source": "금감원 DART ...",
  "stocks": [{ "name", "value", "change", "amount", "rcept_dt", "rank" }],
  "changes": [{ "name", "value", "prev", "change", "rcept_dt", "is_new" }]
}
```
- `stocks`: 누적 포트폴리오 (지분율 내림차순, rank 포함)
- `changes`: 90일 누적 변동 히스토리 (중복 제거, 날짜 내림차순)

---

## GitHub Actions 워크플로우

`.github/workflows/update-nps.yml`

- **트리거**: 매일 UTC 19:00 (KST 04:00) cron + 수동(`workflow_dispatch`) + `main` push
- **Job 1 (fetch-data)**: Python 3.12 → 스크립트 5개 순차 실행 → 변경 시 자동 커밋 & 푸시
- **Job 2 (deploy)**: `npm ci` → `vite build` → GitHub Pages 배포 (Node 24)
- **환경변수**: `DART_API_KEY`, `BOK_API_KEY` (GitHub Secrets)
- **폴백**: 각 스크립트는 API 실패 시 기존 JSON 유지, 앱 절대 불다운

---

## 설계 원칙

1. **백엔드 없음**: 모든 데이터는 정적 JSON 또는 클라이언트 fetch
2. **항상 표시**: API 실패 시 에러 UI + 재시도 버튼. 앱이 깨지지 않음
3. **LocalStorage 영속성**: 체크리스트·저널은 새로고침해도 유지
4. **설명 우선**: 모든 위젯에 `▸ 무엇인가요?` + 우상단 💡 팝오버 해석 가이드
5. **반응형**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` 기반, 모바일 완전 지원
6. **하드코딩 금지**: API 키는 반드시 `os.environ.get()` / GitHub Secrets 사용

---

## 코드 수정 시 주의사항

- `GaugeMeter` 컴포넌트: uid prop 필수 (SVG linearGradient ID 충돌 방지)
- `merge_portfolio()`: 인자 순서 `(existing, history, today)` — 변경 금지
- `KrFngWidget`: `computeKrFng()` + `computeKrFngSeries()` 두 함수 모두 사용
- 금리 등락색: **상승=`#ef4444`(빨강), 하락=`#3b82f6`(파랑)** — Bloomberg 컨벤션
- `nps.json` `changes` 키: 90일 누적 배열, 실행마다 초기화하면 안 됨
- vite.config.js `base: '/HemStock/'` — 절대 삭제 금지

---

## Todo

현재 미구현 예정 기능 없음. 위젯 전체 구현 완료.

---

## SSH 인증 설정

Claude Code가 push할 때 사용하는 SSH 키:
- 공개키: `~/.ssh/id_ed25519.pub` → GitHub Settings > SSH Keys 등록됨
- GitHub 리모트: `git@github.com:papavhub/HemStock.git`
