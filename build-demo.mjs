import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('./enums.js', import.meta.url), 'utf8');
const template = await readFile(new URL('./index.template.html', import.meta.url), 'utf8');
const exportStatement = /^export \{ EnumFactory as Enums, EnumCombination \};?\s*$/m;

if (!exportStatement.test(source) || !template.includes('/* ENUM_LIBRARY */')) {
    throw new Error('Could not find the expected export or template marker');
}
if (/<\/script/i.test(source)) {
    throw new Error('Library source cannot be placed safely in an inline script');
}

const inlineLibrary = source.replace(exportStatement, '');
const html = template.replace('/* ENUM_LIBRARY */', inlineLibrary);
await writeFile(new URL('./index.html', import.meta.url), html);
console.log('Built index.html for direct file:// opening');

