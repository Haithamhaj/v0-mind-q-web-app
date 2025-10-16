'use client';

import React from 'react';
import clsx from 'clsx';

type Driver = {
  dimension: string;
  value: string;
  impact?: number | null;
};

type InsightCardProps = {
  title: string;
  summary: string;
  severity?: 'low' | 'medium' | 'high';
  drivers?: Driver[];
  onOpen?: () => void;
  source?: string;
};

const severityConfig: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-rose-500/10 text-rose-500 dark:text-rose-300' },
  medium: { label: 'Medium', className: 'bg-amber-500/10 text-amber-500 dark:text-amber-300' },
  low: { label: 'Low', className: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-300' },
  default: { label: 'Unclassified', className: 'bg-muted text-muted-foreground' },
};

export const InsightCard: React.FC<InsightCardProps> = ({
  title,
  summary,
  severity = 'medium',
  drivers = [],
  onOpen,
  source,
}) => {
  const badge = severityConfig[severity] ?? severityConfig.default;

  return (
    <article
      dir='rtl'
      className='flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg'
    >
      <div className='flex items-start justify-between gap-3'>
        <h3 className='text-base font-semibold'>{title}</h3>
        <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', badge.className)}>{badge.label}</span>
      </div>
      <p className='text-sm text-muted-foreground'>{summary}</p>
      {drivers.length > 0 && (
        <div className='rounded-xl border border-dashed border-border/50 bg-muted/40 p-3'>
          <span className='mb-2 block text-xs font-medium text-muted-foreground'>Key drivers</span>
          <ul className='flex flex-col gap-2 text-sm'>
            {drivers.map((driver, index) => (
              <li key={${driver.dimension}--} className='flex items-center justify-between gap-3'>
                <span className='truncate font-medium'>{driver.dimension}</span>
                <span className='truncate text-sm text-muted-foreground'>{driver.value}</span>
                {typeof driver.impact === 'number' && !Number.isNaN(driver.impact) && (
                  <span className='text-xs font-medium text-primary/80'>{(driver.impact * 100).toFixed(1)}%</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className='flex items-center justify-between text-xs text-muted-foreground'>
        {source && <span>{source}</span>}
        <button
          type='button'
          onClick={onOpen}
          className='rounded-full px-3 py-1 font-medium text-primary transition hover:bg-primary/10'
        >
          Open analysis
        </button>
      </div>
    </article>
  );
};

export default InsightCard;

