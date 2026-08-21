# SEO and earned-link plan for danielgaskins.com

Updated August 21, 2026.

## Positioning

The site should own one person entity and two technical subject areas:

- **Daniel Gaskins:** applied AI engineer, machine learning engineer, founder.
- **Agent reliability:** agent evaluation, mutation testing for agent evals, tool-call evaluation, human review for AI agents.
- **Practical ML systems:** document AI, invoice automation controls, LightGBM deployment, cross-runtime inference.

The goal is not maximum traffic. It is qualified discovery by engineering teams, founders, recruiters, and writers working on applied AI reliability.

## Current baseline

- The public search sample for `site:danielgaskins.com Daniel Gaskins` did not return a page from the domain.
- PyPI already returns a relevant Daniel Gaskins profile and the `lgbm-to-code` package. These are the strongest existing third-party entity signals.
- The site has unique titles, descriptions, canonical URLs, crawlable HTML, a sitemap, and useful original work.
- The main gaps were consistent person-entity markup, a feed, complete social previews, accurate sitemap modification dates, and external links that explicitly connect Daniel's profiles and projects to the domain.

## Keyword-to-page map

| Page | Primary intent | Supporting language |
| --- | --- | --- |
| `/` | Daniel Gaskins; applied AI engineer | machine learning engineer, AI agent evaluation engineer, document AI |
| `/mendmark.html` | mutation testing for agent evals | test an agent evaluation suite, tool-call evaluation, AI agent reliability |
| `/agent-eval-mutation-testing.html` | agent eval mutation testing | broken tool calls, trace evaluation, evaluator sensitivity |
| `/human-review-ai-agents.html` | human review for AI agents | human-in-the-loop AI, approval queues, AI action authority |
| `/syncabill.html` | AI invoice automation case study | document AI, invoice validation, QuickBooks and Xero controls |
| future LightGBM article | convert LightGBM model to code | dependency-free LightGBM inference, LightGBM to C++/JavaScript/Python |

Keep one primary intent per page. Use the supporting phrases where they genuinely clarify the text; do not repeat exact phrases mechanically.

## Backlink campaign: first 30 days

### 1. Close the entity loop

These are profile edits, not cold outreach, and should be completed first:

- GitHub profile: set the website field to `https://danielgaskins.com/` and publish the prepared profile README in `github-profile/README.md`.
- PyPI `mendmark-evals`: add Homepage, Documentation, Source, and Author project URLs, with the homepage or documentation URL pointing to `https://danielgaskins.com/mendmark.html`.
- PyPI `lgbm-to-code`: add a project URL to the future LightGBM article; until then, point Homepage to the main portfolio and Source to GitHub.
- LinkedIn: use the exact title “Applied AI Engineer” or “Applied AI and Machine Learning Engineer,” add the domain to contact info, and feature Mendmark's case study rather than only a GitHub URL.
- SyncABill: add a factual founder/about link to Daniel's homepage if the product site has an appropriate About or footer location.

Every profile should use the same full name, role family, portrait, and canonical domain. This helps distinguish this Daniel Gaskins from unrelated people with the same name.

### 2. Submit Mendmark to relevant maintained lists

Start with repositories that explicitly welcome contributions. Submit one precise entry to each; do not mass-submit identical promotional text.

1. [aglio-lab/ai-evaluation-tools](https://github.com/aglio-lab/ai-evaluation-tools) — broad, current evaluation-tool catalog.
2. [SeaOtterAI/awesome-ai-agent-evaluation](https://github.com/SeaOtterAI/awesome-ai-agent-evaluation) — focused on agent outputs, trajectories, and release gating; especially relevant.
3. [royalpinto007/awesome-agent-evals](https://github.com/royalpinto007/awesome-agent-evals) — accepts one structured object per tool.
4. [chaosync-org/awesome-ai-agent-testing](https://github.com/chaosync-org/awesome-ai-agent-testing) — relevant to testing methodology and mutation testing.
5. [tugkanboz/awesome-ai-testing](https://github.com/tugkanboz/awesome-ai-testing) — broader QA audience; lower priority than the agent-specific lists.

Suggested factual description:

> **Mendmark** — Open-source mutation testing for agent eval suites. It plants controlled faults in passing tool-use traces, reruns the existing evaluators, and reports which wrong arguments, missing calls, repeated side effects, hidden errors, or damaged responses survive.

Link the tool name to the GitHub repository where the list convention requires source links. Include the case study or field note only when the maintainer permits an additional documentation link. A relevant repository link is more durable than a directory link obtained by stretching the category.

### 3. Earn links with reproducible evidence

Use the public golden set as the campaign asset. Pitch the result and method, not Daniel's biography:

- 263 controlled broken runs tested against response-only, trace-only, and trace-plus-outcome evaluators.
- A downloadable/versioned artifact and exact reproduction command.
- Clear limitation: this measures sensitivity to the controlled fault set, not overall agent safety.

Good outreach audiences are maintainers of agent-evaluation tools, engineering newsletters, MLOps communities, and podcasts that cover testing or reliability. Before outreach, make the golden set citable with a tagged release, `CITATION.cff`, stable result table, and archival DOI if practical.

Short outreach template:

> Subject: Reproducible agent-eval mutation set (263 controlled faults)
>
> I built an open-source mutation test for agent eval suites and published the complete golden set. In one pinned comparison, a response-only evaluator missed 176 of 263 planted faults, while exact trace-and-outcome checks caught all 263. The result is deliberately narrow: it tests evaluator sensitivity to these mutations, not general agent safety. If this fits your work on [specific topic], the cases and reproduction steps are here: [most relevant artifact].

Personalize the first and last sentences. Do not ask for a backlink; ask whether the reproducible artifact is useful to their readers or project.

## Content that can earn links

Build these in order:

1. **LightGBM model to dependency-free code:** a technical article with benchmark table, parity methodology, missing-value behavior, limitations, and runnable examples. This connects the already-ranking PyPI package to the domain.
2. **Agent evaluator sensitivity report:** a stable HTML report for the golden set, with CSV/JSON downloads and methodology. Link it from Mendmark releases.
3. **Human-review policy worksheet:** a small, vendor-neutral decision matrix people can reuse and cite. It should complement the existing article rather than gate it behind email.
4. **Invoice extraction failure taxonomy:** anonymized categories, detection methods, and remediation controls from SyncABill. Publish only claims supported by actual observations.

Each asset needs a canonical HTML explanation, downloadable data or template, author identity, update date, and a stable URL.

## Technical and editorial cadence

- Publish one substantial, evidence-backed article every 3–4 weeks; update an existing project page between new articles.
- Add two or three contextual internal links from every new article to a project, another note, and the homepage/about identity.
- Keep article dates honest. Update `dateModified`, visible copy where appropriate, the RSS feed, and `sitemap.xml` only when content materially changes.
- Use descriptive anchor text such as “mutation testing for agent evals,” not “click here.”
- Keep booking and résumé pages subordinate; they are conversion/support pages, not content hubs.

## Measurement

Set up Google Search Console and Bing Webmaster Tools, verify the domain property, and submit `https://danielgaskins.com/sitemap.xml` plus `https://danielgaskins.com/feed.xml`.

Record monthly:

- indexed canonical pages and crawl errors;
- impressions, clicks, average position, and query/page pairs;
- referring domains and the exact linked page;
- branded searches for `Daniel Gaskins` plus a role/project modifier;
- non-branded impressions for the five page intents above;
- qualified contact or résumé actions from organic landing pages.

For the first 90 days, success is: all canonical content indexed; the homepage returned for `Daniel Gaskins applied AI`; at least five relevant referring domains; and first non-branded impressions for agent-eval mutation testing and LightGBM-to-code terms. Treat rankings and referral quality as outcomes, not guarantees.

## Guardrails

- No paid link packages, private blog networks, reciprocal-link pages, spun guest posts, or unrelated directories.
- No invented awards, customer counts, benchmark superiority, or security claims.
- Do not reuse the same anchor text across every placement.
- External submissions and profile changes are not complete until made through Daniel's accounts and publicly verified.
