import { join } from "path";
import { readdir, stat, writeFile } from 'fs/promises';

const folder = join('.', 'public', 'img', 'maps');
const out = join('.', 'src', 'generated-map-directory.ts')

const resolve = async () => {
  const realms = await readdir(folder);
  const dir: { [realm: string]: string[] } = {};

  for (const realm of realms) {
    if (realm === 'src') continue;
    if (!(await stat(join(folder, realm))).isDirectory()) continue;

    const list = (dir[realm] || (dir[realm] = []));
    const maps = await readdir(join(folder, realm));

    for (const map of maps) {
      if (!((await stat(join(folder, realm, map))).isFile())) continue;
      list.push(map);
    }
  }

  return dir;
}

const createTsFile = async (dir: Awaited<ReturnType<typeof resolve>>) => {
  const lines = [] as string[];

  lines.push(`export const MapDirectory = {`);
  for (const realm of Object.keys(dir)) {
    lines.push(`  "${realm}": [`);
    lines.push(`${dir[realm].map(map => `    "${map}"`).join(",\n")}`)
    lines.push(`  ],`);
  }
  lines.push(`} as const;`);

  await writeFile(out, lines.join('\n'));
}

resolve().then(createTsFile);
