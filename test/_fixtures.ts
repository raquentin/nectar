import fs from "node:fs/promises";
import path from "node:path";

import { mkTempDir } from "./_helpers.js";

// create a temporary project with nectar config and sample source file
export async function makeTempProject() {
  const dir = await mkTempDir("nectar-json-");
  await fs.writeFile(path.join(dir, "nectar.config.json"), JSON.stringify({
    heavyDeps: ["date-fns"], dynamicAllowlist: ["Chart"]
  }));
  const src = path.join(dir, "src"); await fs.mkdir(src, { recursive: true });
  await fs.writeFile(path.join(src, "p.tsx"), `import * as dateFns from 'date-fns'; export default dateFns.format(new Date(),'y')`);
  const man = path.join(dir, "manifest"); await fs.mkdir(man, { recursive: true });
  await fs.writeFile(path.join(man, "build-manifest.json"), JSON.stringify({ pages: { "/": ["static/chunks/vendors-date-fns-x.js"] } }));
  await fs.writeFile(path.join(man, "sizes.json"), JSON.stringify({ "static/chunks/vendors-date-fns-x.js": 80000 }));
  return { dir, manifest: path.join(man, "build-manifest.json"), sizes: path.join(man, "sizes.json") };
}

