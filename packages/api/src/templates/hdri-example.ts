import type { TemplateFile, VersionRecord } from './index.js'

export async function hdriExampleTemplate(
  assetName: string,
  version: VersionRecord,
  _r2: R2Bucket,
): Promise<TemplateFile[]> {
  const _parentName = assetName.replace(/-example$/, '')

  return [
    {
      path: 'src/app.system.ts',
      content: `import { System } from "@v43/core";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SphereGeometry, Mesh, MeshStandardMaterial } from "three";

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
      const material = new MeshStandardMaterial({ metalness: 1, roughness: 0 });
      const mesh = new Mesh(geometry, material);
      scene.add(mesh);
      return () => {
        scene.remove(mesh);
        geometry.dispose();
        material.dispose();
      };
    });

    this.effect(() => {
      const camera = this.camera.value;
      const renderer = this.renderer.value;
      if (!camera || !renderer) return;
      camera.position.set(0, 0, 3);
      const controls = new OrbitControls(camera, renderer.domElement);
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
