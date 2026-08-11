# Broadridge CIT — AEM Edge Delivery Services

Migration of the Broadridge Collective Investment Trusts section
(`https://www.broadridge.com/cit/*`) to AEM Edge Delivery Services, authored in
Document Authoring (DA).

The migration scope, effort estimation, and delivery plan are documented in
[`docs/cit-migration-plan.md`](docs/cit-migration-plan.md) (with a shareable
PDF alongside it).

## Environments
- Preview: https://main--da-broadridge-cit--rrrragas.aem.page/
- Live: https://main--da-broadridge-cit--rrrragas.aem.live/

## Blocks
- `hero-banner` — full-bleed background-image banner (hero)
- `cards-feature` — clickable feature tiles
- `columns-media` — text + image two-column layout
- `columns-compare` — "is / is not" comparison lists with check/X bullets
- `form-contact` — "Talk to Us" contact form (client-side)
- `header` / `footer` / `fragment` — site chrome and reusable fragments

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository (already installed for this project).
1. Install the [AEM CLI](https://github.com/adobe/aem-cli): `npm install -g @adobe/aem-cli`
1. Start the AEM dev server: `aem up` (serves at `http://localhost:3000`)
1. Open the project in your IDE and start coding.

## Documentation

Adobe Edge Delivery Services docs at https://www.aem.live/docs/ — in particular:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
