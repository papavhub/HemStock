"""
국민연금 포트폴리오 수집 — 금감원 DART OpenAPI + 공시 뷰어
전략:
  1) corpCode.xml → 대상 종목 corp_code 매핑 (exact match)
  2) list.json (D001: 주식대량보유상황보고) → 국민연금 공시 발견
  3) dart.fss.or.kr 뷰어 HTML 스크래핑 → 보유비율 추출
     (document.json API는 D001 타입에서 101 오류 발생하여 우회)
  4) 실패 시 빈 목록 반환 (fallback 목 데이터 사용 안 함)

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
from bs4 import BeautifulSoup

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "data" / "nps.json"
KST  = timezone(timedelta(hours=9))
KEY  = os.environ.get("DART_API_KEY", "").strip()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://dart.fss.or.kr/",
}
SESSION = requests.Session()
SESSION.headers.update(HEADERS)

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
}

EXTRA_NAMES = [
    "SK하이닉스", "LG에너지솔루션", "LG화학", "LG전자", "LG",
    "카카오", "KT", "SK텔레콤", "SK이노베이션", "셀트리온",
    "카카오뱅크", "SK",
]


# ── Step 1: corpCode.xml에서 추가 종목 매핑 ─────────────────────
def enrich_corp_codes(base: dict) -> dict:
    print("  corpCode.xml 다운로드 중...")
    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    res = SESSION.get(url, params={"crtfc_key": KEY}, timeout=60)
    res.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        fname = [n for n in z.namelist() if "CORPCODE" in n.upper()][0]
        with z.open(fname) as f:
            tree = ET.parse(f)

    result = dict(base)
    for item in tree.getroot().findall("list"):
        code       = (item.findtext("corp_code") or "").strip()
        name       = (item.findtext("corp_name") or "").strip()
        stock_code = (item.findtext("stock_code") or "").strip()
        if code and name and stock_code and name in EXTRA_NAMES and name not in result:
            result[name] = code
            print(f"    추가 매핑: {name} → {code}")

    print(f"  총 매핑: {len(result)}종목")
    return result


# ── Step 2: 종목별 국민연금 D001 공시 목록 ───────────────────────
def get_nps_filings(corp_code: str) -> list[dict]:
    now    = datetime.now(KST)
    end_de = now.strftime("%Y%m%d")
    bgn_de = (now - timedelta(days=365)).strftime("%Y%m%d")

    params = {
        "crtfc_key":        KEY,
        "corp_code":        corp_code,
        "pblntf_detail_ty": "D001",
        "bgn_de":           bgn_de,
        "end_de":           end_de,
        "page_no":          "1",
        "page_count":       "20",
    }
    res  = SESSION.get("https://opendart.fss.or.kr/api/list.json", params=params, timeout=10)
    data = res.json()
    if data.get("status") not in ("000", "013"):
        return []
    items = data.get("list", [])
    nps   = [i for i in items if "국민연금" in i.get("flr_nm", "")]
    return sorted(nps, key=lambda x: x.get("rcept_dt", ""), reverse=True)


# ── Step 3: DART 뷰어 HTML → 보유비율 추출 ──────────────────────
def extract_ratio(text: str):
    """HTML 테이블에서 보유비율 추출 — BeautifulSoup 우선, 날짜 오탐 방지"""
    soup = BeautifulSoup(text, "html.parser")

    # ① 테이블 셀에서 "보유비율" 또는 "지분율" 텍스트를 찾고 인접 셀 값 파싱
    keywords = ("보유비율", "보유 비율", "지분율", "보유주식비율")
    for cell in soup.find_all(["td", "th"]):
        cell_txt = cell.get_text(strip=True).replace(" ", "")
        if any(kw.replace(" ", "") in cell_txt for kw in keywords):
            # 다음 td 또는 다음다음 td에서 숫자 추출
            for sibling in [cell.find_next_sibling("td"),
                            cell.find_next("td")]:
                if sibling is None:
                    continue
                raw = sibling.get_text(strip=True).replace(",", "").replace("%", "").replace("％", "").strip()
                try:
                    v = float(raw)
                    if 5.0 <= v <= 25.0:
                        return v
                except ValueError:
                    # 숫자만 추출
                    m = re.search(r"([0-9]+\.[0-9]{1,4})", raw)
                    if m:
                        v = float(m.group(1))
                        if 5.0 <= v <= 25.0:
                            return v

    # ② XML 태그 형태 (XBRL)
    for tag in ("holdRto", "bndtRto", "posesnStockRto"):
        m = re.search(rf"<{tag}[^>]*>\s*([0-9]+\.[0-9]+)\s*</{tag}>", text, re.I)
        if m:
            v = float(m.group(1))
            if 5.0 <= v <= 25.0:
                return v

    # ③ "보유비율" 뒤에 바로 % 붙은 패턴 — 날짜 오탐 방지 위해 % 필수
    m = re.search(r"보유\s*비율[^0-9<]{0,60}([0-9]+\.[0-9]{1,4})\s*(?:%|％)", text)
    if m:
        v = float(m.group(1))
        if 5.0 <= v <= 25.0:
            return v

    return None  # 날짜 오탐 방지: catch-all 패턴 제거


def get_dart_doc_parts(rcept_no: str) -> list[dict]:
    """DART 내부 API로 문서 파트 목록(dtd/offset/length 등) 조회"""
    # DART가 뷰어 JS에서 호출하는 내부 엔드포인트들 시도
    endpoints = [
        ("GET",  f"https://dart.fss.or.kr/dsaf001/selectSoliConct.do?rcpNo={rcept_no}"),
        ("POST", "https://dart.fss.or.kr/dsaf001/selectRprtFrmList.do",   {"rcpNo": rcept_no}),
        ("POST", "https://dart.fss.or.kr/dsaf001/selectToListTemp.do",    {"rcpNo": rcept_no}),
        ("GET",  f"https://dart.fss.or.kr/dsaf001/selectRprtFrmData.do?rcpNo={rcept_no}"),
    ]
    for method, url, *payload in endpoints:
        try:
            if method == "POST":
                r = SESSION.post(url, data=payload[0] if payload else {}, timeout=8)
            else:
                r = SESSION.get(url, timeout=8)
            if r.status_code == 200 and r.text.strip():
                return [{"url": url, "content": r.text[:300]}]
        except Exception:
            pass
    return []


def parse_ratio_from_viewer(rcept_no: str, corp_name: str):
    """DART 공시 문서에서 보유비율 추출 (여러 경로 시도)"""
    try:
        # 경로 1: DART 내부 API로 실제 문서 URL 탐색
        if corp_name == "KB금융":
            parts = get_dart_doc_parts(rcept_no)
            print(f"  [DEBUG KB금융] doc parts 시도 결과:")
            for p in parts:
                print(f"    url={p['url']}")
                print(f"    content={repr(p['content'])}")

        # 경로 2: DART 공시 원문 다운로드 URL 패턴들
        candidate_urls = [
            # opendart API (다른 파라미터명 시도)
            f"https://opendart.fss.or.kr/api/document.json?crtfc_key={KEY}&rcpNo={rcept_no}",
            # dart.fss.or.kr 직접 뷰어 (메인 페이지)
            f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}",
        ]

        for url in candidate_urls:
            try:
                r = SESSION.get(url, timeout=12)
                if r.status_code == 200 and len(r.text) > 200:
                    ratio = extract_ratio(r.text)
                    if ratio:
                        return ratio
                    # 디버그: KB금융에서 내용 앞부분 출력
                    if corp_name == "KB금융":
                        print(f"  [DEBUG KB금융] {url[:60]} → {len(r.text)}bytes")
                        print(f"    앞 500자: {repr(r.text[:500])}")
            except Exception as e:
                if corp_name == "KB금융":
                    print(f"  [DEBUG KB금융] {url[:60]} → 오류: {e}")

        # 경로 3: DART 메인페이지 frameset → 실제 frame src 재구성
        main_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcept_no}"
        res      = SESSION.get(main_url, timeout=12)
        soup     = BeautifulSoup(res.text, "html.parser")

        # JavaScript 내 URL 패턴 추출 (동적 로딩 우회)
        # 예: viewer.do?rcpNo=...&dtd=dart3.xsd&eleId=1&offset=0&length=12345
        js_match = re.search(
            r"viewer\.do\?[^'\"]*rcpNo[^'\"]*dtd[^'\"]*length=([0-9]+)[^'\"]*",
            res.text
        )
        if js_match:
            # JS에서 URL 전체 추출
            full_url_match = re.search(
                r"['\"]([^'\"]*viewer\.do[^'\"]*rcpNo[^'\"]*length=[0-9]+[^'\"]*)['\"]",
                res.text
            )
            if full_url_match:
                doc_url = full_url_match.group(1)
                if not doc_url.startswith("http"):
                    doc_url = "https://dart.fss.or.kr" + doc_url
                r2 = SESSION.get(doc_url, timeout=12)
                ratio = extract_ratio(r2.text)
                if ratio:
                    return ratio

        return None

    except Exception as e:
        print(f"    [WARN] 파싱 실패 {corp_name} ({rcept_no}): {e}")
        return None


# ── 메인 ─────────────────────────────────────────────────────────
def fetch_all() -> list[dict]:
    if not KEY:
        print("  [ERROR] DART_API_KEY 환경변수 없음")
        return []
    print(f"  API 키: {'*'*8}{KEY[-4:]}")

    try:
        corp_map = enrich_corp_codes(DART_CORPS)
    except Exception as e:
        print(f"  [WARN] corpCode.xml 실패: {e} → 하드코딩 사용")
        corp_map = dict(DART_CORPS)

    stocks = []
    print(f"\n  국민연금 D001 공시 조회 + 뷰어 파싱 ({len(corp_map)}종목)...")

    for corp_name, corp_code in corp_map.items():
        try:
            filings = get_nps_filings(corp_code)
            if not filings:
                continue

            latest   = filings[0]
            rcept_no = latest.get("rcept_no", "")
            rcept_dt = latest.get("rcept_dt", "")

            ratio = parse_ratio_from_viewer(rcept_no, corp_name) if rcept_no else None
            if ratio is None:
                print(f"  - {corp_name:<22} 공시 있으나 비율 파싱 실패 ({rcept_no})")
                continue

            prev_ratio = ratio
            if len(filings) >= 2:
                prev_ratio = (
                    parse_ratio_from_viewer(filings[1]["rcept_no"], corp_name) or ratio
                )
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
        time.sleep(0.3)

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
    stocks     = fetch_all()

    if stocks:
        source = "금감원 DART — 주식대량보유상황보고(D001) + dart.fss.or.kr 뷰어 파싱"
    else:
        print("\n  ⚠ 수집 실패 — 빈 목록으로 저장 (fallback 없음)")
        source     = "수집 실패 — DART 공시 데이터 없음"
        updated_at += " [error]"

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump({
            "updated_at": updated_at,
            "source":     source,
            "stocks":     stocks,   # 실패 시 빈 배열
        }, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"  ✅ 완료: {len(stocks)}종목 | {updated_at}")
    print(f"  출처: {source}")
    print("=" * 55)


if __name__ == "__main__":
    main()
