"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI
전략:
  1) corpCode.xml 다운로드 → 대상 종목 corp_code 정확 매핑 (exact match only)
  2) 각 종목 list.json (pblntf_detail_ty=I001: 주식대량보유상황보고) → 국민연금 공시 발견
  3) 최신 공시 document.json → XML 파싱 → 보유비율 추출
  4) 전부 실패 시 fallback

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

# DART corpCode.xml 에서 확인된 정확한 이름 → corp_code 매핑
# 이전 실행 로그에서 추출 + 추가 검증
DART_CORPS = {
    "삼성전자":           "00126380",
    "삼성SDI":            "00126362",
    "삼성전기":           "00126371",
    "삼성물산":           "00126229",
    "삼성바이오로직스":   "00877059",
    "삼성생명":           "00126256",
    "기아":               "00106641",
    "현대자동차":         "00164742",
    "현대모비스":         "00164760",
    "현대제철":           "00145880",
    "현대글로비스":       "00360595",
    "POSCO홀딩스":        "00155319",
    "KB금융":             "00688996",
    "신한지주":           "00382199",
    "하나금융지주":       "00547583",
    "우리금융지주":       "00375302",
    "한화에어로스페이스": "00126566",
    "두산에너빌리티":     "00159616",
    "한국전력공사":       "00159193",
    "고려아연":           "00102858",
    "크래프톤":           "00760971",
    "NAVER":              "00266961",
    "HD한국조선해양":     "00164830",
    "HD현대중공업":       "01390344",
    # corpCode.xml 에서 exact name 조회 필요 (아래 EXTRA_NAMES에 추가)
}

# corpCode.xml에서 exact 조회할 추가 종목 (DART 등록명 후보)
EXTRA_NAMES = [
    "SK하이닉스",
    "LG에너지솔루션",
    "LG화학",
    "LG전자",
    "LG",              # 지주사 LG(주)
    "카카오",
    "KT",
    "SK텔레콤",
    "SK이노베이션",
    "셀트리온",
    "카카오뱅크",
    "삼성생명보험",    # 삼성생명 대체 후보
    "KB금융지주",      # KB금융 대체 후보
    "SK",              # SK(주)
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


# ── Step 1: corpCode.xml에서 추가 종목 exact 조회 ─────────────────
def enrich_corp_codes(base: dict) -> dict:
    """corpCode.xml 다운로드 후 EXTRA_NAMES를 exact match로 추가"""
    print("  corpCode.xml 다운로드 중...")
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    res = SESSION.get(url, params={"crtfc_key": KEY}, timeout=60)
    res.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        fname = [n for n in z.namelist() if "CORPCODE" in n.upper()][0]
        with z.open(fname) as f:
            tree = ET.parse(f)

    result = dict(base)  # 하드코딩된 것 먼저
    root   = tree.getroot()

    # exact match only
    for item in root.findall("list"):
        code       = (item.findtext("corp_code") or "").strip()
        name       = (item.findtext("corp_name") or "").strip()
        stock_code = (item.findtext("stock_code") or "").strip()
        if not code or not name or not stock_code:
            continue
        if name in EXTRA_NAMES and name not in result:
            result[name] = code
            print(f"    추가 매핑: {name} → {code}")

    print(f"  총 매핑: {len(result)}종목")
    return result


# ── Step 2: 종목별 국민연금 I001 공시 목록 조회 ───────────────────
def get_nps_filings(corp_code: str, corp_name: str) -> list[dict]:
    """list.json — 특정 종목의 주식대량보유상황보고 중 국민연금 공시"""
    url    = "https://opendart.fss.or.kr/api/list.json"
    params = {
        "crtfc_key":  KEY,
        "corp_code":  corp_code,
        "page_no":    "1",
        "page_count": "100",   # 유형 필터 없이 최대 조회 후 client-side 필터
    }
    res  = SESSION.get(url, params=params, timeout=10)
    data = res.json()
    status = data.get("status")

    if status not in ("000", "013"):
        print(f"  [WARN] list.json {corp_name}: status={status} {data.get('message')}")

    items = data.get("list", [])

    # 디버그: 삼성전자는 모든 공시 유형 출력 (어떤 pblntf_detail_ty가 대량보유인지 확인)
    if corp_code == "00126380":
        print(f"  [DEBUG 삼성전자] 전체 공시 {len(items)}건 (total={data.get('total_count',0)}):")
        for it in items[:15]:
            print(f"    flr_nm={repr(it.get('flr_nm',''))[:20]}  ty={it.get('pblntf_detail_ty','')}  report_nm={it.get('report_nm','')[:35]}")

    # 국민연금 + 대량보유 관련 공시만 필터
    nps = [i for i in items if "국민연금" in i.get("flr_nm", "")
           or "국민연금" in i.get("report_nm", "")]
    return sorted(nps, key=lambda x: x.get("rcept_dt", ""), reverse=True)


# ── Step 3: 공시 원본 XML 파싱 → 보유비율 추출 ──────────────────────
def parse_ratio_from_doc(rcept_no: str, corp_name: str) -> float | None:
    """document.json → ZIP → XML → 보유비율(%) 추출"""
    url = "https://opendart.fss.or.kr/api/document.json"
    try:
        res = SESSION.get(url, params={"crtfc_key": KEY, "rcept_no": rcept_no}, timeout=20)
        res.raise_for_status()

        with zipfile.ZipFile(io.BytesIO(res.content)) as z:
            xml_files = [n for n in z.namelist() if n.lower().endswith(".xml")]
            for fname in xml_files:
                with z.open(fname) as f:
                    text = f.read().decode("utf-8", errors="ignore")

                # 패턴 1: XML 태그 형태
                for tag in ("holdRto", "bndtRto", "posesnStockRto", "hold_rto", "stkqy_irds_irds"):
                    m = re.search(rf"<{tag}[^>]*>\s*([0-9]+\.[0-9]+)\s*</{tag}>", text, re.I)
                    if m:
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

                # 패턴 2: "보유비율" 텍스트 근처 숫자
                for pat in [
                    r"보유\s*비율[^0-9<]{0,30}([0-9]+\.[0-9]{1,4})",
                    r"지분율[^0-9<]{0,15}([0-9]+\.[0-9]{1,4})",
                ]:
                    for m in re.finditer(pat, text):
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

    except Exception as e:
        print(f"    [WARN] 문서 파싱 실패 {corp_name} ({rcept_no}): {e}")
    return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수가 비어 있습니다.")
        return []
    print(f"  API 키 확인: {'*' * 8}{KEY[-4:]} (마지막 4자리)")

    try:
        corp_map = enrich_corp_codes(DART_CORPS)
    except Exception as e:
        print(f"  [ERROR] corpCode.xml 실패: {e}")
        print("  하드코딩된 corp_code만 사용합니다.")
        corp_map = dict(DART_CORPS)

    stocks = []
    print(f"\n  국민연금 대량보유 공시 조회 ({len(corp_map)}종목)...")

    for corp_name, corp_code in corp_map.items():
        try:
            filings = get_nps_filings(corp_code, corp_name)
            if not filings:
                continue

            latest   = filings[0]
            rcept_no = latest.get("rcept_no", "")
            rcept_dt = latest.get("rcept_dt", "")

            ratio = parse_ratio_from_doc(rcept_no, corp_name) if rcept_no else None
            if ratio is None:
                print(f"  - {corp_name:<22} 공시 있으나 비율 파싱 실패")
                continue

            prev_ratio = ratio
            if len(filings) >= 2:
                prev_ratio = parse_ratio_from_doc(filings[1].get("rcept_no", ""), corp_name) or ratio

            change = round(ratio - prev_ratio, 2)
            if len(rcept_dt) == 8:
                rcept_dt = f"{rcept_dt[:4]}-{rcept_dt[4:6]}-{rcept_dt[6:]}"

            stocks.append({
                "name":     corp_name,
                "value":    round(ratio, 2),
                "change":   change,
                "amount":   f"지분율 {ratio:.2f}%",
                "rcept_dt": rcept_dt,
            })
            print(f"  ✓ {corp_name:<22} {ratio:.2f}%  변동 {change:+.2f}%  ({rcept_dt})")

        except Exception as e:
            print(f"  [ERROR] {corp_name}: {e}")

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
        source = "금감원 DART OpenAPI — 주식대량보유상황보고(I001) 원본 파싱 (국민연금 최신 공시)"
    else:
        print("\n  ⚠ DART 수집 실패 → fallback 데이터 사용")
        stocks     = FALLBACK
        source     = "fallback — 과거 공시 기준 하드코딩"
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
