"use client";

import React, { useEffect, useRef } from "react";
import clsx from "clsx";
import * as echarts from "echarts";
import type { EChartsCoreOption, EChartsType } from "echarts";

type EChartBaseProps = {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  onReady?: (instance: EChartsType) => void;
};

export const EChartBase: React.FC<EChartBaseProps> = ({ option, height = 320, className, onReady }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = containerRef.current;
    if (!target) {
      return;
    }

    let instance = echarts.getInstanceByDom(target);
    if (!instance) {
      instance = echarts.init(target, undefined, { renderer: "canvas" });
    }

    instance.setOption(option, { notMerge: false, lazyUpdate: true });
    onReady?.(instance);

    const resize = () => {
      if (!instance?.isDisposed()) {
        instance.resize();
      }
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(target);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      if (instance && !instance.isDisposed()) {
        instance.dispose();
      }
    };
  }, [option, onReady]);

  return <div ref={containerRef} className={clsx("w-full", className)} style={{ height }} />;
};

export default EChartBase;
