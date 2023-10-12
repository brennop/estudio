import "./style.css";
import createREGL from "regl";
import { CodeJar } from "codejar";
import { save } from "./download";

import { Pane } from "tweakpane";
import { BindingApi } from "@tweakpane/core";

import hljs from "highlight.js/lib/core";
import glsl from "highlight.js/lib/languages/glsl";
import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("glsl", glsl);

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="editor"></div>
  <canvas></canvas>
`;

const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;

const regl = createREGL(canvas);

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

window.addEventListener("resize", () => {
  resizeCanvasToDisplaySize(canvas);
});

resizeCanvasToDisplaySize(canvas);

const pallete = [
  `[[0.938 0.328 0.718] [0.659 0.438 0.328] [0.388 0.388 0.296] [2.538 2.478 0.168]]`,
  `[[0.500 0.500 0.500] [0.500 0.500 0.500] [0.800 0.800 0.500] [0.000 0.200 0.500]]`,
  `[[0.875 0.588 0.296] [0.631 0.257 0.647] [1.408 0.773 1.364] [4.417 3.357 2.216]]`,
  `[[0.938 0.328 0.248] [0.659 0.438 0.328] [0.388 0.388 0.018] [3.538 3.478 1.178]]`,
  `[[0.698 0.338 0.158] [0.358 0.438 0.268] [0.518 0.388 -0.382] [2.558 2.558 -0.902]]`,
]

const getCoeffs = (str: string) => str.match(/\d+\.\d+/g)?.map((n) => parseFloat(n))?.reduce((acc, n, i) => {
  const index = Math.floor(i / 3);
  acc[index] = acc[index] || [];
  acc[index].push(n);
  return acc;
}, [] as number[][]);

const bayerMatrix = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const palette = [
  [0x1a, 0x1c, 0x2c],
  [0x5d, 0x27, 0x5d],
  [0xb1, 0x3e, 0x53],
  [0xef, 0x7d, 0x57],
  [0xff, 0xcd, 0x75],
  [0xa7, 0xf0, 0x70],
  [0x38, 0xb7, 0x64],
  [0x25, 0x71, 0x79],
  [0x29, 0x36, 0x6f],
  [0x3b, 0x5d, 0xc9],
  [0x41, 0xa6, 0xf6],
  [0x73, 0xef, 0xf7],
  [0xf4, 0xf4, 0xf4],
  [0x94, 0xb0, 0xc2],
  [0x56, 0x6c, 0x86],
  [0x33, 0x3c, 0x57],
];

const code = {
  value: `
float getValue(float x, float y, float t) {
  return (x * y) * 1.8 + t * .1;
}
`,
  draw: (..._: any[]) => { },
  pallette: pallete[0],
  resolution: 7,
};

const params = {} as any;
const bindings: Record<string, BindingApi> = {}

const pane = new Pane();

pane.addButton({
  title: "Save",
}).on("click", () => {
  const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
  save(canvas, 5000);
});

pane.addBinding(code, "pallette", {
  options: Object.fromEntries(pallete.map((p, i) => [i, p])),
}).on("change", (e) => {
  code.draw = getDraw(code.value, getCoeffs(e.value)!);
});

pane.addBinding(code, "resolution", {
  min: 4,
  max: 9,
  step: 1,
})

const editor = CodeJar(document.querySelector(".editor")!, (editor) => {
  editor.removeAttribute("data-highlighted");
  return hljs.highlightElement(editor);
}, {
  tab: "  ",
})

editor.updateCode(code.value);

editor.onUpdate((value) => {
  try {
    const coeffs = getCoeffs(code.pallette);
    code.draw = getDraw(value, coeffs!);
    code.value = value;

    // capture type and name of uniforms
    const uniforms = value.match(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)/g)?.map((line) => {
      const [_, type, name] = line.match(/uniform\s+(float|vec2|vec3|vec4)\s+(\w+)/)!;
      return { type, name };
    });

    // add uniforms to pane
    uniforms?.forEach(({ type, name }) => {
      if (params[name] == null) {
        switch (type) {
          case "float":
            params[name] = 0;
            break;
          case "vec2":
            params[name] = { x: 0, y: 0 };
            break;
          case "vec3":
            params[name] = { x: 0, y: 0, z: 0 };
            break;
          case "vec4":
            params[name] = { r: 0, g: 0, b: 0, a: 0 };
            break;
        }

        bindings[name] = pane.addBinding(params, name);
      }
    });

    // remove uniforms from pane
    Object.entries(bindings).forEach(([name, binding]) => {
      if (!uniforms?.find((u) => u.name === name)) {
        binding.dispose();
        params[name] = null;
      }
    });

    pane.refresh();
  } catch (e) {
  }
});

const getDraw = (code: string, coeffs: number[][]) => {
  const uniforms = Object.fromEntries(
    Object.keys(params).map((key) => [key, regl.prop(key)])
  );

  return regl({
    frag: `
  precision mediump float;

  #define PI 3.1415926538
  #define BAYER_SIZE 4.0
  varying vec2 uv;
  uniform float time;
  uniform sampler2D palette; // 16 colors
  uniform sampler2D bayer; // 8x8 bayer matrix
  uniform float resolution;
  #define SIZE resolution

  uniform vec3 coeffsA;
  uniform vec3 coeffsB;
  uniform vec3 coeffsC;
  uniform vec3 coeffsD;

  ${code}

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d )
  {
      t = floor(t * 8.0) / 8.0;
      return a + b*cos( 6.28318*(c*t+d) );
  }

  void main () {
    float x = floor(uv.x * SIZE) / SIZE;
    float y = floor(-uv.y * SIZE) / SIZE;
    float t = time * 3.;
    float i = x * SIZE * 2. + y;

    float bayerValue = texture2D(bayer, vec2(
      mod(uv.x * 256., BAYER_SIZE * 1.0) / BAYER_SIZE * 1.,
      mod(uv.y * 256., BAYER_SIZE * 1.0) / BAYER_SIZE * 1.
    )).r / 1.;

    float value = mod((getValue(x, y, t)) + bayerValue, 1.0);
    gl_FragColor = vec4(pal(value, coeffsA, coeffsB, coeffsC, coeffsD), 1);
  }
    `,
    vert: `
  precision mediump float;
  attribute vec2 position;
  varying vec2 uv;
  void main () {
    uv = position; // FIXME: improve this
    gl_Position = vec4(position, 0, 1);
  }
`,
    attributes: {
      position: [
        [-1, -1],
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, 1],
        [1, -1],
      ],
    },
    uniforms: {
      time: regl.context("time"),
      palette: regl.texture([palette]),
      bayer: regl.texture(bayerMatrix),
      coeffsA: coeffs[0],
      coeffsB: coeffs[1],
      coeffsC: coeffs[2],
      coeffsD: coeffs[3],
      resolution: regl.prop("resolution"),
      ...uniforms,
    },
    count: 6,
  });
};

code.draw = getDraw(code.value, getCoeffs(pallete[0])!);

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
  });

  const _params = Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "number") {
        return [key, value];
      }

      if (typeof value !== "object") {
        return [key, value];
      }

      if (value == null) {
        return [key, value];
      }

      if ("z" in value) {
        return [key, [value.x, value.y, value.z]];
      }

      if ("a" in value) {
        return [key, [value.r, value.g, value.b, value.a]];
      }

      if ("y" in value) {
        return [key, [value.x, value.y]];
      }

      return [key, value];
    })
  );

  _params.resolution = Math.pow(2, code.resolution);

  code.draw(_params);
});
