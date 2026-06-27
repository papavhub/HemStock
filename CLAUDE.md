# HemStock — CLAUDE.md

주식 매매기준 모니터링 및 멘탈 관리 대시보드.
GitHub Pages(정적 사이트)로 배포되며, 백엔드 서버 없이 운영된다.

---

## 기술 스택

| 역할 | 기술 |
|---|---|
| UI 프레임워크 | React 18 + Vite |
| 스타일링 | Tailwind CSS (다크모드 고정, 블룸버그 터미널 스타일) |
| 차트 | Recharts |
| 상태 유지 | LocalStorage (체크리스트, 매매메모, 매매여부) |
| 데이터 자동갱신 | GitHub Actions + Python |
| 배포 | GitHub Pages (`/HemStock/` base path) |

---

## 프로젝트 구조

```
HemStock/
├── .github/workflows/
│   └── update-nps.yml       # 매일 04:00 KST 자동 실행 (NPS 수집 + Pages 배포)
├── scripts/
│   ├── fetch_nps.py          # 국민연금 데이터 수집 Python 스크립트
│   └── requirements.txt      # requests, beautifulsoup4, lxml
├── public/
│   └── data/
│       └── nps.json          # GitHub Actions가 매일 갱신하는 데이터 파일
├── src/
│   ├── pages/
│   │   └── Dashboard.jsx     # 메인 대시보드 (단일 페이지)
│   ├── main.jsx
│   └── index.css             # Tailwind 기본 + 커스텀 컴포넌트
├── index.html
├── vite.config.js            # base: '/HemStock/' 설정 필수
├── tailwind.config.js
└── package.json
```

---

## 위젯 구성 및 데이터 출처

### 실시간 API 위젯 (API 키 불필요, 클라이언트 fetch)

| 위젯 | API 엔드포인트 | 설명 |
|---|---|---|
| 공포탐욕지수 | `https://api.alternative.me/fng/?limit=8` | 암호화폐·주식 심리 지수 0~100. 25 이하 = 공포(매수), 75 이상 = 탐욕(매도 고려) |
| 원달러 환율 | `https://open.er-api.com/v6/latest/USD` | USD/KRW 실시간. 1,400원 이상 = 외인 이탈 경계 |
| 비트코인 | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&...` | BTC 가격 + 24h 변동률. -5% 이하 급락 = 위험자산 기피 신호 |

### GitHub Actions 자동갱신 위젯

| 위젯 | 파일 | 갱신 주기 |
|---|---|---|
| 국민연금 포트폴리오 | `public/data/nps.json` | 매일 04:00 KST |

### Mock 데이터 위젯 (추후 API 연동 예정)

| 위젯 | 연동 예정 API |
|---|---|
| VIX 공포지수 | Alpha Vantage (무료, API 키 필요) |
| 신용잔고 비율 | 금융투자협회 (KOFIA) |
| 연준 방향성 | FRED API (연준 공식, 무료) |
| 시장건강 신고가 비율 | KRX 정보데이터시스템 |

---

## 로컬 개발

```bash
npm install
npm run dev        # http://localhost:5173/HemStock/
```

## 빌드 & 배포

```bash
npm run build      # dist/ 생성
# GitHub에 push하면 Actions가 자동으로 Pages 배포
```

## NPS 스크립트 수동 실행

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_nps.py
# → public/data/nps.json 갱신
```

---

## GitHub Actions 워크플로우

`.github/workflows/update-nps.yml`

- **트리거**: 매일 UTC 19:00 (KST 04:00) cron + 수동(`workflow_dispatch`) + `main` push
- **Job 1 (fetch-data)**: Python 환경 세팅 → `fetch_nps.py` 실행 → 변경 시 자동 커밋 & 푸시
- **Job 2 (deploy)**: `npm ci` → `npm run build` → GitHub Pages 배포
- **폴백 구조**: KRX API 실패 시 → 전일 데이터 → 하드코딩 fallback 순으로 항상 정상 종료

---

## 설계 원칙

1. **백엔드 없음**: 모든 데이터는 정적 JSON 또는 클라이언트 fetch
2. **항상 표시**: API 실패 시 에러 UI + 재시도 버튼 표시. 앱이 깨지지 않음
3. **LocalStorage 영속성**: 체크리스트·메모는 새로고침해도 유지
4. **설명 우선**: 모든 위젯에 "▸ 무엇인가요?" 설명 + 우상단 💡 해석 가이드 포함
5. **다크모드 고정**: 블룸버그 터미널 스타일 (`#0a0e14` 배경)

---

## vite.config.js 주의사항

```js
base: '/HemStock/'  // GitHub Pages URL 경로와 반드시 일치해야 함
```

레포 이름이 바뀌면 이 값도 함께 수정해야 한다.

---

## SSH 인증 설정

Claude Code가 push할 때 사용하는 SSH 키:
- 공개키: `~/.ssh/id_ed25519.pub` → GitHub Settings > SSH Keys에 등록됨
- GitHub 리모트: `git@github.com:papavhub/HemStock.git`
