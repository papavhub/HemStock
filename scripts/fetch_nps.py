"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
전략:
  1) corpCode.xml 다운로드 → 대상 종목 corp_code 매핑
  2) 각 종목 list.json (pblntf_detail_ty=I001: 주식대량보유상황보고) → 국민연금 공시 발견
  3) 최신 공시 document.json 다운로드 → XML 파싱 → 보유비율 추출
  4) 전부 실패 시 fallback

참고:
  - majorstock.json은 임원·주요주주(내부자) 소유보고용 → 국민연금에 해당 없음
  - 국민연금은 list.json I001 타입으로 공시, document에 보유비율 포함

환경변수: DART_API_KEY (GitHub Secret)
결과: public/data/nps.json
"""

import io
import json
import os
import re
import time
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "nps.json"
KST  = timezone(timedelta(hours=9))
KEY  = os.environ.get("DART_API_KEY", "").strip()

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; HemStock/1.0; +https://github.com/papavhub/HemStock)"}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

# 대상 종목 (DART 등록 공식 명칭으로 최대한 맞춤)
TARGET_NAMES = [
    "삼성전자", "SK하이닉스", "LG에너지솔루션", "삼성바이오로직스",
    "현대자동차", "기아", "POSCO홀딩스", "KB금융지주",
    "신한지주", "하나금융지주", "삼성물산", "삼성SDI",
    "현대모비스", "LG화학", "SK이노베이션", "카카오",
    "NAVER", "한국전력공사", "현대제철", "삼성전기",
    "KT", "SK텔레콤", "LG전자", "셀트리온",
    "삼성생명보험", "한화에어로스페이스", "두산에너빌리티",
    "SK", "LG", "KT&G", "고려아연",
    "현대중공업", "한국조선해양", "현대글로비스",
    "우리금융지주", "크래프톤", "카카오뱅크",
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


# ── Step 1: corpCode.xml 다운로드 → corp_code 매핑 ────────────────
def get_corp_code_map() -> dict[str, tuple[str, str]]:
    """DART corpCode.xml에서 대상 종목 corp_code 조회
    반환: {corp_name: (corp_code, dart_corp_name)}
    """
    print("  corpCode.xml 다운로드 중...")
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    res = SESSION.get(url, params={"crtfc_key": KEY}, timeout=60)
    res.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        fname = [n for n in z.namelist() if n.upper() == "CORPCODE.XML"][0]
        with z.open(fname) as f:
            tree = ET.parse(f)

    root   = tree.getroot()
    result = {}
    # 상장 종목만 (stock_code 있는 것)
    for item in root.findall("list"):
        code       = (item.findtext("corp_code") or "").strip()
        name       = (item.findtext("corp_name") or "").strip()
        stock_code = (item.findtext("stock_code") or "").strip()
        if not code or not name or not stock_code:
            continue
        for target in TARGET_NAMES:
            if target == name or target in name or name in target:
                if target not in result:
                    result[target] = (code, name)

    found = [f"{t}→{v[1]}({v[0]})" for t, v in result.items()]
    print(f"  corp_code 매핑: {len(result)}/{len(TARGET_NAMES)}종목")
    for f in found:
        print(f"    {f}")
    return result


# ── Step 2: 종목별 국민연금 I001 공시 목록 ──────────────────────────
def get_nps_filings(corp_code: str) -> list[dict]:
    """list.json — 특정 종목의 국민연금 대량보유상황보고 목록"""
    url    = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key":        KEY,
        "corp_code":        corp_code,
        "pblntf_detail_ty": "I001",  # 주식대량보유상황보고
        "page_no":          "1",
        "page_count":       "20",
    }
    res  = SESSION.get(url, params=params, timeout=10)
    data = res.json()
    if data.get("status") not in ("000",):
        return []
    items = data.get("list", [])
    # 제출자(flr_nm)에 국민연금 포함
    nps = [i for i in items if "국민연금" in i.get("flr_nm", "")]
    return sorted(nps, key=lambda x: x.get("rcept_dt", ""), reverse=True)


# ── Step 3: 공시 원본 파싱 → 보유비율 추출 ──────────────────────────
def parse_ratio_from_doc(rcept_no: str) -> float | None:
    """document.json → ZIP → XML 파싱 → 보유비율(%) 추출"""
    url  = "https://opendart.fss.or.kr/api/document.json"
    res  = SESSION.get(url, params={"crtfc_key": KEY, "rcept_no": rcept_no}, timeout=20)
    res.raise_for_status()

    try:
        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_files = [n for n in z.namelist() if n.lower().endswith(".xml")]
            for fname in xml_files:
                with z.open(fname) as f:
                    text = f.read().decode("utf-8", errors="ignore")

                # 패턴 1: XML 태그 <holdRto> 또는 <bndtRto>
                for tag in ("holdRto", "bndtRto", "posesnStockRto", "hold_rto"):
                    m = re.search(rf"<{tag}[^>]*>\s*([0-9]+\.[0-9]+)\s*</{tag}>", text)
                    if m:
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

                # 패턴 2: "보유비율" 텍스트 근처 숫자
                for pat in [
                    r"보유\s*비율[^0-9]{0,20}([0-9]+\.[0-9]{1,4})",
                    r"지분율[^0-9]{0,10}([0-9]+\.[0-9]{1,4})",
                ]:
                    for m in re.finditer(pat, text):
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v
    except Exception as e:
        print(f"      [WARN] 문서 파싱 실패 ({rcept_no}): {e}")

    return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수가 비어 있습니다.")
        return []

    print(f"  API 키 확인: {'*' * 8}{KEY[-4:]} (마지막 4자리)")

    # Step 1: corp_code 매핑
    try:
        code_map = get_corp_code_map()
    except Exception as e:
        print(f"  [ERROR] corpCode.xml 다운로드 실패: {e}")
        return []

    if not code_map:
        print("  [ERROR] corp_code 매핑 결과 없음")
        return []

    # Step 2~3: 종목별 국민연금 공시 조회 + 보유비율 파싱
    stocks = []
    print(f"\n  국민연금 대량보유 공시 조회 ({len(code_map)}종목)...")
    for target_name, (corp_code, dart_name) in code_map.items():
        try:
            filings = get_nps_filings(corp_code)
            if not filings:
                continue

            latest  = filings[0]
            rcept_no = latest.get("rcept_no", "")
            rcept_dt = latest.get("rcept_dt", "")

            # 보유비율 파싱
            ratio = parse_ratio_from_doc(rcept_no) if rcept_no else None
            if ratio is None:
                print(f"  - {dart_name:<20} 공시 있으나 비율 파싱 실패 (rcept_no={rcept_no})")
                continue

            # 이전 공시 비율로 변동 계산
            prev_ratio = ratio
            if len(filings) >= 2:
                prev_ratio = parse_ratio_from_doc(filings[1].get("rcept_no", "")) or ratio

            change = round(ratio - prev_ratio, 2)
            dt     = rcept_dt  # 이미 YYYY-MM-DD or YYYYMMDD 형식
            if len(dt) == 8:
                dt = f"{dt[:4]}-{dt[4:6]}-{dt[6:]}"

            stocks.append({
                "name":     dart_name,
                "value":    round(ratio, 2),
                "change":   change,
                "amount":   f"지분율 {ratio:.2f}%",
                "rcept_dt": dt,
            })
            print(f"  ✓ {dart_name:<20} {ratio:.2f}%  변동 {change:+.2f}%  ({dt})")

        except Exception as e:
            print(f"  [ERROR] {dart_name}: {e}")

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
        source = "금감원 DART OpenAPI — 주식대량보유상황보고(I001) 원본 파싱 (국민연금 최신 공시 기준)"
    else:
        print("\n  ⚠ DART 수집 실패 → fallback 데이터 사용")
        stocks     = FALLBACK
        source     = "fallback — 과거 공시 기준 하드코딩 (DART 수집 실패)"
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
