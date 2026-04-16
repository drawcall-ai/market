import type { TemplateFile, VersionRecord } from './index.js'

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export async function modelTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  const className = toPascalCase(assetName)
  const ext = version.sourceKey.endsWith('.gltf') ? 'gltf' : 'glb'

  const files: TemplateFile[] = [
    {
      path: `model.${ext}`,
      r2Key: version.sourceKey,
    },
    {
      path: 'model.system.ts',
      content: `import { System, resource } from "@v43/core";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = new URL("./model.${ext}", import.meta.url).href;

export default class ${className} extends System() {
  private scene = this.load("Scene");
  private gltf = resource(() => new GLTFLoader().loadAsync(MODEL_URL));

  constructor() {
    super();
    this.effect(() => {
      const gltf = this.gltf.value;
      const scene = this.scene.value;
      if (!gltf || !scene) return;
      const model = gltf.scene.clone();
      scene.add(model);
      return () => scene.remove(model);
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

A 3D model asset for use with V43.

## Usage

\`\`\`ts
// Just place this folder in your src/ directory.
// V43 auto-discovers the model.system.ts file.
\`\`\`

## Dependencies

- \`@v43/core\`
- \`three\`
`,
    },
  ]

  return files
}
