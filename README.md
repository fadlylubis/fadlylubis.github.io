# fadlylubis.github.io

Personal website of Fadly Lubis — [fadlylubis.github.io](https://fadlylubis.github.io)

Built with [Jekyll](https://jekyllrb.com/) on the [al-folio](https://github.com/alshedivat/al-folio) theme. Deployed to the `gh-pages` branch by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `master`.

## Run locally

```bash
docker compose up   # http://localhost:8888
```

Or without Docker (Ruby + Bundler):

```bash
bundle install
bundle exec jekyll serve --lsi   # http://localhost:4000
```

## Where things live

| What | Where |
| --- | --- |
| Site config, nav, theme colors | `_config.yml` |
| Pages | `_pages/about.md`, `_pages/cv.md` |
| CV content | `assets/json/resume.json` (falls back to `_data/cv.yml`) |
| Images, PDFs | `assets/` |

The theme also supports blog posts (`_posts/`), news and project collections (`_news/`, `_projects/`) and publications (`_bibliography/papers.bib`) — none are in use yet; create the folder to start one.

Theme documentation: [al-folio README](https://github.com/alshedivat/al-folio#readme).

## License

Theme is MIT licensed (see [LICENSE](LICENSE)). Site content © Fadly Lubis.
