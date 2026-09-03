/**
 * Bridge between tools (plain modules) and React UI.
 *
 * A tool cannot open a file dialog or a camera on its own — the browser
 * requires these to be user-driven. The tool raises a request, the UI renders
 * the appropriate control, and the human's action resolves the tool's promise.
 */
export type PickerKind = "file" | "camera";

export type PickerRequest = {
  kind: PickerKind;
  resolve: (dataURL: string) => void;
  reject: (reason: Error) => void;
};

let pending: PickerRequest | null = null;
const listeners = new Set<(req: PickerRequest | null) => void>();

function emit() {
  listeners.forEach((fn) => fn(pending));
}

export function subscribePicker(fn: (req: PickerRequest | null) => void) {
  listeners.add(fn);
  fn(pending);
  return () => {
    listeners.delete(fn);
  };
}

export function requestPicker(kind: PickerKind, timeoutMs = 120_000): Promise<string> {
  if (pending) return Promise.reject(new Error("Another picker is already open."));

  return new Promise<string>((resolve, reject) => {
    // Without a timeout an abandoned dialog would leave the agent's tool call
    // hanging forever.
    const timer = setTimeout(() => {
      pending = null;
      emit();
      reject(new Error("Timed out waiting for the human to choose."));
    }, timeoutMs);

    pending = {
      kind,
      resolve: (dataURL) => { clearTimeout(timer); pending = null; emit(); resolve(dataURL); },
      reject: (reason) => { clearTimeout(timer); pending = null; emit(); reject(reason); },
    };
    emit();
  });
}

export function cancelPicker() {
  pending?.reject(new Error("Cancelled by the human."));
}
