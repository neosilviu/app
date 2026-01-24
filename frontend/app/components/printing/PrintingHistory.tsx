import React from 'react';
import { useTranslation } from 'react-i18next';
import { renderString } from '~/lib/core';
import { 
    Tabs, TabsContent, TabsList, TabsTrigger 
} from "~/components/ui/tabs";
import { 
    Card, CardHeader, CardTitle, CardDescription, CardContent 
} from "~/components/ui/card";
import { 
    Table, TableHeader, TableBody, TableRow, TableHead, TableCell 
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { History, Save, Eye } from 'lucide-react';

interface PrintingHistoryProps {
    historyJobs: any[];
    savedSessions: any[];
    setSelectedSession: (session: any) => void;
    setIsSessionDialogOpen: (open: boolean) => void;
    getStatusBadge: (status: string) => React.ReactNode;
    lang: string;
}

export function PrintingHistory({
    historyJobs,
    savedSessions,
    setSelectedSession,
    setIsSessionDialogOpen,
    getStatusBadge,
    lang
}: PrintingHistoryProps) {
    const { t } = useTranslation(['common', 'printing']);

    return (
        <Tabs defaultValue="logs" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <TabsList className="bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger value="logs" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm px-4 py-2">
                        <History className="h-3 w-3 mr-2" />
                        {renderString(t('common:activity_log'), lang)}
                    </TabsTrigger>
                    <TabsTrigger value="saved" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm px-4 py-2">
                        <Save className="h-3 w-3 mr-2" />
                        {renderString(t('printing:saved_orders'), lang)}
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="logs">
                <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 p-6 dark:bg-slate-800/50">
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            {renderString(t('common:activity_log'), lang)}
                        </CardTitle>
                        <CardDescription>{renderString(t('printing:archive_description'), lang)}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:timestamp'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:filename'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:pages'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:operated_by'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:status'), lang)}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyJobs.map((job, i) => (
                                        <TableRow key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                            <TableCell className="font-mono text-[10px] py-4 text-slate-500">
                                                {new Date(job.created_at || job.date).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-900 dark:text-white uppercase text-[11px] italic tracking-tight">{job.filename}</TableCell>
                                            <TableCell className="font-black text-primary">{job.pages || 1}</TableCell>
                                            <TableCell className="text-[10px] font-bold uppercase text-slate-600 italic">
                                                {job.operator || job.created_by_name || renderString(t('common:system'), lang)}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(job.status || 'Completed')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="saved">
                <Card className="border-none shadow-lg bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 p-6 dark:bg-slate-800/50">
                        <CardTitle className="flex items-center gap-2">
                            <Save className="h-5 w-5 text-primary" />
                            {renderString(t('printing:saved_orders'), lang)}
                        </CardTitle>
                        <CardDescription>{renderString(t('printing:saved_orders_description'), lang)}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:date'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('printing:order_name'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:customer'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:value'), lang)}</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{renderString(t('common:items'), lang)}</TableHead>
                                        <TableHead className="text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedSessions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-slate-400 uppercase text-[10px] font-bold">{renderString(t('printing:no_saved_orders'), lang)}</TableCell>
                                        </TableRow>
                                    ) : (
                                        savedSessions.map((session, i) => (
                                            <TableRow key={session.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                                <TableCell className="font-mono text-[10px] py-4 text-slate-500">
                                                    {new Date(session.createdAt).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-900 dark:text-white uppercase text-[11px] italic tracking-tight">{session.name}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold uppercase">{session.customerName || renderString(t('common:anonymous'), lang)}</span>
                                                        <span className="text-[9px] text-slate-500">{session.customerPhone || ''}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-black text-primary">{Number(session.totalPrice || 0).toFixed(2)} {renderString(t('printing:currency'), lang)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-[9px] font-bold bg-slate-100/50">
                                                        {renderString(t('printing:files_count', { count: session.items?.length || 0 }), lang)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button 
                                                        variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10"
                                                        onClick={() => {
                                                            setSelectedSession(session);
                                                            setIsSessionDialogOpen(true);
                                                        }}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
