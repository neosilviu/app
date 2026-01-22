import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Dialog, 
    DialogContent, 
    DialogTitle, 
    DialogDescription 
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { 
    FileText, 
    Download, 
    XCircle, 
    AlertTriangle, 
    ExternalLink,
    Edit2,
    Info
} from "lucide-react";
import { FileDetailsPanel } from './FileDetailsPanel';

interface DocumentPreviewProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    fileUrl: string;
    fileName: string;
    fileType?: string;
    fileSize?: number;
    previewUrl?: string;
    filePath?: string; // New: for metadata editing
    children?: React.ReactNode; 
}

export function DocumentPreview({ 
    isOpen, 
    onOpenChange, 
    fileUrl, 
    fileName, 
    fileType = 'unknown', 
    fileSize = 0,
    previewUrl,
    filePath,
    children
}: DocumentPreviewProps) {
    const { t } = useTranslation(['common', 'printing']);
    const [showEdit, setShowEdit] = React.useState(false);

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 KB';
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    const isImage = fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
    const isPDF = fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={`${showEdit && filePath ? 'max-w-7xl' : 'max-w-4xl'} h-[90vh] bg-slate-950/95 backdrop-blur-xl border-none shadow-2xl rounded-3xl p-0 overflow-hidden flex flex-row transition-all duration-300`}>
                <DialogTitle className="hidden">
                    {t('printing:document_preview')}
                </DialogTitle>
                <DialogDescription className="hidden">
                    {t('printing:preview_description')}
                </DialogDescription>
                
                <div className="flex flex-col flex-1 min-w-0 h-full">
                    {/* Header */}
                    <div className="p-6 flex items-center justify-between border-b border-white/10 shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-white font-black uppercase tracking-tight italic truncate max-w-[200px] md:max-w-md">
                                    {fileName}
                                </h3>
                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                    {formatSize(fileSize)}
                                    {" • "}
                                    {fileType}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {filePath && (
                                <Button 
                                    variant="ghost" size="sm" 
                                    className={`rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-4 gap-2 ${showEdit ? 'bg-primary text-white hover:bg-primary/90' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                    onClick={() => setShowEdit(!showEdit)}
                                >
                                    {showEdit ? <Info className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                                    {showEdit ? t('common:show_preview') : t('common:edit_metadata')}
                                </Button>
                            )}
                            <Button 
                                variant="ghost" size="icon" 
                                className="text-white hover:bg-white/10 rounded-full"
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = fileUrl;
                                    link.download = fileName;
                                    link.click();
                                }}
                                title={t('common:download')}
                            >
                                <Download className="h-5 w-5" />
                            </Button>
                            <Button 
                                variant="ghost" size="icon" 
                                className="text-white hover:bg-white/20 bg-white/10 rounded-full h-10 w-10 flex items-center justify-center"
                                onClick={() => onOpenChange(false)}
                            >
                                <XCircle className="h-6 w-6" />
                            </Button>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 bg-black/40 flex items-center justify-center p-4 overflow-hidden relative">
                        {isImage ? (
                            <img 
                                src={fileUrl} 
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in fade-in zoom-in-95 duration-300" 
                                alt="Preview" 
                            />
                        ) : (isPDF || previewUrl) ? (
                            <iframe 
                                src={previewUrl || fileUrl} 
                                className="w-full h-full rounded-lg bg-white border-none shadow-2xl"
                                title={t('printing:document_preview')}
                            />
                        ) : (
                            <div className="text-center space-y-4 max-w-xs p-8 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-sm">
                                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                                </div>
                                <h4 className="text-white font-black uppercase text-sm tracking-widest">{t('printing:no_visual_preview')}</h4>
                                <p className="text-slate-400 text-[10px] font-bold uppercase leading-relaxed tracking-widest">
                                    {t('printing:preview_not_supported', { extension: fileName.split('.').pop()?.toUpperCase() })}
                                </p>
                                <Button 
                                    variant="outline" 
                                    className="border-white/20 text-white hover:bg-white hover:text-black rounded-xl font-black uppercase text-[10px] tracking-widest w-full py-6 mt-4 gap-2"
                                    onClick={() => {
                                        window.open(fileUrl);
                                    }}
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    {t('common:open_new_tab')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {children}
                </div>

                {/* Edit Sidebar */}
                {showEdit && filePath && (
                    <div className="w-96 shrink-0 border-l border-white/10 bg-white dark:bg-slate-900 animate-in slide-in-from-right duration-300">
                        <FileDetailsPanel 
                            filePath={filePath} 
                            fileName={fileName} 
                            onClose={() => setShowEdit(false)} 
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
