"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
- endpoint: majorstock.json (대량보유상황보고)
- 국민연금이 5% 이상 보유한 최신 공시 기준으로 추출
- 환경변수 DART_API_KEY 필요 (GitHub Secret)
- 결과: public/data/nps.json
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "nps.json"
KST  = timezone(timedelta(hours=9))
KEY  = os.environ.get("DART_API_KEY", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HemStock/1.0)"
}

# ── DART 고유번호 목록 (주요 KOSPI 대형주) ──────────────────────
CORPS = {
    "삼성전자":        "00126380",
    "SK하이닉스":      "00164779",
    "LG에너지솔루션":  "01426563",
    "삼성바이오로직스":"00802238",
    "현대차":          "00164742",
    "기아":            "00164953",
    "POSCO홀딩스":     "00134796",
    "KB금융":          "00688360",
    "신한지주":        "00382199",
    "하나금융지주":    "00547583",
    "삼성SDI":         "00126182",
    "LG화학":          "00109110",
    "NAVER":           "00266961",
    "카카오":          "00918444",
    "삼성물산":        "00126300",
    "현대모비스":      "00164788",
    "우리금융지주":    "01138694",
    "SK이노베이션":    "00631533",
    "한국전력":        "00108009",
    "LG전자":          "00116033",
    "삼성생명":        "00126380",  # placeholder - update if needed
    "SK텔레콤":        "00178299",
    "셀트리온":        "00603710",
    "두산에너빌리티":  "00134483",
    "포스코퓨처엠":    "00124806",
}

# ── FALLBACK: 최신 5%+ 공시 기준 하드코딩 ──────────────────────
FALLBACK = [
    {"rank":1,  "name":"삼성전자",        "value":8.26, "change":0.10, "amount":"지분율 8.26%", "rcept_dt":"2025-03-10"},
    {"rank":2,  "name":"SK하이닉스",       "value":6.94, "change":0.30, "amount":"지분율 6.94%", "rcept_dt":"2025-02-20"},
    {"rank":3,  "name":"현대차",           "value":8.41, "change":0.00, "amount":"지분율 8.41%", "rcept_dt":"2025-03-05"},
    {"rank":4,  "name":"기아",             "value":9.12, "change":-0.20,"amount":"지분율 9.12%", "rcept_dt":"2025-03-01"},
    {"rank":5,  "name":"POSCO홀딩스",      "value":9.67, "change":0.15, "amount":"지분율 9.67%", "rcept_dt":"2025-02-15"},
    {"rank":6,  "name":"KB금융",           "value":9.23, "change":0.10, "amount":"지분율 9.23%", "rcept_dt":"2025-02-28"},
    {"rank":7,  "name":"신한지주",         "value":8.44, "change":0.00, "amount":"지분율 8.44%", "rcept_dt":"2025-03-08"},
    {"rank":8,  "name":"하나금융지주",     "value":8.91, "change":0.05, "amount":"지분율 8.91%", "rcept_dt":"2025-02-22"},
    {"rank":9,  "name":"LG에너지솔루션",   "value":6.12, "change":-0.10,"amount":"지분율 6.12%", "rcept_dt":"2025-01-30"},
    {"rank":10, "name":"삼성바이오로직스", "value":5.80, "change":0.05, "amount":"지분율 5.80%", "rcept_dt":"2025-02-10"},
]


def fetch_dart_majorstock(corp_code: str, corp_name: str) -> dict | None:
    """DART majorstock.json — 특정 종목의 국민연금 보유 현황"""
    url = "https://opendart.fss.or.kr/api/majorstock.json"
    params = {"crtfc_key": KEY, "corp_code": corp_code}
    try:
        res = requests.get(url, params=params, headers=HEADERS, timeout=10)
        res.raise_for_status()
        data = res.json()

        if data.get("status") != "000":
            return None

        # 국민연금 관련 보고만 필터
        nps_items = [
            item for item in data.get("list", [])
            if "국민연금" in item.get("repror", "")
        ]
        if not nps_items:
            return None

        # 가장 최근 보고 기준
        latest  = sorted(nps_items, key=lambda x: x.get("rcept_dt", ""), reverse=True)[0]
        ratio   = float(latest.get("hold_ratio") or 0)
        if ratio < 5.0:
            return None  # 5% 미만은 제외

        # 직전 보고와 비중 차이 계산
        prev_items = [i for i in nps_items if i.get("rcept_dt", "") < latest.get("rcept_dt", "")]
        prev_ratio = float(prev_items[0].get("hold_ratio") or ratio) if prev_items else ratio
        change     = round(ratio - prev_ratio, 2)

        rcept_dt = latest.get("rcept_dt", "")
        rcept_fmt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:8]}" if len(rcept_dt) == 8 else rcept_dt

        return {
            "name":     corp_name,
            "value":    round(ratio, 2),
            "change":   change,
            "amount":   f"지분율 {ratio:.2f}%",
            "rcept_dt": rcept_fmt,
        }
    except Exception as e:
        print(f"    [WARN] {corp_name}({corp_code}): {e}", file=sys.stderr)
        return None


def fetch_all() -> list[dict]:
    if not KEY:
        print("  [WARN] DART_API_KEY 없음 → fallback 사용", file=sys.stderr)
        return []

    stocks = []
    for name, code in CORPS.items():
        result = fetch_dart_majorstock(code, name)
        if result:
            stocks.append(result)
            print(f"  ✓ {name:<18} {result['value']:.2f}%  {result['change']:+.2f}%  ({result['rcept_dt']})")
        time.sleep(0.3)  # API 과호출 방지

    # 지분율 높은 순 정렬 + rank 부여
    stocks.sort(key=lambda x: x["value"], reverse=True)
    for i, s in enumerate(stocks, 1):
        s["rank"] = i

    return stocks


def main():
    print("=" * 55)
    print("  국민연금 포트폴리오 수집 (DART OpenAPI)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    stocks = fetch_all()

    if stocks:
        source = "금감원 DART OpenAPI — 대량보유상황보고 (최신 5%+ 공시)"
    else:
        print("\n  fallback 데이터 사용 (DART 키 없음 또는 수집 실패)")
        stocks     = FALLBACK
        source     = "fallback — 분기 공시 기준 하드코딩 (DART_API_KEY 설정 필요)"
        updated_at += " [fallback]"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": updated_at,
        "source":     source,
        "stocks":     stocks,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  수집 종목: {len(stocks)}개 | 출처: {source}")


if __name__ == "__main__":
    main()
