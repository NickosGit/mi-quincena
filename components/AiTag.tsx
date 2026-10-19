/** Shown on every row that came from OCR or the LLM. */
export function AiTag() {
  return (
    <span className="inline-block self-start rounded-full bg-tag-soft px-2.5 py-0.5 text-sm font-medium text-tag">
      Leído de tu captura — revisa
    </span>
  );
}
