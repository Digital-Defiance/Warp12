import { Fragment, useMemo } from 'react';

import styles from './rules-view.module.scss';

interface RulesMarkdownProps {
  source: string;
}

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'p'; text: string }
  | { type: 'hr' }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'blockquote'; blocks: Block[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export function RulesMarkdown({ source }: RulesMarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  return (
    <article className={styles.markdown}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </article>
  );
}

function renderBlock(block: Block, index: number) {
  switch (block.type) {
    case 'h1':
      return (
        <h1 key={index} className={styles.h1}>
          {renderInline(block.text)}
        </h1>
      );
    case 'h2':
      return (
        <h2 key={index} className={styles.h2}>
          {renderInline(block.text)}
        </h2>
      );
    case 'h3':
      return (
        <h3 key={index} className={styles.h3}>
          {renderInline(block.text)}
        </h3>
      );
    case 'p':
      return (
        <p key={index} className={styles.p}>
          {renderInline(block.text)}
        </p>
      );
    case 'hr':
      return <hr key={index} className={styles.hr} />;
    case 'ul':
      return (
        <ul key={index} className={styles.ul}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className={styles.ol}>
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case 'blockquote':
      return (
        <blockquote key={index} className={styles.blockquote}>
          {block.blocks.map((inner, innerIndex) =>
            renderBlock(inner, innerIndex)
          )}
        </blockquote>
      );
    case 'table':
      return (
        <div key={index} className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.headers.map((cell, cellIndex) => (
                  <th key={cellIndex}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function parseMarkdown(source: string): Block[] {
  return parseLines(source.replace(/\r\n/g, '\n').split('\n'), false);
}

function parseLines(lines: string[], inBlockquote: boolean): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = inBlockquote ? stripBlockquote(rawLine) : rawLine;
    index += 1;

    if (!line.trim()) {
      continue;
    }

    if (!inBlockquote && line.startsWith('# ')) {
      blocks.push({ type: 'h1', text: line.slice(2).trim() });
      continue;
    }

    if (!inBlockquote && line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() });
      continue;
    }

    if (!inBlockquote && line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() });
      continue;
    }

    if (line.trim() === '---') {
      blocks.push({ type: 'hr' });
      continue;
    }

    if (!inBlockquote && line.startsWith('> ')) {
      const quoteLines = [rawLine];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quoteLines.push(lines[index]);
        index += 1;
      }
      blocks.push({
        type: 'blockquote',
        blocks: parseLines(
          quoteLines.map((quoteLine) => stripBlockquote(quoteLine)),
          true
        ),
      });
      continue;
    }

    if (line.includes('|') && isTableDivider(lines[index])) {
      const headers = splitTableRow(line);
      index += 1;
      const rows: string[][] = [];
      while (index < lines.length) {
        const rowLine = inBlockquote
          ? stripBlockquote(lines[index])
          : lines[index];
        if (!rowLine.trim() || !rowLine.includes('|')) {
          break;
        }
        if (isTableDivider(lines[index])) {
          index += 1;
          continue;
        }
        rows.push(splitTableRow(rowLine));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (line.startsWith('- ')) {
      const items = [line.slice(2).trim()];
      while (index < lines.length) {
        const nextLine = inBlockquote
          ? stripBlockquote(lines[index])
          : lines[index];
        if (!nextLine.startsWith('- ')) {
          break;
        }
        items.push(nextLine.slice(2).trim());
        index += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const items = [orderedMatch[2]];
      while (index < lines.length) {
        const nextLine = inBlockquote
          ? stripBlockquote(lines[index])
          : lines[index];
        const nextMatch = nextLine.match(/^(\d+)\.\s+(.*)$/);
        if (!nextMatch) {
          break;
        }
        items.push(nextMatch[2]);
        index += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines = [line];
    while (index < lines.length) {
      const nextRaw = lines[index];
      const nextLine = inBlockquote
        ? stripBlockquote(nextRaw)
        : nextRaw;
      if (
        !nextLine.trim() ||
        nextLine.startsWith('#') ||
        nextLine.startsWith('> ') ||
        nextLine.startsWith('- ') ||
        nextLine.match(/^\d+\.\s+/) ||
        nextLine.trim() === '---' ||
        (nextLine.includes('|') && isTableDivider(lines[index + 1]))
      ) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: 'p', text: paragraphLines.join(' ') });
  }

  return blocks;
}

function stripBlockquote(line: string): string {
  return line.startsWith('> ') ? line.slice(2) : line;
}

function isTableDivider(line: string | undefined): boolean {
  if (!line) {
    return false;
  }
  const normalized = line.replace(/^\>\s?/, '').trim();
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(normalized);
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
