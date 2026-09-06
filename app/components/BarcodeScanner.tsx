"use client";
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

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
  const containerId = "barcode-scanner-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setReady(false);

    const scanner = new Html5Qrcode(containerId);
    scannerRef.current = scanner;

    const startPromise = scanner
      .start(
        // videoConstraints: request a higher resolution feed — low-res
        // streams (often the default) make 1D barcodes very hard to decode
        // since they need sharp resolution along one axis.
        {
          facingMode: "environment",
        },
        {
          fps: 10,
          // NOTE: qrbox intentionally omitted for now — cropping to a box
          // that doesn't match your actual video resolution/aspect ratio
          // can silently make the library scan the wrong region and never
          // find anything. Once scanning works, we can reintroduce a qrbox
          // sized correctly for your device.
          videoConstraints: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        (decodedText) => {
          console.log("✅ DECODED:", decodedText); // TEMP DEBUG — remove later
          const now = Date.now();
          if (now - lastScanRef.current < cooldownMs) return;
          lastScanRef.current = now;
          onScan(decodedText);
        },
        (errorMessage) => {
          // TEMP DEBUG — logs every frame where no barcode was found.
          // If you see this repeating in the console, the scan loop IS
          // running; if you see nothing at all, the loop never started.
          console.log("…scanning, no match this frame:", errorMessage);
        }
      )
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error("Failed to start camera:", err);
        if (!cancelled) setError(describeCameraError(err));
      });

    return () => {
      cancelled = true;
      startPromise
        .catch(() => {
          /* start already failed, nothing to stop */
        })
        .finally(() => {
          const s = scannerRef.current;
          if (!s) return;
          if (s.getState && s.getState() === 2 /* SCANNING */) {
            s.stop()
              .then(() => s.clear())
              .catch(() => {
                /* already stopped, ignore */
              });
          } else {
            s.clear();
          }
        });
    };
  }, [onScan, cooldownMs]);

  return (
    <div className="relative w-full h-full">
      <div id={containerId} className="w-full h-full" />

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
    </div>
  );
}