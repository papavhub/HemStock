"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
전략:
  1) list.json으로 국민연금 대량보유 보고 목록 수집 (보고자=국민연금공단)
  2) 각 보고의 corp_code로 majorstock.json 호출 → 최신 보유 비율 추출
  3) 전부 실패 시 fallback (분기 공시 기준 하드코딩)

환경변수: DART_API_KEY (GitHub Secret)
결과: public/data/nps.json
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
KEY  = os.environ.get("DART_API_KEY", "").strip()

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HemStock/1.0; +https://github.com/papavhub/HemStock)"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

FALLBACK = [
    {"rank":1,  "name":"삼성전자",        "value":8.26,"change": 0.10,"amount":"지분율 8.26% (공시기준)","rcept_dt":"2025-03-10"},
    {"rank":2,  "name":"기아",             "value":9.12,"change":-0.20,"amount":"지분율 9.12% (공시기준)","rcept_dt":"2025-03-01"},
    {"rank":3,  "name":"POSCO홀딩스",      "value":9.67,"change": 0.15,"amount":"지분율 9.67% (공시기준)","rcept_dt":"2025-02-15"},
    {"rank":4,  "name":"KB금융",           "value":9.23,"change": 0.10,"amount":"지분율 9.23% (공시기준)","rcept_dt":"2025-02-28"},
    {"rank":5,  "name":"현대차",           "value":8.41,"change": 0.00,"amount":"지분율 8.41% (공시기준)","rcept_dt":"2025-03-05"},
    {"rank":6,  "name":"하나금융지주",     "value":8.91,"change": 0.05,"amount":"지분율 8.91% (공시기준)","rcept_dt":"2025-02-22"},
    {"rank":7,  "name":"신한지주",         "value":8.44,"change": 0.00,"amount":"지분율 8.44% (공시기준)","rcept_dt":"2025-03-08"},
    {"rank":8,  "name":"SK하이닉스",       "value":6.94,"change": 0.30,"amount":"지분율 6.94% (공시기준)","rcept_dt":"2025-02-20"},
    {"rank":9,  "name":"LG에너지솔루션",   "value":6.12,"change":-0.10,"amount":"지분율 6.12% (공시기준)","rcept_dt":"2025-01-30"},
    {"rank":10, "name":"삼성바이오로직스", "value":5.80,"change": 0.05,"amount":"지분율 5.80% (공시기준)","rcept_dt":"2025-02-10"},
]


# ── Step 1: 국민연금 대량보유 보고 목록 ──────────────────────────
def get_nps_filing_list() -> list[dict]:
    """DART list.json — 최근 1년 국민연금 대량보유 보고 목록"""
    now    = datetime.now(KST)
    end_de = now.strftime("%Y%m%d")
    bgn_de = (now - timedelta(days=88)).strftime("%Y%m%d")  # corp_code 없이 최대 3개월

    url    = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key":         KEY,
        "pblntf_detail_ty":  "I001",   # 주식대량보유상황보고
        "bgn_de":            bgn_de,
        "end_de":            end_de,
        "page_no":           "1",
        "page_count":        "100",
    }
    res  = SESSION.get(url, params=params, timeout=15)
    res.raise_for_status()
    data = res.json()

    print(f"  list.json → status={data.get('status')} msg={data.get('message')} total={data.get('total_count',0)}")

    all_filings = data.get("list", [])
    # 보고자(flr_nm)에 '국민연금' 포함된 것만
    nps = [f for f in all_filings if "국민연금" in f.get("flr_nm", "")]
    print(f"  국민연금 보고: {len(nps)}건 (전체 {len(all_filings)}건 중)")

    # corp별 최신 보고만 유지
    latest: dict[str, dict] = {}
    for f in nps:
        c = f["corp_code"]
        if c not in latest or f["rcept_dt"] > latest[c]["rcept_dt"]:
            latest[c] = f
    return list(latest.values())


# ── Step 2: corp_code별 보유 비율 조회 ──────────────────────────
def get_hold_ratio(corp_code: str, corp_name: str):
    """DART majorstock.json — 특정 종목 국민연금 최신 보유 비율"""
    url    = "https://opendart.fss.or.kr/api/majorstock.json"
    params = {"crtfc_key": KEY, "corp_code": corp_code}
    try:
        res  = SESSION.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()

        if data.get("status") != "000":
            print(f"    majorstock {corp_name}: status={data.get('status')} {data.get('message')}")
            return None

        items     = data.get("list", [])
        nps_items = [i for i in items if "국민연금" in i.get("repror", "")]
        if not nps_items:
            return None

        latest    = sorted(nps_items, key=lambda x: x.get("rcept_dt",""), reverse=True)[0]
        ratio     = float(latest.get("hold_ratio") or 0)
        if ratio < 5.0:
            return None

        prev_items = [i for i in nps_items if i["rcept_dt"] < latest["rcept_dt"]]
        prev_ratio = float(prev_items[0].get("hold_ratio") or ratio) if prev_items else ratio
        change     = round(ratio - prev_ratio, 2)

        dt = latest.get("rcept_dt","")
        return {
            "name":     corp_name,
            "value":    round(ratio, 2),
            "change":   change,
            "amount":   f"지분율 {ratio:.2f}%",
            "rcept_dt": f"{dt[:4]}-{dt[4:6]}-{dt[6:]}" if len(dt)==8 else dt,
        }
    except Exception as e:
        print(f"    majorstock {corp_name}({corp_code}): {e}")
        return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    # API 키 확인
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수가 비어 있습니다.")
        print("  GitHub Secret 'DART_API_KEY' 를 확인해주세요.")
        return []

    print(f"  API 키 확인: {'*' * 8}{KEY[-4:]} (마지막 4자리)")

    # Step 1: 보고 목록 수집
    try:
        filings = get_nps_filing_list()
    except Exception as e:
        print(f"  [ERROR] list.json 호출 실패: {e}")
        return []

    if not filings:
        print("  [WARN] 국민연금 보고 목록이 비어 있습니다.")
        return []

    # Step 2: 각 종목 보유 비율 조회
    stocks = []
    print(f"\n  보유 비율 조회 ({len(filings)}종목)...")
    for f in filings:
        corp_code = f.get("corp_code","")
        corp_name = f.get("corp_name","")
        result    = get_hold_ratio(corp_code, corp_name)
        if result:
            stocks.append(result)
            print(f"  ✓ {corp_name:<18} {result['value']:.2f}%  변동 {result['change']:+.2f}%  ({result['rcept_dt']})")
        time.sleep(0.2)

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
        source = "금감원 DART OpenAPI — 대량보유상황보고 (현재 보유 기준, 최신 공시)"
    else:
        print("\n  ⚠ DART 수집 실패 → fallback 데이터 사용")
        stocks     = FALLBACK
        source     = "fallback — 과거 공시 기준 하드코딩 (DART_API_KEY 확인 필요)"
        updated_at += " [fallback]"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": updated_at,
            "source":     source,
            "stocks":     stocks,
        }, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 55}")
    print(f"  ✅ 완료: {len(stocks)}종목 | {updated_at}")
    print(f"  출처: {source}")
    print("=" * 55)


if __name__ == "__main__":
    main()
