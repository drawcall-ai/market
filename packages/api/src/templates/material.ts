import type { TemplateFile, VersionRecord } from './index.js'

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export async function materialTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  const className = toPascalCase(assetName)

  const files: TemplateFile[] = [
    {
      path: 'properties.json',
      r2Key: version.sourceKey,
    },
    {
      path: 'material.system.ts',
      content: `import { System } from "@v43/core";
import { MeshStandardMaterial } from "three";
import properties from "./properties.json";

export function create${className}Material() {
  return new MeshStandardMaterial({
    color: properties.color,
    roughness: properties.roughness,
    metalness: properties.metalness,
    emissive: properties.emissive,
    emissiveIntensity: properties.emissiveIntensity,
  });
}

declare global {
  interface Resources {
    ${className}Material: MeshStandardMaterial;
  }
}

export default class ${className}System extends System() {
  private material = create${className}Material();

  constructor() {
    super();
    this.provide("${className}Material", this.material);
  }
}
`,
    },
    {
      path: 'README.md',
      content:
        version.readme ??
        `# ${assetName}

A PBR material for use with V43.

## Usage

\`\`\`ts
// Option 1: Auto-discovered system — load the material from another system:
// private material = this.load("${className}Material");

// Option 2: Direct factory usage:
// import { create${className}Material } from "./${assetName}/material.system";
// const mat = create${className}Material();
\`\`\`

## Dependencies

- \`@v43/core\`
- \`three\`
`,
    },
  ]

  return files
}
