"""
신용거래 잔고 비율 수집
- 1순위: KRX 정보데이터시스템 API (신용거래 잔고)
- 2순위: KOFIA 금융통계정보시스템 스크래핑
- 결과: public/data/credit.json
"""

import json
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "credit.json"
KST = timezone(timedelta(hours=9))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://data.krx.co.kr/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# ── 1순위: KRX 신용거래 잔고 ────────────────────────────────────
def fetch_krx_credit() -> list[dict]:
    """KRX 공개 API — 신용거래 잔고 (월별)"""
    url = "https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"

    now = datetime.now(KST)
    # 최근 6개월 데이터 요청
    months = []
    for i in range(5, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12; y -= 1
        months.append(f"{y}{m:02d}")

    results = []
    for ym in months:
        start = f"{ym}01"
        # 말일 계산
        import calendar
        last = calendar.monthrange(int(ym[:4]), int(ym[4:]))[1]
        end  = f"{ym}{last}"

        payload = {
            "bld":        "dbms/MDC/STAT/standard/MDCSTAT30201",
            "locale":     "ko_KR",
            "mktId":      "STK",
            "strtDd":     start,
            "endDd":      end,
            "share":      "1",
            "money":      "1",
            "csvxls_isNo":"false",
        }
        try:
            res = SESSION.post(url, data=payload, timeout=12)
            res.raise_for_status()
            data  = res.json()
            items = data.get("output", [])
            if items:
                # 해당 월의 마지막 데이터 사용
                item = items[-1]
                # 융자잔고 / 시가총액 = 신용잔고 비율
                loan  = float(str(item.get("LOAN_BLCE", "0")).replace(",", "") or 0)
                mcap  = float(str(item.get("MKTCAP",   "0")).replace(",", "") or 1)
                ratio = round(loan / mcap * 100, 2) if mcap else 0
                date_str = item.get("TRD_DD", end)[:7].replace("/", "-")
                results.append({"date": date_str, "ratio": ratio, "loan_bil": round(loan / 1e8, 1)})
        except Exception as e:
            print(f"  [WARN] KRX {ym}: {e}", file=sys.stderr)
        time.sleep(0.5)

    return results


# ── 2순위: KOFIA 금융통계정보시스템 ─────────────────────────────
def fetch_kofia_credit() -> list[dict]:
    """KOFIA freeSIS — 신용거래 융자 잔고"""
    # KOFIA는 공개 통계 페이지를 통해 제공
    url = "https://freesis.kofia.or.kr/brd/M_63/view.do"
    params = {"subMenuNo": "176", "menuNo": "176"}
    try:
        res = SESSION.get(url, params=params, timeout=12)
        res.raise_for_status()
        res.encoding = "utf-8"
        soup = BeautifulSoup(res.text, "html.parser")

        rows    = soup.select("table tbody tr")
        results = []
        for row in rows[:6]:
            cols = row.select("td")
            if len(cols) < 3:
                continue
            date_txt  = cols[0].get_text(strip=True)
            ratio_txt = cols[2].get_text(strip=True).replace("%", "").replace(",", "")
            try:
                ratio = float(ratio_txt)
                results.append({"date": date_txt, "ratio": ratio})
            except ValueError:
                pass

        return list(reversed(results))  # 오래된 순
    except Exception as e:
        print(f"  [WARN] KOFIA: {e}", file=sys.stderr)
        return []


# ── FALLBACK ────────────────────────────────────────────────────
FALLBACK = [
    {"date": "2026-01", "ratio": 1.82, "loan_bil": 0},
    {"date": "2026-02", "ratio": 1.95, "loan_bil": 0},
    {"date": "2026-03", "ratio": 2.11, "loan_bil": 0},
    {"date": "2026-04", "ratio": 2.34, "loan_bil": 0},
    {"date": "2026-05", "ratio": 2.58, "loan_bil": 0},
    {"date": "2026-06", "ratio": 2.71, "loan_bil": 0},
]


def main():
    print("=" * 55)
    print("  신용거래 잔고 비율 수집")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    print("\n[1/2] KRX 신용거래 잔고 API 시도...")
    series = fetch_krx_credit()

    if not series:
        print("[2/2] KOFIA 통계 시도...")
        series = fetch_kofia_credit()

    source = ""
    if series:
        source = "KRX 정보데이터시스템 — 신용거래 잔고 (월말 기준)"
        latest = series[-1]
        print(f"  ✓ {len(series)}개월 수집  최신: {latest['date']} {latest['ratio']:.2f}%")
    else:
        print("  모든 수집 실패 → fallback")
        series     = FALLBACK
        source     = "fallback (실제 데이터 수집 실패)"
        updated_at += " [fallback]"

    # 전고점 및 최신값 계산
    max_ratio = max(s["ratio"] for s in series)
    latest    = series[-1]
    prev      = series[-2] if len(series) >= 2 else series[-1]
    change    = round(latest["ratio"] - prev["ratio"], 2)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": updated_at,
        "source":     source,
        "series":     series,
        "latest":     latest["ratio"],
        "prev":       prev["ratio"],
        "change":     change,
        "peak":       max_ratio,   # 전고점
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  최신 신용잔고 비율: {latest['ratio']:.2f}%  전고점: {max_ratio:.2f}%")


if __name__ == "__main__":
    main()
