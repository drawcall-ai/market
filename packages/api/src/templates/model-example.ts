import type { TemplateFile, VersionRecord } from './index.js'

export async function modelExampleTemplate(
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
import { AmbientLight, DirectionalLight } from "three";

export default class App extends System() {
  private scene = this.load("Scene");
  private camera = this.load("Camera");
  private renderer = this.load("Renderer");

  constructor() {
    super();

    this.effect(() => {
      const scene = this.scene.value;
      if (!scene) return;
      const ambient = new AmbientLight(0xffffff, 0.5);
      const directional = new DirectionalLight(0xffffff, 1);
      directional.position.set(5, 10, 7);
      directional.castShadow = true;
      scene.add(ambient, directional);
      return () => {
        scene.remove(ambient, directional);
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

  update() {
    const camera = this.camera.value;
    const renderer = this.renderer.value;
    if (!camera || !renderer) return;
    // OrbitControls auto-updates via its own internal mechanism when autoRotate is set
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
