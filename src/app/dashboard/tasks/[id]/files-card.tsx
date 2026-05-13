"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/toast";
import { useI18n } from "@/lib/i18n/provider";
import {
  uploadTaskFileAction,
  deleteTaskFileAction,
  getTaskFileDownloadUrlAction,
} from "./files-actions";

export type TaskFile = {
  id: string;
  name: string;
  mime: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by: string | null;
  uploader: { username: string; full_name: string | null } | null;
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function iconFor(mime: string | null): string {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📕";
  if (mime.includes("zip") || mime.includes("compress")) return "🗜️";
  if (mime.includes("word") || mime.includes("doc")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel")) return "📊";
  return "📄";
}

export function FilesCard({
  taskId,
  initial,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  initial: TaskFile[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const { t } = useI18n();
  const [files, setFiles] = useState<TaskFile[]>(initial);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function uploadFile(file: File) {
    const fd = new FormData();
    fd.set("task_id", taskId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadTaskFileAction(fd);
      if (res.ok) {
        toast.success(`${file.name} ajouté`);
        // Optimistic add (will be replaced by server data on next nav)
        setFiles((prev) => [
          {
            id: "tmp-" + crypto.randomUUID(),
            name: file.name,
            mime: file.type || null,
            size_bytes: file.size,
            created_at: new Date().toISOString(),
            uploaded_by: currentUserId,
            uploader: null,
          },
          ...prev,
        ]);
      } else {
        toast.error(res.error);
      }
    });
  }

  function onChoose(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    for (const f of Array.from(list)) uploadFile(f);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const list = e.dataTransfer.files;
    if (!list) return;
    for (const f of Array.from(list)) uploadFile(f);
  }

  async function onDownload(f: TaskFile) {
    if (f.id.startsWith("tmp-")) {
      toast.info(t.taskDetail.fileRefresh);
      return;
    }
    const res = await getTaskFileDownloadUrlAction(f.id);
    if (res.ok) window.open(res.url, "_blank");
    else toast.error(res.error);
  }

  function onDelete(f: TaskFile) {
    if (!confirm(t.taskDetail.fileDeleteConfirm(f.name))) return;
    const before = files;
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    const fd = new FormData();
    fd.set("id", f.id);
    fd.set("task_id", taskId);
    startTransition(async () => {
      const res = await deleteTaskFileAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        setFiles(before);
      } else {
        toast.success(t.taskDetail.fileDeleted);
      }
    });
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>
          {t.taskDetail.files}
          <span className="ml-1.5 text-xs font-medium text-ink/40">
            {files.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-sm transition-colors ${
            dragOver
              ? "border-brand bg-brand/5 text-brand"
              : "border-ink/15 bg-white/40 text-ink/55"
          }`}
        >
          <p className="text-center">
            Glissez vos fichiers ici, ou
          </p>
          <label>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onChoose}
              disabled={pending}
            />
            <span
              className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md bg-brand px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
              role="button"
            >
              {pending ? "Téléversement…" : "Choisir un fichier"}
            </span>
          </label>
          <p className="text-xs text-ink/40">Max 25 Mo par fichier</p>
        </div>

        {files.length > 0 && (
          <ul className="space-y-1">
            {files.map((f) => {
              const canDelete =
                isAdmin || (f.uploaded_by && f.uploaded_by === currentUserId);
              return (
                <li
                  key={f.id}
                  className="group flex items-center gap-3 rounded-lg border border-white/40 bg-white/60 px-3 py-2 transition-colors hover:bg-white"
                >
                  <span className="text-xl">{iconFor(f.mime)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {f.name}
                    </p>
                    <p className="truncate text-xs text-ink/45">
                      {fmtSize(f.size_bytes)}
                      {f.uploader &&
                        ` · ${f.uploader.full_name ?? "@" + f.uploader.username}`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(f)}
                  >
                    Télécharger
                  </Button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(f)}
                      className="text-xs text-ink/30 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      title="Supprimer"
                      aria-label="Supprimer le fichier"
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
