import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Mail, Printer, History, FileText,  ExternalLink, Clock, ArrowRight, Star, Pin } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { api, socketRequest, formatDate } from '~/lib/core';

interface ContactInteractionsProps {
    contact: {
        id: string;
        name: string;
        email?: string;
        phone?: string;
        [key: string]: any;
    };
}

export function ContactInteractions({ contact }: ContactInteractionsProps) {
    const { t } = useTranslation(['common', 'whatsapp', 'gmail', 'printing']);
    const [activeTab, setActiveTab] = useState('timeline');
    
    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid h-12 w-full grid-cols-5 gap-2 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-2xl">
                    <TabsTrigger value="timeline" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <History className="w-3.5 h-3.5 mr-2" />
                        Timeline
                    </TabsTrigger>
                    <TabsTrigger value="whatsapp" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <MessageSquare className="w-3.5 h-3.5 mr-2 text-green-500" />
                        WhatsApp
                    </TabsTrigger>
                    <TabsTrigger value="email" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <Mail className="w-3.5 h-3.5 mr-2 text-blue-500" />
                        Gmail
                    </TabsTrigger>
                    <TabsTrigger value="file" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5 mr-2 text-amber-500" />
                        Fișiere
                    </TabsTrigger>
                    <TabsTrigger value="printing" className="rounded-xl data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 font-bold text-[11px] uppercase tracking-wider">
                        <Printer className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                        Printări
                    </TabsTrigger>
                </TabsList>

                <div className="mt-8">
                    <TabsContent value="timeline">
                        <ContactTimeline contact={contact} />
                    </TabsContent>
                    <TabsContent value="whatsapp">
                        <ContactWhatsApp contact={contact} />
                    </TabsContent>
                    <TabsContent value="email">
                        <ContactEmail contact={contact} />
                    </TabsContent>
                    <TabsContent value="file">
                        <ContactFiles contact={contact} />
                    </TabsContent>
                    <TabsContent value="printing">
                        <ContactPrinting contact={contact} />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}

// --- Sub-components (Simplified for now) ---

function ContactTimeline({ contact }: { contact: any }) {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTimeline = async () => {
            setLoading(true);
            try {
                const results: any[] = [];
                
                // 1. Fetch WA from unified interaction
                if (contact.phone) {
                    const phoneNumeric = contact.phone.replace(/\D/g, '');
                    const chatId = phoneNumeric.includes('@') ? phoneNumeric : `${phoneNumeric}@c.us`;
                    const res = await api.brain.get(`db/collection/interaction?chatId=${chatId}&provider=whatsapp&limit=5&sortBy=timestamp&sortOrder=DESC`);
                    if (res.success) {
                        res.data.forEach((m: any) => results.push({
                            id: m.id,
                            timestamp: m.timestamp,
                            type: 'whatsapp',
                            title: m.fromMe ? 'Mesaj Trimis' : 'Mesaj Primit',
                            description: m.body,
                            iconType: 'whatsapp',
                            color: 'bg-green-500',
                            isPinned: m.isPinned,
                            isFavorite: m.isFavorite,
                            tag: typeof m.tag === 'string' ? JSON.parse(m.tag || '[]') : (Array.isArray(m.tag) ? m.tag : [])
                        }));
                    }
                }

                // 2. Fetch Emails from unified interaction
                if (contact.email) {
                    const res = await api.brain.get(`db/collection/interaction?chatId=${contact.email}&provider=email&limit=5&sortBy=timestamp&sortOrder=DESC`);
                    if (res.success) {
                        res.data.forEach((e: any) => results.push({
                            id: e.id,
                            timestamp: e.timestamp,
                            type: 'email',
                            title: `Email: ${e.subject}`,
                            description: e.body?.substring(0, 100) + '...',
                            iconType: 'email',
                            color: 'bg-blue-500',
                            isPinned: e.isPinned,
                            isFavorite: e.isFavorite,
                            tag: typeof e.tag === 'string' ? JSON.parse(e.tag || '[]') : (Array.isArray(e.tag) ? e.tag : [])
                        }));
                    }
                }

                // 3. Fetch Orders (D1 - Future)
                /* 
                const ordersRes = await api.brain.get(`orders?contactId=${contact.id}`);
                if (ordersRes.success) { ... push to results }
                */

                // 4. Fetch Tickets (D1 - Future)
                /* 
                const ticketsRes = await api.brain.get(`tickets?contactId=${contact.id}`);
                if (ticketsRes.success) { ... push to results }
                */

                // Sort by timestamp DESC
                results.sort((a, b) => b.timestamp - a.timestamp);
                setEvents(results);
            } catch (e) {
                console.error("Timeline error", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTimeline();
    }, [contact.id]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 p-8 md:p-12 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="flex items-center justify-between mb-12">
                <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight italic flex items-center gap-3">
                        <History className="text-indigo-500" />
                        Timeline Activitate
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Istoric unificat D1 + Local Agent</p>
                </div>
                <Badge variant="outline" className="h-8 px-4 rounded-full border-slate-200 font-black text-[10px] uppercase bg-slate-50">
                    Live Sync active
                </Badge>
            </div>
            
            {loading ? (
                <div className="py-20 text-center animate-pulse font-black text-slate-300 uppercase italic tracking-[0.2em]">Sincronizare Timeline...</div>
            ) : events.length === 0 ? (
                <div className="py-20 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-300">
                        <Clock size={32} />
                    </div>
                    <p className="text-slate-400 font-bold italic uppercase text-xs tracking-widest">Nicio activitate înregistrată încă.</p>
                </div>
            ) : (
                <div className="space-y-12 relative before:absolute before:inset-0 before:left-[15px] before:w-px before:bg-gradient-to-b before:from-indigo-500/20 before:via-slate-200 before:to-transparent">
                    {events.map((event) => (
                        <div key={event.id} className="flex gap-8 relative group">
                            <div className={`w-8 h-8 rounded-xl ${event.color} text-white z-10 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {event.iconType === 'whatsapp' && <MessageSquare className="w-3.5 h-3.5" />}
                                {event.iconType === 'email' && <Mail className="w-3.5 h-3.5" />}
                            </div>
                            <div className="flex-1 space-y-2 bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                                            {event.title}
                                        </span>
                                        {event.isPinned === 1 && <Pin className="w-2.5 h-2.5 text-indigo-500 rotate-45 shrink-0" />}
                                        {event.isFavorite === 1 && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter tabular-nums whitespace-nowrap">
                                        {new Date(event.timestamp).toLocaleString('ro-RO')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{event.description}</p>
                                {event.tag && event.tag.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-1">
                                        {event.tag.map((t: string) => (
                                            <Badge key={t} variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5 bg-slate-200/50 text-slate-600 border-none font-bold uppercase">
                                                {t}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ContactWhatsApp({ contact }: { contact: any }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!contact.phone) return;
        
        const fetchMessages = async () => {
            setLoading(true);
            try {
                // Formatting phone for chat ID (removing non-digits and ensuring country code if needed)
                const phoneNumeric = contact.phone.replace(/\D/g, '');
                const chatId = phoneNumeric.includes('@') ? phoneNumeric : `${phoneNumeric}@c.us`;
                
                const res = await api.brain.get(`db/collection/interaction?chatId=${chatId}&provider=whatsapp&limit=10&sortBy=timestamp&sortOrder=DESC`);
                if (res.success) {
                    setMessages(res.data);
                }
            } catch (e) {
                console.error("Failed to fetch WA messages", e);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [contact.phone]);

    if (!contact.phone) return <div className="p-10 text-center text-slate-400 font-bold italic">Nu există un număr de telefon asociat.</div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-green-50/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm">Conversație WhatsApp</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{contact.phone}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase text-green-600 hover:bg-green-50">
                    Deschide Chat Complet <ArrowRight size={12} className="ml-1" />
                </Button>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                {loading ? (
                    <div className="py-10 text-center animate-pulse text-slate-400 font-bold uppercase text-xs">Se încarcă mesajele...</div>
                ) : messages.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 italic">Nicio interacțiune găsită pe WhatsApp.</div>
                ) : (
                    messages.map((msg: any) => (
                        <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.fromMe ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none border border-black/5 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-1 gap-4">
                                   <div className="flex gap-1">
                                      {msg.isPinned === 1 && <Pin className="w-2.5 h-2.5 rotate-45" />}
                                      {msg.isFavorite === 1 && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />}
                                   </div>
                                    <span className="text-[8px] opacity-70 font-black uppercase tracking-tighter">
                                        {new Date(msg.timestamp).toLocaleString('ro-RO')}
                                    </span>
                                </div>
                                <p className="leading-relaxed">{msg.body}</p>
                                {msg.tag && typeof msg.tag === 'string' && (
                                   <div className="flex flex-wrap gap-0.5 mt-2">
                                      {JSON.parse(msg.tag).map((t: string) => (
                                         <Badge key={t} variant="outline" className={`text-[7px] px-1 py-0 h-3 border-none bg-black/10 transition-colors ${msg.fromMe ? 'text-white' : 'text-slate-500 font-bold'}`}>
                                            {t}
                                         </Badge>
                                      ))}
                                   </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function ContactEmail({ contact }: { contact: any }) {
    const [emails, setEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!contact.email) return;
        
        const fetchEmails = async () => {
            setLoading(true);
            try {
                const res = await api.brain.get(`db/collection/interaction?chatId=${contact.email}&provider=email&limit=5&sortBy=timestamp&sortOrder=DESC`);
                if (res.success) {
                    setEmails(res.data);
                }
            } catch (e) {
                console.error("Failed to fetch emails", e);
            } finally {
                setLoading(false);
            }
        };
        fetchEmails();
    }, [contact.email]);

    if (!contact.email) return <div className="p-10 text-center text-slate-400 font-bold italic">Nu există o adresă de email asociat.</div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
             <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-blue-50/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                        <Mail size={20} />
                    </div>
                    <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-sm">Istoric Email-uri</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{contact.email}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="font-black text-[10px] uppercase text-blue-600 hover:bg-blue-50">
                    Vezi Toate <ArrowRight size={12} className="ml-1" />
                </Button>
            </div>

            <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {loading ? (
                    <div className="p-10 text-center animate-pulse text-slate-400 font-bold uppercase text-xs">Căutare email-uri...</div>
                ) : emails.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 italic">Niciun email găsit de la acest contact.</div>
                ) : (
                    emails.map((email: any) => (
                        <div key={email.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer border-b last:border-0">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                   <h5 className="font-black text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors truncate">{email.subject}</h5>
                                   {email.isPinned === 1 && <Pin className="w-2.5 h-2.5 text-indigo-500 rotate-45 shrink-0" />}
                                   {email.isFavorite === 1 && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400 shrink-0" />}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{new Date(email.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate line-clamp-1 mb-2">{email.body || email.bodyHtml?.replace(/<[^>]*>/g, '').substring(0, 100) || "Fără conținut text"}</p>
                            {email.tag && (
                                <div className="flex flex-wrap gap-1">
                                    {(typeof email.tag === 'string' ? JSON.parse(email.tag) : []).map((t: string) => (
                                        <Badge key={t} variant="secondary" className="text-[7px] px-1 py-0 h-3 font-bold uppercase tracking-widest">{t}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function ContactFiles({ contact }: { contact: any }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-8 text-center">
             <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center text-amber-600 mx-auto mb-4">
                <FileText size={32} />
             </div>
             <h3 className="font-black text-slate-900 dark:text-white mb-2 italic">Fișiere Directe & Inbox</h3>
             <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">Aici vor apărea fișierele trimise prin WhatsApp sau descărcate prin Email de la acest contact.</p>
             <Button variant="outline" className="rounded-xl border-amber-100 text-amber-600 hover:bg-amber-50 gap-2 font-bold px-6">
                 Scanare Inbox Local
                 <ExternalLink size={14} />
             </Button>
        </div>
    );
}

function ContactPrinting({ contact }: { contact: any }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-8 text-center italic text-slate-400">
             Modul Printări în curs de conectare...
        </div>
    );
}

