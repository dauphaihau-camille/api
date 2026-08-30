import type {
  AiResponseBlock,
  AiResponseBlockPayload,
  AiResponseInlineContent,
} from '../contracts/ai-assistance.contract';

const headingPattern = /^(#{1,6})\s+(.+)$/;
const bulletPattern = /^[-*]\s+(.+)$/;
const numberedPattern = /^\d+[.)]\s+(.+)$/;
const boldPattern = /\*\*([^*]+)\*\*/g;
const italicPattern = /(?<!\*)\*([^*]+)\*(?!\*)/g;

type NormalizedLine = {
  block: AiResponseBlock;
};

export type AiResponseBlockStreamEvent =
  | {
    type: 'block_start';
    blockId: string;
    blockType: AiResponseBlock['type'];
    props?: AiResponseBlock['props'];
  }
  | {
    type: 'text_delta';
    blockId: string;
    content: AiResponseInlineContent[];
  }
  | {
    type: 'block_end';
    blockId: string;
  };

export class AiResponseStreamNormalizer {
  private buffer = '';
  private nextBlockNumber = 1;
  private readonly blocks: AiResponseBlock[] = [];

  append(delta: string): AiResponseBlockStreamEvent[] {
    this.buffer += delta;
    return this.flushCompleteLines();
  }

  complete(): { events: AiResponseBlockStreamEvent[]; payload: AiResponseBlockPayload } {
    const events = this.flushRemainingLine();

    return {
      events,
      payload: this.blocks.length > 0
        ? [...this.blocks]
        : [this.createEmptyParagraph()],
    };
  }

  private flushCompleteLines(): AiResponseBlockStreamEvent[] {
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? '';

    return this.normalizeLines(lines);
  }

  private flushRemainingLine(): AiResponseBlockStreamEvent[] {
    if (this.buffer.trim().length === 0) {
      this.buffer = '';
      return [];
    }

    const line = this.buffer;
    this.buffer = '';
    return this.normalizeLines([line]);
  }

  private normalizeLines(lines: string[]): AiResponseBlockStreamEvent[] {
    const events: AiResponseBlockStreamEvent[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.length === 0) {
        continue;
      }

      const normalized = this.normalizeLine(line);
      this.blocks.push(normalized.block);
      events.push(
        {
          type: 'block_start',
          blockId: normalized.block.id,
          blockType: normalized.block.type,
          props: normalized.block.props,
        },
        {
          type: 'text_delta',
          blockId: normalized.block.id,
          content: normalized.block.content,
        },
        {
          type: 'block_end',
          blockId: normalized.block.id,
        },
      );
    }

    return events;
  }

  private normalizeLine(line: string): NormalizedLine {
    const headingMatch = headingPattern.exec(line);

    if (headingMatch) {
      return {
        block: this.createBlock('heading', parseInlineMarkdown(headingMatch[2]), {
          level: headingMatch[1].length,
        }),
      };
    }

    const bulletMatch = bulletPattern.exec(line);

    if (bulletMatch) {
      return {
        block: this.createBlock('bulletListItem', parseInlineMarkdown(bulletMatch[1])),
      };
    }

    const numberedMatch = numberedPattern.exec(line);

    if (numberedMatch) {
      return {
        block: this.createBlock('numberedListItem', parseInlineMarkdown(numberedMatch[1])),
      };
    }

    return {
      block: this.createBlock('paragraph', parseInlineMarkdown(line)),
    };
  }

  private createBlock(
    type: AiResponseBlock['type'],
    content: AiResponseInlineContent[],
    props?: AiResponseBlock['props'],
  ): AiResponseBlock {
    return {
      id: `ai-block-${this.nextBlockNumber++}`,
      type,
      content,
      ...(props ? { props } : {}),
    };
  }

  private createEmptyParagraph(): AiResponseBlock {
    return {
      id: `ai-block-${this.nextBlockNumber++}`,
      type: 'paragraph',
      content: [],
    };
  }
}

export function normalizeCompletedAiResponse(text: string): AiResponseBlockPayload {
  const normalizer = new AiResponseStreamNormalizer();
  normalizer.append(text);
  return normalizer.complete().payload;
}


// ---------- Private helpers ----------

function parseInlineMarkdown(text: string): AiResponseInlineContent[] {
  return parseItalicSegments(parseBoldSegments(text));
}

function parseBoldSegments(text: string): AiResponseInlineContent[] {
  return parseMarkedSegments(text, boldPattern, 'bold');
}

function parseItalicSegments(segments: AiResponseInlineContent[]): AiResponseInlineContent[] {
  return segments.flatMap((segment) => {
    if (segment.styles?.bold) {
      return [segment];
    }

    return parseMarkedSegments(segment.text, italicPattern, 'italic');
  });
}

function parseMarkedSegments(
  text: string,
  pattern: RegExp,
  style: 'bold' | 'italic',
): AiResponseInlineContent[] {
  const segments: AiResponseInlineContent[] = [];
  let lastIndex = 0;

  pattern.lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    segments.push({
      type: 'text',
      text: match[1],
      styles: { [style]: true },
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text }];
}
