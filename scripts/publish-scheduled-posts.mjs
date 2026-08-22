#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SITE_URL = "https://danielgaskins.com";
const EXISTING_POST_IDS = [
  `${SITE_URL}/human-review-ai-agents.html#article`,
  `${SITE_URL}/agent-eval-mutation-testing.html#article`,
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    args[key] = argv[i + 1];
    i += 1;
  }
  return args;
}

function localIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function html(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function xml(value) {
  return html(value).replaceAll("'", "&apos;");
}

function displayDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function rssDate(iso) {
  return new Date(`${iso}T12:00:00Z`).toUTCString();
}

function validateEntry(entry, directory) {
  const required = [
    "slug",
    "publishDate",
    "title",
    "description",
    "category",
    "readTime",
    "image",
    "imageWidth",
    "imageHeight",
  ];
  for (const field of required) {
    if (entry[field] === undefined || entry[field] === "") {
      throw new Error(`${directory}/entry.json is missing ${field}`);
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.publishDate)) {
    throw new Error(`${directory}/entry.json has an invalid publishDate`);
  }
  if (!/^[a-z0-9-]+$/.test(entry.slug)) {
    throw new Error(`${directory}/entry.json has an invalid slug`);
  }
  if (!fs.existsSync(path.join(directory, "post.html"))) {
    throw new Error(`${directory} is missing post.html`);
  }
}

function loadDueEntries(source, date) {
  if (!fs.existsSync(source)) throw new Error(`Scheduled source not found: ${source}`);
  return fs
    .readdirSync(source, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => {
      const directory = path.join(source, item.name);
      const entry = readJson(path.join(directory, "entry.json"));
      validateEntry(entry, directory);
      return { ...entry, directory };
    })
    .filter((entry) => entry.publishDate <= date)
    .sort((a, b) => b.publishDate.localeCompare(a.publishDate));
}

function replaceBetween(contents, start, end, replacement) {
  const startIndex = contents.indexOf(start);
  const endIndex = contents.indexOf(end);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Missing publishing markers: ${start} / ${end}`);
  }
  return `${contents.slice(0, startIndex + start.length)}${replacement}${contents.slice(endIndex)}`;
}

function blogEntry(entry) {
  return `
        <article class="blog-entry">
          <a class="blog-entry__image" href="./${html(entry.slug)}.html" tabindex="-1" aria-hidden="true">
            <img src="./${html(entry.image)}" width="${entry.imageWidth}" height="${entry.imageHeight}" loading="lazy" alt="" />
          </a>
          <div class="blog-entry__body">
            <div class="blog-entry__meta">
              <time datetime="${entry.publishDate}">${displayDate(entry.publishDate)}</time>
              <span>${html(entry.category)}</span>
              <span>${html(entry.readTime)}</span>
            </div>
            <h2><a href="./${html(entry.slug)}.html">${html(entry.title)}</a></h2>
            <p>${html(entry.description)}</p>
            <a class="blog-entry__link" href="./${html(entry.slug)}.html">
              Read the field note
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M3 8h9M8.5 3.5 13 8l-4.5 4.5" /></svg>
            </a>
          </div>
        </article>
`;
}

function feedItem(entry) {
  const url = `${SITE_URL}/${entry.slug}.html`;
  return `
    <item>
      <title>${xml(entry.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rssDate(entry.publishDate)}</pubDate>
      <description>${xml(entry.description)}</description>
    </item>`;
}

function sitemapUrl(entry) {
  return `
  <url>
    <loc>${SITE_URL}/${entry.slug}.html</loc>
    <lastmod>${entry.publishDate}</lastmod>
    <priority>0.8</priority>
  </url>`;
}

function writeGeneratedSurfaces(root, entries, date) {
  const blogFile = path.join(root, "blog.html");
  let blog = fs.readFileSync(blogFile, "utf8");
  blog = replaceBetween(
    blog,
    "<!-- SCHEDULED_BLOG_ENTRIES_START -->",
    "<!-- SCHEDULED_BLOG_ENTRIES_END -->",
    `${entries.map(blogEntry).join("")}        `,
  );
  blog = blog.replace(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    (block, json) => {
      const schema = JSON.parse(json);
      if (schema["@type"] !== "Blog") return block;
      schema.blogPost = [
        ...entries.map((entry) => ({ "@id": `${SITE_URL}/${entry.slug}.html#article` })),
        ...EXISTING_POST_IDS.map((id) => ({ "@id": id })),
      ];
      return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n")}\n    </script>`;
    },
  );
  fs.writeFileSync(blogFile, blog);

  const feedFile = path.join(root, "feed.xml");
  let feed = fs.readFileSync(feedFile, "utf8");
  feed = feed.replace(/<lastBuildDate>[^<]+<\/lastBuildDate>/, `<lastBuildDate>${rssDate(date)}</lastBuildDate>`);
  feed = replaceBetween(
    feed,
    "<!-- SCHEDULED_FEED_ITEMS_START -->",
    "<!-- SCHEDULED_FEED_ITEMS_END -->",
    `${entries.map(feedItem).join("")}\n    `,
  );
  fs.writeFileSync(feedFile, feed);

  const sitemapFile = path.join(root, "sitemap.xml");
  let sitemap = fs.readFileSync(sitemapFile, "utf8");
  sitemap = replaceBetween(
    sitemap,
    "<!-- SCHEDULED_SITEMAP_URLS_START -->",
    "<!-- SCHEDULED_SITEMAP_URLS_END -->",
    `${entries.map(sitemapUrl).join("")}\n  `,
  );
  fs.writeFileSync(sitemapFile, sitemap);
}

export function publishScheduled({ root = process.cwd(), source, date = localIsoDate() }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date must use YYYY-MM-DD");
  const sourcePath = path.resolve(source || path.join(root, ".scheduled-content", "scheduled-posts"));
  const publishedFile = path.join(root, "content", "published-scheduled.json");
  const alreadyPublished = readJson(publishedFile);
  const due = loadDueEntries(sourcePath, date);
  const bySlug = new Map(alreadyPublished.map((entry) => [entry.slug, entry]));

  for (const entry of due) {
    const target = path.join(root, `${entry.slug}.html`);
    const sourcePost = path.join(entry.directory, "post.html");
    fs.copyFileSync(sourcePost, target);
    const { directory, ...metadata } = entry;
    bySlug.set(entry.slug, metadata);
  }

  const published = [...bySlug.values()].sort((a, b) => b.publishDate.localeCompare(a.publishDate));
  fs.writeFileSync(publishedFile, `${JSON.stringify(published, null, 2)}\n`);
  writeGeneratedSurfaces(root, published, date);
  return { date, due: due.length, published: published.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const result = publishScheduled({ root: process.cwd(), source: args.source, date: args.date });
  console.log(`Publishing date: ${result.date}`);
  console.log(`Due drafts: ${result.due}`);
  console.log(`Published scheduled posts: ${result.published}`);
}
