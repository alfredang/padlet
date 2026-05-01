"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera, RotateCcw, Check, Loader2 } from "lucide-react";

export default function CameraCapture({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (url: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Blob | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e: any) {
        setError(
          e?.name === "NotAllowedError"
            ? "Camera access was denied. Allow it in your browser to take a photo."
            : "Couldn't open the camera. Make sure no other app is using it."
        );
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setSnapshot(blob);
        if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
        setSnapshotUrl(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92
    );
  }

  function retake() {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    setSnapshot(null);
    setSnapshotUrl(null);
  }

  async function usePhoto() {
    if (!snapshot) return;
    setUploading(true);
    try {
      const fd = new FormData();
      const file = new File([snapshot], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Upload failed: ${err?.error ?? res.statusText}`);
        return;
      }
      const { url } = await res.json();
      onUploaded(url);
      onClose();
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg animate-pop-in overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="font-bold flex items-center gap-2">
            <Camera size={18} /> Take a photo
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] grid place-items-center">
          {error ? (
            <div className="text-center px-6 text-slate-300 text-sm">{error}</div>
          ) : snapshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snapshotUrl} alt="Snapshot" className="w-full h-full object-contain" />
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 flex items-center justify-center gap-3">
          {snapshot ? (
            <>
              <button
                onClick={retake}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 font-semibold text-sm disabled:opacity-50"
              >
                <RotateCcw size={15} /> Retake
              </button>
              <button
                onClick={usePhoto}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 font-bold text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {uploading ? "Uploading…" : "Use photo"}
              </button>
            </>
          ) : (
            <button
              onClick={capture}
              disabled={!!error}
              className="w-16 h-16 rounded-full bg-white text-slate-900 grid place-items-center hover:scale-105 active:scale-95 transition shadow-xl disabled:opacity-30"
              aria-label="Capture"
            >
              <div className="w-12 h-12 rounded-full border-4 border-slate-900" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
