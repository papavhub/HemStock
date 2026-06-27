# HemStock 📊

> 주식 매매기준 모니터링 & 멘탈 관리 대시보드

Bloomberg 터미널 스타일의 개인용 주식 모니터링 대시보드입니다.  
백엔드 없이 GitHub Pages에서 실행되며, 매일 새벽 4시 자동으로 데이터를 갱신합니다.

🔗 **[라이브 데모 →](https://papavhub.github.io/HemStock/)**

---

## 주요 기능

### 🌐 글로벌 심리 지표 (실시간, API 키 불필요)

| 위젯 | 데이터 출처 | 설명 |
|---|---|---|
| 🌡️ 공포·탐욕지수 | Alternative.me API | 시장 심리 0~100 / 25↓ 공포(매수기회), 75↑ 탐욕(매도고려) |
| 💱 원달러 환율 | Open Exchange Rates | USD/KRW 실시간 / 1,400원↑ 외국인 이탈 경계 |
| ₿ 비트코인 | CoinGecko API | BTC 가격 + 24h 변동률 / -5%↓ 위험자산 기피 신호 |

### 🇺🇸 미국 시장 / 매크로 (매일 04:00 KST 자동갱신)

| 위젯 | 데이터 출처 | 설명 |
|---|---|---|
| 📉 VIX 공포지수 | Yahoo Finance (^VIX) | 미국 변동성 지수 / 30↑ 시장 공포 구간 |
| 🏦 연준 방향성 | Yahoo Finance (^TNX) | 미 10년 국채금리 추이로 긴축/완화 방향 판단 |

### 🇰🇷 한국 시장 (매일 04:00 KST 자동갱신)

| 위젯 | 데이터 출처 | 설명 |
|---|---|---|
| 🏛️ 국민연금 포트폴리오 | 금감원 DART OpenAPI | 5%↑ 대량보유 공시 기준 현재 보유 종목 |
| 💳 신용거래 잔고 비율 | KRX 정보데이터시스템 | 융자잔고/시가총액 비율 / 상승 추세 = 레버리지 과열 |
| 📈 신고가·신저가 비율 | Yahoo Finance (KOSPI 80종목) | 52주 신고가 비율 / 70%↑ 강세, 30%↓ 약세 |

### 🗒️ 사이드바 도구

- **매매 체크리스트** — 진입 전 점검 항목 (LocalStorage 영구 저장)
- **매매 일지** — 메모 기록 (LocalStorage 영구 저장)
- **오늘 매매 여부** — 매매 완료 상태 토글

---

## 기술 스택

```
React 18 + Vite        UI 프레임워크
Tailwind CSS           스타일링 (라이트/다크 테마)
Recharts               차트
GitHub Actions         데이터 자동 수집 (Python)
GitHub Pages           정적 사이트 배포
LocalStorage           체크리스트·메모 영구 저장
```

---

## 로컬 실행

```bash
git clone https://github.com/papavhub/HemStock.git
cd HemStock
npm install
npm run dev
# → http://localhost:5173/HemStock/
```

---

## 데이터 자동갱신 구조

```
GitHub Actions (매일 UTC 19:00 = KST 04:00)
 ├── python scripts/fetch_nps.py          → public/data/nps.json
 ├── python scripts/fetch_market_data.py  → public/data/market.json
 ├── python scripts/fetch_credit.py       → public/data/credit.json
 └── python scripts/fetch_breadth.py     → public/data/breadth.json
          ↓
     git commit & push
          ↓
     Vite 빌드 → GitHub Pages 배포
```

각 스크립트는 API 실패 시 fallback 데이터로 자동 전환하여 항상 정상 종료됩니다.

---

## DART API 설정 (국민연금 데이터)

국민연금 포트폴리오 위젯은 [금감원 DART OpenAPI](https://opendart.fss.or.kr/)를 사용합니다.

1. [DART 회원가입](https://opendart.fss.or.kr/intro/main.do) 후 API 키 발급
2. GitHub 저장소 → **Settings → Secrets and variables → Actions** → `DART_API_KEY` 등록
3. Actions 탭 → 워크플로우 수동 실행(`workflow_dispatch`)으로 테스트

---

## 프로젝트 구조

```
HemStock/
├── .github/workflows/
│   └── update-nps.yml         # 데이터 수집 + Pages 배포 자동화
├── scripts/
│   ├── fetch_nps.py           # 국민연금 DART API 수집
│   ├── fetch_market_data.py   # VIX·금리·DXY·S&P500 (yfinance)
│   ├── fetch_credit.py        # 신용거래 잔고 (KRX)
│   ├── fetch_breadth.py       # 신고가·신저가 비율 (yfinance)
│   └── requirements.txt
├── public/data/               # GitHub Actions가 매일 갱신
│   ├── nps.json
│   ├── market.json
│   ├── credit.json
│   └── breadth.json
├── src/
│   └── pages/Dashboard.jsx    # 메인 대시보드 (단일 페이지)
└── vite.config.js             # base: '/HemStock/' 필수
```

---

## 설계 원칙

1. **백엔드 없음** — 모든 데이터는 정적 JSON 또는 브라우저 직접 fetch
2. **항상 표시** — API 실패 시 fallback 데이터 사용, 앱이 깨지지 않음
3. **설명 우선** — 모든 위젯에 "▸ 무엇인가요?" 설명 + 해석 가이드 포함
4. **영속성** — 체크리스트·메모는 LocalStorage에 저장, 새로고침해도 유지

---

## License

MIT