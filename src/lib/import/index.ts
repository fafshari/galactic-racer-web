// Screenshot import (ADR 0016): reads the game's build summary screen into a build. Framework-free (ADR 0008);
// the browser glue that decodes images and runs OCR lives with the planner island.
export { readScreenshot, assembleBuild, topSpeedKmh, doubtful, ScreenshotError, CONFIDENT } from './recognise.ts';
export type { Ocr, OcrMode, Reading, ScreenshotReading, VehicleReading, StyleReading, AbilityReading, PartReading, LevelReading } from './recognise.ts';
export { textCrop, type Raster, type Box } from './raster.ts';
