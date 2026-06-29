"""
한국 국채 금리 수집 — 한국은행 ECOS OpenAPI
- 국고채 3년 (KR3Y)  : 통계코드 028Y001 / 항목코드 0AA0003
- 국고채 10년 (KR10Y): 통계코드 028Y001 / 항목코드 0AA0010

환경변수: BOK_API_KEY (GitHub Secret)
결과: public/data/market.json 의 kr_3y · kr_10y 키에 병합
출처: 한국은행 경제통계시스템(ECOS) — https://ecos.bok.or.kr
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

MARKET_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "market.json"
KST  = timezone(timedelta(hours=9))
KEY  = os.environ.get("BOK_API_KEY", "").strip()
BASE = "https://ecos.bok.or.kr/api"

STAT_CODE = "028Y001"   # 시장금리(일별)
TARGETS = [
    ("kr_3y",  "0AA0003", "국고채 3년"),
    ("kr_10y", "0AA0010", "국고채 10년"),
]


def discover_item_code(label: str, keyword: str) -> str | None:
    """항목코드를 자동 탐색 (코드가 틀렸을 때 폴백)"""
    url = f"{BASE}/StatisticItemList/{KEY}/json/kr/1/200/{STAT_CODE}"
    try:
        r = requests.get(url, timeout=15)
        rows = r.json().get("StatisticItemList", {}).get("row", [])
        for row in rows:
            name = row.get("ITEM_NAME", "")
            if keyword in name:
                code = row.get("ITEM_CODE", "")
                print(f"    탐색 발견: {name} → {code}")
                return code
    except Exception as e:
        print(f"    [WARN] 항목 탐색 실패: {e}")
    return None


def fetch_series(key: str, item_code: str, label: str) -> dict:
    """ECOS API → 시계열 데이터 수집 (최근 3개월)"""
    now_kst   = datetime.now(KST)
    end_date  = now_kst.strftime("%Y%m%d")
    start_date = (now_kst - timedelta(days=90)).strftime("%Y%m%d")

    url = f"{BASE}/StatisticSearch/{KEY}/json/kr/1/100/{STAT_CODE}/DD/{start_date}/{end_date}/{item_code}"
    try:
        r    = requests.get(url, timeout=15)
        data = r.json()

        # 오류 확인
        result = data.get("RESULT", {})
        if result.get("CODE", "") != "":
            # 항목코드 오류 → 자동 탐색
            yr = label.replace("국고채 ", "").replace("년", "")
            alt = discover_item_code(label, f"{yr}년")
            if alt and alt != item_code:
                return fetch_series(key, alt, label)
            print(f"  [ERROR] {label}: {result}")
            return _empty()

        rows = data.get("StatisticSearch", {}).get("row", [])
        if not rows:
            print(f"  [WARN] {label}: 데이터 없음 (빈 응답)")
            return _empty()

        series = []
        for row in rows:
            date_str = row.get("TIME", "")          # 'YYYYMMDD'
            val_str  = row.get("DATA_VALUE", "")
            if not date_str or not val_str:
                continue
            try:
                val  = float(val_str)
                date = f"{date_str[4:6]}/{date_str[6:]}"   # MM/DD
                series.append({"date": date, "value": round(val, 3)})
            except ValueError:
                continue

        if not series:
            return _empty()

        latest     = series[-1]["value"]
        prev       = series[-2]["value"] if len(series) >= 2 else latest
        change     = round(latest - prev, 3)
        change_pct = round((change / prev) * 100, 3) if prev else 0

        print(f"  ✓ {label:<18} {latest:.3f}%  {change_pct:+.3f}%  ({len(series)}일치)")
        return {
            "series":     series,
            "latest":     latest,
            "prev":       prev,
            "change":     change,
            "change_pct": change_pct,
        }

    except Exception as e:
        print(f"  [ERROR] {label}: {e}", file=sys.stderr)
        return _empty()


def _empty() -> dict:
    return {"series": [], "latest": None, "prev": None, "change": None, "change_pct": None}


def main():
    print("=" * 55)
    print("  한국 국채 금리 수집 (한국은행 ECOS OpenAPI)")
    print("=" * 55)

    if not KEY:
        print("  [ERROR] BOK_API_KEY 환경변수 없음 — 건너뜀")
        sys.exit(0)   # 오류지만 0 반환 → 워크플로우 중단 안 함
    print(f"  API 키: {'*'*8}{KEY[-4:]}")

    results = {}
    for key, item_code, label in TARGETS:
        results[key] = fetch_series(key, item_code, label)

    # market.json에 병합 (기존 데이터 유지)
    existing = {}
    if MARKET_PATH.exists():
        try:
            with open(MARKET_PATH, encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    existing.update(results)

    MARKET_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MARKET_PATH, "w", encoding="utf-8") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)

    now_kst = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    print(f"\n{'='*55}")
    print(f"  ✅ market.json 병합 완료 — {now_kst}")
    print("  출처: 한국은행 경제통계시스템 (ECOS) https://ecos.bok.or.kr")
    print("=" * 55)


if __name__ == "__main__":
    main()
