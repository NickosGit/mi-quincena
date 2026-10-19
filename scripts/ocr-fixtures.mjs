// Runs tesseract.js (spa) on fixtures/*.png and saves the raw text next to each
// image (fixtures/clean.txt, fixtures/blurred.txt). Same engine and language the
// browser uses in F3, so unit tests run on the text the app would really see.
//
//   node scripts/ocr-fixtures.mjs
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createWorker } from "tesseract.js";

const dir = path.join(import.meta.dirname, "..", "fixtures");
const images = readdirSync(dir).filter((f) => f.endsWith(".png"));

const worker = await createWorker("spa");
// PSM 3 = automatic page layout (Tesseract's CLI default). tesseract.js defaults to
// 6 (single block), which garbled every date on the clean fixture (see DECISIONS.md).
// Keep in sync with the browser OCR settings.
await worker.setParameters({ tessedit_pageseg_mode: "3" });
for (const file of images) {
  const { data } = await worker.recognize(path.join(dir, file));
  const out = path.join(dir, file.replace(/\.png$/, ".txt"));
  writeFileSync(out, data.text);
  console.log(`=== ${file} (confidence ${Math.round(data.confidence)})\n${data.text}`);
}
await worker.terminate();
