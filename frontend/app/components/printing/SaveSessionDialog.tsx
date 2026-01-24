import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Save, User, Phone, Tag, Search, XCircle, Loader2 } from 'lucide-react';
import { api } from "~/lib/core";

interface SaveSessionDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (sessionData: { 
        name: string, 
        customerName: string, 
        customerPhone: string,
        customerEmail?: string,
        contactId?: string 
    }) => void;
    totalAmount: number;
}

export function SaveSessionDialog({
    isOpen,
    onOpenChange,
    onSave,
    totalAmount
}: SaveSessionDialogProps) {
    const { t } = useTranslation(['common', 'printing']);
    const [name, setName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [contact, setContacts] = useState<any[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedContact, setSelectedContact] = useState<any>(null);
    const [loadingContacts, setLoadingContacts] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchContacts();
        }
    }, [isOpen]);

    const fetchContacts = async () => {
        setLoadingContacts(true);
        try {
            const res = await api.brain.get('db/collection/contact/all');
            if (res.data?.success) {
                setContacts(res.data || []);
            }
        } catch (e) {
            console.error("Failed to fetch contact", e);
        } finally {
            setLoadingContacts(false);
        }
    };

    const filteredContacts = useMemo(() => {
        if (!contactSearch) return [];
        const q = contactSearch.toLowerCase();
        return contact.filter(c => 
            (c.name || '').toLowerCase().includes(q) || 
            (c.phone || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        ).slice(0, 5);
    }, [contact, contactSearch]);

    const handleSave = () => {
        onSave({ 
            name, 
            customerName: selectedContact ? selectedContact.name : customerName, 
            customerPhone: selectedContact ? selectedContact.phone : customerPhone,
            customerEmail: selectedContact ? selectedContact.email : customerEmail,
            contactId: selectedContact?.id
        });
        reset();
    };

    const reset = () => {
        setName('');
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setContactSearch('');
        setSelectedContact(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) reset();
            onOpenChange(open);
        }}>
            <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-white/95 backdrop-blur-xl dark:bg-slate-900/95">
                <div className="bg-primary p-8 text-white relative overflow-hidden">
                    <DialogHeader className="p-0 text-left relative z-10">
                        <DialogTitle className="text-2xl font-black italic uppercase tracking-tight text-white">{t('printing:save_order')}</DialogTitle>
                        <DialogDescription className="text-xs font-bold uppercase text-primary-foreground/60">{t('printing:save_order_description')}</DialogDescription>
                    </DialogHeader>
                    <Save className="absolute -bottom-4 -right-4 h-32 w-32 text-white/10 rotate-12" />
                </div>

                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic flex items-center gap-2">
                                <Tag className="h-3 w-3" /> {t('printing:order_title')}
                            </Label>
                            <Input 
                                placeholder={t('printing:order_title_placeholder')}
                                className="h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none font-bold"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 relative">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic flex items-center gap-2">
                                <Search className="h-3 w-3" /> {t('common:assign_contact')}
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder={t('common:search_contacts_placeholder')}
                                    className="h-12 pl-11 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none font-bold"
                                    value={contactSearch}
                                    onChange={(e) => setContactSearch(e.target.value)}
                                />
                                {loadingContacts && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
                            </div>

                            {filteredContacts.length > 0 && (
                                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    {filteredContacts.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className="w-full flex flex-col items-start p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b last:border-none border-slate-50 dark:border-slate-800 text-left"
                                            onClick={() => {
                                                setSelectedContact(c);
                                                setContactSearch("");
                                            }}
                                        >
                                            <span className="font-black text-sm text-slate-900 dark:text-white">{c.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{c.phone || c.email || t('common:no_details')}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedContact ? (
                                <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 animate-in zoom-in-95">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-black">
                                                {selectedContact.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-900 dark:text-white">{selectedContact.name}</p>
                                                <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-tighter">{selectedContact.phone || selectedContact.email}</p>
                                            </div>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => setSelectedContact(null)}
                                            className="p-1 hover:bg-white rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold uppercase text-slate-400 ml-1">{t('common:customer_name')}</Label>
                                        <Input 
                                            placeholder={t('common:customer_name_placeholder')}
                                            value={customerName}
                                            onChange={(e) => setCustomerName(e.target.value)}
                                            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-none font-bold text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-bold uppercase text-slate-400 ml-1">{t('common:phone')}</Label>
                                        <Input 
                                            placeholder={t('common:phone_placeholder')}
                                            value={customerPhone}
                                            onChange={(e) => setCustomerPhone(e.target.value)}
                                            className="h-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 border-none font-bold text-xs"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-dashed border-indigo-200 dark:border-indigo-800 flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-indigo-600/60 mb-1 tracking-[0.2em]">{t('printing:total_to_save')}</span>
                        <span className="text-3xl font-black text-indigo-900 dark:text-indigo-400 italic">{(totalAmount / 100).toFixed(2)} {t('printing:currency')}</span>
                    </div>
                </div>

                <DialogFooter className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t flex-row gap-2">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest"
                    >
                        {t('common:cancel')}
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={!name.trim()}
                        className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-slate-200 dark:shadow-none"
                    >
                        {t('common:confirm_and_save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

