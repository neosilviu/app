import React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Loader2, Upload, X, FileIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/core";
import { useTranslation } from "react-i18next";

interface FileUploaderProps {
  value: any;
  onChange: (value: any) => void;
  multiple?: boolean;
  storage?: string;
  accept?: string;
  variant?: 'file' | 'image';
}

export function FileUploader({ value, onChange, multiple, storage, accept, variant = 'file' }: FileUploaderProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const files = React.useMemo(() => {
    if (!value) return [];
    
    // Normalize value to an array of objects { key, url, name, size, type }
    let rawList: any[] = [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            rawList = Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            // It's a simple URL string
            rawList = [{ url: value, name: value.split('/').pop() || 'file' }];
        }
    } else if (Array.isArray(value)) {
        rawList = value;
    } else if (typeof value === 'object') {
        rawList = [value];
    }

    return rawList.map(f => {
        if (typeof f === 'string') return { url: f, name: f.split('/').pop() || 'file' };
        return f;
    });
  }, [value]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    let currentFiles = [...files];

    // If not multiple, we'll replace
    if (!multiple) {
        currentFiles = [];
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append("file", file);
      
      // Dacă suntem în local dev (detectat prin hostname de rețea sau localhost), 
      // folosim R2 (miniflare) ca fallback dacă agentul local nu e pornit.
      // În registry, parametrul storage controlează destinația.
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname.startsWith('192.168.');
      if (storage) {
        formData.append("storage", storage);
      } else if (isLocal) {
        formData.append("storage", "r2"); // Fast-path pentru dev folosind wrangler state
      }

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const result = (await response.json()) as { 
          success: boolean; 
          key: string; 
          url: string; 
          name: string; 
          size: number; 
          type: string; 
          error?: string 
        };

        if (result.success) {
          currentFiles.push({
            key: result.key,
            url: result.url,
            name: result.name,
            size: result.size,
            type: result.type,
          });
        } else {
          toast.error(t('common:upload_failed', { name: file.name, error: result.error }));
        }
      } catch (error) {
        toast.error(t('common:upload_error', { name: file.name }));
      }
    }

    const finalValue = multiple ? currentFiles : currentFiles[0];
    onChange(finalValue);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onChange(multiple ? newFiles : null);
  };

  if (variant === 'image') {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
                {files.map((file, index) => (
                    <div 
                        key={`${file.key || index}-${index}`}
                        className="relative group w-32 h-32 rounded-3xl overflow-hidden border-2 border-slate-100 bg-slate-50 shadow-sm transition-all hover:border-indigo-400 hover:shadow-xl"
                    >
                        <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <a 
                                href={file.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/40"
                            >
                                <ExternalLink size={14} />
                            </a>
                            <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="w-8 h-8 rounded-full bg-rose-500/20 backdrop-blur-md flex items-center justify-center text-rose-500 hover:bg-rose-500/40"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                        "w-32 h-32 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-white hover:border-indigo-400 hover:text-indigo-600 group",
                        uploading && "animate-pulse"
                    )}
                >
                    {uploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Upload className="w-6 h-6 transition-transform group-hover:scale-110 text-slate-400 group-hover:text-indigo-500" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500 text-center px-2">
                        {uploading ? t('common:uploading') : (multiple ? t('common:new_photos') : t('common:change_photo'))}
                    </span>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleUpload}
                        multiple={multiple}
                        accept={accept || "image/*"}
                        disabled={uploading}
                    />
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      {files.length > 0 && (
        <div className={cn(
          "grid gap-3",
          multiple ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}>
          {files.map((file, index) => {
            const isImage = file.type?.startsWith('image/') || file.url?.match(/\.(jpg|jpeg|png|gif|webp)/i);
            
            return (
              <div
                key={`${file.key || index}-${index}`}
                className="group relative flex items-center gap-4 p-3 rounded-[24px] border border-slate-200 bg-white shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300"
              >
                {isImage ? (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-100 shrink-0">
                     <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <FileIcon className="h-8 w-8 text-indigo-500" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-black text-slate-700 truncate mb-0.5">{file.name}</p>
                  <div className="flex items-center gap-2">
                    {file.size && (
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest italic truncate max-w-[100px]">
                        {file.key?.split('-').pop() || 'STORAGE'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-9 w-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                  >
                    <a href={file.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="h-9 w-9 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative group/uploader">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleUpload}
          multiple={multiple}
          accept={accept}
          disabled={uploading}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full h-16 rounded-[24px] border-dashed border-2 border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:text-indigo-600 transition-all duration-300 font-black uppercase tracking-widest text-[11px] gap-3 group-hover/uploader:shadow-2xl group-hover/uploader:shadow-indigo-100 group-hover/uploader:-translate-y-0.5",
            uploading && "animate-pulse"
          )}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Upload className="h-5 w-5 transition-transform group-hover/uploader:scale-110" />
          )}
          {uploading ? t('common:syncing_storage') : (multiple ? t('common:add_documents') : t('common:upload_here'))}
        </Button>
      </div>
    </div>
  );
}



