import React from 'react';
import { cn } from '~/lib/core';

interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

export const HeroHeader = ({ 
  title, 
  subtitle, 
  badge, 
  icon, 
  children, 
  className,
  titleClassName,
  gradientFrom = "primary",
  gradientTo = "blue-500" 
}: HeroHeaderProps) => {
  const gradientFromClass = {
    primary: "bg-primary/20",
    "blue-500": "bg-blue-500/20",
    "indigo-500": "bg-indigo-500/20",
  }[gradientFrom] || "bg-primary/20";

  const gradientToClass = {
    primary: "bg-primary/10",
    "blue-500": "bg-blue-500/10",
    "indigo-500": "bg-indigo-500/10",
  }[gradientTo] || "bg-blue-500/10";

  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 shadow-2xl md:px-12 md:py-16", className)}>
      <div className={cn("absolute top-0 right-0 -m-20 h-80 w-80 rounded-full blur-3xl opacity-20", gradientFromClass)} />
      <div className={cn("absolute bottom-0 left-0 -m-20 h-80 w-80 rounded-full blur-3xl opacity-20", gradientToClass)} />
      
      <div className="relative flex flex-col items-center justify-between gap-6 md:flex-row">
        <div className="space-y-4 text-center md:text-left">
          {badge && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-primary backdrop-blur-md border border-white/20">
              {icon}
              {badge}
            </div>
          )}
          <h1 className={cn("text-3xl font-bold tracking-tight text-white md:text-5xl", titleClassName)}>
            {title}
          </h1>
          {subtitle && (
            <p className="max-w-xl text-lg text-slate-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        {children && (
          <div className="flex flex-wrap justify-center gap-3">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
