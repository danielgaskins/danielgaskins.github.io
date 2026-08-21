const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const pages = [
  "index.html",
  "blog.html",
  "mendmark.html",
  "syncabill.html",
  "agent-eval-mutation-testing.html",
  "human-review-ai-agents.html",
  "resume.html",
  "meet.html",
];

const htmlByPage = new Map(pages.map((page) => [page, fs.readFileSync(page, "utf8")]));

function firstMatch(html, pattern, label, page) {
  const match = html.match(pattern);
  assert.ok(match, `${page} is missing ${label}`);
  return match[1].trim();
}

test("indexable pages have unique titles, descriptions, and canonical URLs", () => {
  const titles = new Set();
  const descriptions = new Set();
  const canonicals = new Set();

  for (const [page, html] of htmlByPage) {
    const title = firstMatch(html, /<title>([^<]+)<\/title>/, "a title", page);
    const description = firstMatch(html, /<meta\s+name="description"\s+content="([^"]+)"\s*\/>/s, "a description", page);
    const canonical = firstMatch(html, /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/>/, "a canonical URL", page);

    assert.ok(!titles.has(title), `duplicate title: ${title}`);
    assert.ok(!descriptions.has(description), `duplicate description: ${description}`);
    assert.ok(!canonicals.has(canonical), `duplicate canonical: ${canonical}`);
    assert.ok(canonical.startsWith("https://danielgaskins.com/"), `${page} has an off-domain canonical`);
    titles.add(title);
    descriptions.add(description);
    canonicals.add(canonical);
  }
});

test("structured data blocks contain valid JSON", () => {
  let count = 0;
  for (const [page, html] of htmlByPage) {
    for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]), `${page} has invalid JSON-LD`);
      count += 1;
    }
  }
  assert.ok(count >= 6, "expected structured data on the main content pages");
});

test("local HTML links resolve to files or page fragments", () => {
  for (const [page, html] of htmlByPage) {
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|#)/.test(href)) continue;
      const cleanPath = href.split("#")[0].split("?")[0];
      if (!cleanPath || cleanPath === "./") continue;
      const resolved = path.resolve(path.dirname(page), cleanPath);
      assert.ok(fs.existsSync(resolved), `${page} links to missing ${cleanPath}`);
    }
  }
});

test("sitemap contains every canonical content page and honest lastmod values", () => {
  const sitemap = fs.readFileSync("sitemap.xml", "utf8");
  for (const [page, html] of htmlByPage) {
    const canonical = firstMatch(html, /<link\s+rel="canonical"\s+href="([^"]+)"\s*\/>/, "a canonical URL", page);
    assert.ok(sitemap.includes(`<loc>${canonical}</loc>`), `${page} is absent from sitemap.xml`);
  }
  assert.equal((sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, pages.length);
});

test("RSS feed is discoverable and contains the published field notes", () => {
  const feed = fs.readFileSync("feed.xml", "utf8");
  for (const page of ["index.html", "blog.html", "agent-eval-mutation-testing.html", "human-review-ai-agents.html"]) {
    assert.match(htmlByPage.get(page), /rel="alternate" type="application\/rss\+xml"/);
  }
  assert.match(feed, /<rss version="2\.0"/);
  assert.equal((feed.match(/<item>/g) || []).length, 2);
});
