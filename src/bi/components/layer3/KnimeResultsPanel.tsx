"use client";

import React from "react";
import clsx from "clsx";
import type { Layer3Intelligence } from "../../data/intelligence";
import type { KnimeDataSnapshot } from "../../data/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

type KnimeResultsPanelProps = {
  data: Layer3Intelligence["knime"];
  dataset?: KnimeDataSnapshot | null;
  className?: string;
};

const formatSize = (size?: number) => {
  if (!size || size <= 0) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const KnimeResultsPanel: React.FC<KnimeResultsPanelProps> = ({ data, dataset, className }) => {
  const totalRows = dataset?.total_rows ?? data.data_parquet?.rows ?? null;
  const parquetSize = dataset?.size_bytes ?? data.data_parquet?.size_bytes;
  const parquetUpdatedAt = dataset?.updated_at ?? data.data_parquet?.updated_at;
  const previewColumns =
    dataset?.columns?.length ? dataset.columns.slice(0, 8) : data.data_parquet?.columns?.slice(0, 8) ?? [];
  const previewRows =
    dataset?.rows?.length ? dataset.rows.slice(0, Math.min(dataset.rows.length, 10)) : data.data_parquet?.preview ?? [];
  const previewLink = dataset?.run ? `/api/bi/knime-data?run=${encodeURIComponent(dataset.run)}&limit=1000` : undefined;

  return (
    <Card className={clsx("border-border/40 bg-background/80 shadow-sm", className)} dir="rtl">
      <CardHeader className="flex flex-col gap-2 text-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">نتائج KNIME المجمعة</CardTitle>
          <Badge variant="outline" className="text-xs font-medium">
            الوضع: {data.mode ?? "prompt"}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          نظرة سريعة على ملفات profile الناتجة من الجسر بعد المرحلة 08 مع معاينة لأهم الحقول.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Run ID</span>
          <span className="font-mono text-foreground">{data.run_id ?? "-"}</span>
        </div>
        <div className="grid gap-2 rounded-xl border border-border/50 bg-background/40 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>عدد الصفوف</span>
            <span className="font-semibold text-foreground">{totalRows ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>عدد الأعمدة</span>
            <span className="font-medium text-foreground">
              {previewColumns.length || data.files.length || data.data_parquet?.columns?.length || "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>آخر تحديث</span>
            <span>{parquetUpdatedAt ? new Date(parquetUpdatedAt).toLocaleString("ar-SA") : "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>الحجم</span>
            <span>{formatSize(parquetSize)}</span>
          </div>
          {previewLink ? (
            <a
              href={previewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              تنزيل المعاينة الكاملة (JSON)
            </a>
          ) : null}
        </div>
        <ul className="space-y-2">
          {data.files.map((file) => (
            <li
              key={file.path}
              className="flex flex-col gap-1 rounded-xl border border-border/60 bg-background/60 p-3 text-xs text-start"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{file.name}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{formatSize(file.size_bytes)}</span>
                  {file.updated_at ? <span>{new Date(file.updated_at).toLocaleString("ar-SA")}</span> : null}
                  <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </div>
              </div>
              {file.summary ? <p className="text-muted-foreground">{file.summary}</p> : null}
            </li>
          ))}
        </ul>
        <div className="space-y-2 pt-1">
          <h4 className="text-sm font-semibold text-foreground">معاينة الجدول</h4>
          {previewColumns.length && previewRows.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-separate border-spacing-y-1 text-start text-xs">
                <thead>
                  <tr>
                    {previewColumns.map((column) => (
                      <th key={column} className="rounded-lg bg-muted px-3 py-2 font-semibold text-muted-foreground">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="rounded-lg">
                      {previewColumns.map((column) => (
                        <td key={column} className="rounded-lg bg-background/70 px-3 py-2 text-foreground">
                          {row?.[column] !== undefined && row?.[column] !== null ? String(row[column]) : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
              لا توجد معاينة جاهزة بعد. يرجى التأكد من تشغيل الجسر أو تحديث بيانات KNIME.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KnimeResultsPanel;
