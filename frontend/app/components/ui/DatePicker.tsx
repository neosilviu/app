import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO } from 'date-fns';
import * as Locales from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { cn } from '~/lib/core';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

interface DatePickerProps {
    value?: string | Date;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
    showTime?: boolean;
}

export function DatePicker({ value, onChange, placeholder, className, showTime = false }: DatePickerProps) {
    const { t } = useTranslation();
    const { lang = 'en' } = useParams();
    const dateLocale = (Locales as any)[lang] || Locales.enUS;

    const [open, setOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(value ? (typeof value === 'string' ? parseISO(value) : value) : new Date());

    const selectedDate = value ? (typeof value === 'string' ? parseISO(value) : value) : null;

    const [time, setTime] = useState(() => {
        if (!selectedDate) return "12:00";
        return format(selectedDate, "HH:mm");
    });

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-2 py-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-black uppercase tracking-tighter">
                    {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
                </span>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        );
    };

    const renderDays = () => {
        const days = [];
        const date = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        for (let i = 0; i < 7; i++) {
            days.push(
                <div key={i} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">
                    {date[i]}
                </div>
            );
        }
        return <div className="grid grid-cols-7 border-b border-slate-100">{days}</div>;
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, "d");
                const cloneDay = day;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);

                days.push(
                    <button
                        key={day.toString()}
                        className={cn(
                            "h-8 w-8 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center m-0.5",
                            !isCurrentMonth ? "text-slate-200 pointer-events-none" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600",
                            isSelected && "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100"
                        )}
                        onClick={() => {
                            let newDate = cloneDay;
                            if (showTime) {
                                const [hours, minutes] = time.split(':').map(Number);
                                newDate = new Date(cloneDay);
                                newDate.setHours(hours, minutes);
                            }
                            onChange(newDate.toISOString());
                            if (!showTime) {
                                setOpen(false);
                            }
                        }}
                        type="button"
                    >
                        <span>{formattedDate}</span>
                    </button>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="p-1">{rows}</div>;
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <div 
                    className={cn(
                        "group p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-indigo-200 transition-all active:scale-[0.98]",
                        !value && "opacity-80 bg-slate-50/50",
                        className
                    )}
                >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white shrink-0">
                        <CalendarIcon size={20} className="mb-0.5" />
                        {selectedDate && <span className="text-[9px] font-black leading-none">{format(selectedDate, "MMM", { locale: dateLocale }).toUpperCase()}</span>}
                    </div>
                    <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-400 leading-none mb-1">
                            {placeholder || t('common.date')}
                        </span>
                        <span className="text-sm font-black text-slate-800 italic truncate">
                            {selectedDate ? format(selectedDate, showTime ? 'PPP HH:mm' : 'PPP', { locale: dateLocale }) : <span>{placeholder || t('common.select_date')}</span>}
                        </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 hover:bg-indigo-50 transition-colors shrink-0">
                        <Plus size={16} />
                    </div>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-3xl border-none shadow-2xl bg-white/95 backdrop-blur-md overflow-hidden z-50" align="start">
                <div className="w-[280px]">
                    {renderHeader()}
                    {renderDays()}
                    {renderCells()}
                    
                    {showTime && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col gap-2">
                             <span className="text-[9px] font-black uppercase text-slate-400">{t('common.select_time')}</span>
                             <div className="flex items-center gap-2">
                                 <input 
                                    type="time" 
                                    value={time}
                                    onChange={(e) => {
                                        setTime(e.target.value);
                                        if (selectedDate) {
                                            const [hours, minutes] = e.target.value.split(':').map(Number);
                                            const newDate = new Date(selectedDate);
                                            newDate.setHours(hours, minutes);
                                            onChange(newDate.toISOString());
                                        }
                                    }}
                                    className="flex-1 h-9 rounded-xl border border-slate-200 bg-white px-3 font-bold text-xs focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                 />
                             </div>
                        </div>
                    )}

                    <div className="p-2 border-t border-slate-100 flex flex-col gap-1 bg-slate-50/30">
                         {showTime && (
                             <Button 
                                className="w-full text-[10px] font-black uppercase italic tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 h-9 rounded-xl shadow-md shadow-indigo-100 mb-1"
                                onClick={() => setOpen(false)}
                             >
                                 {t('common.confirm')}
                             </Button>
                         )}
                         <Button 
                            variant="ghost" 
                            className="w-full text-[10px] font-black uppercase italic tracking-widest text-indigo-600 hover:bg-indigo-50 h-9 rounded-xl"
                            onClick={() => {
                                onChange(new Date().toISOString());
                                setOpen(false);
                            }}
                         >
                             {t('common.today')}
                         </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
