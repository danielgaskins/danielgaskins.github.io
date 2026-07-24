# Daniel Gaskins portfolio

A dependency-free, career-focused portfolio for an applied machine learning engineer.

## Run locally

From this directory:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Structure

- `index.html` — content and page structure
- `faultline.html` — ML agent-evaluation project case study
- `resume.html` / `resume.css` — browser and print versions of the résumé
- `styles.css` — responsive visual system
- `script.js` — navigation, header, and reveal interactions
- `favicon.svg` — vector favicon

The site has no build step and can be deployed to any static host.

## Deployment

The `main` branch is published directly with GitHub Pages at
`danielgaskins.github.io` and uses the custom domain `danielgaskins.com`.

- `CNAME` declares the custom domain to GitHub Pages.
- `.nojekyll` ensures GitHub serves the static files without Jekyll processing.
