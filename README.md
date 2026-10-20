# Explainers

Interactive isometric figures, one per folder. Each figure is a standalone HTML page with everything inlined, so the repo can be served as-is (for example by GitHub Pages).

| Folder | Figure |
|---|---|
| [`root-canal/`](root-canal/) | Root canal treatment: a sectioned premolar on a bench rig, through seven stages |
| [`ct-scanner/`](ct-scanner/) | CT scanner: a gantry and rotor take projections, which are reconstructed into a slice read in Hounsfield units |
| [`fountain-pen/`](fountain-pen/) | Fountain pen: a sectioned pen on a test rig, with capillary ink feed, a fin buffer and an air channel that lets bubbles in |
| [`keyboard-switches/`](keyboard-switches/) | Keyboard switches: seven cut-open switches on a bench with a pressing probe, force and sensing curves, and notes on every source (`RESEARCH.md`) |

## Layout

```
index.html          landing page listing the explainers
kit/                vendored drawing kit (MIT, from anatomy)
<explainer>/
  build.mjs         geometry and page assembly
  model.mjs         the pure model the figure is driven by
  live.js           in-page animation and controls
  *.css             figure styles
  index.html        built page (committed, so Pages needs no build step)
```

## Build

Requires Node 18+. No dependencies.

```sh
cd root-canal
node build.mjs          # writes index.html (follows the system light/dark theme)
node build.mjs --dark   # also writes a fixed dark copy for checking (git-ignored)
```

## Add an explainer

Make a new folder with its own `build.mjs` importing from `../kit/`, have it write `index.html`, and add a link to the root `index.html`.
