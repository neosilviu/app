import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "~/components/ui/dialog";
import { Search, File, Check, X, Database, Loader2, Calendar, HardDrive } from 'lucide-react';
import { api } from '~/lib/core';
import { useTranslation } from 'react-i18next';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

interface LocalFile {
  id: string;
  original_name: string;
  filename: string;
  size: number;
  source: string;
  createdAt: string;
  mimeType? : string;
  contentType? : string;
}

interface LocalInboxPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (file: LocalFile[]) => void;
  workspaceId?: string;
}

export function LocalInboxPicker({ isOpen, onClose, onSelect, workspaceId }: LocalInboxPickerProps) {
  const { t } = useTranslation(['common', 'gmail']);
  const [file, setFiles] = useState<LocalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<LocalFile[]>([]);
  const [previewFile, setPreviewFile] = useState<LocalFile | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
      setSelectedFiles([]);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts (Space for preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.code === 'Space') {
        const activeElement = document.activeElement;
        const isInput = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
        if (isInput) return; // Don't trigger if typing in search

        e.preventDefault();
        if (previewFile) {
          setPreviewFile(null);
        } else if (selectedFiles.length > 0) {
          setPreviewFile(selectedFiles[selectedFiles.length - 1]);
        }
      } else if (e.code === 'Escape' && previewFile) {
        setPreviewFile(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedFiles, previewFile]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const url = `db/collection/file${workspaceId ? `/${workspaceId}` : ''}?limit=100&sortBy=createdAt&sortOrder=DESC`;
      const response = await api.local.get(url);
      if (response.success) {
        setFiles(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching file from inbox:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = file.filter(f => 
    (f.original_name || f.filename || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const toggleFile = (file: LocalFile) => {
    setSelectedFiles(prev => {
      const exists = prev.find(f => f.id === file.id);
      if (exists) {
        return prev.filter(f => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  const isSelected = (file: LocalFile) => !!selectedFiles.find(f => f.id === file.id);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Database className="w-6 h-6 text-blue-500" />
            <span>{t('gmail:local_inbox_picker')}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('gmail:local_inbox_picker_desc')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 border-b bg-gray-50/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder={t('common:search')}
              className="pl-10 bg-white border-gray-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm">{t('common:loading')}</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center p-8">
              <HardDrive className="w-12 h-12 mb-4 opacity-10" />
              <p className="text-sm font-medium">{t('gmail:no_files_found')}</p>
              <p className="text-xs opacity-60 mt-1">{t('gmail:no_files_found_hint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {filteredFiles.map((file) => {
                const selected = isSelected(file);
                return (
                  <div 
                    key={file.id}
                    onClick={() => toggleFile(file)}
                    className={`flex items-center p-3 rounded-xl cursor-pointer transition-all border ${selected ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100' : 'hover:bg-gray-50 border-gray-100 hover:border-gray-300'}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mr-4 shadow-sm ${selected ? 'bg-blue-500 text-white' : 'bg-white text-gray-500 border border-gray-100'}`}>
                      {file.mimeType?.includes('image') || file.contentType?.includes('image') ? (
                         <div className="w-full h-full rounded-lg overflow-hidden bg-gray-200">
                            <img 
                              src={`/api/file/${encodeURIComponent(file.filename)}`} 
                              className="w-full h-full object-cover" 
                              alt="preview"
                            />
                         </div>
                      ) : (
                        <File className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{file.original_name || file.filename}</p>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1 font-medium">
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded-md">
                          <HardDrive className="w-2.5 h-2.5" />
                          {file.source || 'unknown'}
                        </span>
                        <span>{formatSize(file.size)}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatDate(file.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${selected ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-200 text-transparent'}`}>
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Preview Overlay */}
        {previewFile && (
          <div 
            className="absolute inset-0 z-[100] bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setPreviewFile(null)}
          >
            <div className="relative max-w-full max-h-full flex flex-col items-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-12 right-0 text-white hover:bg-white/20"
                onClick={() => setPreviewFile(null)}
              >
                <X className="w-6 h-6" />
              </Button>
              
              <div className="bg-white rounded-2xl overflow-hidden shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                {previewFile.mimeType?.includes('image') || previewFile.contentType?.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(previewFile.filename) ? (
                  <div className="flex-1 overflow-hidden flex items-center justify-center bg-gray-100 min-h-[400px]">
                    <img 
                      src={`/api/file/${encodeURIComponent(previewFile.filename)}`} 
                      className="max-w-full max-h-full object-contain shadow-sm" 
                      alt="preview"
                    />
                  </div>
                ) : (previewFile.mimeType?.includes('pdf') || previewFile.filename.toLowerCase().endsWith('.pdf')) ? (
                  <div className="flex-1 w-full min-h-[600px]">
                    <iframe 
                      src={`/api/file/${encodeURIComponent(previewFile.filename)}`} 
                      className="w-full h-full border-none"
                      title="PDF Preview"
                    />
                  </div>
                ) : (
                  <div className="p-20 flex flex-col items-center bg-white">
                    <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 border border-blue-100 shadow-inner">
                      <File className="w-12 h-12 text-blue-500" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 mb-2">{previewFile.original_name || previewFile.filename}</p>
                    <p className="text-gray-500 font-medium">{formatSize(previewFile.size)} • {previewFile.source} • {previewFile.mimeType || 'Unknown Type'}</p>
                    
                    <div className="mt-12 p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200 w-full max-w-md text-center">
                      <p className="text-sm text-gray-600 font-bold mb-1">Preview not available for this file type</p>
                      <p className="text-xs text-gray-400">Still, you can attach it to your email or download it later.</p>
                    </div>

                    <p className="mt-8 text-[10px] text-gray-400 uppercase tracking-widest font-black">Hold Space or Escape to Close</p>
                  </div>
                )}
              </div>
              <div className="mt-4 text-center">
                <p className="text-white text-lg font-bold drop-shadow-md">{previewFile.original_name || previewFile.filename}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="p-4 border-t bg-white flex items-center justify-between sm:justify-between">
          <div className="text-xs text-blue-600 sm:block font-bold bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            {selectedFiles.length > 0 ? t('gmail:files_selected', { count: selectedFiles.length }) : t('gmail:no_selection')}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl font-bold">
              {t('common:cancel')}
            </Button>
            <Button 
              size="sm" 
              disabled={selectedFiles.length === 0} 
              onClick={() => onSelect(selectedFiles)}
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 px-6"
            >
              {t('gmail:attach_files', { count: selectedFiles.length })}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

