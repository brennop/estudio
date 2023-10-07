import { TpPlugin } from "tweakpane";
import { CodeJar } from "codejar";
import { BindingTarget, ValueController, View, Value, ViewProps, TpPluginBundle, createPlugin } from "@tweakpane/core";

interface Config {
  value: Value<string>;
  viewProps: ViewProps;
}

class EditorView implements View {
  public readonly element: HTMLElement;
  public readonly jar: CodeJar;

  constructor(doc: Document, config: Config) {
    const el = doc.createElement("div");
    el.classList.add("editor");
    this.element = el;

    this.jar = CodeJar(el, () => { });
    this.jar.updateCode(config.value.rawValue);
  }
}

class EditorController implements ValueController<string, EditorView> {
  public readonly value: Value<string>;
  public readonly view: EditorView;
  public readonly viewProps: ViewProps;

  constructor(doc: Document, config: Config) {
    this.value = config.value;
    this.viewProps = config.viewProps;

    this.view = new EditorView(doc, {
      value: config.value,
      viewProps: this.viewProps,
    });

    this.view.jar.onUpdate(code => {
      this.value.rawValue = code;
    });
  }
}

const EditorPlugin: TpPlugin = createPlugin({
  id: "editor",
  type: "input",
  accept: (value: unknown, params: Record<string, unknown>) => {
    if (typeof value !== "string") return null;
    if (typeof params !== "object") return null;
    if (params.view !== "editor") return null;
    return {
      initialValue: value,
      params: params,
    };
  },
  binding: {
    reader: () => (value: unknown) => String(value),
    writer: () => (target: BindingTarget, value: string) => {
      target.write(value);
    }
  },
  controller(args) {
    return new EditorController(args.document, {
      value: args.value,
      viewProps: args.viewProps,
    });
  },
});

// const EditorPluginBundle: TpPluginBundle = {
//   id: "editor",
//   plugins: [EditorPlugin],
// };

export const plugins = [EditorPlugin];
export const id = "editor";
