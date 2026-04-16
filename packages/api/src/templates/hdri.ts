import type { TemplateFile, VersionRecord } from './index.js'

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export async function hdriTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  const className = toPascalCase(assetName)
  const ext = version.sourceKey.endsWith('.exr') ? 'exr' : 'hdr'
  const loaderImport =
    ext === 'exr'
      ? `import { EXRLoader } from "three/addons/loaders/EXRLoader.js";`
      : `import { RGBELoader } from "three/addons/loaders/RGBELoader.js";`
  const loaderClass = ext === 'exr' ? 'EXRLoader' : 'RGBELoader'

  const files: TemplateFile[] = [
    {
      path: `environment.${ext}`,
      r2Key: version.sourceKey,
    },
    {
      path: 'environment.system.ts',
      content: `import { System, resource } from "@v43/core";
${loaderImport}
import { EquirectangularReflectionMapping } from "three";

const ENV_URL = new URL("./environment.${ext}", import.meta.url).href;

export default class ${className} extends System() {
  private scene = this.load("Scene");
  private envMap = resource(() => new ${loaderClass}().loadAsync(ENV_URL));

  constructor() {
    super();
    this.effect(() => {
      const texture = this.envMap.value;
      const scene = this.scene.value;
      if (!texture || !scene) return;
      texture.mapping = EquirectangularReflectionMapping;
      scene.environment = texture;
      scene.background = texture;
      return () => {
        scene.environment = null;
        scene.background = null;
        texture.dispose();
      };
    });
  }
}
`,
    },
    {
      path: 'README.md',
      content:
        version.readme ??
        `# ${assetName}

An HDRI environment map for use with V43.

## Usage

\`\`\`ts
// Just place this folder in your src/ directory.
// V43 auto-discovers the environment.system.ts file.
\`\`\`

## Dependencies

- \`@v43/core\`
- \`three\`
`,
    },
  ]

  return files
}
