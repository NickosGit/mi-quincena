// Browser OCR. The image is read on the device with tesseract.js; only text comes out.

import { MAX_TEXT_LENGTH, truncateText } from "./parse";

export const OCR_LANG = "spa";

/** OCR text, cut to MAX_TEXT_LENGTH; `truncated` says whether anything was cut. */
export async function readImageText(
  image: Blob,
  onProgress: (fraction: number) => void,
): Promise<{ text: string; truncated: boolean }> {
  // Loaded on demand: tesseract.js only ships to people who actually upload.
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANG, undefined, {
    logger: (m) => {
      if (m.status === "recognizing text") onProgress(m.progress);
    },
  });
  try {
    // PSM 3 (AUTO) = automatic page layout. tesseract.js defaults to 6 (single block),
    // which garbled every date on the clean fixture. Keep in sync with scripts/ocr-fixtures.mjs.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
    const { data } = await worker.recognize(image);
    return { text: truncateText(data.text), truncated: data.text.length > MAX_TEXT_LENGTH };
  } finally {
    // Frees the wasm heap that held the decoded image.
    await worker.terminate();
  }
}
