# 0016. Import a build from a screenshot

- Status: Accepted
- Date: 2026-11-02

## Context

Players want to bring the build they're running in the game into the planner without re-entering every slot. The game's **Build** screen (opened from the race menu) shows the whole build on one screen:
- **Vehicle stats:** the vehicle name, the top speed in km/h, and a row of ten pips per stat.
- **Racer style:** the style name and its traits by name.
- **Abilities:** four slots, plus a crash ability that the planner doesn't model.
- **Installed parts:** a count ("4/4"), and a card per part with its name, description, icon and a row of rarity dots under the icon.

The site is static (ADR 0003, 0011): there's no server to send an image to, and screenshots must not leave the player's device anyway.

Our own icons can't identify a build on their own:
- 45 abilities share 9 icons.
- 55 styles share 15 icons.
- Epic and Legendary members of a part family often share one icon.

But every slot on the screen is labelled with a name, and the names in our data are unique: part names carry their rarity as a numeral (I Common … IV Legendary).

## Decision

**Read the text, count the pips, check against the numbers.**

- **OCR with tesseract.js** (WebAssembly, in a Web Worker), English only. Each name is matched against the closed list of game names by edit distance, so a misread letter still lands on the right item.
- **Layout from the panels, not from fixed coordinates.**
  - The three columns of dark teal panels are found by colour. Every other position is measured from them in reference coordinates (a 2000×1125 capture).
  - So any resolution, aspect ratio, letterboxing or crop works as long as the panels are whole.
- **Text lines from the pixels.**
  - Within each generous box, the first line of bright text is located, binarised (Otsu) and scaled to about 26 px before OCR.
  - Tesseract reads this bold display font well at 22–32 px and often returns nothing above about 40 px, so an empty read is retried at another size.
- **Styles** are matched by name plus their traits. Campaign ranks and the Multiplayer version share a name, so the traits decide the rank, and the style decides the mode.
- **Parts:**
  - The family comes from the name.
  - The rarity comes from the dots under the icon: OCR garbles the numeral ("III" comes back as "Ill", "Ii", "lll"), but the dots are crisp.
  - The numeral only cross-checks, or decides when the dots can't be read.
- **Stat levels** are lit pips: a pip is lit when it's much brighter than its row's background. A non-contiguous row lowers the confidence.
- **Cross-check:** the screen prints the build's top speed, and the review step compares it with the planner's own number (402.3 km/h vs the game's 403 for the sample).
- **Confidence per slot** (0–1) comes from the match score and its lead over the runner-up.
  - Below 0.8, the review step flags the slot ("Check") and shows what was read.
  - A part card covered by the hover tooltip is flagged with a hint to hide tooltips in the game.
- **Where the code lives:**
  - `src/lib/import/` is framework-free (ADR 0008):
    - `readScreenshot(raster, ocr)` returns readings with confidences.
    - `assembleBuild(readings)` returns a `Build` through the planner's own rules, such as one rarity per part family.
    - The OCR function is injected, so tests use the same engine in Node.
  - Browser glue (image decoding, the tesseract worker) is in `src/components/BuildPlanner/screenshot.ts`. The UI is `ScreenshotImport.svelte` in the planner's drawer.
- **How players get an image in:**
  - Paste (Ctrl+V or ⌘V) anywhere on the planner: pasted text still goes where it was going.
  - Drop a file onto the planner.
  - The toolbar's **Import screenshot** button, which opens a file picker (the keyboard route).
  - Nothing is applied until the player presses **Use this build**. The drawer closes after that, as with every pick (ADR 0012).
- **Self-hosted, lazily loaded:**
  - The tesseract worker and WebAssembly core are hashed Vite assets.
  - The English data is served at `/ocr/4.0.0_best_int/eng.traineddata.gz` by the `ocr-data` integration: tesseract.js only loads language data from a folder URL. The version in the path keeps cached copies harmless.
  - The page loads a ~20 KB chunk only when an image arrives. On the first import the browser downloads about 4.5 MB (core ~1.5 MB compressed, language data 2.9 MB), then serves it from its cache.
  - No request goes to a CDN, and the image never leaves the device.

## Consequences

- An import takes 1–4 seconds in a browser, most of it the first-time download.
- The recogniser's tests run real OCR on a real capture at five sizes and framings (`src/lib/import/import.test.ts`). Playwright pastes through the real clipboard and drops a file (`tests/e2e/screenshot-import.spec.ts`).
- A UI change in a game patch (layout, fonts, colours) can break recognition. A new fixture screenshot and the reference coordinates in `layout.ts` and `recognise.ts` are the things to update.
- Favours and situational counts aren't on the Build screen, so they aren't imported.

## Open questions

- **Captures:** only one real capture exists so far (Campaign, Skim Speeder, 2000×1125). Other aspect ratios are tested by rescaling and letterboxing it, which assumes the game scales its UI uniformly. Native 21:9, 16:10 (Steam Deck) and 4K captures, and a Multiplayer Tour build, would confirm this.
- **Rarity dots:** whether they show the part's tier or its rarity is unconfirmed. They agree for the sample's parts, but some families start at Rare tier 1. A screenshot with such a part would settle it.
- **Many parts:** with more parts installed than the panel shows (six cards fit), the list probably scrolls. Only visible cards are read.
- **Language:** non-English game text isn't supported.
