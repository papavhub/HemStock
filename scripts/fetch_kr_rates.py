"""
한국 국채 금리 수집 — 한국은행 ECOS OpenAPI
- 국고채 3년  (KR3Y)
- 국고채 10년 (KR10Y)

전략:
  1) StatisticItemList → 028Y001 항목 목록 조회
  2) '국고채' + '3년'/'10년' 키워드로 ITEM_CODE 자동 매핑
  3) StatisticSearch → 최근 3개월 일별 시계열 수집
  4) market.json 에 kr_3y / kr_10y 키로 병합

환경변수: BOK_API_KEY (GitHub Secret)
출처: 한국은행 경제통계시스템(ECOS) — https://ecos.bok.or.kr
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

MARKET_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "market.json"
KST      = timezone(timedelta(hours=9))
KEY      = os.environ.get("BOK_API_KEY", "").strip()
BASE     = "https://ecos.bok.or.kr/api"
STAT     = "817Y002"   # 시장금리(일별)


# ── Step 1: 항목 목록 조회 → 국고채 3Y/10Y 코드 탐색 ─────────────
def get_item_codes() -> dict[str, str]:
    """StatisticItemList에서 '국고채 N년' ITEM_CODE 자동 매핑"""
    url = f"{BASE}/StatisticItemList/{KEY}/json/kr/1/200/{STAT}"
    try:
        r    = requests.get(url, timeout=15)
        rows = r.json().get("StatisticItemList", {}).get("row", [])
    except Exception as e:
        print(f"  [WARN] 항목 목록 조회 실패: {e}")
        return {}

    print(f"  항목 목록 {len(rows)}건 조회 완료")
    mapping = {}
    for row in rows:
        code = (row.get("ITEM_CODE") or "").strip()
        name = (row.get("ITEM_NAME") or "").strip()
        if not code or not name:
            continue
        # "국고채" + 연수 매핑
        if "국고채" in name:
            print(f"    발견: [{code}] {name}")
            if "3년" in name:
                mapping["kr_3y"] = code
            elif "5년" in name:
                mapping["kr_5y"] = code
            elif "10년" in name:
                mapping["kr_10y"] = code
            elif "20년" in name:
                mapping["kr_20y"] = code

    return mapping


# ── Step 2: 시계열 수집 ───────────────────────────────────────────
def fetch_series(item_code: str, label: str) -> dict:
    now_kst    = datetime.now(KST)
    end_date   = now_kst.strftime("%Y%m%d")
    start_date = (now_kst - timedelta(days=90)).strftime("%Y%m%d")

    url = (
        f"{BASE}/StatisticSearch/{KEY}/json/kr"
        f"/1/100/{STAT}/D/{start_date}/{end_date}/{item_code}"
    )
    try:
        r    = requests.get(url, timeout=15)
        data = r.json()

        err = data.get("RESULT", {})
        if err.get("CODE"):
            print(f"  [ERROR] {label} ({item_code}): {err}")
            return _empty()

        rows = data.get("StatisticSearch", {}).get("row", [])
        if not rows:
            print(f"  [WARN] {label}: 응답은 성공이나 데이터 없음")
            return _empty()

        series = []
        for row in rows:
            time_str = row.get("TIME", "")     # 'YYYYMMDD'
            val_str  = row.get("DATA_VALUE", "")
            if not time_str or not val_str or val_str.strip() == "":
                continue
            try:
                val  = float(val_str)
                date = f"{time_str[4:6]}/{time_str[6:]}"
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


# ── Main ─────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  한국 국채 금리 수집 (한국은행 ECOS OpenAPI)")
    print("=" * 55)

    if not KEY:
        print("  [ERROR] BOK_API_KEY 환경변수 없음 — 건너뜀")
        sys.exit(0)
    print(f"  API 키: {'*'*8}{KEY[-4:]}")

    # 항목코드 자동 탐색
    code_map = get_item_codes()
    if not code_map:
        print("  [ERROR] 항목 코드 탐색 실패 — 종료")
        _save({})
        return

    # 탐색된 코드로 수집 (kr_3y, kr_10y 우선)
    targets = {k: v for k, v in code_map.items() if k in ("kr_3y", "kr_10y")}
    label_map = {
        "kr_3y":  "국고채 3년",
        "kr_10y": "국고채 10년",
    }

    results = {}
    for key, item_code in targets.items():
        results[key] = fetch_series(item_code, label_map.get(key, key))

    _save(results)


def _save(results: dict):
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
