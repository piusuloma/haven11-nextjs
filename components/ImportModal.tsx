"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, Upload } from "lucide-react";
import { Modal, ModalButton } from "@/components/Modal";
import { parseCsv } from "@/lib/csv";
import { exportCsv } from "@/lib/export";

export interface ImportResult { added: number; error?: string }

/**
 * Reusable bulk-import dialog. The caller supplies the expected columns, a
 * sample row for the downloadable template, and an `onImport` that maps the
 * parsed rows onto domain objects.
 */
export function ImportModal({
  open,
  onClose,
  title,
  description,
  templateName,
  sample,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  templateName: string;
  sample: Record<string, string | number>;
  onImport: (rows: Record<string, string>[]) => ImportResult;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const rows = text.trim() ? parseCsv(text) : [];
  const headers = Object.keys(sample);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.onerror = () => toast.error("Could not read that file");
    reader.readAsText(file);
  }

  function doImport() {
    if (rows.length === 0) { toast.error("Paste or upload a CSV first"); return; }
    const result = onImport(rows);
    if (result.error) { toast.error(result.error); return; }
    toast.success(`Imported ${result.added} row${result.added !== 1 ? "s" : ""}`);
    setText("");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={doImport} disabled={rows.length === 0}>
            Import{rows.length > 0 ? ` ${rows.length} row${rows.length !== 1 ? "s" : ""}` : ""}
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { exportCsv(templateName, [sample]); toast.success("Template downloaded"); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-surface"
          >
            <FileDown className="h-3.5 w-3.5" />Download template
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-surface"
          >
            <Upload className="h-3.5 w-3.5" />Upload .csv file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            …or paste CSV rows — columns: <span className="font-mono text-foreground">{headers.join(", ")}</span>
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={`${headers.join(",")}\n${headers.map((h) => sample[h]).join(",")}`}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y"
          />
        </div>

        {rows.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <p className="bg-surface/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Preview · {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
            </p>
            <div className="overflow-x-auto max-h-48">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    {Object.keys(rows[0]).map((h) => <th key={h} className="px-3 py-1.5 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      {Object.keys(rows[0]).map((h) => <td key={h} className="px-3 py-1.5">{r[h]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 8 && <p className="px-3 py-1.5 text-xs text-muted-foreground">+ {rows.length - 8} more…</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}
