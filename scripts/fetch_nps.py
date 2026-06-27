"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
전략:
  KOSPI 주요 50종목 corp_code를 직접 지정 → majorstock.json 호출
  → 국민연금(repror 필드)이 5%↑ 보유한 종목만 추출
  → 전부 실패 시 fallback (하드코딩)

환경변수: DART_API_KEY (GitHub Secret)
결과: public/data/nps.json
"""

import json
import os
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

# KOSPI 주요 종목 DART corp_code (시가총액 상위 50개)
KOSPI_CORPS = [
    ("00126380", "삼성전자"),
    ("00164779", "SK하이닉스"),
    ("00401731", "LG에너지솔루션"),
    ("00739422", "삼성바이오로직스"),
    ("00164742", "현대차"),
    ("00164588", "기아"),
    ("00430964", "POSCO홀딩스"),
    ("00204254", "KB금융"),
    ("00222757", "신한지주"),
    ("00229613", "하나금융지주"),
    ("00581614", "우리금융지주"),
    ("00113573", "삼성물산"),
    ("00126186", "삼성SDI"),
    ("00164050", "현대모비스"),
    ("00117617", "LG화학"),
    ("00160416", "SK이노베이션"),
    ("00277423", "카카오"),
    ("00293886", "NAVER"),
    ("00138321", "두산에너빌리티"),
    ("00120182", "고려아연"),
    ("00109872", "한국전력"),
    ("00164956", "현대제철"),
    ("00126439", "삼성전기"),
    ("00105262", "KT"),
    ("00104711", "SK텔레콤"),
    ("00144346", "LG전자"),
    ("00104781", "포스코"),
    ("00108897", "한화에어로스페이스"),
    ("00500032", "셀트리온"),
    ("00547583", "카카오뱅크"),
    ("00221905", "삼성생명"),
    ("00150577", "한국조선해양"),
    ("00154587", "현대중공업"),
    ("00178902", "현대글로비스"),
    ("00114467", "S-Oil"),
    ("00160715", "SK"),
    ("00110776", "LG"),
    ("00113177", "롯데케미칼"),
    ("00104830", "KT&G"),
    ("00259960", "HMM"),
    ("00124534", "한미약품"),
    ("00133427", "유한양행"),
    ("00105088", "농심"),
    ("00105666", "오리온"),
    ("00142429", "아모레퍼시픽"),
    ("00344672", "크래프톤"),
    ("00296747", "카카오페이"),
    ("00179024", "한진칼"),
    ("00113028", "대한항공"),
    ("00187939", "삼성중공업"),
]

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


def get_hold_ratio(corp_code: str, corp_name: str):
    """DART majorstock.json — 특정 종목 국민연금 보유 비율 조회"""
    url    = "https://opendart.fss.or.kr/api/majorstock.json"
    params = {"crtfc_key": KEY, "corp_code": corp_code}
    try:
        res  = SESSION.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()

        if data.get("status") != "000":
            # 010 = 데이터 없음 (정상적으로 공시 없는 종목) — 로그 생략
            if data.get("status") != "010":
                print(f"    [{corp_name}] status={data.get('status')} {data.get('message')}")
            return None

        items     = data.get("list", [])
        nps_items = [i for i in items if "국민연금" in i.get("repror", "")]
        if not nps_items:
            return None

        latest    = sorted(nps_items, key=lambda x: x.get("rcept_dt", ""), reverse=True)[0]
        ratio     = float(latest.get("hold_ratio") or 0)
        if ratio < 5.0:
            return None  # 5% 미만은 대량보유 아님

        prev_items = [i for i in nps_items if i["rcept_dt"] < latest["rcept_dt"]]
        prev_ratio = float(prev_items[0].get("hold_ratio") or ratio) if prev_items else ratio
        change     = round(ratio - prev_ratio, 2)

        dt = latest.get("rcept_dt", "")
        return {
            "name":     corp_name,
            "value":    round(ratio, 2),
            "change":   change,
            "amount":   f"지분율 {ratio:.2f}%",
            "rcept_dt": f"{dt[:4]}-{dt[4:6]}-{dt[6:]}" if len(dt) == 8 else dt,
        }
    except Exception as e:
        print(f"    [{corp_name}] 오류: {e}")
        return None


def fetch_all():
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수가 비어 있습니다.")
        return []

    print(f"  API 키 확인: {'*' * 8}{KEY[-4:]} (마지막 4자리)")
    print(f"  조회 대상: KOSPI 주요 {len(KOSPI_CORPS)}종목 → majorstock.json")

    stocks = []
    for i, (corp_code, corp_name) in enumerate(KOSPI_CORPS, 1):
        result = get_hold_ratio(corp_code, corp_name)
        if result:
            stocks.append(result)
            print(f"  ✓ {corp_name:<18} {result['value']:.2f}%  변동 {result['change']:+.2f}%  ({result['rcept_dt']})")
        if i % 10 == 0:
            print(f"  ... {i}/{len(KOSPI_CORPS)} 진행 중")
        time.sleep(0.15)  # API 속도 제한 방지

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
        source = "금감원 DART OpenAPI — majorstock.json (5%↑ 대량보유, 최신 공시 기준)"
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
