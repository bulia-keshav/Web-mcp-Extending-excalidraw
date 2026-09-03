import { useEffect, useRef, useState } from "react";
import { subscribePicker, cancelPicker, type PickerRequest } from "./pickerBridge";
import "./PickerHost.css";

/** Renders whichever capture UI the current tool call is waiting on. */
export default function PickerHost() {
  const [req, setReq] = useState<PickerRequest | null>(null);
  useEffect(() => subscribePicker(setReq), []);

  if (!req) return null;
  return req.kind === "file" ? <FilePrompt req={req} /> : <CameraModal req={req} />;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function FilePrompt({ req }: { req: PickerRequest }) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Browsers only open a file dialog from a real user gesture, so we show a
  // button rather than trying to click the input programmatically.
  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true">
      <div className="picker-card">
        <h2>The agent asked for an image</h2>
        <p>Choose a photo or screenshot to place on the canvas.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try { req.resolve(await readAsDataURL(file)); }
            catch (err) { req.reject(err instanceof Error ? err : new Error(String(err))); }
          }}
        />
        <div className="picker-actions">
          <button className="picker-primary" onClick={() => inputRef.current?.click()}>Choose image…</button>
          <button onClick={cancelPicker}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function CameraModal({ req }: { req: PickerRequest }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not open the camera.");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { req.reject(new Error("Could not capture a frame.")); return; }
    ctx.drawImage(video, 0, 0);
    req.resolve(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="picker-backdrop" role="dialog" aria-modal="true">
      <div className="picker-card picker-card--camera">
        <h2>Point at your sketch</h2>
        {error ? (
          <p className="picker-error">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted className="picker-video" />
        )}
        <div className="picker-actions">
          {!error && <button className="picker-primary" onClick={capture}>Capture</button>}
          <button onClick={cancelPicker}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
