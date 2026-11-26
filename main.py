import json
import os
import urllib.request
from datetime import UTC, datetime

GITHUB_API = "https://api.github.com/repos"
OAI_REPO = "openai/math"
ANT_REPO = "anthropics/formal-math"
OAI_OUT = "oai.json"
ANT_OUT = "ant.json"
META_OUT = "meta.json"


def github_get(url):
    """Fetch JSON data from the GitHub API."""
    headers = {"Accept": "application/vnd.github+json"}
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def load_cached_dates(filename):
    """Load a {url: date} lookup map from an existing JSON file if present."""
    if not os.path.exists(filename):
        return {}

    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}

    if not isinstance(data, list):
        return {}

    cached = {}
    for item in data:
        if isinstance(item, dict) and item.get("url") and item.get("date"):
            cached[item["url"]] = item["date"]
    return cached


def get_file_date(repo, path):
    """Return the last commit date for a file."""
    commits = github_get(f"{GITHUB_API}/{repo}/commits?path={path}&per_page=1")

    if not commits:
        return None

    return commits[0]["commit"]["committer"]["date"][:10]


def resolve_date(cached_dates, repo, path, url):
    """Return cached date if available, otherwise query GitHub."""
    cached = cached_dates.get(url)
    if cached:
        return cached
    return get_file_date(repo, path)


def get_oai_pdfs(cached_dates=None):
    """Return OpenAI preprint folder names, PDF links, and dates."""
    cached_dates = cached_dates or {}
    root = github_get(f"{GITHUB_API}/{OAI_REPO}/contents")

    preprints = next(
        item for item in root if item["name"] == "preprints" and item["type"] == "dir"
    )

    tree = github_get(
        f"{GITHUB_API}/{OAI_REPO}/git/trees/{preprints['sha']}?recursive=1"
    )

    if tree.get("truncated"):
        raise RuntimeError("OpenAI preprints tree was truncated.")

    results = []

    for item in tree["tree"]:
        if item["type"] != "blob" or not item["path"].lower().endswith(".pdf"):
            continue

        path = item["path"]
        folder = path.split("/")[0]
        full_path = f"preprints/{path}"
        url = f"https://github.com/{OAI_REPO}/blob/main/{full_path}"

        results.append(
            {
                "name": folder,
                "url": url,
                "date": resolve_date(cached_dates, OAI_REPO, full_path, url),
            }
        )

    return results


def get_ant_papers(cached_dates=None):
    """Return Anthropic project names, paper links, and dates."""
    cached_dates = cached_dates or {}
    folders = github_get(f"{GITHUB_API}/{ANT_REPO}/contents")

    results = []

    for folder in folders:
        if folder["type"] != "dir" or folder["name"] == ".github":
            continue

        paper_path = f"{folder['name']}/paper.pdf"
        paper = github_get(f"{GITHUB_API}/{ANT_REPO}/contents/{paper_path}")
        url = paper["html_url"]

        results.append(
            {
                "name": folder["name"],
                "url": url,
                "date": resolve_date(cached_dates, ANT_REPO, paper_path, url),
            }
        )

    return results


def main():
    """Return both repository listings using cached dates when available."""
    oai_cache = load_cached_dates(OAI_OUT)
    ant_cache = load_cached_dates(ANT_OUT)

    return {
        "oai": get_oai_pdfs(oai_cache),
        "ant": get_ant_papers(ant_cache),
    }


if __name__ == "__main__":
    oai_data = get_oai_pdfs(load_cached_dates(OAI_OUT))
    with open(OAI_OUT, "w", encoding="utf-8") as f:
        json.dump(oai_data, f, indent=2, ensure_ascii=False)

    ant_data = get_ant_papers(load_cached_dates(ANT_OUT))
    with open(ANT_OUT, "w", encoding="utf-8") as f:
        json.dump(ant_data, f, indent=2, ensure_ascii=False)

    meta = {
        "last_updated": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(META_OUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
