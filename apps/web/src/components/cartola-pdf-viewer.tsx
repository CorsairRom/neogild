"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as pdfjs from "pdfjs-dist";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export function CartolaPdfViewer({
  movementId,
  password,
}: {
  movementId: string;
  password: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function render() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/email-movements/${movementId}/attachment`);
        if (!res.ok) throw new Error("No se pudo descargar el PDF");

        const data = await res.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data, password }).promise;

        if (!active) return;
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (!active) return;

          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className =
            "mx-auto max-w-full rounded-lg border border-zinc-200 shadow-sm dark:border-zinc-800";

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas no disponible");

          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
          if (active && pageNum === 1) setLoading(false);
        }
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Error al abrir el PDF";
        if (/password/i.test(msg) || /incorrect/i.test(msg)) {
          setError(
            "Contraseña incorrecta. Revisá tu RUT en Configuración (últimos 4 dígitos sin dígito verificador).",
          );
        } else {
          setError(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    render();
    return () => {
      active = false;
    };
  }, [movementId, password]);

  return (
    <div className="space-y-4">
      {loading && (
        <p className="text-sm text-zinc-500">Abriendo cartola encriptada…</p>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p>{error}</p>
          <Link href="/settings" className="mt-2 inline-block font-medium underline">
            Ir a Configuración → RUT
          </Link>
        </div>
      )}
      <div ref={containerRef} className="space-y-4 overflow-x-auto pb-8" />
    </div>
  );
}
