import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger 
} from './popover';
import { Button } from './button';
import { cn } from '~/lib/core';
import { Check } from 'lucide-react';

interface ColorPickerProps {
    value?: string;
    onChange: (value: string) => void;
    className?: string;
}

const PRESET_COLORS = [
    '#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', 
    '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#22c55e', 
    '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#64748b'
];

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    className={cn("h-12 w-full justify-start rounded-2xl bg-slate-50 border-slate-200 px-4 hover:bg-slate-100 transition-all", className)}
                >
                    <div className="flex items-center gap-3">
                        <div 
                            className="w-6 h-6 rounded-full border border-slate-200 shadow-sm shrink-0" 
                            style={{ backgroundColor: value || '#6366f1' }} 
                        />
                        <span className="font-mono text-sm font-bold uppercase">{value || '#6366f1'}</span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 rounded-2xl shadow-2xl border-none">
                <div className="space-y-4">
                    <div className="grid grid-cols-6 gap-2">
                        {PRESET_COLORS.map(color => (
                            <button 
                                key={color}
                                type="button"
                                className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center transition-transform hover:scale-110 active:scale-95 shadow-sm"
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    onChange(color);
                                    setOpen(false);
                                }}
                            >
                                {value === color && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <input 
                            type="color" 
                            value={value || '#6366f1'} 
                            onChange={(e) => onChange(e.target.value)}
                            className="w-8 h-8 rounded-md border border-slate-200 cursor-pointer p-0 overflow-hidden"
                        />
                        <input 
                            type="text" 
                            value={value || '#6366f1'} 
                            onChange={(e) => onChange(e.target.value)}
                            className="flex-1 h-8 rounded-lg bg-slate-50 border border-slate-200 px-2 text-xs font-mono font-bold uppercase outline-none focus:ring-1 focus:ring-primary/20"
                        />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
