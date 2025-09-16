import { promises as fs } from 'fs';
import * as path from 'path';

export function sanitizeUsername(username: string) {
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new Error(
      'Invalid username: only alphanumeric characters and underscores are allowed',
    );
  }
  return username;
}

export function checkPath(dir: string) {
  // Basic input validation
  if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_/.-]*$/.test(dir)) {
    throw new Error('Invalid characters in path');
  }

  // Normalize and check for dangerous patterns
  const normalized = path.normalize(dir).replace(/^(\.\.[\/\\])+/, '');
  if (
    normalized.includes('..') ||
    normalized.startsWith('/') ||
    normalized.includes('\0')
  ) {
    throw new Error('Invalid path provided');
  }
  return normalized;
}

export async function findFilesByExtname(
  dir: string,
  regText: string,
): Promise<string[]> {
  const dtsFiles: string[] = [];

  // First validate the path
  checkPath(dir);

  try {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        // If it's a directory, recursively search for .d.ts files
        const subDirFiles = await findFilesByExtname(filePath, regText);
        dtsFiles.push(...subDirFiles);
      } else if (stat.isFile() && file.endsWith(regText)) {
        // If it's a .d.ts file, add to the list
        dtsFiles.push(filePath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to read directory ${dir}: ${error}`);
  }

  return dtsFiles;
}

export async function combineDtsFiles(
  filePaths: string[],
  outputPath: string,
): Promise<void> {
  const contentParts: string[] = [];

  // Read all files and collect their content
  for (const filePath of filePaths) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      contentParts.push(fileContent);
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  // Join all content parts with newlines
  const combinedContent = contentParts.join('\n\n');

  // Write to the output file
  try {
    await fs.writeFile(outputPath, combinedContent, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write to ${outputPath}: ${error}`);
  }
}

export async function readFiles(files: string[]) {
  const filesContent: { [filename: string]: string } = {};
  await Promise.all(
    files.map(async (file) => {
      filesContent[file] = await fs.readFile(file, 'utf-8');
    }),
  );
  return filesContent;
}
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error) || 'Unknown error';
}
