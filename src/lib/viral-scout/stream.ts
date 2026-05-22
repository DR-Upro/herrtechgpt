import type { ScoutEvent } from "@/app/api/viral-scout/scout/route";

// Parse Server-Sent Events (SSE) stream. Each event is `data: <JSON>\n\n`.
// Comment lines (`: ...`) are ignored — they're used as anti-buffering flush.
export async function* readScoutStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<ScoutEvent, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events terminate on double newline.
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const dataLines: string[] = [];
        for (const line of block.split("\n")) {
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length > 0) {
          const payload = dataLines.join("\n");
          try {
            yield JSON.parse(payload) as ScoutEvent;
          } catch (err) {
            console.warn("[scout] failed to parse SSE payload:", payload, err);
          }
        }
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
