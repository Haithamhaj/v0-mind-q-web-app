"use client";

import React from "react";
import clsx from "clsx";
import type { Layer3Intelligence } from "../../data/intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

type KnimeResultsPanelProps = {
  data: Layer3Intelligence["knime"];
  className?: string;
};

const formatSize = (size?: number) => {
  if (!size || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const KnimeResultsPanel: React.FC<KnimeResultsPanelProps> = ({ data, className }) => {
  return (
    <Card className={clsx("border-border/40 bg-background/80 shadow-sm", className)} dir="rtl">
      <CardHeader className="flex flex-col gap-2 text-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold text-foreground">مخرجات KNIME المجهزة</CardTitle>
          <Badge variant="outline" className="text-xs font-medium">
            الوضع: {data.mode ?? "prompt"}
          </Badge>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          أحدث ملفات profile وملخص الجسر لتتبع ما تم تمريره إلى مرحلة 08 وإتاحته للطبقة الثالثة.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Run ID</span>
          <span className="font-mono text-foreground">{data.run_id ?? "—"}</span>
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
      </CardContent>
    </Card>
  );
};

export default KnimeResultsPanel;
