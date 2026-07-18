"""
매크로 경제 지표 수집
- 하이일드 채권 스프레드 (HY OAS) : FRED BAMLH0A0HYM2  (API 키 불필요)
- 버핏 지수 (미국)               : FRED WILL5000INDFC / GDP (API 키 불필요)
- 신용융자잔고 & 투자자예탁금      : 한국은행 ECOS 064Y003 (BOK_API_KEY)

출력: public/data/macro.json

환경변수: BOK_API_KEY (GitHub Secret, 신용잔고 수집 시 필요)
"""

import csv
import io
import json
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "macro.json"
KST      = timezone(timedelta(hours=9))
BOK_KEY  = os.environ.get("BOK_API_KEY", "").strip()
ECOS_BASE = "https://ecos.bok.or.kr/api"
FRED_CSV  = "https://fred.stlouisfed.org/graph/fredgraph.csv"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/125.0 Safari/537.36"
    )
}


# ─── 공통 유틸 ──────────────────────────────────────────────────
def _empty() -> dict:
    return {"series": [], "latest": None, "prev": None,
            "change": None, "change_pct": None}


# ─── 1. FRED CSV (API 키 불필요) ────────────────────────────────
def fetch_fred(series_id: str, limit: int = 90) -> dict:
    """FRED 공개 CSV 엔드포인트 수집"""
    try:
        res = requests.get(
            FRED_CSV,
            params={"id": series_id},
            headers=HEADERS,
            timeout=25,
        )
        res.raise_for_status()
        reader = csv.DictReader(io.StringIO(res.text))
        rows = []
        for row in reader:
            date_str = row.get("DATE", "")
            val_str  = (row.get(series_id) or "").strip()
            if val_str in (".", "", "NA") or not date_str:
                continue
            try:
                rows.append({"date": date_str, "value": float(val_str)})
            except ValueError:
                pass

        if not rows:
            print(f"  [WARN] FRED:{series_id} 데이터 없음")
            return _empty()

        rows_trimmed = rows[-limit:]
        latest = round(rows_trimmed[-1]["value"], 3)
        prev   = round(rows_trimmed[-2]["value"], 3) if len(rows_trimmed) >= 2 else latest
        change = round(latest - prev, 3)
        chg_pct = round((change / prev) * 100, 2) if prev else 0

        # 차트용 날짜를 MM/DD 형식으로
        series_display = [
            {"date": r["date"][5:], "value": round(r["value"], 3)}
            for r in rows_trimmed
        ]
        print(f"  ✓ FRED:{series_id:<24} {latest}  ({len(series_display)}건)")
        return {
            "series":      series_display,
            "full_series": rows_trimmed,     # 버핏 지수 계산에만 사용 (저장 제외)
            "latest":      latest,
            "prev":        prev,
            "change":      change,
            "change_pct":  chg_pct,
        }
    except Exception as e:
        print(f"  [WARN] FRED:{series_id} 실패: {e}")
        return _empty()


# ─── 2. 버핏 지수 (미국): WILL5000INDFC / GDP ───────────────────
def compute_buffett(will_data: dict, gdp_data: dict) -> dict:
    """
    버핏 지수 (%) = Wilshire 5000 Total Market Cap (조 달러) / US GDP (조 달러) × 100
    FRED WILL5000INDFC 는 십억 달러(billion USD) 단위,
    FRED GDP          는 십억 달러(billion USD) 단위.
    → 단위 상쇄되어 그냥 나누면 됨.
    역사적 기준: 80% 이하 = 저평가, 100~120% = 적정, 150% = 고평가, 200%+ = 극도 과열
    """
    will_full = will_data.get("full_series", [])
    gdp_full  = gdp_data.get("full_series", [])
    if not will_full or not gdp_full:
        return {**_empty(), "label": None}

    # GDP는 분기 — YYYY-MM → 값 맵 (분기별 보간)
    gdp_map = {r["date"][:7]: r["value"] for r in gdp_full}
    sorted_gdp_keys = sorted(gdp_map.keys())

    def nearest_gdp(date_str: str) -> float | None:
        ym = date_str[:7]
        candidates = [d for d in sorted_gdp_keys if d <= ym]
        return gdp_map[candidates[-1]] if candidates else None

    series = []
    for r in will_full:
        gdp_val = nearest_gdp(r["date"])
        if gdp_val and gdp_val > 0:
            ratio = round(r["value"] / gdp_val * 100, 1)
            series.append({"date": r["date"][5:10], "value": ratio})

    if not series:
        return {**_empty(), "label": None}

    # 최대 60 분기(약 15년) 유지
    series = series[-60:]
    latest = series[-1]["value"]
    prev   = series[-2]["value"] if len(series) >= 2 else latest

    label = (
        "극도 과열" if latest > 200 else
        "과열"     if latest > 160 else
        "고평가"   if latest > 120 else
        "적정"     if latest > 80  else
        "저평가"
    )

    print(f"  ✓ 버핏지수(US) {latest}% — {label}")
    return {
        "series":     series,
        "latest":     latest,
        "prev":       prev,
        "change":     round(latest - prev, 1),
        "change_pct": round((latest - prev) / prev * 100, 2) if prev else 0,
        "label":      label,
    }


# ─── 3. BOK ECOS — 투자자예탁금 & 신용융자잔고 ──────────────────
def fetch_ecos_credit() -> dict[str, dict]:
    """
    한국은행 ECOS 064Y003: 투자자예탁금 및 신용융자잔고 (월별, 억원)
    → 조원 단위로 환산하여 저장 (÷10,000)
    """
    empty_result = {"deposit": _empty(), "credit": _empty()}

    if not BOK_KEY:
        print("  [SKIP] BOK_API_KEY 없음 — 신용잔고 수집 건너뜀")
        return empty_result

    STAT = "064Y003"

    # Step 1: 항목 목록 자동 탐색
    url = f"{ECOS_BASE}/StatisticItemList/{BOK_KEY}/json/kr/1/200/{STAT}"
    try:
        res  = requests.get(url, timeout=15)
        rows = res.json().get("StatisticItemList", {}).get("row", [])
    except Exception as e:
        print(f"  [WARN] ECOS 항목 목록 조회 실패: {e}")
        return empty_result

    deposit_code = None
    credit_code  = None
    for row in rows:
        code = (row.get("ITEM_CODE") or "").strip()
        name = (row.get("ITEM_NAME") or "").strip()
        if not code or not name:
            continue
        if "예탁금" in name and deposit_code is None:
            deposit_code = code
            print(f"    투자자예탁금 코드: [{code}] {name}")
        if "융자" in name and ("잔고" in name or "잔액" in name) and credit_code is None:
            credit_code = code
            print(f"    신용융자잔고 코드: [{code}] {name}")

    # Step 2: 시계열 수집
    now_kst    = datetime.now(KST)
    end_ym     = now_kst.strftime("%Y%m")
    start_ym   = (now_kst - timedelta(days=730)).strftime("%Y%m")  # 2년치

    def fetch_item(code: str | None, label: str) -> dict:
        if not code:
            print(f"  [WARN] {label} 항목 코드 미발견 — 건너뜀")
            return _empty()

        url = (
            f"{ECOS_BASE}/StatisticSearch/{BOK_KEY}/json/kr"
            f"/1/30/{STAT}/MM/{start_ym}/{end_ym}/{code}"
        )
        try:
            r    = requests.get(url, timeout=15)
            data = r.json()
            rr   = data.get("StatisticSearch", {}).get("row", [])
            if not rr:
                print(f"  [WARN] {label}: 응답 데이터 없음")
                return _empty()

            series = []
            for row in rr:
                t = row.get("TIME", "")       # YYYYMM
                v = (row.get("DATA_VALUE") or "").strip()
                if not t or not v:
                    continue
                try:
                    # 억원 → 조원 (÷10,000)
                    val_jo = round(float(v) / 10_000, 2)
                    series.append({
                        "date":  f"{t[:4]}-{t[4:6]}",
                        "value": val_jo,
                    })
                except ValueError:
                    pass

            if not series:
                return _empty()

            latest = series[-1]["value"]
            prev   = series[-2]["value"] if len(series) >= 2 else latest
            print(f"  ✓ {label:<16} {latest:.2f}조원  ({len(series)}건)")
            return {
                "series":     series,
                "latest":     latest,
                "prev":       prev,
                "change":     round(latest - prev, 2),
                "change_pct": round((latest - prev) / prev * 100, 2) if prev else 0,
            }
        except Exception as e:
            print(f"  [ERROR] {label}: {e}")
            return _empty()

    return {
        "deposit": fetch_item(deposit_code, "투자자예탁금"),
        "credit":  fetch_item(credit_code,  "신용융자잔고"),
    }


# ─── Main ────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  매크로 경제 지표 수집 (FRED + BOK ECOS)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    # ① 하이일드 채권 스프레드 (일별)
    print("\n  [1/3] ICE BofA HY OAS (FRED: BAMLH0A0HYM2) ...")
    hy = fetch_fred("BAMLH0A0HYM2", limit=90)

    # ② 버핏 지수 — Wilshire 5000 + GDP (분기)
    print("\n  [2/3] 버핏 지수 (FRED: WILL5000INDFC + GDP) ...")
    will    = fetch_fred("WILL5000INDFC", limit=32)   # ~8년 분기
    gdp     = fetch_fred("GDP",           limit=32)
    buffett = compute_buffett(will, gdp)

    # ③ 신용잔고 & 예탁금 (BOK ECOS)
    print("\n  [3/3] 신용융자잔고 & 투자자예탁금 (BOK ECOS: 064Y003) ...")
    credit_data = fetch_ecos_credit()

    # full_series는 계산용 임시 데이터 — JSON 저장 제외
    hy_save = {k: v for k, v in hy.items() if k != "full_series"}

    # 기존 macro.json 로드 (있으면 병합)
    existing = {}
    if OUTPUT_PATH.exists():
        try:
            with open(OUTPUT_PATH, encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            pass

    payload = {
        **existing,
        "updated_at": updated_at,
        "source":     "FRED (St. Louis Fed) + 한국은행 ECOS",
        "hy_spread":  hy_save,
        "buffett_us": {k: v for k, v in buffett.items() if k != "full_series"},
        "deposit":    credit_data.get("deposit", _empty()),
        "credit":     credit_data.get("credit",  _empty()),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  HY스프레드: {hy.get('latest')}%  | 버핏지수: {buffett.get('latest')}%")
    print(f"  예탁금: {credit_data['deposit'].get('latest')}조원 | "
          f"융자잔고: {credit_data['credit'].get('latest')}조원")
    print(f"  갱신: {updated_at}")
    print("=" * 55)


if __name__ == "__main__":
    main()
