"""
매크로 경제 지표 수집
- 하이일드 채권 스프레드 (HY OAS) : FRED BAMLH0A0HYM2        (API 키 불필요)
- 버핏 지수 (미국)                : World Bank CM.MKT.LCAP.GD.ZS (API 키 불필요)
- 투자자예탁금                    : 한국은행 ECOS 901Y056 / S23A  (BOK_API_KEY)
- 신용융자잔고                    : 사용 가능한 공개 소스 없음 (note 로 사유 기록)

출력: public/data/macro.json

환경변수: BOK_API_KEY (GitHub Secret, 투자자예탁금 수집 시 필요)

변경 이력 (2026-11-10 수정안)
  1) FRED CSV 헤더가 `DATE` → `observation_date` 로 바뀌어 파싱이 전부 실패하던 문제
     → 날짜 컬럼을 헤더 이름이 아니라 첫 번째 컬럼으로 읽도록 수정.
  2) FRED 가 Chrome UA 를 스로틀링해 read timeout 이 나던 문제
     → UA 위장 제거, 자기 식별 UA 사용 + 1회 재시도.
  3) FRED 가 Wilshire 지수를 2024-06-03 자로 전면 삭제(WILL5000INDFC 404)
     → 버핏 지수는 World Bank 시가총액/GDP 로 대체 (연간, 키 불필요).
  4) ECOS 통계표 064Y003 은 존재하지 않는 코드 (INFO-200)
     → 투자자예탁금은 실제 통계표 901Y056(증시주변자금동향, 금융투자협회 작성) 에서 수집.
  5) 신용융자잔고는 ECOS 미수록 → 빈 값 대신 note 로 사유를 남겨 위젯에서 안내할 수 있게 함.
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
WB_API    = "https://api.worldbank.org/v2/country/USA/indicator/CM.MKT.LCAP.GD.ZS"

# FRED 는 브라우저 UA 위장 요청을 느리게/차단하는 경향이 있어 자기 식별 UA 를 쓴다.
HEADERS = {
    "User-Agent": "HemStock/1.0 (+https://github.com/papavhub/HemStock)"
}


# ─── 공통 유틸 ──────────────────────────────────────────────────
def _empty() -> dict:
    return {"series": [], "latest": None, "prev": None,
            "change": None, "change_pct": None}


# ─── 1. FRED CSV (API 키 불필요) ────────────────────────────────
def fetch_fred(series_id: str, limit: int = 90) -> dict:
    """FRED 공개 CSV 엔드포인트 수집.

    FRED CSV 첫 줄은 `observation_date,<SERIES_ID>` 또는 `DATE,<SERIES_ID>` 로,
    시기에 따라 헤더 이름이 다르다. 헤더 이름에 의존하지 않고
    첫 컬럼=날짜, 두 번째 컬럼=값 으로 읽는다.
    """
    last_err = None
    for attempt in (1, 2):                      # 타임아웃 대비 1회 재시도
        try:
            res = requests.get(
                FRED_CSV,
                params={"id": series_id},
                headers=HEADERS,
                timeout=30,
            )
            res.raise_for_status()

            reader = csv.reader(io.StringIO(res.text))
            header = next(reader, None)
            if not header or len(header) < 2:
                print(f"  [WARN] FRED:{series_id} CSV 헤더 없음")
                return _empty()

            rows = []
            for row in reader:
                if len(row) < 2:
                    continue
                date_str = (row[0] or "").strip()
                val_str  = (row[1] or "").strip()
                if not date_str or val_str in (".", "", "NA"):
                    continue
                try:
                    rows.append({"date": date_str, "value": float(val_str)})
                except ValueError:
                    continue

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
                "full_series": rows_trimmed,     # 계산용 (저장 제외)
                "latest":      latest,
                "prev":        prev,
                "change":      change,
                "change_pct":  chg_pct,
            }
        except Exception as e:
            last_err = e
            if attempt == 1:
                continue
    print(f"  [WARN] FRED:{series_id} 실패: {last_err}")
    return _empty()


# ─── 2. 버핏 지수 (미국): 시가총액 / GDP ─────────────────────────
def fetch_buffett_worldbank(limit: int = 15) -> dict:
    """World Bank — Market capitalization of listed domestic companies (% of GDP), 미국.

    FRED 가 Wilshire 5000 지수를 2024-06-03 자로 삭제해 WILL5000INDFC/GDP 계산이 불가능해졌다.
    World Bank 지표는 연간(약 1년 지연)이지만 키 없이 실제 '시총/GDP' 비율을 준다.
    """
    try:
        res = requests.get(
            WB_API,
            params={"format": "json", "per_page": 40, "date": "1990:2026"},
            headers=HEADERS,
            timeout=30,
        )
        res.raise_for_status()
        data = res.json()
        if not isinstance(data, list) or len(data) < 2 or not isinstance(data[1], list):
            print("  [WARN] 버핏지수: World Bank 응답 형식 이상")
            return {**_empty(), "label": None, "source": None, "as_of": None}
    except Exception as e:
        print(f"  [WARN] 버핏지수(World Bank) 실패: {e}")
        return {**_empty(), "label": None, "source": None, "as_of": None}

    rows = []
    for item in data[1]:
        val = item.get("value")
        year = item.get("date")
        if val is None or not year:
            continue
        try:
            rows.append({"date": str(year), "value": round(float(val), 1)})
        except (TypeError, ValueError):
            continue

    if not rows:
        print("  [WARN] 버핏지수: 값 없음")
        return {**_empty(), "label": None, "source": None, "as_of": None}

    rows.sort(key=lambda r: r["date"])          # 오래된 → 최신
    series = rows[-limit:]
    latest = series[-1]["value"]
    prev   = series[-2]["value"] if len(series) >= 2 else latest

    label = (
        "극도 과열" if latest > 200 else
        "과열"     if latest > 160 else
        "고평가"   if latest > 120 else
        "적정"     if latest > 80  else
        "저평가"
    )

    print(f"  ✓ 버핏지수(US) {latest}% — {label}  ({series[-1]['date']}년)")
    return {
        "series":     series,
        "latest":     latest,
        "prev":       prev,
        "change":     round(latest - prev, 1),
        "change_pct": round((latest - prev) / prev * 100, 2) if prev else 0,
        "label":      label,
        "source":     "World Bank — 시가총액/GDP (연간)",
        "as_of":      series[-1]["date"],
    }


# ─── 3. BOK ECOS — 투자자예탁금 ─────────────────────────────────
def fetch_ecos_deposit() -> dict:
    """한국은행 ECOS 901Y056 '증시주변자금동향' 의 '투자자 예탁금'(ITEM_CODE S23A), 월별.

    기존 코드의 064Y003 은 존재하지 않는 통계표 코드였다(INFO-200).
    단위는 '원' → 조원으로 환산해 저장.
    """
    if not BOK_KEY:
        print("  [SKIP] BOK_API_KEY 없음 — 투자자예탁금 수집 건너뜀")
        return {**_empty(), "note": "BOK_API_KEY 미설정"}

    STAT = "901Y056"          # 1.5.1.4. 증시주변자금동향 (작성: 금융투자협회)

    # Step 1: 항목 코드 자동 탐색
    url = f"{ECOS_BASE}/StatisticItemList/{BOK_KEY}/json/kr/1/200/{STAT}"
    try:
        res  = requests.get(url, timeout=20)
        body = res.json()
    except Exception as e:
        print(f"  [WARN] ECOS 항목 목록 조회 실패: {e}")
        return {**_empty(), "note": "항목 목록 조회 실패"}

    if "RESULT" in body:
        print(f"  [WARN] ECOS 항목 목록 오류: {body['RESULT']}")
        return {**_empty(), "note": f"ECOS 오류 {body['RESULT'].get('CODE')}"}

    deposit_code = None
    seen = set()
    for row in body.get("StatisticItemList", {}).get("row", []):
        code = (row.get("ITEM_CODE") or "").strip()
        name = (row.get("ITEM_NAME") or "").strip()
        cycle = (row.get("CYCLE") or "").strip()
        if not code or not name or cycle != "M":     # 월별 항목만
            continue
        if code in seen:
            continue
        seen.add(code)
        print(f"    항목: [{code}] {name} ({cycle})")
        if "예탁금" in name and deposit_code is None:
            deposit_code = code

    if not deposit_code:
        print("  [WARN] 투자자예탁금 항목 코드 미발견")
        return {**_empty(), "note": "항목 코드 미발견"}

    # Step 2: 시계열 수집 (최근 2년, 월별)
    now_kst  = datetime.now(KST)
    end_ym   = now_kst.strftime("%Y%m")
    start_ym = (now_kst - timedelta(days=730)).strftime("%Y%m")
    url = (
        f"{ECOS_BASE}/StatisticSearch/{BOK_KEY}/json/kr"
        f"/1/40/{STAT}/MM/{start_ym}/{end_ym}/{deposit_code}"
    )
    try:
        body = requests.get(url, timeout=20).json()
    except Exception as e:
        print(f"  [WARN] 투자자예탁금 조회 실패: {e}")
        return {**_empty(), "note": "시계열 조회 실패"}

    if "RESULT" in body:
        print(f"  [WARN] 투자자예탁금 응답 오류: {body['RESULT']}")
        return {**_empty(), "note": f"ECOS 오류 {body['RESULT'].get('CODE')}"}

    series = []
    for row in body.get("StatisticSearch", {}).get("row", []):
        t = (row.get("TIME") or "").strip()             # YYYYMM
        v = (row.get("DATA_VALUE") or "").strip()
        if not t or not v:
            continue
        try:
            # 원 → 조원
            jo = round(float(v) / 1_000_000_000_000, 2)
        except ValueError:
            continue
        series.append({"date": f"{t[:4]}-{t[4:6]}", "value": jo})

    if not series:
        print("  [WARN] 투자자예탁금: 응답에 값 없음")
        return {**_empty(), "note": "응답에 값 없음"}

    latest = series[-1]["value"]
    prev   = series[-2]["value"] if len(series) >= 2 else latest
    print(f"  ✓ 투자자예탁금 {latest:.2f}조원 ({len(series)}건, {series[-1]['date']})")
    return {
        "series":     series,
        "latest":     latest,
        "prev":       prev,
        "change":     round(latest - prev, 2),
        "change_pct": round((latest - prev) / prev * 100, 2) if prev else 0,
    }


# ─── Main ────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  매크로 경제 지표 수집 (FRED + World Bank + BOK ECOS)")
    print("=" * 55)

    now_kst    = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    # ① 하이일드 채권 스프레드 (일별)
    print("\n  [1/3] ICE BofA HY OAS (FRED: BAMLH0A0HYM2) ...")
    hy = fetch_fred("BAMLH0A0HYM2", limit=90)

    # ② 버핏 지수 (연간)
    print("\n  [2/3] 버핏 지수 (World Bank: 시가총액/GDP) ...")
    buffett = fetch_buffett_worldbank()

    # ③ 투자자예탁금 (BOK ECOS)
    print("\n  [3/3] 투자자예탁금 (BOK ECOS: 901Y056) ...")
    deposit = fetch_ecos_deposit()

    # 신용융자잔고: ECOS 미수록, KRX API 차단(2026-06-28 커밋), KOFIA FreeSIS 는 값 마스킹으로
    # JSON 자체가 깨져 사용 불가 → 데이터 없이 사유만 남긴다.
    credit = {
        **_empty(),
        "note": ("신용융자잔고 공개 소스 없음 — "
                 "ECOS 미수록 / KRX 차단 / KOFIA FreeSIS 값 마스킹. "
                 "data.go.kr 금융투자협회종합통계정보(15094809) 키 필요"),
    }

    hy_save = {k: v for k, v in hy.items() if k != "full_series"}

    # 기존 macro.json 로드 (있으면 병합 — 다른 스크립트가 넣은 키 보존)
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
        "source":     "FRED (St. Louis Fed) + World Bank + 한국은행 ECOS",
        "hy_spread":  hy_save,
        "buffett_us": {k: v for k, v in buffett.items() if k != "full_series"},
        "deposit":    deposit,
        "credit":     credit,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"  ✅ 저장 완료: {OUTPUT_PATH}")
    print(f"  HY스프레드: {hy.get('latest')}%  | 버핏지수: {buffett.get('latest')}%")
    print(f"  예탁금: {deposit.get('latest')}조원 | 융자잔고: {credit.get('latest')}조원")
    print(f"  갱신: {updated_at}")
    print("=" * 55)


if __name__ == "__main__":
    main()
