![GitHub release](https://img.shields.io/github/release-date/mclemente/simplefog)
![GitHub release (latest by SemVer and asset)](https://img.shields.io/github/downloads/mclemente/simplefog/latest/module.zip)

[![ko-fi](https://img.shields.io/badge/ko--fi-Support%20Me-red?style=flat-square&logo=ko-fi)](https://ko-fi.com/mclemente)

# Simple Fog
A module for [FoundryVTT](https://foundryvtt.com) that lets you draw fog of war manually.

## Feature Overview Video
Encounter Library did a review of Simple Fog which explains how it works much better than I can, please check it out if you would like an idea how this module works.

[![Feature Overview](https://img.youtube.com/vi/gTt6FDQ7iQA/hqdefault.jpg)](https://www.youtube.com/watch?v=gTt6FDQ7iQA)

## Features

- Simple Fog implements a manual fog of war layer above the core vision layer
  - Enable and disable the Simple Fog layer at any time, per scene
  - This allows you to use both Simple Fog AND the core vision for line of sight, or alternatively use only one or the other, on a scene by scene basis
- Tokens can be automatically hidden and revealed when underneath Simple Fog with a configurable opacity threshold
- Implements a history system so you can easily undo your actions
- Various drawing tools for drawing and erasing fog of war manually
  - Brush tool
    - Hotkeys for quickly changing brush size [ ]
  - Rectangle & Ellipse tool
    - Hold shift to force equal width & height while drawing
  - Polygon Shape tool
    - Click the orange handle to finish your drawing, or right click to cancel
  - Grid tool
    - Reveals any grid square you drag across, works for both Hex and Square grids
  - Room tool
    - Reveals walled rooms. Hold the SHIFT key to take doors into account.
    - This feature doesn't detect an actual "room", it is limited by sight, so it won't reveal fog over corners.
- Add an image to the Simple Fog layer which overlays the selected tint for both GMs and Players.

## Fog API

The module exposes `game.modules.get("simplefog").api` with point, door-side and explicit area reveal/apply methods, including `revealFromPoint()` and
`revealDoorSides()`. These GM-only methods use the existing Room Tool sight geometry
and save each request as one undoable operation. See [the API reference](docs/api.md)
for options, return values, examples, and the required in-app verification.

# Build

## Install all packages

```bash
npm install
```
## npm build scripts

### build

Builds the code and copies assets into `dist`. It does not install or link the module.
The source manifest contains release placeholders; the release workflow supplies its
version and download URLs. A local test installation also needs a valid manifest.

Only if you intend to link a build, create a `foundryconfig.json` with the installation
root containing `Data`:

```json
{
  "dataPath": "~/.local/share/FoundryVTT/"
}
```

`npm run link-project` separately links `dist` into that installation's
`Data/modules/simplefog` directory, if no module already exists there.

```bash
npm run-script build
```

### Tests

```bash
npm test
npm run lint
```

The automated API tests run on Node 24 without a running Foundry server. See the
[in-app verification checklist](docs/api.md#verification-before-table-use) before using
the API at the table.

### NOTE:

You don't need to build the `foundryconfig.json` file you can just copy the content of the `dist` folder on the module folder under `modules` of Foundry

### build:watch

`build:watch` will build and watch for changes, rebuilding automatically.

```bash
npm run-script build:watch
```

### clean

`clean` will remove all contents in the dist folder (but keeps the link from build:install).

```bash
npm run-script clean
```

### prettier-format

`prettier-format` launch the prettier plugin based on the configuration [here](./.prettierrc)

```bash
npm run-script prettier-format
```

### package

`package` generates a zip file containing the contents of the dist folder generated previously with the `build` command. Useful for those who want to manually load the module or want to create their own release

```bash
npm run-script package
```

## Issues

Any issues, bugs, or feature requests are always welcome to be reported directly to the [Issue Tracker](https://github.com/p4535992/foundryvtt-final-blow/issues ), or using the [Bug Reporter Module](https://foundryvtt.com/packages/bug-reporter/).

## License

This package is under an [MIT license](LICENSE) and the [Foundry Virtual Tabletop Limited License Agreement for module development](https://foundryvtt.com/article/license/).

## Credit
- This is a fork of SimpleFog, created by Vance.
