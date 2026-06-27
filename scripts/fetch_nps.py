"""
국민연금 포트폴리오 데이터 수집 스크립트
- 출처: KIND(한국거래소 기업공시채널) 기관투자자 보유 현황 + 보조 소스
- 실행: GitHub Actions에서 매일 04:00 KST(UTC 19:00) 자동 실행
- 결과: public/data/nps.json 저장
"""

import json
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ─────────────────────────────────────────────
# 상수
# ─────────────────────────────────────────────
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "nps.json"
KST = timezone(timedelta(hours=9))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Referer": "https://finance.naver.com/",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


# ─────────────────────────────────────────────
# 방법 1: 네이버페이 증권 — 기관 순매수 TOP 종목
#   URL: https://finance.naver.com/sise/sise_quant.naver?sosok=0
#   국민연금 단독 필터는 어렵지만, 기관 전체 순매수 상위 종목을 수집
# ─────────────────────────────────────────────
def fetch_naver_inst_buying() -> list[dict]:
    """네이버 증권 기관 순매수 상위 종목 크롤링"""
    url = "https://finance.naver.com/sise/field_submit.naver"
    params = {
        "menu": "quant",
        "ranktype": "buy_inst_amt",   # 기관 순매수 금액
        "siseType": "P",
        "pageSize": "10",
        "page": "1",
        "sosok": "0",                 # 0=코스피, 1=코스닥
    }
    try:
        res = SESSION.get(url, params=params, timeout=10)
        res.raise_for_status()
        res.encoding = "euc-kr"
        soup = BeautifulSoup(res.text, "html.parser")

        stocks = []
        rows = soup.select("table.type_2 tbody tr")
        rank = 1
        for row in rows:
            cols = row.select("td")
            if len(cols) < 3:
                continue
            name = cols[1].get_text(strip=True)
            if not name or name == "종목명":
                continue
            # 기관순매수량 컬럼 (컬럼 인덱스는 레이아웃에 따라 다를 수 있음)
            try:
                amount_text = cols[7].get_text(strip=True).replace(",", "")
                amount = int(amount_text)
            except (ValueError, IndexError):
                amount = 0
            stocks.append({
                "rank": rank,
                "name": name,
                "raw_amount": amount,
            })
            rank += 1
            if rank > 10:
                break

        return stocks
    except Exception as e:
        print(f"[WARN] 네이버 기관순매수 크롤링 실패: {e}", file=sys.stderr)
        return []


# ─────────────────────────────────────────────
# 방법 2: 국민연금 공시 (KIND) — 5% 이상 보유 공시
#   https://kind.krx.co.kr/disclose/investinstholding.do
# ─────────────────────────────────────────────
def fetch_kind_nps() -> list[dict]:
    """KIND 기관투자자 보유 현황에서 국민연금 데이터 추출"""
    url = "https://kind.krx.co.kr/disclose/investinstholding.do"
    params = {
        "method": "searchInvestInstHoldingMain",
        "currentPageSize": "15",
        "pageIndex": "1",
        "investinstKind": "NPS",   # 국민연금
        "ord": "1",
    }
    try:
        res = SESSION.post(url, data=params, timeout=15)
        res.raise_for_status()
        res.encoding = "utf-8"
        soup = BeautifulSoup(res.text, "html.parser")

        stocks = []
        rows = soup.select("table tbody tr")
        rank = 1
        for row in rows:
            cols = row.select("td")
            if len(cols) < 5:
                continue
            name = cols[1].get_text(strip=True)
            ratio_text = cols[4].get_text(strip=True).replace("%", "").strip()
            try:
                ratio = float(ratio_text)
            except ValueError:
                ratio = 0.0
            if not name:
                continue
            stocks.append({
                "rank": rank,
                "name": name,
                "value": ratio,
                "change": 0.0,
                "amount": f"지분율 {ratio:.1f}%",
            })
            rank += 1
            if rank > 10:
                break
        return stocks
    except Exception as e:
        print(f"[WARN] KIND 국민연금 크롤링 실패: {e}", file=sys.stderr)
        return []


# ─────────────────────────────────────────────
# 방법 3: 에프앤가이드 국민연금 포트폴리오
#   https://www.fnguide.com  — 증권사 RI/기관 현황 페이지 참고
# ─────────────────────────────────────────────
def fetch_fnguide_nps() -> list[dict]:
    """FnGuide 국민연금 포트폴리오 크롤링 (공개 데이터)"""
    # FnGuide는 로그인 없이 일부 기관 데이터 제공
    url = "https://comp.fnguide.com/SVO2/ASP/portfolio_nps.asp"
    try:
        res = SESSION.get(url, timeout=12)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")

        stocks = []
        rows = soup.select("#grid1 tr, table.gTable tbody tr")
        rank = 1
        for row in rows:
            cols = row.select("td")
            if len(cols) < 3:
                continue
            name = cols[0].get_text(strip=True)
            if not name:
                continue
            try:
                ratio = float(cols[2].get_text(strip=True).replace("%", "").replace(",", ""))
            except ValueError:
                ratio = 0.0
            stocks.append({
                "rank": rank,
                "name": name,
                "value": round(ratio, 2),
                "change": 0.0,
                "amount": f"비중 {ratio:.1f}%",
            })
            rank += 1
            if rank > 10:
                break
        return stocks
    except Exception as e:
        print(f"[WARN] FnGuide NPS 크롤링 실패: {e}", file=sys.stderr)
        return []


# ─────────────────────────────────────────────
# 방법 4: 정적 fallback — 공개된 국민연금 포트폴리오 (분기 공시 기준)
#   국민연금이 5% 이상 보유한 종목은 분기마다 공시 의무가 있어
#   크롤링 전체 실패 시 최신 공시 기준 하드코딩 데이터를 사용
# ─────────────────────────────────────────────
FALLBACK_STOCKS = [
    {"rank": 1, "name": "삼성전자",         "value": 8.26, "change":  0.10, "amount": "5% 이상 보유 공시"},
    {"rank": 2, "name": "SK하이닉스",        "value": 6.94, "change":  0.30, "amount": "5% 이상 보유 공시"},
    {"rank": 3, "name": "LG에너지솔루션",    "value": 6.12, "change": -0.10, "amount": "5% 이상 보유 공시"},
    {"rank": 4, "name": "삼성바이오로직스",  "value": 5.80, "change":  0.05, "amount": "5% 이상 보유 공시"},
    {"rank": 5, "name": "현대차",            "value": 8.41, "change":  0.00, "amount": "5% 이상 보유 공시"},
    {"rank": 6, "name": "기아",              "value": 9.12, "change": -0.20, "amount": "5% 이상 보유 공시"},
    {"rank": 7, "name": "POSCO홀딩스",       "value": 9.67, "change":  0.15, "amount": "5% 이상 보유 공시"},
    {"rank": 8, "name": "KB금융",            "value": 9.23, "change":  0.10, "amount": "5% 이상 보유 공시"},
    {"rank": 9, "name": "신한지주",          "value": 8.44, "change":  0.00, "amount": "5% 이상 보유 공시"},
    {"rank":10, "name": "하나금융지주",      "value": 8.91, "change":  0.05, "amount": "5% 이상 보유 공시"},
]


# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
def main():
    print("=== 국민연금 포트폴리오 데이터 수집 시작 ===")
    now_kst = datetime.now(KST)
    updated_at = now_kst.strftime("%Y-%m-%d %H:%M KST")

    stocks = []

    # 1순위: KIND 공시 (국민연금 직접 필터)
    print("[1/3] KIND 기관투자자 현황 크롤링 시도...")
    stocks = fetch_kind_nps()
    if stocks:
        print(f"  ✓ KIND에서 {len(stocks)}개 종목 수집 완료")

    # 2순위: FnGuide
    if not stocks:
        print("[2/3] FnGuide NPS 데이터 크롤링 시도...")
        time.sleep(1)
        stocks = fetch_fnguide_nps()
        if stocks:
            print(f"  ✓ FnGuide에서 {len(stocks)}개 종목 수집 완료")

    # 3순위: 네이버 기관 순매수
    if not stocks:
        print("[3/3] 네이버 기관 순매수 크롤링 시도...")
        time.sleep(1)
        raw = fetch_naver_inst_buying()
        if raw:
            total = sum(s["raw_amount"] for s in raw) or 1
            for s in raw:
                s["value"] = round(s["raw_amount"] / total * 100, 2)
                s["change"] = 0.0
                s["amount"] = f"기관순매수 {s['raw_amount']:,}주"
            stocks = [{k: v for k, v in s.items() if k != "raw_amount"} for s in raw]
            print(f"  ✓ 네이버에서 {len(stocks)}개 종목 수집 완료")

    # 전체 실패 시 fallback
    if not stocks:
        print("[WARN] 모든 크롤링 실패 → fallback 데이터 사용")
        stocks = FALLBACK_STOCKS
        updated_at = f"{updated_at} [fallback]"

    # 출력 디렉토리 생성 및 JSON 저장
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "updated_at": updated_at,
        "source": "GitHub Actions auto-collect (scripts/fetch_nps.py)",
        "stocks": stocks,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print(f"   수집 종목 수: {len(stocks)}")
    print(f"   업데이트 시각: {updated_at}")


if __name__ == "__main__":
    main()
