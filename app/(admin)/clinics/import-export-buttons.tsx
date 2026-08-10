"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ImportExportButtons() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/clinics/import", { method: "POST", body: formData });

    setImporting(false);
    e.target.value = "";
    if (res.ok) router.refresh();
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onImport}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-4 w-4" />
        {importing ? "Importing…" : "Import"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
        <a href="/api/clinics/export">
          <Download className="h-4 w-4" />
          Export
        </a>
      </Button>
    </>
  );
}
