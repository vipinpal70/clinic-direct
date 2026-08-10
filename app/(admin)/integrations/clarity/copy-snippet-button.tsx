"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopySnippetButton({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3"
      onClick={async () => {
        await navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied!" : "Copy snippet"}
    </Button>
  );
}
