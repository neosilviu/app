import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Textarea } from './textarea';

interface BufferedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: any;
    onChange: (val: any) => void;
}

export const BufferedInput = ({ value, onChange, placeholder, className, type = "text", disabled = false, ...props }: BufferedInputProps) => {
    const [localValue, setLocalValue] = useState(value || "");
    useEffect(() => { setLocalValue(value || ""); }, [value]);
    const handleBlur = () => { if (localValue !== value) onChange(localValue); };
    return (
        <Input 
            {...props}
            type={type} 
            value={localValue} 
            onChange={(e) => setLocalValue(e.target.value)} 
            onBlur={handleBlur} 
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            placeholder={placeholder} 
            className={className} 
            disabled={disabled} 
        />
    );
};

interface BufferedTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    value: any;
    onChange: (val: any) => void;
}

export const BufferedTextarea = ({ value, onChange, placeholder, className, disabled = false, rows = 3, ...props }: BufferedTextareaProps) => {
    const [localValue, setLocalValue] = useState(value || "");
    useEffect(() => { setLocalValue(value || ""); }, [value]);
    const handleBlur = () => { if (localValue !== value) onChange(localValue); };
    return (
        <Textarea 
            {...props}
            value={localValue} 
            onChange={(e) => setLocalValue(e.target.value)} 
            onBlur={handleBlur} 
            placeholder={placeholder} 
            className={className} 
            disabled={disabled} 
            rows={rows} 
        />
    );
};
