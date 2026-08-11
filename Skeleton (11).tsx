import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded ${className}`} />
  );
};

export const TableRowSkeleton: React.FC = () => (
    <tr className="border-b border-slate-100">
        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
        <td className="px-6 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
        <td className="px-6 py-4"><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-lg" /><Skeleton className="h-8 w-8 rounded-lg" /></div></td>
    </tr>
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-start">
            <div className="space-y-3 w-full">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
    </div>
);