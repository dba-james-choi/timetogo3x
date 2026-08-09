#!/usr/bin/env python3
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_PATH = DATA_DIR / "news.json"
TOP_N = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

# Google News RSS, no API key required. Local places use a keyword search
# (with a "BC" qualifier to avoid same-named places elsewhere, e.g. Victoria
# AU); Canada uses the geo headlines section for genuine national top news
# instead of a noisy keyword search for "Canada".
SECTIONS = [
    {
        "key": "saanich",
        "label": "Saanich",
        "url": "https://news.google.com/rss/search?q=Saanich%20BC&hl=en-CA&gl=CA&ceid=CA:en",
    },
    {
        "key": "victoria",
        "label": "Victoria",
        "url": "https://news.google.com/rss/search?q=Victoria%20BC&hl=en-CA&gl=CA&ceid=CA:en",
    },
    {
        "key": "vancouver",
        "label": "Vancouver",
        "url": "https://news.google.com/rss/search?q=Vancouver%20BC&hl=en-CA&gl=CA&ceid=CA:en",
    },
    {
        "key": "canada",
        "label": "Canada",
        "url": "https://news.google.com/rss/headlines/section/geo/Canada?hl=en-CA&gl=CA&ceid=CA:en",
    },
]

SOURCE_SUFFIX_RE = re.compile(r"\s+-\s+[^-]+$")


def fetch_rss(url: str) -> ET.Element:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return ET.fromstring(resp.read())


def fetch_rss_with_retries(url: str) -> ET.Element:
    last_exc = None
    for attempt in range(3):
        try:
            return fetch_rss(url)
        except (urllib.error.URLError, ET.ParseError) as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(2)
    raise RuntimeError(f"failed to fetch {url}: {last_exc}")


BC_ABBREVIATION_RE = re.compile(r"\bB\.C\.")


def translate_to_korean(text: str) -> str | None:
    # Unofficial Google Translate endpoint (client=gtx) -- no API key,
    # same "free but undocumented" tradeoff already accepted elsewhere in
    # this project (Yahoo Finance chart API, Google News RSS). A failure
    # here just means no translation for that headline, never a hard
    # workflow failure, since it's a nice-to-have on top of the real title.
    if not text:
        return None
    # Google Translate reliably misreads "B.C." (British Columbia, which is
    # what it always means in this project's headlines) as the historical
    # era "Before Christ", rendering it as "기원전". Expand it before
    # sending -- unambiguous here since every source is BC/Canada news --
    # so the translation, not just the fetch, is correct every day.
    text = BC_ABBREVIATION_RE.sub("British Columbia", text)
    url = (
        "https://translate.googleapis.com/translate_a/single"
        "?client=gtx&sl=auto&tl=ko&dt=t&q=" + urllib.parse.quote(text)
    )
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return "".join(segment[0] for segment in data[0] if segment[0]).strip() or None
    except (urllib.error.URLError, ValueError, KeyError, IndexError, TypeError):
        return None


def clean_title(title: str, source: str | None) -> str:
    # Google News titles are formatted as "Headline - Source" (with the
    # <source> tag almost always present too, giving the same name
    # redundantly). Strip the known source name precisely when available;
    # only fall back to the generic "- Anything" pattern when it's not,
    # since blindly stripping could otherwise cut a headline that
    # legitimately ends in " - Word" for an unrelated reason.
    if source:
        suffix = f" - {source}"
        if title.endswith(suffix):
            return title[: -len(suffix)].strip()
    return SOURCE_SUFFIX_RE.sub("", title).strip()


def parse_articles(root: ET.Element, limit: int) -> list:
    articles = []
    for item in root.findall("./channel/item")[:limit]:
        title = (item.findtext("title") or "").strip()
        source_el = item.find("source")
        source = source_el.text.strip() if source_el is not None and source_el.text else None
        title = clean_title(title, source)

        pub_date_raw = (item.findtext("pubDate") or "").strip()
        published = None
        if pub_date_raw:
            try:
                published = parsedate_to_datetime(pub_date_raw).astimezone(timezone.utc).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                )
            except (TypeError, ValueError):
                published = None

        articles.append(
            {
                "title": title,
                "title_ko": translate_to_korean(title),
                "link": (item.findtext("link") or "").strip(),
                "source": source,
                "published": published,
            }
        )
    return articles


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    sections = {}

    for section in SECTIONS:
        try:
            root = fetch_rss_with_retries(section["url"])
            articles = parse_articles(root, TOP_N)
        except RuntimeError as exc:
            failures.append(f"{section['key']}: {exc}")
            continue

        if not articles:
            failures.append(f"{section['key']}: no articles parsed")
            continue

        sections[section["key"]] = {"label": section["label"], "articles": articles}

    if not sections:
        print("FAILURE: no sections fetched successfully:", "; ".join(failures), file=sys.stderr)
        return 1

    payload = {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sections": sections,
    }
    OUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT_PATH} ({len(sections)} sections)")

    if failures:
        print("PARTIAL FAILURES:", "; ".join(failures), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
