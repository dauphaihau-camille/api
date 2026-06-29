import { readFileSync } from 'node:fs';

function parseTsv(content: string, filePath: string): Array<Record<string, string>> {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = lines[0].split('\t').map((header) => header.trim());
  if (headers.some((header) => header.length === 0)) {
    throw new Error(`Invalid TSV header in ${filePath}`);
  }

  return lines.slice(1).map((line, index) => {
    const values = line.split('\t');
    if (values.length !== headers.length) {
      throw new Error(
        `Invalid TSV row width in ${filePath} row ${index + 2}: expected ${headers.length} columns, got ${values.length}`,
      );
    }

    const row: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      row[header] = values[columnIndex] ?? '';
    });
    return row;
  });
}

export function readTsvRows<T extends Record<string, string>>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf8');
  return parseTsv(content, filePath) as T[];
}

export function readOptionalTsvRows<T extends Record<string, string>>(filePath: string): T[] {
  try {
    return readTsvRows<T>(filePath);
  }
  catch (error) {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'ENOENT'
    ) {
      return [];
    }

    throw error;
  }
}
