import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { socket } from '~/lib/core';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { TagSelector } from '~/components/ui/tag-selector';
import { X, Loader2, Save } from 'lucide-react';

interface FileDetailsProps {
  filePath: string;
  fileName: string;
  onClose: () => void;
}

export function FileDetailsPanel({ filePath, fileName, onClose }: FileDetailsProps) {
  const { t } = useTranslation(['common', 'file']);
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    notes: '',
    price: '',
    contactId: ''
  });

  useEffect(() => {
    fetchMetadata();
    fetchContacts();
  }, [filePath]);

  const fetchMetadata = () => {
    setLoading(true);
    socket.emit('file:get-metadata', { fullPath: filePath }, (res: any) => {
      if (res.success) {
        setMetadata(res.data);
        setFormData({
          notes: res.data.notes || '',
          price: res.data.price ? String(res.data.price) : '',
          contactId: res.data.contactId || ''
        });
      }
      setLoading(false);
    });
  };

  const fetchContacts = () => {
    socket.emit('db:list', { collection: 'contact' }, (res: any) => {
      if (res.success && res.data) {
        setContacts(res.data);
      }
    });
  };

  const handleSave = () => {
    setSaving(true);
    socket.emit('file:update-metadata', {
      fullPath: filePath,
      notes: formData.notes,
      price: formData.price ? parseFloat(formData.price) : null,
      contactId: formData.contactId || null
    }, (res: any) => {
      setSaving(false);
      if (res.success) {
        fetchMetadata();
      }
    });
  };

  const handleContactChange = (contactId: string) => {
    setFormData({ ...formData, contactId });
  };

  if (loading) {
    return (
      <div className="w-96 border-l border-slate-200 dark:border-slate-800 h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="w-96 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalii Fișier</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate mt-1">{fileName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Associated Contact */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Contact Asociat
          </Label>
          <Select value={formData.contactId} onValueChange={handleContactChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selectează contact..." />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name || c.email || c.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {metadata?.contact && (
            <div className="text-xs text-slate-500 mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              <p className="font-semibold">{metadata.contact.name}</p>
              {metadata.contact.email && <p>{String(metadata.contact.email)}</p>}
              {metadata.contact.phone && <p>{String(metadata.contact.phone)}</p>}
            </div>
          )}
        </div>

        {/* Price/Value */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Preț / Valoare
          </Label>
          <Input
            type="number"
            placeholder="Introduceți valoare..."
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="h-9"
            step="0.01"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Note
          </Label>
          <Textarea
            placeholder="Adăugați observații despre acest fișier..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="min-h-24 text-sm"
          />
        </div>

        {/* tag */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Etichete
          </Label>
          <TagSelector
            entityType="local_file"
            entityId={filePath}
            initialTags={metadata?.tag || []}
            size="md"
          />
        </div>

        {/* Metadata */}
        {metadata?.createdAt && (
          <div className="text-xs text-slate-500 p-3 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 space-y-1">
            <p>
              <span className="font-semibold">Creat:</span>{' '}
              {new Date(metadata.createdAt).toLocaleDateString('ro-RO', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
            {metadata?.updatedAt && (
              <p>
                <span className="font-semibold">Actualizat:</span>{' '}
                {new Date(metadata.updatedAt).toLocaleDateString('ro-RO', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer - Save Button */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-9 text-sm font-bold"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Se salvează...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvează
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

