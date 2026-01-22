import React from 'react';
import { Card } from './card';
import { cn } from '~/lib/core';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const GlassCard = ({ children, className, onClick }: GlassCardProps) => (
  <Card 
    onClick={onClick}
    className={cn(
      "border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 transition-all", 
      onClick && "cursor-pointer hover:bg-white/60 dark:hover:bg-slate-900/60",
      className
    )}
  >
    {children}
  </Card>
);
