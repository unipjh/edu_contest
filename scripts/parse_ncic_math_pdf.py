#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import quote_plus

import pdfplumber


EXPECTED_PREFIX_COUNTS = {
    "10공수1": 19,
    "10공수2": 20,
    "10기수1": 17,
    "10기수2": 17,
    "12대수": 18,
    "12미적Ⅰ": 20,
    "12확통": 16,
}

SUBJECT_BY_PREFIX = {
    "10공수1": {"subject": "공통수학1", "track": "공통 과목", "priority": "core"},
    "10공수2": {"subject": "공통수학2", "track": "공통 과목", "priority": "core"},
    "10기수1": {"subject": "기본수학1", "track": "공통 과목", "priority": "support"},
    "10기수2": {"subject": "기본수학2", "track": "공통 과목", "priority": "support"},
    "12대수": {"subject": "대수", "track": "일반 선택 과목", "priority": "core"},
    "12미적Ⅰ": {"subject": "미적분Ⅰ", "track": "일반 선택 과목", "priority": "core"},
    "12확통": {"subject": "확률과 통계", "track": "일반 선택 과목", "priority": "core"},
}

MATH_TERMS = [
    "다항식", "사칙연산", "항등식", "나머지정리", "인수분해", "복소수", "이차방정식",
    "실근", "허근", "판별식", "근과 계수", "이차함수", "그래프", "최대", "최소",
    "삼차방정식", "사차방정식", "연립이차방정식", "연립일차부등식", "절댓값",
    "이차부등식", "합의 법칙", "곱의 법칙", "경우의 수", "순열", "조합", "행렬",
    "내분", "내분점", "좌표", "평행", "수직", "직선", "거리", "원의 방정식",
    "원과 직선", "원의 접선", "도형의 이동", "집합", "명제", "절대부등식",
    "유리함수", "무리함수", "역함수", "합성함수", "지수", "로그", "상용로그",
    "지수함수", "로그함수", "삼각함수", "일반각", "호도법", "사인법칙", "코사인법칙",
    "수열", "일반항", "등차수열", "공차", "등비수열", "공비", "수열의 합",
    "귀납적 정의", "수학적 귀납법", "함수의 극한", "극한", "연속", "연속함수",
    "미분계수", "미분가능", "도함수", "접선", "평균값 정리", "증가", "감소",
    "극대", "극소", "속도", "가속도", "부정적분", "정적분", "넓이", "거리",
    "중복순열", "중복조합", "이항정리", "확률", "확률의 덧셈정리", "조건부확률",
    "독립", "종속", "확률의 곱셈정리", "확률변수", "확률분포", "이산확률변수",
    "기댓값", "표준편차", "이항분포", "정규분포", "모집단", "표본", "표본추출",
    "표본평균", "모평균", "표본비율", "모비율", "추정", "신뢰구간",
]

STOPWORDS = {
    "뜻을", "뜻과", "알고", "이해하고", "설명하고", "계산할", "구할", "이를", "그",
    "성질을", "활용하여", "이용하여", "문제를", "해결할", "관계를", "판단할",
    "수", "있다", "대한", "통해", "관련된",
}

CODE_RE = re.compile(r"^\s*(?:[•ㆍ]\s*)?\[([^\]\s]+-?\d{2}-\d{2})\]\s*(.*)$")
DOMAIN_RE = re.compile(r"^\((\d+)\)\s+(.+)$")
PREFIX_RE = re.compile(r"-?\d{2}-\d{2}$")
TOKEN_RE = re.compile(r"[가-힣A-Za-z0-9ⅠⅡⅢ]+")


def configure_stdout() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def find_default_pdf() -> Path:
    candidates = list(Path("docs").glob("*.pdf"))
    for path in candidates:
        if "수학과 교육과정" in path.name:
            return path
    for path in candidates:
        if path.stat().st_size == 683152:
            return path
    raise FileNotFoundError("docs/에서 수학과 교육과정 PDF를 찾지 못했습니다.")


def clean_line(line: str) -> str:
    line = line.replace("\u00a0", " ")
    line = re.sub(r"\s+", " ", line).strip()
    return line


def is_noise_line(line: str) -> bool:
    if not line:
        return True
    if line.isdigit():
        return True
    if line in {"수학과 교육과정"}:
        return True
    if line.startswith("선택 중심 교육과정"):
        return True
    return False


def code_prefix(code: str) -> str:
    return PREFIX_RE.sub("", code)


def normalize_description(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    text = text.replace("제항", "제n항")
    return text


def should_stop_capture(line: str) -> bool:
    return (
        line.startswith("(가) 성취기준 해설")
        or line.startswith("(나) 성취기준 적용 시 고려 사항")
        or line.startswith("3. 교수")
        or line.startswith("다. 교수")
    )


def is_domain_heading(line: str) -> str | None:
    match = DOMAIN_RE.match(line)
    if not match:
        return None
    name = match.group(2).strip()
    if len(name) > 30:
        return None
    blocked = ("교수", "평가", "방향", "방법", "유의", "목표")
    if any(token in name for token in blocked):
        return None
    return name


def extract_standards(pdf_path: Path) -> tuple[list[dict], dict]:
    standards: list[dict] = []
    duplicate_codes: list[dict] = []
    seen_codes: set[str] = set()
    current_domain = ""
    capturing = False
    current: dict | None = None

    def flush_current() -> None:
        nonlocal current
        if not current:
            return
        current["description"] = normalize_description(" ".join(current.pop("_parts")))
        if current["code"] not in seen_codes:
            standards.append(current)
            seen_codes.add(current["code"])
        else:
            duplicate_codes.append({"code": current["code"], "page": current["page"]})
        current = None

    with pdfplumber.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            for raw_line in text.splitlines():
                line = clean_line(raw_line)
                if is_noise_line(line):
                    continue

                domain = is_domain_heading(line)
                if domain:
                    flush_current()
                    current_domain = domain
                    capturing = True
                    continue

                if line == "나. 성취기준":
                    flush_current()
                    capturing = True
                    continue

                if should_stop_capture(line):
                    flush_current()
                    capturing = False
                    continue

                code_match = CODE_RE.match(line)
                if code_match and capturing and current_domain:
                    flush_current()
                    code = code_match.group(1)
                    current = {
                        "code": code,
                        "prefix": code_prefix(code),
                        "domain": current_domain,
                        "page": page_number,
                        "_parts": [code_match.group(2).strip()],
                        "lineCount": 1,
                    }
                    continue

                if current and capturing:
                    if line.startswith("•") or CODE_RE.match(line):
                        continue
                    if line.startswith("(") or line.startswith("가.") or line.startswith("나."):
                        flush_current()
                        continue
                    current["_parts"].append(line)
                    current["lineCount"] += 1

    flush_current()
    meta = {"duplicateCodesIgnored": duplicate_codes}
    return standards, meta


def pick_terms(description: str, domain: str, subject: str) -> list[str]:
    found = []
    haystack = f"{domain} {description}"
    for term in MATH_TERMS:
        if term in haystack and term not in found:
            found.append(term)
    for token in TOKEN_RE.findall(haystack):
        token = re.sub(r"(의|을|를|은|는|이|가|와|과|에|으로|로)$", "", token)
        if (
            len(token) >= 2
            and token not in STOPWORDS
            and token not in found
            and not token.isdigit()
        ):
            found.append(token)
        if len(found) >= 10:
            break
    for token in [domain, subject]:
        if token and token not in found:
            found.append(token)
    return found[:12]


def make_title(description: str, domain: str) -> str:
    title = description
    title = title.replace("의 뜻을 알고,", "의 뜻,")
    title = title.replace("의 뜻과 성질을 설명하고,", "의 뜻과 성질,")
    title = title.replace("의 뜻과 성질을 이해하고,", "의 뜻과 성질,")
    title = title.replace("을 이해하고,", " 이해,")
    title = title.replace("를 이해하고,", " 이해,")
    title = title.replace("을 알고,", ",")
    title = title.replace("를 알고,", ",")
    title = title.replace("이를 활용하여 ", "")
    title = title.replace("이를 이용하여 ", "")
    title = title.replace("그 성질을 이용하여 ", "성질로 ")
    title = title.replace("문제를 해결할 수 있다", "문제 해결")
    title = title.replace("계산할 수 있다", "계산")
    title = title.replace("구할 수 있다", "구하기")
    title = title.replace("설명할 수 있다", "설명")
    title = title.replace("판단할 수 있다", "판단")
    title = title.replace("인식할 수 있다", "인식")
    title = re.sub(r"\s*할 수 있다\.?$", "", title)
    title = re.sub(r"\s*이해한다\.?$", "", title)
    title = re.sub(r"\s*설명할 수 있다\.?$", "", title)
    title = re.sub(r"\s*문제를 해결할 수 있다\.?$", "", title)
    title = title.strip(" .")
    if len(title) > 34:
        title = title[:34].rstrip() + "..."
    if not title:
        title = f"{domain} 이해"
    return title


def build_json(raw_standards: list[dict], pdf_path: Path) -> list[dict]:
    output = []
    for item in raw_standards:
        subject_meta = SUBJECT_BY_PREFIX.get(item["prefix"], {})
        subject = subject_meta.get("subject", item["prefix"])
        keywords = pick_terms(item["description"], item["domain"], subject)
        edunet_query = " ".join(keywords[:5])
        source = {
            "provider": "NCIC 국가교육과정정보센터",
            "document": pdf_path.name,
            "page": item["page"],
            "extraction": "PDF 성취기준 본문 자동 파싱",
        }
        output.append({
            "code": item["code"],
            "curriculum": "2022 개정",
            "sourceType": "NCIC PDF parsed",
            "subject": subject,
            "grade": "고등학교",
            "track": subject_meta.get("track", ""),
            "priority": subject_meta.get("priority", "core"),
            "domain": item["domain"],
            "unit": item["domain"],
            "description": item["description"],
            "keywords": keywords,
            "learningTargets": [{
                "id": f"{item['code']}-T01",
                "title": make_title(item["description"], item["domain"]),
                "description": item["description"],
                "criteria": keywords[:6],
                "keywords": keywords,
                "source": source,
            }],
            "edunetQuery": edunet_query,
            "edunetUrl": "https://www.edunet.net/nedu/search/searchList.do?query="
                         + quote_plus(edunet_query),
            "source": source,
            "lineCount": item["lineCount"],
        })
    return output


def audit(data: list[dict], meta: dict, pdf_path: Path) -> dict:
    prefix_counts = Counter(code_prefix(item["code"]) for item in data)
    subject_counts = Counter(item["subject"] for item in data)
    missing_domain = [item["code"] for item in data if not item.get("domain")]
    missing_description = [item["code"] for item in data if not item.get("description")]
    missing_targets = [item["code"] for item in data if not item.get("learningTargets")]
    mojibake_candidates = [
        item["code"] for item in data
        if "�" in item["description"] or "?" in item["code"]
    ]
    expected_mismatches = {
        prefix: {"expected": expected, "actual": prefix_counts.get(prefix, 0)}
        for prefix, expected in EXPECTED_PREFIX_COUNTS.items()
        if prefix_counts.get(prefix, 0) != expected
    }
    duplicate_codes = [
        code for code, count in Counter(item["code"] for item in data).items()
        if count > 1
    ]
    report = {
        "sourcePdf": str(pdf_path),
        "totalStandards": len(data),
        "prefixCounts": dict(sorted(prefix_counts.items())),
        "subjectCounts": dict(sorted(subject_counts.items())),
        "wrappedDescriptions": sum(1 for item in data if item.get("lineCount", 1) > 1),
        "missingDomain": missing_domain,
        "missingDescription": missing_description,
        "missingLearningTargets": missing_targets,
        "duplicateCodes": duplicate_codes,
        "duplicateCodesIgnored": meta.get("duplicateCodesIgnored", []),
        "mojibakeCandidates": mojibake_candidates,
        "expectedMismatches": expected_mismatches,
    }
    report["passed"] = (
        len(data) == sum(EXPECTED_PREFIX_COUNTS.values())
        and not expected_mismatches
        and not missing_domain
        and not missing_description
        and not missing_targets
        and not duplicate_codes
        and not mojibake_candidates
    )
    return report


def write_review_markdown(data: list[dict], report: dict, path: Path) -> None:
    lines = [
        "# NCIC Math Standards Parse Review",
        "",
        f"- Source: `{report['sourcePdf']}`",
        f"- Total standards: {report['totalStandards']}",
        f"- Passed: {report['passed']}",
        "",
        "## Counts",
        "",
    ]
    for prefix, count in report["prefixCounts"].items():
        lines.append(f"- {prefix}: {count}")
    lines.extend(["", "## Samples", ""])
    for item in data[:12]:
        target = item["learningTargets"][0]
        lines.append(f"- `{item['code']}` {item['subject']} / {item['domain']}: {target['title']}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    configure_stdout()
    parser = argparse.ArgumentParser(description="Parse NCIC high-school math PDF into app JSON.")
    parser.add_argument("pdf", nargs="?", type=Path, default=None)
    parser.add_argument("--out-dir", type=Path, default=Path("output/ncic"))
    parser.add_argument("--write-app-data", action="store_true")
    args = parser.parse_args()

    pdf_path = args.pdf or find_default_pdf()
    raw_standards, meta = extract_standards(pdf_path)
    data = build_json(raw_standards, pdf_path)
    report = audit(data, meta, pdf_path)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.out_dir / "ncic_math_standards.generated.json"
    report_path = args.out_dir / "ncic_math_parse_report.json"
    review_path = args.out_dir / "ncic_math_parse_review.md"
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_review_markdown(data, report, review_path)

    if args.write_app_data:
        app_path = Path("src/data/ncic_standards.json")
        app_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"parsed={len(data)} passed={report['passed']}")
    print(f"json={json_path}")
    print(f"report={report_path}")
    if args.write_app_data:
        print("appData=src/data/ncic_standards.json")
    if not report["passed"]:
        print("quality report failed. See expectedMismatches/missing fields.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
