const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");

function copyFixture(target) {
  for (const file of ["blog.html", "feed.xml", "sitemap.xml"]) {
    fs.copyFileSync(path.join(root, file), path.join(target, file));
  }
  fs.mkdirSync(path.join(target, "content"));
  fs.writeFileSync(path.join(target, "content", "published-scheduled.json"), "[]\n");
  fs.mkdirSync(path.join(target, "scripts"));
  fs.copyFileSync(
    path.join(root, "scripts", "publish-scheduled-posts.mjs"),
    path.join(target, "scripts", "publish-scheduled-posts.mjs"),
  );
  const source = path.join(target, "drafts", "example-post");
  fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(
    path.join(source, "entry.json"),
    JSON.stringify({
      slug: "example-post",
      publishDate: "2026-09-03",
      title: "A scheduled field note",
      description: "A test description for the scheduled publishing pipeline.",
      category: "Agent evaluation",
      readTime: "5 minute read",
      image: "assets/img/agent-eval-og-v1.jpg",
      imageWidth: 1200,
      imageHeight: 630,
    }),
  );
  fs.writeFileSync(path.join(source, "post.html"), "<!doctype html><title>A scheduled field note</title>\n");
}

async function publish(target, date) {
  const module = await import(`${pathToFileURL(path.join(target, "scripts", "publish-scheduled-posts.mjs"))}?date=${date}`);
  module.publishScheduled({ root: target, source: path.join(target, "drafts"), date });
}

test("future drafts remain unpublished", async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "scheduled-post-test-"));
  copyFixture(target);
  await publish(target, "2026-09-02");
  assert.ok(!fs.existsSync(path.join(target, "example-post.html")));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, "content", "published-scheduled.json"))), []);
});

test("a due draft publishes once across every discovery surface", async () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "scheduled-post-test-"));
  copyFixture(target);
  await publish(target, "2026-09-03");
  await publish(target, "2026-09-04");

  assert.ok(fs.existsSync(path.join(target, "example-post.html")));
  assert.equal(JSON.parse(fs.readFileSync(path.join(target, "content", "published-scheduled.json"))).length, 1);
  for (const file of ["blog.html", "feed.xml", "sitemap.xml"]) {
    const contents = fs.readFileSync(path.join(target, file), "utf8");
    assert.equal((contents.match(/example-post/g) || []).length > 0, true, `${file} omits the post`);
  }
  const feed = fs.readFileSync(path.join(target, "feed.xml"), "utf8");
  assert.equal((feed.match(/<title>A scheduled field note<\/title>/g) || []).length, 1);
  const blog = fs.readFileSync(path.join(target, "blog.html"), "utf8");
  const schemas = [...blog.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.doesNotThrow(() => schemas.forEach((match) => JSON.parse(match[1])));
});
