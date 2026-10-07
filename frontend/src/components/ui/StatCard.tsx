import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  color?: 'green' | 'orange' | 'blue' | 'purple';
}

const colors = {
  green:  { icon: 'bg-primary text-white' },
  orange: { icon: 'bg-accent text-white' },
  blue:   { icon: 'bg-blue-600 text-white' },
  purple: { icon: 'bg-purple-600 text-white' },
};

export function StatCard({ title, value, subtitle, icon: Icon, trend, color = 'green' }: StatCardProps) {
  const c = colors[color];
  return (
    <div className="card flex items-start gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', c.icon)}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {(subtitle || trend !== undefined) && (
          <div className="flex items-center gap-2 mt-1">
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            {trend !== undefined && (
              <span className={clsx('text-xs font-medium', trend >= 0 ? 'text-green-600' : 'text-red-500')}>
                {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}% vs mes ant.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
