import type { TemplateFile, VersionRecord } from './index.js'

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

export async function materialExampleTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  const parentName = assetName.replace(/-example$/, '')
  const className = toPascalCase(parentName)

  return [
    {
      path: 'src/app.system.ts',
      content: `import { System } from "@v43/core";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SphereGeometry, Mesh, AmbientLight, DirectionalLight } from "three";
import { create${className}Material } from "./${parentName}/material.system.js";

export default class App extends System() {
  private scene = this.load("Scene");
  private camera = this.load("Camera");
  private renderer = this.load("Renderer");

  constructor() {
    super();

    this.effect(() => {
      const scene = this.scene.value;
      if (!scene) return;

      const geometry = new SphereGeometry(1, 64, 64);
      const material = create${className}Material();
      const mesh = new Mesh(geometry, material);

      const ambient = new AmbientLight(0xffffff, 0.5);
      const directional = new DirectionalLight(0xffffff, 1);
      directional.position.set(5, 10, 7);
      directional.castShadow = true;

      scene.add(mesh, ambient, directional);
      return () => {
        scene.remove(mesh, ambient, directional);
        geometry.dispose();
        material.dispose();
      };
    });

    this.effect(() => {
      const camera = this.camera.value;
      const renderer = this.renderer.value;
      if (!camera || !renderer) return;
      camera.position.set(0, 1.5, 3);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.autoRotate = true;
      return () => controls.dispose();
    });
  }
}
`,
    },
    {
      path: 'vite.config.ts',
      content: `import { defineConfig } from "vite";
import { v43 } from "@v43/plugin";

export default defineConfig({
  plugins: [v43()],
  base: "./",
  build: { outDir: "dist" },
});
`,
    },
    {
      path: 'package.json',
      content: JSON.stringify(
        {
          name: assetName,
          private: true,
          type: 'module',
          scripts: { dev: 'vite', build: 'vite build' },
          dependencies: JSON.parse(version.npmDependencies),
        },
        null,
        2,
      ),
    },
  ]
}
