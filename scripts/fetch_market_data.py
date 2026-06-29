"""
시장 핵심 지표 자동 수집 스크립트
- VIX (공포지수)       : CBOE Volatility Index  — Yahoo Finance ^VIX
- 미 국채 10Y 금리     : US Treasury 10Y Yield  — Yahoo Finance ^TNX
- 달러 인덱스 (DXY)    : US Dollar Index        — Yahoo Finance DX-Y.NYB
- S&P500               : 시장 기준선            — Yahoo Finance ^GSPC
- NASDAQ               :                        — Yahoo Finance ^IXIC
- KOSPI                : 코스피                 — Yahoo Finance ^KS11
- KOSDAQ               : 코스닥                 — Yahoo Finance ^KQ11
- 금 선물 (GOLD)       : Gold Futures           — Yahoo Finance GC=F

실행: GitHub Actions 매일 04:00 KST 자동 실행 (update-nps.yml)
결과: public/data/market.json
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import yfinance as yf
except ImportError:
    print("[ERROR] yfinance 미설치. pip install yfinance 실행 후 재시도", file=sys.stderr)
    sys.exit(1)

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "market.json"
KST = timezone(timedelta(hours=9))


def fetch_series(symbol: str, period: str = "3mo", label: str = "") -> dict:
    """야후 파이낸스에서 종가 시계열 데이터 수집"""
    try:
        ticker = yf.Ticker(symbol)
        hist   = ticker.history(period=period, interval="1d")

        if hist.empty:
            print(f"  [WARN] {symbol}: 데이터 없음", file=sys.stderr)
            return {"series": [], "latest": None, "prev": None, "change": None, "change_pct": None}

        series = [
            {
                "date":  idx.strftime("%m/%d"),
                "value": round(float(row["Close"]), 2),
            }
            for idx, row in hist.iterrows()
            if str(row["Close"]) != "nan"
        ]

        if not series:
            return {"series": [], "latest": None, "prev": None, "change": None, "change_pct": None}

        latest = series[-1]["value"]
        prev   = series[-2]["value"] if len(series) >= 2 else latest
        change = round(latest - prev, 3)
        change_pct = round((change / prev) * 100, 2) if prev else 0

        lbl = label or symbol
        print(f"  ✓ {lbl:<14} {latest:>12,.2f}  {change_pct:+.2f}%  ({len(series)}일치)")
        return {
            "series":     series,
            "latest":     latest,
            "prev":       prev,
            "change":     change,
            "change_pct": change_pct,
        }

    except Exception as e:
        print(f"  [WARN] {symbol} 수집 실패: {e}", file=sys.stderr)
        return {"series": [], "latest": None, "prev": None, "change": None, "change_pct": None}


SYMBOLS = [
    # (key, symbol, period, label)
    ("vix",          "^VIX",      "1mo",  "VIX"),
    # 미국 금리 (Yahoo Finance)
    ("treasury_10y", "^TNX",      "3mo",  "US10Y"),   # 미 국채 10Y
    ("treasury_2y",  "^IRX",      "3mo",  "US3M"),    # 미 국채 3개월물 (단기금리)
    ("dxy",          "DX-Y.NYB",  "3mo",  "DXY"),
    ("spx",          "^GSPC",     "3mo",  "S&P500"),
    ("nasdaq",       "^IXIC",     "3mo",  "NASDAQ"),
    ("kospi",        "^KS11",     "3mo",  "KOSPI"),
    ("kosdaq",       "^KQ11",     "3mo",  "KOSDAQ"),
    ("gold",         "GC=F",      "3mo",  "GOLD"),
    # 한국 금리는 Yahoo Finance 미지원 → fetch_kr_rates.py (BOK ECOS) 별도 수집
]


def main():
    print("=" * 55)
    print("  시장 핵심 지표 수집 시작 (yfinance / Yahoo Finance)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    results = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(fetch_series, sym, period, label): key
            for key, sym, period, label in SYMBOLS
        }
        for future in as_completed(futures):
            key = futures[future]
            results[key] = future.result()

    # 저장
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": updated_at,
        "source":     "Yahoo Finance (yfinance) — 종가 기준",
        **results,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 55}")
    print(f"  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  업데이트: {updated_at}")
    print("=" * 55)


if __name__ == "__main__":
    main()
