import "./style.css";
import createREGL from "regl";

import { Pane } from "tweakpane";

const letters = "abcdefghijklmnopqrsuvwz".split("");

const regl = createREGL();

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

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
  </div>
`;

const code = {
  value: `((x * y) * .16 + t)`,
  draw: (..._: any[]) => { },
};

const params = {} as any;

const pane = new Pane();

const btn = pane.addButton({
  title: "add",
});

btn.on("click", () => {
  const name = letters.shift();
  if (!name) return;

  params[name] = 0;
  pane.addBinding(params, name);
});

pane.addBinding(code, "value", {}).on("change", (event) => {
  const value = event.value as string;
  code.draw = getDraw(value);
});

const getDraw = (code: string) => {
  const uniforms = Object.fromEntries(
    Object.keys(params).map((key) => [key, regl.prop(key)])
  );

  return regl({
    frag: `
  precision mediump float;

  ${Object.keys(params).map((key) => `uniform float ${key};`).join("\n")}

  #define PI 3.1415926538
  #define SIZE 32.0
  #define BAYER_SIZE 2.0
  varying vec2 uv;
  uniform float time;
  uniform sampler2D palette; // 16 colors
  uniform sampler2D bayer; // 8x8 bayer matrix

  void main () {
    float x = floor(uv.x * SIZE);
    float y = floor(-uv.y * SIZE);
    float t = time * 3.;
    float i = x * SIZE * 2. + y;

    float bayerValue = texture2D(bayer, vec2(
      mod(uv.x * 128., BAYER_SIZE * 1.0) / BAYER_SIZE * 1.,
      mod(uv.y * 128., BAYER_SIZE * 1.0) / BAYER_SIZE * 1.
    )).r / 1.;

    float value = mod((${code}) / 16. + bayerValue, 1.0);
    gl_FragColor = texture2D(palette, vec2(value, 0.0));
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
      ...uniforms,
    },
    count: 6,
  });
};

code.draw = getDraw(code.value);

regl.frame(() => {
  regl.clear({
    color: [0, 0, 0, 1],
  });

  code.draw(params);
});
