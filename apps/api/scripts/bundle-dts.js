const fs = require('fs');
const path = require('path');

const modules = [
  {
    name: 'test-case-base',
    path: 'dist/types/test-cases/classes/test-case-base.d.ts',
  },
  {
    name: 'test-case-decorator',
    path: 'dist/types/test-cases/classes/test-case-decorator.d.ts',
  },
  {
    name: 'test-case-main',
    path: 'dist/types/test-cases/classes/test-case-main.d.ts',
  },
  {
    name: 'test-case-main-impl',
    path: 'dist/types/test-cases/classes/test-case-main.impl.d.ts',
  },
];

const outputFile = 'dist/types/frontend.d.ts';
const frontendOutput = '../frontend/src/types/frontend.d.ts';
const maxRetries = 3;
const retryDelay = 1000;

async function tryReadFile(filePath, retries = maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      if (attempt === retries) {
        console.error(
          `Failed to read ${filePath} after ${retries} attempts: ${e}`,
        );
        return null;
      }
      console.warn(
        `Attempt ${attempt} failed for ${filePath}. Retrying in ${retryDelay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

async function bundleDts() {
  let combinedContent = '// Auto-generated type definitions for frontend\n\n';
  combinedContent += 'declare module "test-case" {\n';

  for (const module of modules) {
    const content = await tryReadFile(module.path);
    if (content) {
      combinedContent += `  // ${module.name}\n${content.replace(/^declare\s+module\s+['"].*['"]\s*{/, '').replace(/}\s*$/, '')}\n`;
    } else {
      console.error(`Skipping ${module.name} due to read failure`);
    }
  }

  combinedContent += '}\n';

  try {
    fs.writeFileSync(outputFile, combinedContent);
    console.log(`Bundled .d.ts files into ${outputFile}`);
    fs.copyFileSync(outputFile, frontendOutput);
    console.log(`Copied bundled .d.ts to ${frontendOutput}`);
  } catch (e) {
    console.error(`Failed to write or copy bundled .d.ts file: ${e}`);
  }
}

bundleDts();
