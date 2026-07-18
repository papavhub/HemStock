"""
시장 건강 상태 — 신고가·신저가 비율 수집
- yfinance로 KOSPI 주요 종목(top 80) 가격 데이터 수집
- 당일 종가가 52주 고가의 98% 이상 → 신고가 카운트
- 당일 종가가 52주 저가의 102% 이하 → 신저가 카운트
- 결과: public/data/breadth.json
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("[ERROR] yfinance / pandas 미설치", file=sys.stderr)
    sys.exit(1)

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "breadth.json"
KST = timezone(timedelta(hours=9))

# KOSPI 주요 종목 Yahoo Finance 티커 (상위 80개)
KOSPI_TICKERS = [
    "005930.KS","000660.KS","373220.KS","207940.KS","005380.KS",
    "000270.KS","068270.KS","105560.KS","055550.KS","086790.KS",
    "035420.KS","035720.KS","247540.KS","051910.KS","006400.KS",
    "028260.KS","009150.KS","096770.KS","003670.KS","017670.KS",
    "012330.KS","066570.KS","011200.KS","034730.KS","010950.KS",
    "032830.KS","316140.KS","009540.KS","042660.KS","024110.KS",
    "011790.KS","000720.KS","010130.KS","003490.KS","015760.KS",
    "030200.KS","018260.KS","139480.KS","033780.KS","002790.KS",
    "008770.KS","011170.KS","009830.KS","000810.KS","079550.KS",
    "010140.KS","078930.KS","003550.KS","023530.KS","011780.KS",
    "021240.KS","000100.KS","002380.KS","004020.KS","005940.KS",
    "000880.KS","271560.KS","006800.KS","088350.KS","090430.KS",
    "014820.KS","032640.KS","004990.KS","000210.KS","006110.KS",
    "004170.KS","007070.KS","002350.KS","007310.KS","051600.KS",
    "002310.KS","004800.KS","014680.KS","008930.KS","004140.KS",
    "001040.KS","003830.KS","010060.KS","001800.KS","005300.KS",
]


def get_snapshot(tickers: list[str]) -> tuple[int, int, int]:
    """한 번에 전체 종목 데이터 수집 → (highs, lows, total)"""
    highs = 0
    lows  = 0
    ok    = 0

    # yfinance 배치 다운로드 (속도 최적화)
    raw = yf.download(
        tickers,
        period="1y",
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    for ticker in tickers:
        try:
            if len(tickers) == 1:
                closes = raw["Close"]
            else:
                closes = raw[ticker]["Close"]

            closes = closes.dropna()
            if len(closes) < 20:
                continue

            current   = float(closes.iloc[-1])
            year_high = float(closes.max())
            year_low  = float(closes.min())

            ok += 1
            if current >= year_high * 0.97:   # 52주 고가의 97% 이상
                highs += 1
            elif current <= year_low * 1.03:  # 52주 저가의 103% 이하
                lows += 1

        except Exception:
            pass

    return highs, lows, ok


def get_recent_series(days: int = 6) -> list[dict]:
    """최근 N 영업일의 신고가·신저가 추이 (단일 종목 샘플링으로 날짜 추출)"""
    try:
        spy = yf.Ticker("005930.KS").history(period="2mo", interval="1d")
        dates = [d.strftime("%m/%d") for d in spy.index[-days:]]
        return dates
    except Exception:
        return []


def compute_adr_series(raw, tickers: list[str], days: int = 60) -> list[dict]:
    """
    일별 등락비율(ADR) MA10 시계열 계산
    ADR = MA10(상승종목수) / MA10(하락종목수) × 100
    - 75 이하 : 과매도 (바닥 탐색)
    - 75 ~ 120: 중립
    - 120 이상 : 과매수 (과열)
    """
    # 종목별 종가 DataFrame 구성
    close_dict = {}
    for ticker in tickers:
        try:
            closes = raw[ticker]["Close"] if len(tickers) > 1 else raw["Close"]
            closes = closes.dropna()
            if len(closes) >= 20:
                close_dict[ticker] = closes
        except Exception:
            pass

    if not close_dict:
        return []

    df  = pd.DataFrame(close_dict)
    ret = df.pct_change()

    adv_daily = (ret > 0.001).astype(int).sum(axis=1)   # 0.1% 이상 상승
    dec_daily = (ret < -0.001).astype(int).sum(axis=1)  # 0.1% 이상 하락

    # 10일 이동평균
    adv_ma10 = adv_daily.rolling(10, min_periods=5).mean()
    dec_ma10 = dec_daily.rolling(10, min_periods=5).mean()

    result = []
    for idx in df.index[-days:]:
        a = adv_ma10.get(idx)
        d = dec_ma10.get(idx)
        if pd.isna(a) or pd.isna(d) or d == 0:
            continue
        adr = round(float(a) / float(d) * 100, 1)
        adr = min(adr, 300.0)   # 이상치 클리핑
        result.append({
            "date": idx.strftime("%m/%d"),
            "adr":  adr,
            "adv":  int(adv_daily.get(idx, 0)),
            "dec":  int(dec_daily.get(idx, 0)),
        })

    return result


def main():
    print("=" * 55)
    print("  시장 건강 지표 수집 (yfinance — KOSPI 주요주)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")
    today_str  = now_kst.strftime("%m/%d")

    print(f"\n  대상 종목: {len(KOSPI_TICKERS)}개 / 기준: 52주 신고가·신저가")
    print("  데이터 다운로드 중 (약 30~60초)...")

    # ① 신고가·신저가 스냅샷 계산 (기존)
    highs, lows, total = get_snapshot(KOSPI_TICKERS)
    ratio = round(highs / (highs + lows) * 100, 1) if (highs + lows) > 0 else 0.0
    print(f"  ✓ 신고가·신저가: {total}종목 | 고가 {highs}개 | 저가 {lows}개 | 비율 {ratio:.1f}%")

    # ② ADR(등락비율) 시계열 계산 (신규)
    print("  ADR 시계열 계산 중...")
    raw_data = yf.download(
        KOSPI_TICKERS,
        period="6mo",
        interval="1d",
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )
    adr_series = compute_adr_series(raw_data, KOSPI_TICKERS, days=60)
    adr_latest = adr_series[-1]["adr"] if adr_series else None
    print(f"  ✓ ADR MA10 최신: {adr_latest}  ({len(adr_series)}일치)")

    # 신고가·신저가 시계열 (누적)
    existing_series = []
    existing_adr    = []
    if OUTPUT_PATH.exists():
        try:
            old = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
            existing_series = old.get("series", [])[-29:]
            existing_adr    = old.get("adr_series", [])
        except Exception:
            pass

    today_point = {"date": today_str, "highs": highs, "lows": lows}
    if existing_series and existing_series[-1]["date"] == today_str:
        existing_series[-1] = today_point
    else:
        existing_series.append(today_point)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": updated_at,
        "source":     f"Yahoo Finance (yfinance) — KOSPI 주요주 {len(KOSPI_TICKERS)}종목 기준",
        "latest":     {"highs": highs, "lows": lows, "ratio": ratio, "total": total},
        "series":     existing_series,
        "adr_series": adr_series,                     # 60일 ADR MA10 시계열
        "adr_latest": {
            "value":    adr_latest,
            "adv":      adr_series[-1]["adv"]  if adr_series else None,
            "dec":      adr_series[-1]["dec"]  if adr_series else None,
        },
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  신고가 비율: {ratio:.1f}%  ADR: {adr_latest}")


if __name__ == "__main__":
    main()
