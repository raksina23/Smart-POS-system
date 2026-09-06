"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from "@zxing/browser";
import { DecodeHintType, BarcodeFormat, NotFoundException } from "@zxing/library";

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  cooldownMs?: number;
}

function describeCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "ต้องเปิดผ่าน HTTPS หรือ localhost เท่านั้น / Camera requires HTTPS or localhost.";
  }
  if (name === "NotAllowedError" || message.includes("Permission")) {
    return "ไม่ได้รับอนุญาตให้ใช้กล้อง / Camera permission was denied.";
  }
  if (name === "NotFoundError" || message.includes("Requested device not found")) {
    return "ไม่พบกล้องบนอุปกรณ์นี้ / No camera was found on this device.";
  }
  if (name === "NotReadableError") {
    return "กล้องถูกใช้งานโดยแอปอื่นอยู่ / The camera is already in use by another app or tab.";
  }
  return `เปิดกล้องไม่สำเร็จ / Couldn't start the camera: ${message}`;
}

export default function BarcodeScanner({ onScan, cooldownMs = 1500 }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    // Explicitly restrict to the barcode formats you actually need —
    // ZXing tries fewer formats per frame this way, which speeds up
    // and improves decode accuracy versus scanning for everything.
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints);

    const start = async () => {
      try {
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (videoInputDevices.length === 0) {
          throw Object.assign(new Error("Requested device not found"), { name: "NotFoundError" });
        }

        // Prefer the back/environment camera on phones
        const backCamera =
          videoInputDevices.find((d) => /back|rear|environment/i.test(d.label)) ??
          videoInputDevices[videoInputDevices.length - 1];

        const controls = await reader.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current!,
          (result, err) => {
            if (result) {
              const text = result.getText();
              const now = Date.now();
              if (now - lastScanRef.current < cooldownMs) return;
              lastScanRef.current = now;
              console.log("✅ DECODED:", text); // remove once confirmed reliable
              onScan(text);
              return;
            }
            // NotFoundException fires continuously while nothing is in
            // frame yet — expected, not a real error, so we ignore it.
            if (err && !(err instanceof NotFoundException)) {
              console.log("scan frame error:", err);
            }
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setReady(true);

        // Check if this device/camera supports a torch (flashlight)
        const track = (videoRef.current?.srcObject as MediaStream)
          ?.getVideoTracks()?.[0];
        const capabilities = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchSupported(!!capabilities?.torch);
      } catch (err) {
        console.error("Failed to start camera:", err);
        if (!cancelled) setError(describeCameraError(err));
      }
    };

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onScan, cooldownMs]);

  const toggleTorch = async () => {
    const track = (videoRef.current?.srcObject as MediaStream)?.getVideoTracks()?.[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: next } as any],
      });
      setTorchOn(next);
    } catch (err) {
      console.log("Torch toggle failed:", err);
    }
  };

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
      />

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 text-gray-500 text-sm font-medium pointer-events-none">
          📷 กำลังเปิดกล้อง... / Starting camera...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-3">
          <p className="text-red-600 text-xs font-medium text-center leading-snug">
            ⚠️ {error}
          </p>
        </div>
      )}

      {ready && torchSupported && (
        <button
          type="button"
          onClick={toggleTorch}
          className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-md z-10"
        >
          {torchOn ? "🔦 ปิดไฟฉาย" : "🔦 เปิดไฟฉาย"}
        </button>
      )}
    </div>
  );
}