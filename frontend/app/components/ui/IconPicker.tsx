import React, { useState, useMemo } from 'react';
import { Search, Check, HelpCircle } from 'lucide-react';
import { 
    Popover, 
    PopoverContent, 
    PopoverTrigger 
} from '~/components/ui/popover';
import { Button } from '~/components/ui/button';
import { ScrollArea } from '~/components/ui/scroll-area';
import { IconMap } from '~/lib/icons';
import { cn } from '~/lib/core';

interface IconPickerProps {
    value?: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

export function IconPicker({ value, onChange, className, placeholder = "Select icon..." }: IconPickerProps) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const icons = useMemo(() => {
        // Filter out aliases or duplicates if necessary, but here we just list all
        return Object.keys(IconMap)
            .filter(name => name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => a.localeCompare(b));
    }, [search]);

    const SelectedIcon = (value && IconMap[value]) ? IconMap[value] : HelpCircle;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button 
                    variant="outline" 
                    role="combobox" 
                    aria-expanded={open}
                    className={cn("w-full justify-start h-8 px-2 text-xs font-normal border-slate-200 bg-slate-50/50 hover:bg-slate-100", className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        <div className="flex h-5 w-5 items-center justify-center rounded bg-white border border-slate-100 shadow-sm shrink-0">
                            <SelectedIcon className="h-3.5 w-3.5 text-slate-600" />
                        </div>
                        <span className="truncate">{typeof value === 'string' ? value : placeholder}</span>
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 shadow-2xl border-slate-200" align="start">
                <div className="flex items-center border-b border-slate-100 px-3 py-2 bg-slate-50/50">
                    <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <input
                        className="flex h-7 w-full rounded-md bg-transparent text-xs outline-none placeholder:text-slate-400"
                        placeholder="Search Lucide icons..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <ScrollArea className="h-[280px]">
                    <div className="grid grid-cols-5 gap-1 p-2">
                        {icons.map((name) => {
                            const Icon = IconMap[name];
                            const isSelected = value === name;
                            return (
                                <button
                                    key={name}
                                    type="button"
                                    className={cn(
                                        "flex flex-col h-14 items-center justify-center rounded-md transition-all relative group",
                                        isSelected 
                                            ? "bg-primary/10 ring-1 ring-primary overflow-hidden" 
                                            : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
                                    )}
                                    onClick={() => {
                                        onChange(name);
                                        setOpen(false);
                                    }}
                                    title={name}
                                >
                                    <Icon className={cn(
                                        "h-5 w-5 mb-1",
                                        isSelected ? "text-primary" : "text-slate-500"
                                    )} />
                                    <span className="text-[8px] truncate w-full px-1 text-center opacity-70 group-hover:opacity-100">
                                        {name}
                                    </span>
                                    {isSelected && (
                                        <div className="absolute top-0 right-0 p-0.5 bg-primary text-white">
                                            <Check className="h-2 w-2" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                        {icons.length === 0 && (
                            <div className="col-span-full py-10 text-center text-[10px] text-slate-400 italic">
                                No icons found in Registry.
                            </div>
                        )}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t border-slate-100 bg-slate-50/30">
                    <p className="text-[9px] text-slate-400 leading-tight">
                        Icon names follow <strong>Lucide</strong> naming convention (e.g., Users, Calendar, Activity).
                    </p>
                </div>
            </PopoverContent>
        </Popover>
    );
}
