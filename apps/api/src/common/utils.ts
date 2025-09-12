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
  if (!/^[a-zA-Z0-9_/.-]+$/.test(dir) || dir.includes('..')) {
    throw new Error('Invalid path provided');
  }
  return dir;
}

export async function findDtsFiles(dir: string): Promise<string[]> {
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
        const subDirFiles = await findDtsFiles(filePath);
        dtsFiles.push(...subDirFiles);
      } else if (stat.isFile() && file.endsWith('.d.ts')) {
        // If it's a .d.ts file, add to the list
        dtsFiles.push(filePath);
      }
    }
  } catch (error) {
    throw new Error(`Failed to read directory ${dir}: ${error}`);
  }
  
  return dtsFiles;
}

export async function combineDtsFiles(filePaths: string[], outputPath: string): Promise<void> {
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
