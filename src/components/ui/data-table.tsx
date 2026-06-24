'use client';

import React, { useState, useCallback } from 'react';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
  mobileHide?: boolean;
  sortable?: boolean;
};

export type DataTableProps<T> = {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  loading?: boolean;
  emptyState?: React.ReactNode;
  mobileCardRender?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
};

type SortDirection = 'asc' | 'desc' | null;

function TableSkeleton({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-[#22506F]/60">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 bg-[#1A3E5C] rounded animate-pulse w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MobileCardSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="bg-[#0D2D47] border border-[#22506F] rounded-xl mb-2 p-4 space-y-2"
        >
          <div className="h-4 bg-[#1A3E5C] rounded animate-pulse w-3/4" />
          <div className="h-3 bg-[#1A3E5C] rounded animate-pulse w-1/2" />
          <div className="h-3 bg-[#1A3E5C] rounded animate-pulse w-2/3" />
        </div>
      ))}
    </>
  );
}

function DefaultMobileCard<T>({
  row,
  columns,
  index,
  onClick,
}: {
  row: T;
  columns: Column<T>[];
  index: number;
  onClick?: (row: T) => void;
}) {
  return (
    <div
      className={[
        'bg-[#0D2D47] border border-[#22506F] rounded-xl mb-2 p-4',
        onClick ? 'cursor-pointer active:bg-[#123A5A]' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick ? () => onClick(row) : undefined}
    >
      {columns.map((col) => (
        <div key={col.key} className="flex flex-col mb-2 last:mb-0">
          <span className="text-[10px] uppercase tracking-widest text-[#64748B] mb-0.5">
            {col.header}
          </span>
          <span className="text-sm text-white">{col.render(row, index)}</span>
        </div>
      ))}
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  loading = false,
  emptyState,
  mobileCardRender,
  onRowClick,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else if (sortDirection === 'desc') {
          setSortKey(null);
          setSortDirection(null);
        } else {
          setSortDirection('asc');
        }
      } else {
        setSortKey(key);
        setSortDirection('asc');
      }
    },
    [sortKey, sortDirection]
  );

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const aStr = String(aVal);
      const bStr = String(bVal);
      const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDirection]);

  const desktopColumns = columns;
  const mobileColumns = columns.filter((col) => !col.mobileHide);

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey) {
      return (
        <svg
          className="inline-block ml-1 w-3 h-3 text-[#64748B] opacity-40"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M6 2L9 5H3L6 2Z" fill="currentColor" />
          <path d="M6 10L3 7H9L6 10Z" fill="currentColor" />
        </svg>
      );
    }
    if (sortDirection === 'asc') {
      return (
        <svg
          className="inline-block ml-1 w-3 h-3 text-white"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M6 2L9 5H3L6 2Z" fill="currentColor" />
        </svg>
      );
    }
    return (
      <svg
        className="inline-block ml-1 w-3 h-3 text-white"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M6 10L3 7H9L6 10Z" fill="currentColor" />
      </svg>
    );
  };

  const isEmpty = !loading && sortedData.length === 0;

  return (
    <div className={className}>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#22506F]">
              {desktopColumns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    'px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[#64748B] font-medium whitespace-nowrap',
                    col.sortable ? 'cursor-pointer select-none hover:text-white transition-colors' : '',
                    col.className ?? '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.header}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton columns={desktopColumns.length} />
            ) : isEmpty ? (
              <tr>
                <td
                  colSpan={desktopColumns.length}
                  className="px-4 py-12 text-center text-[#64748B]"
                >
                  {emptyState ?? (
                    <span className="text-sm">No data available</span>
                  )}
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={String(row[keyField])}
                  className={[
                    'border-b border-[#22506F]/60 transition-colors',
                    onRowClick
                      ? 'cursor-pointer hover:bg-[#123A5A]/60'
                      : 'hover:bg-[#123A5A]/60',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {desktopColumns.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        'px-4 py-3 text-sm text-white',
                        col.className ?? '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="block md:hidden">
        {loading ? (
          <MobileCardSkeleton />
        ) : isEmpty ? (
          <div className="py-12 text-center text-[#64748B]">
            {emptyState ?? <span className="text-sm">No data available</span>}
          </div>
        ) : (
          sortedData.map((row, index) =>
            mobileCardRender ? (
              <div
                key={String(row[keyField])}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {mobileCardRender(row)}
              </div>
            ) : (
              <DefaultMobileCard
                key={String(row[keyField])}
                row={row}
                columns={mobileColumns}
                index={index}
                onClick={onRowClick}
              />
            )
          )
        )}
      </div>
    </div>
  );
}
