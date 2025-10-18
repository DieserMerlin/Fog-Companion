import { execFile } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import semver from 'semver';
import { promisify } from 'util';
import { Plugin } from 'vite';
import { zip } from 'zip-a-folder';
import checker from 'license-checker-rseidelsohn';

const pExecFile = promisify(execFile);

type Options = {
    setVersion?: string | undefined;
    makeOpk?: string | undefined; // "true" oder Suffix
};

const r = (p: string) => resolve(process.cwd(), p);

export default function overwolfVitePlugin(options: Options = {}): Plugin {
    const pluginName = 'overwolf-plugin';

    const packagePath = r('package.json');
    const manifestPath = r('public/manifest.json');
    const distDir = r('dist');
    const releasesDir = r('releases'); // <— nach oben gezogen

    const readJSON = async <T = any>(p: string): Promise<T | null> => {
        try {
            const raw = await readFile(p, 'utf-8');
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    };

    const writeText = (p: string, content: string) => writeFile(p, content, 'utf-8');

    const deleteFileIfExists = async (p: string) => {
        if (existsSync(p)) {
            try { await unlink(p); } catch { /* ignore */ }
        }
    };

    const ensureDir = (dir: string) => {
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    };

    const setVersionIfRequested = async () => {
        const newVersion = options.setVersion;
        if (!newVersion) return;

        if (!semver.valid(newVersion)) {
            throw new Error(`[${pluginName}] Invalid semver "${newVersion}"`);
        }

        const [pkg, manifest] = await Promise.all([
            readJSON<any>(packagePath),
            readJSON<any>(manifestPath),
        ]);

        if (!pkg) throw new Error(`[${pluginName}] could not read package.json`);
        if (!manifest) throw new Error(`[${pluginName}] could not read manifest.json`);

        pkg.version = newVersion;
        if (!manifest.meta) manifest.meta = {};
        manifest.meta.version = newVersion;

        await Promise.all([
            writeText(packagePath, JSON.stringify(pkg, null, 2)),
            writeText(manifestPath, JSON.stringify(manifest, null, 2)),
        ]);
        console.log(`[${pluginName}] Version set to ${newVersion}`);
    };

    const writeThirdPartyNotices = async () => {
        const outPath = join(distDir, 'THIRD-PARTY-NOTICES.txt');
        if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

        const pkgs: Record<string, any> = await new Promise((resolve, reject) => {
            checker.init(
                {
                    start: process.cwd(),     // Projekt-Root
                    production: true,         // nur runtime deps
                    direct: false,            // inkl. transitive
                    customPath: null,
                },
                (err: any, json: any) => (err ? reject(err) : resolve(json))
            );
        });

        let out = '';
        for (const [name, info] of Object.entries(pkgs)) {
            const lic = (info as any).licenses ?? 'UNKNOWN';
            const repo = (info as any).repository ?? '';
            const publisher = (info as any).publisher ?? '';
            const licenseFile = (info as any).licenseFile as string | undefined;

            out += `================================================================\n`;
            out += `${name}\n`;
            out += `License: ${lic}\n`;
            if (publisher) out += `Publisher: ${publisher}\n`;
            if (repo) out += `Repository: ${repo}\n`;

            // Lizenztext anhängen
            if (licenseFile && existsSync(licenseFile)) {
                try {
                    const licText = await readFile(licenseFile, 'utf-8');
                    out += `\n----- LICENSE -----\n${licText.trim()}\n`;
                } catch { /* ignore */ }
                // Versuche zusätzlich eine NOTICE mitzunehmen (Apache-2.0-Fälle)
                try {
                    const baseDir = dirname(licenseFile);
                    const candidates = ['NOTICE', 'NOTICE.txt', 'NOTICE.md'];
                    for (const f of candidates) {
                        const p = join(baseDir, f);
                        if (existsSync(p)) {
                            const notice = await readFile(p, 'utf-8');
                            out += `\n----- NOTICE -----\n${notice.trim()}\n`;
                            break;
                        }
                    }
                } catch { /* ignore */ }
            }
            out += `\n`;
        }

        await writeFile(outPath, out, 'utf-8');
        console.log(`[overwolf-plugin] Wrote ${outPath}`);
    };

    const makeOPKIfRequested = async () => {
        const makeOpk = options.makeOpk;
        if (!makeOpk) return;

        const [pkg, manifest] = await Promise.all([
            readJSON<any>(packagePath),
            readJSON<any>(manifestPath),
        ]);

        if (!pkg) throw new Error(`[${pluginName}] could not read package.json`);
        if (!manifest) throw new Error(`[${pluginName}] could not read manifest.json`);

        const version = pkg.version;
        const name = manifest.meta?.name;
        if (!name) throw new Error(`[${pluginName}] manifest.meta.name not found`);

        const suffix = makeOpk === 'true' ? '' : `.${makeOpk}`;
        ensureDir(releasesDir); // <— Ordner sicher anlegen
        const opkPath = join(releasesDir, `${name}-${version}${suffix}.opk`);

        await deleteFileIfExists(opkPath);
        await zip(distDir, opkPath);

        console.log(`[${pluginName}] OPK created at ${opkPath}`);
    };

    return {
        name: pluginName,

        async configResolved() {
            await setVersionIfRequested();
        },

        // Wenn die Assets in dist/ liegen:
        async closeBundle() {
            await writeThirdPartyNotices(); // <— zuerst Notices erzeugen
            await makeOPKIfRequested();     // <— dann zippen
        },
    };
}
