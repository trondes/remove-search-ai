# Chrome Remove AI

Chrome extension (Manifest V3) that removes AI surfaces from search pages.

## Supported sites

- Google Search support.
- Bing Search support.

## Project Structure

- `manifest.json` - extension manifest.
- `src/content-bootstrap.js` - host/path gate and page module bootstrap.
- `src/pages/google-search.js` - Google Search remover module.
- `src/pages/bing-search.js` - Bing Search remover module.
- `scripts/prepare-release.ps1` - validates manifest/package inputs and builds a Chrome Web Store zip.
- `pages/` - static snapshots for analysis only. Do not push.

## Notes

- The extension injects only on targeted Google/Bing search surfaces declared in `manifest.json`.
- More search engines/pages can be added as separate modules under `src/pages/`.
- Remember to update version number in `manifest.json`

## Prepare Release Package

From project root in PowerShell:

```powershell
./scripts/prepare-release.ps1
```

Output:

- Creates `dist/chrome-remove-search-ai-v<version>.zip`.
- Includes only `manifest.json`, `logo.png`, and `src/**` in the package.
- Validates common Chrome Web Store readiness checks:
  - Manifest is MV3.
  - Content script matches are not broad `*` host patterns.
  - Referenced script and icon files exist.
