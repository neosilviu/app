// app/routes/($lang)._app.comms.tsx
import { type Route } from "../../.react-router/types/app/routes/+types/($lang)._app.comms";
// Core / Hooks
import { socket, api, getLocalizedPath } from "~/lib/core";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { 
  Search, MessageSquare, Mail, MoreVertical, Paperclip, SendHorizontal, Circle, Archive, Inbox, CheckCircle2, RefreshCw, Clock, Filter, Trash2, Star, Pin, Tag, Square, CheckSquare, ChevronDown, ChevronLeft, ArrowRight, CornerUpLeft, Settings, Bot, Sparkles, Check, CheckCheck, Eye, Pencil, RotateCcw, Smile, MapPin, Mic, BookOpen, File, FileText, AlertCircle, Image, X, Plus, Map as MapIcon, Phone, Video, Copy } from 'lucide-react';
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import { Separator as UISeparator } from "~/components/ui/separator";
import { Switch as UISwitch } from "~/components/ui/switch";
import { useTranslation } from "react-i18next";
import { cn } from '~/lib/core';
import { useSystem } from "~/hooks/useSystem";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "~/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

import { useAuth } from "~/hooks/useAuth";

const linkifyText = (text: string) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={i} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline text-current break-all hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function UnifiedComms() {
  const { user } = useAuth();
  const activeWorkspaceId = user?.workspaceId || 'system';
  const { lang = "ro" } = useParams();
  const { t } = useTranslation();
  const { workerStatuses } = useSystem();
  const [search, setSearch] = useState("");
  const [searchTermMessages, setSearchTermMessages] = useState("");
  const [showSearchMessages, setShowSearchMessages] = useState(false);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messagePages, setMessagePages] = useState<Record<string, number>>({}); // Track pagination per chat
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const [inboxModalOpen, setInboxModalOpen] = useState(false);
  const [inboxFiles, setInboxFiles] = useState<any[]>([]);
  const [inboxPage, setInboxPage] = useState(1);
  const [inboxSearch, setInboxSearch] = useState("");
  const [isSendingLocal, setIsSendingLocal] = useState(false);

  const inboxRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "whatsapp" | "gmail">("all");
  const [view, setView] = useState<"inbox" | "sent" | "favorites" | "archive" | "trash">("inbox");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [whatsappState, setWhatsappState] = useState<{status: string, qr?: string}>({ status: 'INITIALIZING' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<{File: File, base64: string, type: 'image' | 'File'}[]>([]);
  const [selectedEmailForView, setSelectedEmailForView] = useState<any>(null);
  const [isEmailExpanded, setIsEmailExpanded] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<any>(null);
  const [forwardSearch, setForwardSearch] = useState("");
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentPicker, setShowAttachmentPicker] = useState(false);
  const [showPredefined, setShowPredefined] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimer = useRef<any>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [dbPredefinedMessages, setDbPredefinedMessages] = useState<any[]>([]);
  const [isPredefinedModalOpen, setIsPredefinedModalOpen] = useState(false);
  const [newPredefinedText, setNewPredefinedText] = useState("");

  const isEmail = selectedChat?.type === 'email' || selectedChat?.type === 'gmail' || selectedChat?.provider === 'email' || selectedChat?.provider === 'gmail';
  const isWhatsApp = selectedChat?.type === 'whatsapp' || selectedChat?.provider === 'whatsapp';

  // Pre-fill subject for email replies
  useEffect(() => {
    if (replyingTo && isEmail && !subject) {
      const parentSubject = replyingTo.subject || "";
      if (parentSubject && !parentSubject.toLowerCase().startsWith('re:')) {
        setSubject(`Re: ${parentSubject}`);
      } else if (!parentSubject) {
        setSubject("Re: (Fără subiect)");
      } else {
        setSubject(parentSubject);
      }
    }
  }, [replyingTo, isEmail]); 

  const loadPredefined = useCallback(() => {
    socket.emit('messaging:predefined:fetch', {}, (res: any) => {
      if (res.success) setDbPredefinedMessages(res.data);
    });
  }, []);

  const handleSavePredefined = (text: string, id?: string) => {
    socket.emit('messaging:predefined:save', { id, text }, (res: any) => {
      if (res.success) {
        toast.success(t('changes_saved'));
        setNewPredefinedText("");
        loadPredefined();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleDeletePredefined = (id: string) => {
    socket.emit('messaging:predefined:delete', { id }, (res: any) => {
      if (res.success) {
        toast.success(t('delete_success'));
        loadPredefined();
      }
    });
  };

  useEffect(() => {
    loadPredefined();
  }, [loadPredefined]);

  const commonEmojis = ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😻"];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/ogg; codecs=opus' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          socket.emit('messaging:send-audio', {
            chatId: selectedChat.chatId,
            provider: selectedChat.type,
            audioData: base64,
            mimetype: 'audio/ogg; codecs=opus',
            workspaceId: activeWorkspaceId
          }, (res: any) => {
             if (res.success) toast.success("Mesaj audio trimis!");
             else toast.error("Eroare audio: " + res.error);
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimer.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Nu s-a putut accesa microfonul.");
    }
  };

  const stopRecording = (shouldSend = true) => {
    if (!mediaRecorder.current) return;
    
    setIsRecording(false);
    clearInterval(recordingTimer.current);
    
    if (shouldSend) {
        mediaRecorder.current.stop();
    } else {
        if (mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.onstop = null; // Prevent sending
            mediaRecorder.current.stop();
        }
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
        toast.info("Înregistrare anulată.");
    }
    setRecordingTime(0);
  };

  useEffect(() => {
    return () => {
      if (recordingTimer.current) clearInterval(recordingTimer.current);
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
        mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleSendLocation = () => {
    if (!selectedChat) return;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        socket.emit('messaging:send-location', {
          chatId: selectedChat.chatId,
          provider: selectedChat.type,
          latitude,
          longitude,
          workspaceId: activeWorkspaceId
        }, (res: any) => {
           if (res.success) toast.success("Locație trimisă!");
        });
      }, () => {
        toast.error("Nu s-a putut obține locația.");
      });
    }
  };

  const scrollToBottom = (behavior: "auto" | "smooth" = "smooth") => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior });
    }
  };

  useEffect(() => {
    const handleStatus = (data: any) => {
        // Filter by workspace to avoid seeing other people's QR codes or statuses
        if (data.workspaceId && activeWorkspaceId && data.workspaceId !== activeWorkspaceId) {
            return;
        }
        
        if (data.status) {
            setWhatsappState({ status: data.status, qr: data.qr });
        }
    };

    socket.on('whatsapp:status', handleStatus);
    socket.on('whatsapp:qr', (data: any) => {
        if (data.qr) {
            setWhatsappState(prev => ({ ...prev, status: 'QR_RECEIVED', qr: data.qr }));
        }
    });

    // Request initial status/start
    socket.emit('whatsapp:qr');

    return () => {
        socket.off('whatsapp:status', handleStatus);
        socket.off('whatsapp:qr');
    };
  }, []);
  
  // Settings State
  const [wsSettings, setWsSettings] = useState<any>({
    modules: {
      gmail: { active: false, clientId: '', clientSecret: '', refreshToken: '', autoReply: false },
      whatsapp: { active: false, autoReply: false }
    }
  });

  const loadSettings = useCallback(async () => {
    try {
      const res = await api.brain.get('workspace/settings'); 
      if (res.data?.success && res.data?.data) {
        setWsSettings((prev: any) => ({ ...prev, ...res.data }));
      }
    } catch (e) {}
  }, []);

  const saveSettings = async (customConfig?: any) => {
    try {
      const configToSave = customConfig || wsSettings;
      await api.brain.post('workspace/update-settings', { 
        settings: configToSave 
      });
      if (!customConfig) {
        toast.success("Setări salvate");
      }
      setWsSettings(configToSave);
    } catch (e) {
      toast.error("Eroare la salvare");
    }
  };

  const loadInbox = useCallback(async () => {
    setLoading(true);
    socket.emit('messaging:fetch', { 
      workspaceId: activeWorkspaceId, 
      view, 
      search,
      limit: 50 
    }, (res: any) => {
      setLoading(false);
      try {
        if (res.success) {
          setConversations(res.data.map((c: any) => {
            let metadata = c.metadata;
            if (typeof metadata === 'string') {
              try { metadata = JSON.parse(metadata); } catch(e) { metadata = {}; }
            }
            return {
              ...c,
              id: c.id,
              chatId: c.chatId || c.from,
              name: c.contactName || c.contactDisplayName || metadata?.senderName || metadata?.fromName || metadata?.subject || c.chatId || c.from || "Contact Necunoscut",
              lastMessage: c.provider === 'whatsapp' ? (c.body || "") : (c.subject ? `[${c.subject}] ` : "") + (c.body || "").replace(/<[^>]*>/g, '').substring(0, 80),
              time: (() => {
                const d = new Date(Number(c.timestamp) || c.timestamp);
                return !isNaN(d.getTime()) ? d.toLocaleTimeString('ro-RO', { hour: 'numeric', minute: '2-digit' }) : "Acum";
              })(),
              unread: c.readAt ? 0 : 1,
              fromMe: c.fromMe === 1 || c.fromMe === "1" || c.fromMe === true,
              type: c.provider === 'email' || c.provider === 'gmail' ? 'gmail' : c.provider,
              avatar: (() => {
                const email = (c.chatId || c.from || "").match(/<(.+)>|([^ ]+@[^ ]+)/)?.[0]?.replace(/[<>]/g, '');
                const isSystem = email && /no-reply|noreply|support|admin|info|contact|notification|alert|billing/i.test(email);
                
                // If it's a system email, never use Google S2/Gravatar
                if (isSystem) return "";
                
                // Use existing avatar if it's NOT a google/gravatar URL that might 404
                if (c.avatar && !c.avatar.includes('google.com/s2') && !c.avatar.includes('gravatar.com')) {
                  return c.avatar;
                }

                // If no valid avatar, try to generate Google S2 for non-system emails
                if (email && (c.provider === 'email' || c.provider === 'gmail')) {
                  return `https://www.google.com/s2/photos/profile/${email}`;
                }
                
                return c.avatar || "";
              })(),
              isPinned: c.isPinned === 1 || c.isPinned === "1" || c.isPinned === true,
              isFavorite: c.isFavorite === 1 || c.isFavorite === "1" || c.isFavorite === true,
              isArchive: c.isArchive === 1 || c.isArchive === "1" || c.isArchive === true,
              isTrash: c.isTrash === 1 || c.isTrash === "1" || c.isTrash === true,
              Tag: typeof c.Tag === 'string' ? JSON.parse(c.Tag || '[]') : (Array.isArray(c.Tag) ? c.Tag : [])
            };
          }));
        }
      } catch (err) {
        console.error("Error processing conversations:", err);
      }
    });
  }, [view, search, filter]);

  // Load Inbox / Latest interaction
  useEffect(() => {
    socket.emit('workspace:join', { workspaceId: activeWorkspaceId });
    loadInbox();
    loadSettings();
  }, [loadInbox, loadSettings, activeWorkspaceId]);

  // Synchronize selectedChat with the latest data from conversations
  useEffect(() => {
    if (selectedChat) {
      const liveChat = conversations.find(c => c.id === selectedChat.id);
      if (liveChat) {
        // Build a simple comparison to see if we need an update
        const changes = 
          liveChat.isPinned !== selectedChat.isPinned || 
          liveChat.isFavorite !== selectedChat.isFavorite || 
          liveChat.isArchive !== selectedChat.isArchive || 
          liveChat.isTrash !== selectedChat.isTrash ||
          liveChat.unread !== selectedChat.unread ||
          JSON.stringify(liveChat.Tag) !== JSON.stringify(selectedChat.Tag);

        if (changes) {
          setSelectedChat(liveChat);
        }
      } else if (view !== 'favorites' && view !== 'archive' && view !== 'trash') {
        // If chat disappeared from inbox (e.g. was archived), deselect it
        // Only if we are not in the view where it should still be present
        // setSelectedChat(null); 
      }
    }
  }, [conversations]);

  useEffect(() => {
    // Listen for new messages
    socket.on('messaging:new', (newMsg: any) => {
      // Update local messages cache if this is the active chat
      if (selectedChat && (newMsg.chatId === selectedChat.chatId || newMsg.chatId === selectedChat.from)) {
        setMessages((prev: any) => {
          const current = prev[selectedChat.chatId] || [];
          // Deduplicate optimistic messages (match by body and very close timestamp if they don't have real IDs yet)
          const isDuplicate = current.some((m: any) => 
            (m.id === newMsg.id) || 
            (m.fromMe && m.body === newMsg.body && Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime()) < 5000)
          );
          if (isDuplicate) {
            // Replace the optimistic message with the real one to get correct ID and metadata
            return {
              ...prev,
              [selectedChat.chatId]: current.map((m: any) => 
                (m.fromMe && m.body === newMsg.body && Math.abs(new Date(m.timestamp).getTime() - new Date(newMsg.timestamp).getTime()) < 5000) ? newMsg : m
              )
            };
          }
          return {
            ...prev,
            [selectedChat.chatId]: [...current, newMsg]
          };
        });
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
      
      // Update conversations list (optimistic update)
      setConversations((prev: any[]) => {
        const normalizedProv = (newMsg.provider === 'email' || newMsg.provider === 'gmail') ? 'gmail' : newMsg.provider;
        const match = prev.find(c => (c.chatId === newMsg.chatId || c.from === newMsg.from) && c.type === normalizedProv);
        if (match) {
          return prev.map(c => (c.chatId === match.chatId && c.type === match.type) ? {
            ...c,
            lastMessage: newMsg.body,
            time: (() => {
              const d = new Date(Number(newMsg.timestamp) || newMsg.timestamp);
              return !isNaN(d.getTime()) ? d.toLocaleTimeString('ro-RO', { hour: 'numeric', minute: '2-digit' }) : "Acum";
            })(),
            unread: newMsg.fromMe ? c.unread : c.unread + 1,
            fromMe: newMsg.fromMe === 1 || newMsg.fromMe === "1" || newMsg.fromMe === true,
            timestamp: newMsg.timestamp
          } : c).sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return Number(b.timestamp) - Number(a.timestamp);
          });
        } else {
          // New conversation
          const mapped = {
            id: newMsg.id,
            chatId: newMsg.chatId || newMsg.from,
            name: newMsg.metadata?.fromName || newMsg.metadata?.senderName || newMsg.metadata?.subject || newMsg.chatId || newMsg.from,
            lastMessage: newMsg.body,
            time: (() => {
              const d = new Date(Number(newMsg.timestamp) || newMsg.timestamp);
              return !isNaN(d.getTime()) ? d.toLocaleTimeString('ro-RO', { hour: 'numeric', minute: '2-digit' }) : "Acum";
            })(),
            unread: newMsg.fromMe ? 0 : 1,
            fromMe: newMsg.fromMe === 1 || newMsg.fromMe === "1" || newMsg.fromMe === true,
            type: newMsg.provider === 'email' || newMsg.provider === 'gmail' ? 'gmail' : newMsg.provider,
            avatar: (() => {
              const email = (newMsg.chatId || newMsg.from || "").match(/<(.+)>|([^ ]+@[^ ]+)/)?.[0]?.replace(/[<>]/g, '');
              const isSystem = email && /no-reply|noreply|support|admin|info|contact|notification|alert|billing/i.test(email);
              if (isSystem) return "";
              if (newMsg.avatar && !newMsg.avatar.includes('google.com/s2') && !newMsg.avatar.includes('gravatar.com')) return newMsg.avatar;
              if (email && (newMsg.provider === 'email' || newMsg.provider === 'gmail')) return `https://www.google.com/s2/photos/profile/${email}`;
              return newMsg.avatar || "";
            })(),
            status: "online",
            isPinned: false,
            isFavorite: false,
            isArchive: false,
            isTrash: false,
            Tag: [],
            timestamp: newMsg.timestamp
          };
          return [mapped, ...prev].sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return Number(b.timestamp) - Number(a.timestamp);
          });
        }
      });
    });

    socket.on('messaging:updated', (payload: any) => {
      const { ids, updates, chatId, provider } = payload;
      const normalizedProvider = (provider === 'email' || provider === 'gmail') ? 'gmail' : provider;

      setConversations((prev: any[]) => {
        const next = prev.map(c => {
          const isMatch = (ids && ids.includes(c.id)) || (chatId && c.chatId === chatId && c.type === normalizedProvider);
          if (isMatch) {
            const updated = { ...c };
            if ('isPinned' in updates) updated.isPinned = updates.isPinned === 1 || updates.isPinned === true;
            if ('isFavorite' in updates) updated.isFavorite = updates.isFavorite === 1 || updates.isFavorite === true;
            if ('isArchive' in updates) updated.isArchive = updates.isArchive === 1 || updates.isArchive === true;
            if ('isTrash' in updates) updated.isTrash = updates.isTrash === 1 || updates.isTrash === true;
            if ('readAt' in updates) updated.unread = updates.readAt ? 0 : 1;
            if ('Tag' in updates) {
               try {
                 updated.Tag = typeof updates.Tag === 'string' ? JSON.parse(updates.Tag) : updates.Tag;
               } catch (e) {
                 updated.Tag = Array.isArray(updates.Tag) ? updates.Tag : [];
               }
            }
            return updated;
          }
          return c;
        });

        // Sync selectedChat if it was updated
        if (selectedChat) {
          const updatedSelected = next.find(c => 
            (ids && ids.includes(selectedChat.id)) || 
            (chatId && selectedChat.chatId === chatId && selectedChat.type === normalizedProvider)
          );
          if (updatedSelected) {
            // Only update if something actually changed to avoid unnecessary re-renders
            if (JSON.stringify(updatedSelected) !== JSON.stringify(selectedChat)) {
              setSelectedChat(updatedSelected);
            }
          }
        }

        return next.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return Number(b.timestamp) - Number(a.timestamp);
        });
      });
    });

    socket.on('message-ack', ({ id, ack }: { id: string, ack: number }) => {
      setMessages((prev: any) => {
        const newMsgs = { ...prev };
        for (const cid in newMsgs) {
          if (newMsgs[cid]) {
            newMsgs[cid] = newMsgs[cid].map((m: any) => {
               if (m.id === id) {
                 const currentMeta = typeof m.metadata === 'string' ? JSON.parse(m.metadata || '{}') : (m.metadata || {});
                 return { ...m, metadata: { ...currentMeta, ack } };
               }
               return m;
            });
          }
        }
        return newMsgs;
      });
    });

    socket.on('message-updated', ({ id, updates }: any) => {
      setMessages((prev: any) => {
        const newMsgs = { ...prev };
        for (const cid in newMsgs) {
          if (newMsgs[cid]) {
            newMsgs[cid] = newMsgs[cid].map((m: any) => m.id === id ? { ...m, ...updates } : m);
          }
        }
        return newMsgs;
      });
    });

    return () => {
      socket.off('messaging:new');
      socket.off('messaging:updated');
      socket.off('message-ack');
      socket.off('message-updated');
    };
  }, [selectedChat]);

  // Load chat history when selected chat changes
  useEffect(() => {
    if (selectedChat) {
      const cid = selectedChat.chatId || selectedChat.from;
      setMessagePages({ ...messagePages, [cid]: 0 });
      socket.emit('messaging:fetch', { chatId: cid, provider: selectedChat.type, page: 0 }, (res: any) => {
        if (res.success) {
          setMessages((prev: any) => ({
            ...prev,
            [cid]: res.data.reverse()
          }));
        }
      });
    }
  }, [selectedChat]);

  // Load older messages (pagination)
  const loadOlderMessages = useCallback(() => {
    if (!selectedChat) return;
    const cid = selectedChat.chatId || selectedChat.from;
    const nextPage = (messagePages[cid] || 0) + 1;
    
    socket.emit('messaging:fetch', { chatId: cid, provider: selectedChat.type, page: nextPage }, (res: any) => {
      if (res.success && res.data.length > 0) {
        setMessagePages({ ...messagePages, [cid]: nextPage });
        setMessages((prev: any) => ({
          ...prev,
          [cid]: [...res.data.reverse(), ...(prev[cid] || [])]
        }));
      }
    });
  }, [selectedChat, messagePages, socket]);

  const handleEditMessage = async (msg: any) => {
    if (!editBody.trim()) return;
    socket.emit('messaging:edit', { id: msg.id, body: editBody }, (res: any) => {
        if (res.success) {
            setEditingMessageId(null);
            setEditBody("");
            toast.success("Mesaj modificat");
        } else {
            toast.error(res.error || "Eroare la modificare");
        }
    });
  };

  const handleDeleteMessage = async (msg: any, revoke = true) => {
    socket.emit('messaging:delete', { id: msg.id, revoke }, (res: any) => {
        if (res.success) {
            toast.success(revoke ? "Mesaj șters pentru toți" : "Mesaj șters local");
        } else {
            toast.error(res.error || "Eroare la ștergere");
        }
    });
  };

  const getStatusIcon = (msg: any) => {
    if (!msg.fromMe && msg.fromMe !== 1) return null;
    let metadata = msg.metadata;
    if (typeof metadata === 'string') {
        try { metadata = JSON.parse(metadata); } catch(e) { metadata = {}; }
    }
    const ack = metadata?.ack;

    if (msg.provider === 'gmail' || msg.provider === 'email' || msg.type === 'email') {
        if (metadata?.readAt || msg.readAt) return <Eye className="w-3 h-3 text-blue-500" />;
        return <Check className="w-3 h-3 text-muted-foreground mr-1" />;
    }

    // WhatsApp Acks
    switch (ack) {
        case 3: return <CheckCheck className="w-3 h-3 text-[hsl(212,100%,70%)]" />; // Blue read
        case 2: return <CheckCheck className="w-3 h-3 text-muted-foreground/70" />; // Double gray delivered
        case 1: return <Check className="w-3 h-3 text-muted-foreground/70" />; // Single gray sent
        case -1: return <AlertCircle className="w-3 h-3 text-destructive" />; // Error
        default: return <Clock className="w-3 h-3 text-muted-foreground/50" />; // Sending
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    toast.info("Sincronizare emailuri...");
    try {
      if (socket.connected) {
        socket.emit('gmail:sync', { workspaceId: activeWorkspaceId, days: 30 }, (res: any) => {
          if (res.success) {
             toast.success(`Sincronizare completă (${res.count || 0} noi)`);
             loadInbox();
          } else {
             toast.error(res.error || "Eroare sincronizare locală");
          }
          setIsSyncing(false);
        });
      } else {
        const res = await api.brain.post('messaging/gmail/sync');
        if (res.success) {
          toast.success(`Sincronizare Cloud completă (${res.data.count || 0} noi)`);
          loadInbox();
        } else {
          toast.error(res.error || "Eroare sincronizare Cloud");
        }
        setIsSyncing(false);
      }
    } catch (e) {
      setIsSyncing(false);
      toast.error("Sincronizarea a eșuat");
    }
  };

  const fetchLocalInbox = () => {
    socket.emit('messaging:list-local-inbox', {}, (res: any) => {
        if (res.success) {
            setInboxFiles(res.File);
        }
    });
  };

  const handleSendLocalFile = (File: any) => {
      if (!selectedChat) return;
      setIsSendingLocal(true);
      socket.emit('messaging:send-local-File', {
          chatId: selectedChat.chatId,
          provider: selectedChat.type,
          relativePath: File.relativePath,
          fileName: File.name
      }, (res: any) => {
          setIsSendingLocal(false);
          if (res.success) {
              toast.success("Fișier trimis!");
              setInboxModalOpen(false);
          } else {
              toast.error("Eroare: " + res.error);
          }
      });
  };

  useEffect(() => {
    if (inboxModalOpen) {
        fetchLocalInbox();
    }
  }, [inboxModalOpen]);

  const handleSend = async () => {

    // If replying, send as reply
    if (replyingTo) {
      socket.emit('messaging:reply', {
        messageId: replyingTo.id,
        body: message,
        parentId: replyingTo.id
      }, (res: any) => {
        if (res.success) {
          setMessage("");
          setReplyingTo(null);
          toast.success("Răspuns trimis!");
          setTimeout(() => scrollToBottom("smooth"), 100);
        } else {
          toast.error("Eroare: " + res.error);
        }
      });
      return;
    }
    if ((!message.trim() && pendingFiles.length === 0) || !selectedChat) return;

    // Split sending for WhatsApp to avoid giant payloads that crash Socket.io
    if (selectedChat.type === 'whatsapp' && pendingFiles.length > 1) {
        toast.info("Trimitere multiplă în curs...");
        
        // Send first File with message
        const firstFile = pendingFiles[0];
        const firstPayload = {
            chatId: selectedChat.chatId,
            body: message,
            provider: selectedChat.type,
            workspaceId: activeWorkspaceId,
            media: {
                data: firstFile.base64,
                mimetype: firstFile.File.type,
                filename: firstFile.File.name
            }
        };

        socket.emit('messaging:send', firstPayload, async (res: any) => {
            if (res.success) {
                // Add to local state for instant feedback
                setMessages(prev => ({
                    ...prev,
                    [selectedChat.chatId]: [...(prev[selectedChat.chatId] || []), {
                        id: crypto.randomUUID(),
                        fromMe: 1,
                        body: message,
                        timestamp: Date.now(),
                        provider: selectedChat.type,
                        chatId: selectedChat.chatId,
                        attachments: [{ original_name: firstFile.File.name, mimetype: firstFile.File.type, size: firstFile.File.size }]
                    }]
                }));
                setMessage("");
                
                // Send remaining File one by one
                for (let i = 1; i < pendingFiles.length; i++) {
                    const pf = pendingFiles[i];
                    await new Promise(resolve => {
                        socket.emit('messaging:send', {
                            chatId: selectedChat.chatId,
                            body: "",
                            provider: selectedChat.type,
                            workspaceId: activeWorkspaceId,
                            media: {
                                data: pf.base64,
                                mimetype: pf.File.type,
                                filename: pf.File.name
                            }
                        }, (innerRes: any) => {
                            if (innerRes.success) {
                                setMessages(prev => ({
                                    ...prev,
                                    [selectedChat.chatId]: [...(prev[selectedChat.chatId] || []), {
                                        id: `temp-${Date.now()}-${i}`,
                                        fromMe: 1,
                                        body: "",
                                        timestamp: Date.now(),
                                        provider: selectedChat.type,
                                        chatId: selectedChat.chatId,
                                        attachments: [{ original_name: pf.File.name, mimetype: pf.File.type, size: pf.File.size }]
                                    }]
                                }));
                            }
                            resolve(innerRes);
                        });
                    });
                    setTimeout(() => scrollToBottom("smooth"), 50);
                }
                setPendingFiles([]);
                toast.success("Toate fișierele au fost trimise!");
            } else {
                toast.error("Err: " + res.error);
            }
        });
        return;
    }

    const payload: any = {
      chatId: selectedChat.chatId,
      body: message,
      subject: subject,
      cc: cc,
      bcc: bcc,
      provider: selectedChat.type,
      workspaceId: activeWorkspaceId,
      attachments: pendingFiles.map(pf => ({
          data: pf.base64,
          mimetype: pf.File.type,
          filename: pf.File.name
      }))
    };

    if (pendingFiles.length > 0) {
        payload.media = payload.attachments[0];
    }

    if (socket.connected) {
      socket.emit('messaging:send', payload, (res: any) => {
        if (res.success) {
          setMessage("");
          setSubject("");
          setCc("");
          setBcc("");
          setPendingFiles([]);
          
          setMessages(prev => ({
             ...prev,
             [selectedChat.chatId]: [...(prev[selectedChat.chatId] || []), {
                 id: crypto.randomUUID(),
                 fromMe: 1,
                 body: message,
                 timestamp: Date.now(),
                 provider: selectedChat.type,
                 chatId: selectedChat.chatId,
                 attachments: payload.attachments.map((a: any) => ({
                     original_name: a.filename,
                     mimetype: a.mimetype,
                     size: 0
                 }))
             }]
          }));
          setTimeout(() => scrollToBottom("smooth"), 100);
        } else {
          toast.error("Err: " + res.error);
        }
      });
    } else {
      if (selectedChat.type !== 'email' && selectedChat.type !== 'gmail') {
          return toast.error("WhatsApp requires Local Agent to be online.");
      }
      try {
        const res = await api.brain.post('messaging/gmail/send', {
            to: selectedChat.chatId,
            cc: cc,
            bcc: bcc,
            subject: subject || "Studio Response",
            body: message
        });
        if (res.success) {
          setMessage("");
          setSubject("");
          setCc("");
          setBcc("");
          toast.success("Email trimis prin Cloud!");
          loadInbox();
        } else {
          toast.error(res.error);
        }
      } catch (e) {
        toast.error("Failed to send via Cloud");
      }
    }
  };

  const handleForward = (chatId: string, type: string) => {
    if (!forwardingMessage) return;
    
    const payload = {
       chatId: chatId.includes('@') ? chatId : chatId,
       provider: type,
       body: forwardingMessage.body || forwardingMessage.text,
       workspaceId: activeWorkspaceId
    };
    
    socket.emit('messaging:send', payload, (res: any) => {
       if (res.success) {
          toast.success("Mesaj redirecționat!");
          setForwardingMessage(null);
       } else {
          toast.error("Eroare la redirecționare");
       }
    });
  };

  const navItems = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'sent', label: 'Sent', icon: SendHorizontal },
    { id: 'favorites', label: 'Favorites', icon: Star },
    { id: 'archive', label: 'Archive', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const formatSidebarName = (name: string) => {
    if (!name) return "";
    return name.replace(/<.*>/, '').replace(/"/g, '').trim();
  };

  const unreadCounts = useMemo(() => {
    return conversations.reduce((acc: any, c: any) => {
      if (c.unread > 0) {
        if (!c.isArchive && !c.isTrash && !c.fromMe) acc['inbox'] = (acc['inbox'] || 0) + 1;
        if (c.isArchive && !c.isTrash) acc['archive'] = (acc['archive'] || 0) + 1;
        if (c.isFavorite && !c.isTrash) acc['favorites'] = (acc['favorites'] || 0) + 1;
      }
      return acc;
    }, {});
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(c => {
      const safeName = c.name || "";
      const safeLastMessage = c.lastMessage || "";
      const matchesSearch = safeName.toLowerCase().includes(search.toLowerCase()) || 
                           safeLastMessage.toLowerCase().includes(search.toLowerCase());
      
      // Fix types search to handle aliases or 'all'
      const matchesType = filter === "all" || c.type === filter;
      
      let matchesView = true;
      if (view === 'inbox') matchesView = c.isArchive !== true && c.isTrash !== true;
      else if (view === 'sent') matchesView = c.fromMe === true && c.isTrash !== true;
      else if (view === 'archive') matchesView = c.isArchive === true && c.isTrash !== true;
      else if (view === 'trash') matchesView = c.isTrash === true;
      else if (view === 'favorites') matchesView = c.isFavorite === true && c.isTrash !== true;

      return matchesSearch && matchesType && matchesView;
    });
  }, [conversations, search, filter, view]);

  const handleBulkAction = async (action: string, specificId?: any) => {
    let idsToUpdate = [...selectedIds];
    if (idsToUpdate.length === 0 && specificId) idsToUpdate = [specificId];
    if (idsToUpdate.length === 0 && selectedChat) idsToUpdate = [selectedChat.id];
    
    if (idsToUpdate.length === 0) return;
    
    const updates: any = {};
    if (action === 'archive') updates.isArchive = 1;
    if (action === 'unarchive') updates.isArchive = 0;
    if (action === 'favorite') updates.isFavorite = 1;
    if (action === 'unfavorite') updates.isFavorite = 0;
    if (action === 'trash') updates.isTrash = 1;
    if (action === 'restore') { updates.isTrash = 0; updates.isArchive = 0; }
    if (action === 'pin') updates.isPinned = 1;
    if (action === 'unpin') updates.isPinned = 0;
    if (action === 'read') updates.readAt = new Date().toISOString();
    if (action === 'Tag') {
       const Tag = prompt("Tag nou:");
       if (!Tag) return;
       updates.Tag = Tag;
    }

    socket.emit('messaging:update', {
      ids: idsToUpdate,
      updates
    }, (res: any) => {
      if (res.success) {
        toast.success(`Succes: ${action}`);
        setSelectedIds([]);
        loadInbox();
      } else {
        toast.error("Eroare la actualizare");
      }
    });
  };

  const selectChat = (chat: any) => {
    setSelectedChat(chat);
    setSearchTermMessages("");
    setShowSearchMessages(false);
    setIsEmailExpanded(false);
    if (chat.unread > 0) {
      socket.emit('messaging:mark-read', { 
        chatId: chat.chatId || chat.from,
        provider: chat.type,
        workspaceId: activeWorkspaceId
      });
      // Update local state immediately
      setConversations(prev => prev.map(c => 
        (c.id === chat.id) ? { ...c, unread: 0 } : c
      ));
    }
  };

  const currentMessages = (selectedChat && messages[selectedChat.chatId]) || [];

  const filteredMessages = useMemo(() => {
    if (!searchTermMessages) return currentMessages;
    const lowerSearch = searchTermMessages.toLowerCase();
    return currentMessages.filter((m: any) => 
       (m.body && m.body.toLowerCase().includes(lowerSearch)) ||
       (m.subject && m.subject.toLowerCase().includes(lowerSearch))
    );
  }, [currentMessages, searchTermMessages]);

  const lastMessageId = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1].id : null;

  useEffect(() => {
    if (currentMessages.length > 0) {
      // First jump
      scrollToBottom("auto");
      // Then smooth follow up after a bit of rendering
      const t1 = setTimeout(() => scrollToBottom("smooth"), 100);
      // Failsafe for images loading
      const t2 = setTimeout(() => scrollToBottom("smooth"), 500);
      const t3 = setTimeout(() => scrollToBottom("smooth"), 2000);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [currentMessages.length, lastMessageId, selectedChat?.id]);

  return (
    <div className="flex h-[calc(100vh-40px)] overflow-hidden bg-background w-full">
      {/* 1. NAVIGATION RAIL - Adaptive visibility */}
      <div className="hidden md:flex w-[48px] flex-col items-center py-6 border-r bg-muted/5 gap-6 shrink-0">
        <TooltipProvider>
          {navItems.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button 
                    variant={view === item.id ? "default" : "ghost"} 
                    size="icon" 
                    className={cn("w-9 h-9 rounded-xl transition-all duration-300", view === item.id ? "shadow-lg shadow-primary/20 scale-110" : "hover:bg-muted opacity-60 hover:opacity-100")}
                    onClick={() => { setView(item.id as any); setSelectedIds([]); }}
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                  </Button>
                  {unreadCounts[item.id] > 0 && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-primary rounded-full border-2 border-background animate-pulse" />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs font-bold">{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>

        <div className="mt-auto flex flex-col items-center gap-6">
           <UISeparator className="w-6 bg-muted/30" />
           <Button variant="ghost" size="icon" className="w-9 h-9 rounded-xl text-muted-foreground opacity-60 hover:opacity-100" asChild>
             <Link to={getLocalizedPath('/settings?tab=comms', lang)}>
               <Settings className="w-5 h-5" />
             </Link>
           </Button>
        </div>
      </div>

      {/* 2. CHAT LIST SIDEBAR */}
      <div className={cn(
        "w-full md:w-[320px] lg:w-[360px] border-r flex flex-col bg-muted/5 transition-all duration-300 shrink-0",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-2 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold capitalize">{view}</h1>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleSync} 
                disabled={isSyncing}
                className={isSyncing ? "animate-spin" : ""}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              {/* ... existing bot dropdown ... */}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                    <Bot className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-4 rounded-2xl shadow-xl border-purple-100" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                       </div>
                       <div>
                          <h4 className="text-sm font-bold leading-tight">AI Auto-Reply</h4>
                          <p className="text-[10px] text-muted-foreground">Răspunsuri automate inteligente pentru mesaje primite</p>
                       </div>
                    </div>
                    
                    <div className="space-y-3">
                       <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/50 border border-blue-100/20">
                          <div className="flex items-center gap-2">
                             <Mail className="w-3.5 h-3.5 text-blue-500" />
                             <span className="text-xs font-medium text-blue-700">Gmail</span>
                          </div>
                          <UISwitch 
                            checked={wsSettings.modules.gmail.active && wsSettings.modules.gmail.autoReply}
                            disabled={!wsSettings.modules.gmail.active}
                            onCheckedChange={(v) => {
                               const newS = {...wsSettings, modules: {...wsSettings.modules, gmail: {...wsSettings.modules.gmail, autoReply: v}}};
                               setWsSettings(newS);
                               saveSettings(newS);
                            }}
                          />
                       </div>

                       <div className="flex items-center justify-between p-2 rounded-xl bg-green-50/50 border border-green-100/20">
                          <div className="flex items-center gap-2">
                             <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                             <span className="text-xs font-medium text-green-700">WhatsApp</span>
                          </div>
                          <UISwitch 
                            checked={wsSettings.modules.whatsapp.active && wsSettings.modules.whatsapp.autoReply}
                            disabled={!wsSettings.modules.whatsapp.active}
                            onCheckedChange={(v) => {
                               const newS = {...wsSettings, modules: {...wsSettings.modules, whatsapp: {...wsSettings.modules.whatsapp, autoReply: v}}};
                               setWsSettings(newS);
                               saveSettings(newS);
                            }}
                          />
                       </div>
                    </div>
                    
                    <UISeparator className="bg-purple-50" />
                    
                    {whatsappState.status === 'QR_RECEIVED' && whatsappState.qr ? (
                       <div className="flex flex-col items-center gap-2 p-2 bg-slate-50 rounded-xl border border-dashed border-slate-200 animate-in zoom-in-95 duration-300">
                          <img 
                             src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(whatsappState.qr)}&size=150x150`} 
                             alt="QR" 
                             className="w-[120px] h-[120px] rounded-lg shadow-sm"
                          />
                          <p className="text-[10px] font-black uppercase text-slate-500 text-center leading-tight">
                             Scanează cu WhatsApp<br/>pentru activare
                          </p>
                       </div>
                    ) : (
                       <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-8 text-[10px] text-green-600 font-bold uppercase tracking-wider hover:bg-green-50 rounded-lg justify-start"
                          onClick={() => socket.emit('whatsapp:qr')}
                       >
                          <RefreshCw className={cn("w-3 h-3 mr-2", (whatsappState.status === 'INITIALIZING' || whatsappState.status === 'AUTHENTICATING') && "animate-spin")} />
                          {whatsappState.status === 'READY' ? 'Sesiune Activă' : 
                           (whatsappState.status === 'INITIALIZING' || whatsappState.status === 'AUTHENTICATING') ? 'Se conectează...' : 
                           'Generare QR Code'}
                       </Button>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={loadInbox}>Refresh List</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const unreadIds = conversations.filter(c => c.unread > 0).map(c => c.id);
                    if (unreadIds.length > 0) {
                      socket.emit('messaging:update', { 
                        ids: unreadIds, 
                        updates: { readAt: new Date().toISOString() } 
                      }, (res: any) => {
                        if (res.success) toast.success("Toate marcate ca citite");
                        loadInbox();
                      });
                    }
                  }}>
                    Mark all as read
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('common:search')} 
                className="pl-8 bg-background" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {search && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" className="h-9 w-9 shrink-0 shadow-lg animate-in zoom-in-50">
                    <Plus className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-[10px]">Trimite Mesaj Nou</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                      const id = search.includes('@') ? search : (search.replace(/\D/g, '') + '@c.us');
                      selectChat({ id: `whatsapp_${id}`, chatId: id, type: 'whatsapp', name: search, avatar: '', status: 'online', unread: 0, fromMe: true, time: 'Nou', lastMessage: '' });
                  }}>
                    <MessageSquare className="w-4 h-4 text-green-500" /> WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {
                      selectChat({ 
                        id: `gmail_${search}`, 
                        chatId: search, 
                        type: 'gmail', 
                        name: search, 
                        avatar: search.includes('@') && !/no-reply|noreply|support|admin|info|contact|notification|alert|billing/i.test(search) 
                        ? `https://www.google.com/s2/photos/profile/${search.match(/<(.+)>|([^ ]+@[^ ]+)/)?.[0]?.replace(/[<>]/g, '')}` : '', 
                        status: 'online', 
                        unread: 0, 
                        fromMe: true, 
                        time: 'Nou', 
                        lastMessage: '' 
                      });
                  }}>
                    <Mail className="w-4 h-4 text-primary" /> Email (Gmail)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-full">
            <TabsList className="grid grid-cols-3 w-full h-8 px-1">
              <TabsTrigger value="all" className="text-[10px] font-bold">All</TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-[10px] gap-1.5 font-bold">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shadow-sm",
                  workerStatuses['whatsapp'] === 'running' ? "bg-green-500 shadow-green-100" :
                  workerStatuses['whatsapp'] === 'processing' ? "bg-amber-400 animate-pulse" :
                  workerStatuses['whatsapp'] === 'limited' ? "bg-blue-400 shadow-blue-100" :
                  "bg-rose-500 shadow-rose-100"
                )} />
                WA
              </TabsTrigger>
              <TabsTrigger value="gmail" className="text-[10px] gap-1.5 font-bold">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shadow-sm",
                  workerStatuses['gmail'] === 'running' ? "bg-green-500 shadow-green-100" :
                  workerStatuses['gmail'] === 'processing' ? "bg-amber-400 animate-pulse" :
                  workerStatuses['gmail'] === 'limited' ? "bg-blue-400 shadow-blue-100" :
                  "bg-rose-500 shadow-rose-100"
                )} />
                Mail
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* BULK ACTIONS BAR */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedIds.length === filteredConversations.length} 
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedIds(filteredConversations.map(c => c.id));
                    else setSelectedIds([]);
                  }}
                />
                <span className="text-[10px] font-bold">{selectedIds.length} selectate</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkAction('Tag')}><Tag className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkAction('archive')}><Archive className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkAction('favorite')}><Star className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleBulkAction('trash')}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 px-1 py-2">
            {filteredConversations.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  "group relative flex items-start gap-1 p-1.5 transition-all rounded-lg hover:bg-muted/50 border border-transparent",
                  selectedChat?.id === chat.id && "bg-muted border-muted-foreground/10",
                  selectedIds.includes(chat.id) && "bg-primary/5 border-primary/10"
                )}
              >
                <div className="flex items-center pt-2 shrink-0">
                   <Checkbox 
                     checked={selectedIds.includes(chat.id)}
                     onCheckedChange={(checked) => {
                       if (checked) setSelectedIds(prev => [...prev, chat.id]);
                       else setSelectedIds(prev => prev.filter(id => id !== chat.id));
                     }}
                     className={cn("h-3.5 w-3.5 transition-opacity", (selectedIds.length > 0) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                   />
                </div>
                
                <button
                  onClick={() => selectChat(chat)}
                  className="flex flex-1 items-start gap-2 text-left min-w-0"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9">
                      {chat.avatar ? (
                        <AvatarImage src={chat.avatar} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                          {formatSidebarName(chat.name).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    {chat.status === "online" && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-background rounded-full bg-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pr-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-0.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className={cn(
                          "font-medium text-[13px] truncate flex-1", 
                          chat.unread > 0 && "font-black text-foreground")}>
                          {formatSidebarName(chat.name)}
                        </span>
                        {!!chat.isPinned && <Pin className="w-2.5 h-2.5 text-primary rotate-45 shrink-0" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-1">{chat.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {chat.type === 'whatsapp' ? (
                        <MessageSquare className="w-2.5 h-2.5 text-green-500 shrink-0" />
                      ) : (
                        <Mail className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                      )}
                      <span className={cn(
                        "text-[11px] text-muted-foreground truncate flex-1", 
                        chat.unread > 0 && "text-foreground font-semibold",
                        "[mask-image:linear-gradient(to_right,black_92%,transparent)]"
                      )}>
                        {chat.lastMessage}
                      </span>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                         {!!chat.isFavorite && <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />}
                         {chat.unread > 0 && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                         )}
                      </div>
                    </div>
                    {chat.Tag && chat.Tag.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {chat.Tag.map((t: string) => (
                          <Badge key={t} variant="secondary" className="px-1 py-0 h-3 text-[8px] opacity-70">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content - Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col relative w-full bg-background min-w-0",
        selectedChat ? "flex" : "hidden md:flex"
      )}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="h-14 border-b flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center gap-2 md:gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden h-8 w-8" 
                  onClick={() => setSelectedChat(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="h-8 w-8">
                  {selectedChat.avatar ? (
                    <AvatarImage src={selectedChat.avatar} />
                  ) : (
                    <AvatarFallback className={cn(
                        "text-[10px]",
                        isEmail ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"
                    )}>
                      {selectedChat.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h2 className="font-semibold text-xs leading-tight">{selectedChat.name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className={cn(
                        "text-[9px] py-0 h-4 capitalize border-none",
                        isEmail ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
                    )}>
                      {isEmail ? 'Email' : 'WhatsApp'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {showSearchMessages && (
                  <div className="flex items-center bg-muted/50 rounded-lg px-2 h-8 mr-2 transition-all border border-primary/20">
                    <Search className="w-3.5 h-3.5 text-muted-foreground mr-2" />
                    <input
                      autoFocus
                      placeholder="Caută în mesaje..."
                      className="bg-transparent border-none text-[11px] focus:ring-0 w-32 md:w-48 placeholder:text-muted-foreground/50"
                      value={searchTermMessages}
                      onChange={(e) => setSearchTermMessages(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowSearchMessages(false);
                          setSearchTermMessages("");
                        }
                      }}
                    />
                    {searchTermMessages && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-transparent" onClick={() => setSearchTermMessages("")}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                )}
                <TooltipProvider>
                  {selectedChat.type === 'whatsapp' && (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => toast.info("Apelul audio va fi disponibil în curând")}>
                            <Phone className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Apel Audio</p></TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => toast.info("Apelul video va fi disponibil în curând")}>
                            <Video className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Apel Video</p></TooltipContent>
                      </Tooltip>
                      <UISeparator orientation="vertical" className="h-4 mx-1" />
                    </>
                  )}
                  {!showSearchMessages && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearchMessages(true)}>
                          <Search className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Caută în mesaje</p></TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const isPinned = !selectedChat.isPinned;
                        socket.emit('messaging:update', { ids: [selectedChat.id], updates: { isPinned: isPinned ? 1 : 0 } }, () => loadInbox());
                      }}>
                        <Pin className={cn("w-4 h-4", selectedChat.isPinned && "fill-primary text-primary rotate-45")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Pin</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const isFav = !selectedChat.isFavorite;
                        socket.emit('messaging:update', { ids: [selectedChat.id], updates: { isFavorite: isFav ? 1 : 0 } }, () => loadInbox());
                      }}>
                        <Star className={cn("w-4 h-4", selectedChat.isFavorite && "fill-yellow-400 text-yellow-400")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Favorite</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBulkAction(selectedChat.isArchive ? 'unarchive' : 'archive')}>
                        <Archive className={cn("w-4 h-4", selectedChat.isArchive && "text-primary")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{selectedChat.isArchive ? 'Unarchive' : 'Archive'}</p></TooltipContent>
                  </Tooltip>
                  {selectedChat.isTrash ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleBulkAction('restore')}>
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Restore</p></TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleBulkAction('trash')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Trash</p></TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
                <UISeparator orientation="vertical" className="h-4 mx-1" />
                <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end">
                      <DropdownMenuLabel className="text-[10px]">Manage Conversation</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs" onClick={() => {
                        const Tag = prompt("Add Tag:");
                        if (Tag && selectedChat) {
                          socket.emit('messaging:bulk-update', { 
                            chatId: selectedChat.chatId, 
                            updates: { Tag: Tag } 
                          });
                        }
                      }}>
                        <Tag className="w-3 h-3 mr-2" /> Add Tag
                      </DropdownMenuItem>
                   </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
                <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                  {currentMessages.length > 0 && (messagePages[selectedChat?.chatId] || 0) > 0 && (
                    <div className="text-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadOlderMessages}
                        className="text-xs"
                      >
                        ↑ Load Older Messages
                      </Button>
                    </div>
                  )}

                {searchTermMessages && (
                  <div className="text-center py-2 bg-primary/5 rounded-lg border border-primary/10 mb-4 animate-in fade-in">
                     <p className="text-[10px] font-bold text-primary italic">Se afișează {filteredMessages.length} rezultate pentru: "{searchTermMessages}"</p>
                  </div>
                )}
                
                {!searchTermMessages && (
                  <div className="text-center py-4">
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full uppercase tracking-wider font-semibold">
                      Istoric Mesaje
                    </span>
                  </div>
                )}

                  {filteredMessages.map((msg: any) => {
                  const isMsgEmail = msg.type === 'email' || msg.provider === 'gmail' || msg.provider === 'email';
                  
                  if (isEmail && isMsgEmail) {
                    const hasAttachments = msg.attachments && JSON.parse(typeof msg.attachments === 'string' ? msg.attachments : '[]').length > 0;
                    const cleanSnippet = (msg.body || msg.text || "").replace(/<[^>]*>/g, '').substring(0, 180).trim();

                    return (
                      <div 
                        key={msg.id} 
                        className={cn(
                          "flex flex-col w-full max-w-2xl mx-auto mb-4 cursor-pointer group transition-all",
                          msg.fromMe ? "items-end ml-auto" : "items-start mr-auto"
                        )}
                        onClick={() => setSelectedEmailForView(msg)}
                      >
                        <div className={cn(
                          "w-full rounded-2xl border p-5 shadow-sm hover:shadow-lg transition-all relative overflow-hidden",
                          msg.fromMe ? "bg-blue-50/70 border-blue-100" : "bg-white border-slate-200"
                        )}>
                          {/* Action Menu (Visible on hover) */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-full hover:bg-slate-200/50 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 border-muted shadow-xl rounded-xl p-1 bg-background/95 backdrop-blur">
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" 
                                  onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }}
                                >
                                  <CornerUpLeft className="w-3.5 h-3.5 opacity-70" /> {t('common:reply')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" 
                                  onClick={(e) => { e.stopPropagation(); setForwardingMessage(msg); }}
                                >
                                  <ArrowRight className="w-3.5 h-3.5 opacity-70" /> {t('common:forward')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const textToCopy = msg.body || msg.text || "";
                                    if (navigator.clipboard && window.isSecureContext) {
                                      navigator.clipboard.writeText(textToCopy).then(() => {
                                        toast.success("Copied!");
                                      }).catch(() => {
                                        toast.error("Format mismatch");
                                      });
                                    } else {
                                      try {
                                        const textArea = document.createElement("textarea");
                                        textArea.value = textToCopy;
                                        document.body.appendChild(textArea);
                                        textArea.select();
                                        document.execCommand("copy");
                                        document.body.removeChild(textArea);
                                        toast.success("Copied!");
                                      } catch (err) {
                                        toast.error("Permission denied");
                                      }
                                    }
                                  }}
                                >
                                  <Copy className="w-3.5 h-3.5 opacity-70" /> {t('common:copy')}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                   className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2"
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      socket.emit('messaging:toggle-favorite', { id: msg.id, isFavorite: !msg.isFavorite }, (res: any) => {
                                        if (res.success) {
                                          setMessages((prev: any) => ({
                                            ...prev,
                                            [selectedChat.chatId]: prev[selectedChat.chatId].map((m: any) => 
                                              m.id === msg.id ? { ...m, isFavorite: !m.isFavorite } : m
                                            )
                                          }));
                                          toast.success(msg.isFavorite ? "Removed from Favorites" : "Added to Favorites");
                                        }
                                      });
                                   }}
                                >
                                  <Star className={cn("w-3.5 h-3.5", msg.isFavorite ? "fill-yellow-400 text-yellow-400" : "opacity-70")} /> {t('common:favorite')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg, false); }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Status Badge & Time (Bottom Right WhatsApp Style) */}
                          <div className="absolute bottom-3 right-4 flex items-center gap-2 pointer-events-none">
                             {!!msg.fromMe && (
                                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-tighter bg-blue-100 px-1.5 py-0.5 rounded">Trimis</span>
                             )}
                             <span className="text-[10px] text-slate-400 font-medium">
                               {(() => {
                                 const d = new Date(Number(msg.timestamp) || msg.timestamp);
                                 return !isNaN(d.getTime()) ? d.toLocaleTimeString('ro-RO', { hour: 'numeric', minute: '2-digit' }) : "Acum";
                               })()}
                             </span>
                          </div>

                          <div className="flex items-start gap-3 mb-3">
                             <div className={cn(
                               "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                               msg.fromMe ? "bg-blue-200 text-blue-700" : "bg-slate-100 text-slate-600"
                             )}>
                                <Mail className="w-5 h-5" />
                             </div>
                             <div className="min-w-0 flex-1 pt-0.5">
                               <h3 className="font-bold text-base text-slate-900 truncate pr-16 leading-tight">
                                 {msg.subject || "(Fără subiect)"}
                               </h3>
                               <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                 {msg.fromMe ? "Către: " : "De la: "}
                                 <span className="text-slate-700 font-bold">{msg.fromMe ? (selectedChat.name || selectedChat.chatId) : (msg.metadata?.fromName || msg.chatId)}</span>
                               </p>
                             </div>
                          </div>

                          <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4 pl-1">
                            {cleanSnippet || "Fără conținut textual."}
                          </p>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-3">
                              {hasAttachments && (
                                <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] font-bold text-slate-700">
                                  <Paperclip className="w-3.5 h-3.5" />
                                  <span>{JSON.parse(typeof msg.attachments === 'string' ? msg.attachments : '[]').length} fișiere</span>
                                </div>
                              )}
                              {!!msg.isFavorite && <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />}
                            </div>
                            

                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div key={msg.id} className={cn("flex flex-col", (msg.fromMe === 1 || msg.fromMe === true) ? "items-end" : "items-start")}>
                    {/* Reply indicator */}
                    {msg.replyTo && (
                      <div className="text-[10px] text-muted-foreground mb-1 px-2">
                        ↳ Replying to...
                      </div>
                    )}

                    <div className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm relative group transition-all",
                      (msg.fromMe === 1 || msg.fromMe === true) 
                        ? "bg-primary text-primary-foreground rounded-tr-none hover:bg-primary/95" 
                        : "bg-muted text-foreground rounded-tl-none hover:bg-muted/90"
                    )}>
                      {/* Action Menu Trigger (WhatsApp Style) */}
                      <div className={cn(
                        "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10",
                        (msg.fromMe === 1 || msg.fromMe === true) ? "text-white" : "text-muted-foreground"
                      )}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 rounded-full hover:bg-black/10 transition-colors"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 border-muted shadow-xl rounded-xl p-1 bg-background/95 backdrop-blur">
                            <DropdownMenuItem className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" onClick={() => setReplyingTo(msg)}>
                              <CornerUpLeft className="w-3.5 h-3.5 opacity-70" /> {t('common:reply')}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" onClick={() => setForwardingMessage(msg)}>
                              <ArrowRight className="w-3.5 h-3.5 opacity-70" /> {t('common:forward')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2" 
                              onClick={() => {
                                const textToCopy = msg.body || msg.text || "";
                                if (navigator.clipboard && window.isSecureContext) {
                                  navigator.clipboard.writeText(textToCopy).then(() => {
                                    toast.success("Copied!");
                                  }).catch(() => {
                                    toast.error("Format mismatch");
                                  });
                                } else {
                                  try {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = textToCopy;
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);
                                    toast.success("Copied!");
                                  } catch (err) {
                                    toast.error("Permission denied");
                                  }
                                }
                              }}
                            >
                              <Copy className="w-3.5 h-3.5 opacity-70" /> {t('common:copy')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                               className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2"
                               onClick={() => {
                                  socket.emit('messaging:toggle-favorite', { id: msg.id, isFavorite: !msg.isFavorite }, (res: any) => {
                                    if (res.success) {
                                      setMessages((prev: any) => ({
                                        ...prev,
                                        [selectedChat.chatId]: prev[selectedChat.chatId].map((m: any) => 
                                          m.id === msg.id ? { ...m, isFavorite: !m.isFavorite } : m
                                        )
                                      }));
                                      toast.success(msg.isFavorite ? "Removed from Favorites" : "Added to Favorites");
                                    }
                                  });
                               }}
                            >
                              <Star className={cn("w-3.5 h-3.5", msg.isFavorite ? "fill-yellow-400 text-yellow-400" : "opacity-70")} /> {t('common:favorite')}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                               className="text-xs py-2 rounded-lg cursor-pointer flex items-center gap-2"
                               onClick={() => {
                                  setEditBody(msg.body || msg.text || "");
                                  setEditingMessageId(msg.id);
                               }}
                            >
                              <Pencil className="w-3.5 h-3.5 opacity-70" /> {t('common:edit')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {msg.fromMe ? (
                              <>
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" 
                                  onClick={() => handleDeleteMessage(msg, true)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete for everyone
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-xs py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" 
                                  onClick={() => handleDeleteMessage(msg, false)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 opacity-50" /> Delete for me
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem 
                                className="text-xs py-2 rounded-lg cursor-pointer text-destructive focus:text-destructive flex items-center gap-2" 
                                onClick={() => handleDeleteMessage(msg, false)}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Message body */}
                      {(msg.type === 'email' || msg.provider === 'gmail') && (
                        <>
                          {msg.subject && (
                            <div className="font-bold text-[10px] mb-1 opacity-80 uppercase flex items-center gap-1.5">
                              <Mail className="w-3 h-3" /> {msg.subject}
                            </div>
                          )}
                          {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2 pb-2 border-b border-dashed border-current/20">
                              {msg.attachments.map((at: any, idx: number) => {
                                const filePath = at.path || at.localPath || at.local_path || '';
                                return (
                                  <button
                                    key={idx}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[10px] font-medium max-w-[180px]",
                                      (msg.fromMe === 1 || msg.fromMe === true) ? "bg-white/20 hover:bg-white/30" : "bg-black/5 hover:bg-black/10"
                                    )}
                                    onClick={() => window.open(`/api/File/view?path=${encodeURIComponent(filePath)}`)}
                                  >
                                    <Paperclip className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{at.original_name || 'Atasament'}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                      
                      <div className="relative pr-12">
                        {editingMessageId === msg.id ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <textarea 
                              className="w-full bg-white/20 border-none rounded p-1 text-sm text-white focus:ring-0"
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-white hover:bg-white/10" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                <Button size="sm" className="h-6 text-[10px] bg-white text-primary hover:bg-white/90" onClick={() => handleEditMessage(msg)}>Save</Button>
                            </div>
                          </div>
                        ) : msg.bodyHtml ? (
                          <div 
                            className="text-sm leading-relaxed overflow-hidden" 
                            dangerouslySetInnerHTML={{ __html: msg.bodyHtml }} 
                          />
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {linkifyText(msg.body || msg.text)}
                          </p>
                        )}

                        <div className={cn(
                          "absolute bottom-1 right-2 flex items-center gap-1 leading-none select-none",
                          (msg.fromMe === 1 || msg.fromMe === true) ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                            {!!msg.isFavorite && (
                              <Star className="w-2.5 h-2.5 fill-current text-yellow-500" />
                            )}
                            <span className="text-[9px] font-medium uppercase">
                              {(() => {
                                  const d = new Date(Number(msg.timestamp) || msg.timestamp);
                                  return !isNaN(d.getTime()) ? d.toLocaleTimeString('ro-RO', { hour: 'numeric', minute: '2-digit' }) : "";
                              })()}
                            </span>
                            {getStatusIcon(msg)}
                        </div>
                      </div>

                      {/* Atasamente */}
                      {msg.attachments && Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                        <div className="mt-3 flex flex-col gap-2 min-w-[150px]">
                          {msg.attachments.map((at: any, idx: number) => {
                            const isImg = at.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(at.original_name || at.filename);
                            const isPdf = at.mimetype === 'application/pdf' || (at.original_name || at.filename || '').toLowerCase().endsWith('.pdf');
                            const filePath = at.path || at.localPath || at.local_path || '';
                            const fileUrl = `/api/File/view?path=${encodeURIComponent(filePath)}`;
                            return (
                              <div 
                                key={idx} 
                                className={cn(
                                  "rounded-lg overflow-hidden border transition-all",
                                  (msg.fromMe === 1 || msg.fromMe === true) ? "border-white/20 bg-white/5" : "border-muted-foreground/10 bg-black/5"
                                )}
                              >
                                {isImg ? (
                                  <div className="relative group/img max-w-[280px]">
                                    <img 
                                      src={fileUrl} 
                                      alt={at.original_name} 
                                      className="max-w-full max-h-80 object-cover cursor-pointer hover:brightness-90 transition-all rounded-sm"
                                      onClick={() => window.open(fileUrl)}
                                    />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                       <Button 
                                         size="icon" 
                                         variant="secondary" 
                                         className="h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 text-white border-none"
                                         onClick={(e) => { e.stopPropagation(); window.open(fileUrl, '_blank'); }}
                                       >
                                          <Eye className="w-3.5 h-3.5" />
                                       </Button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity">
                                       <span className="text-[9px] text-white truncate block">{at.original_name}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <a 
                                    href={fileUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 p-3 text-xs hover:bg-black/5 transition-colors no-underline"
                                  >
                                    <div className={cn(
                                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                      isPdf ? "bg-red-500/10 text-red-500" : ((msg.fromMe === 1 || msg.fromMe === true) ? "bg-white/20 text-white" : "bg-primary/10 text-primary")
                                    )}>
                                      {isPdf ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="font-semibold truncate leading-tight">{(at.original_name || 'Document').split('/').pop()}</span>
                                      <span className="text-[10px] opacity-60 mt-0.5">{(at.size / 1024).toFixed(1)} KB • {isPdf ? 'PDF Document' : 'File'}</span>
                                    </div>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
                })}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-background border-t">
              <div className="max-w-4xl mx-auto flex flex-col gap-2">
                {/* Reply indicator */}
                {replyingTo && (
                  <div className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border-l-4",
                      isEmail ? "bg-blue-50 border-blue-400" : "bg-muted/50 border-primary"
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground mb-1 font-bold uppercase">
                        {isEmail ? `Re: ${replyingTo.subject || "(Fără subiect)"}` : "Răspuns la mesaj:"}
                      </p>
                      <p className="text-xs truncate italic opacity-80">{replyingTo.body?.substring(0, 100) || replyingTo.text?.substring(0, 100)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setReplyingTo(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
                    {pendingFiles.map((pf, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded-xl border border-dashed border-primary/20 min-w-[200px] max-w-[250px]">
                        {pf.type === 'image' ? (
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden border shrink-0">
                            <img src={`data:${pf.File.type};base64,${pf.base64}`} className="w-full h-full object-cover" alt="Preview" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <File className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{pf.File.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(pf.File.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive" 
                          onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className={cn(
                      "flex-1 bg-muted rounded-xl p-2 focus-within:ring-1 transition-all",
                      isEmail ? "focus-within:ring-blue-400/30 bg-blue-50/30" : "focus-within:ring-primary/20"
                  )}>
                    {isEmail && (
                      <div className={cn(
                        "flex flex-col gap-1 transition-all duration-300 overflow-hidden",
                        isEmailExpanded ? "max-h-[300px] mb-2 border-b border-blue-200/30 pb-2" : "max-h-0"
                      )}>
                        <div className="flex items-center gap-2 px-2 relative group mt-1">
                            <span className="text-[10px] font-bold text-blue-600/60 w-12 uppercase tracking-tight">Către:</span>
                            <span className="text-xs font-semibold text-blue-900 truncate flex-1">{selectedChat.chatId}</span>
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  className="h-5 px-1.5 text-[9px] text-blue-600 hover:bg-blue-100"
                                  onClick={() => setShowCc(!showCc)}
                                >
                                  CC
                                </Button>
                            </div>
                        </div>

                        {showCc && (
                          <>
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-[10px] font-bold text-blue-600/60 w-12 uppercase tracking-tight">CC:</span>
                                <Input 
                                    placeholder="destinatar, alt-destinatar..." 
                                    value={cc}
                                    onChange={(e) => setCc(e.target.value)}
                                    className="border-none bg-transparent h-6 text-xs focus-visible:ring-0 px-0 text-blue-900 placeholder:text-blue-300"
                                />
                                <Button 
                                  variant="ghost" 
                                  className="h-5 px-1.5 text-[9px] text-blue-600 hover:bg-blue-100"
                                  onClick={() => {
                                    if(bcc) setBcc(prev => prev ? prev + ', ' : '');
                                  }}
                                >
                                  BCC
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 px-2">
                                <span className="text-[10px] font-bold text-blue-600/60 w-12 uppercase tracking-tight">BCC:</span>
                                <Input 
                                    placeholder="destinatar secret..." 
                                    value={bcc}
                                    onChange={(e) => setBcc(e.target.value)}
                                    className="border-none bg-transparent h-6 text-xs focus-visible:ring-0 px-0 text-blue-900 placeholder:text-blue-300"
                                />
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-[10px] font-bold text-blue-600/60 w-12 uppercase tracking-tight">Subiect:</span>
                            <Input 
                                placeholder="Subiectul email-ului..." 
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="border-none bg-transparent h-6 text-xs focus-visible:ring-0 px-0 font-bold placeholder:text-blue-300 text-blue-900"
                            />
                        </div>
                      </div>
                    )}
                    <textarea 
                      rows={isEmail ? (isEmailExpanded ? 6 : 1) : 1}
                      value={message}
                      onFocus={() => isEmail && setIsEmailExpanded(true)}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={isEmail ? (isEmailExpanded ? "Scrie email-ul aici..." : "Trimite email rapid...") : "Scrie mesaj WhatsApp..."}
                      className={cn(
                          "w-full bg-transparent border-none focus:ring-0 resize-none px-2 py-1 text-sm block transition-all duration-300",
                          isEmail ? (isEmailExpanded ? "min-h-[150px] text-blue-950" : "min-h-[40px] text-blue-950") : "min-h-[40px]"
                      )}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !isEmail) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mt-1 px-1">
                    <div className="flex items-center gap-1">
                      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Smile className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" className="w-64 p-2 bg-background border-muted shadow-2xl rounded-2xl">
                           <div className="grid grid-cols-8 gap-1 h-48 overflow-y-auto p-1 custom-scrollbar">
                              {commonEmojis.map(emoji => (
                                <button 
                                  key={emoji} 
                                  className="hover:bg-muted p-1 rounded text-lg transition-colors"
                                  onClick={() => {
                                    setMessage(prev => prev + emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                >
                                  {emoji}
                                </button>
                              ))}
                           </div>
                        </PopoverContent>
                      </Popover>

                      <input 
                        type="File" 
                        id="chat-attach-File" 
                        className="hidden" 
                        multiple
                        onChange={(e) => {
                          const File = Array.from(e.target.files || []).slice(0, 10);
                          const limitMb = isWhatsApp ? (wsSettings?.modules?.whatsapp?.mediaLimit || 16) : 25;
                          
                          if (File.length > 0) {
                             File.forEach(File => {
                                if (File.size > limitMb * 1024 * 1024) {
                                   toast.error(`Fișierul ${File.name} este prea mare. Limita este de ${limitMb}MB.`);
                                   return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event: any) => {
                                   const base64 = event.target.result.split(',')[1];
                                   const newItem: {File: File, base64: string, type: 'File' | 'image'} = { File, base64, type: 'File' };
                                   setPendingFiles(prev => [...prev, newItem].slice(0, 10));
                                };
                                reader.readAsDataURL(File);
                             });
                             setShowAttachmentPicker(false);
                          }
                        }}
                      />
                      <input 
                        type="File" 
                        id="chat-attach-image" 
                        accept="image/*"
                        className="hidden" 
                        multiple
                        onChange={(e) => {
                          const File = Array.from(e.target.files || []).slice(0, 10);
                          const limitMb = isWhatsApp ? (wsSettings?.modules?.whatsapp?.mediaLimit || 16) : 25;

                          if (File.length > 0) {
                             File.forEach(File => {
                                if (File.size > limitMb * 1024 * 1024) {
                                   toast.error(`Imaginea ${File.name} este prea mare. Limita este de ${limitMb}MB.`);
                                   return;
                                }
                                const reader = new FileReader();
                                reader.onload = (event: any) => {
                                   const base64 = event.target.result.split(',')[1];
                                   const newItem: {File: File, base64: string, type: 'File' | 'image'} = { File, base64, type: 'image' };
                                   setPendingFiles(prev => [...prev, newItem].slice(0, 10));
                                };
                                reader.readAsDataURL(File);
                             });
                             setShowAttachmentPicker(false);
                          }
                        }}
                      />

                      <Popover open={showAttachmentPicker} onOpenChange={setShowAttachmentPicker}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <Paperclip className="w-4 h-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="start" className="w-56 p-2 rounded-xl border-muted shadow-xl bg-background">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="chat-attach-File" className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <File className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Document</span>
                                        <span className="text-[10px] text-muted-foreground">Din computer (.pdf, .doc)</span>
                                    </div>
                                </label>
                                <label htmlFor="chat-attach-image" className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                        <Image className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Imagine</span>
                                        <span className="text-[10px] text-muted-foreground">Din computer (.jpg, .png)</span>
                                    </div>
                                </label>
                                <button 
                                    onClick={() => setInboxModalOpen(true)}
                                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors text-left w-full"
                                >
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                        <Inbox className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">Local Inbox</span>
                                        <span className="text-[10px] text-muted-foreground">Fișiere recepționate/scanate</span>
                                    </div>
                                </button>
                            </div>
                        </PopoverContent>
                      </Popover>

                      {isWhatsApp && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={handleSendLocation}
                          >
                            <MapPin className="w-4 h-4" />
                          </Button>

                          <Popover open={showPredefined} onOpenChange={setShowPredefined}>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <BookOpen className="w-4 h-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="w-64 p-2 bg-background border-muted shadow-2xl rounded-2xl">
                               <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between px-2 py-1">
                                    <h4 className="text-[10px] font-bold uppercase opacity-50">Mesaje Predefinite</h4>
                                    <Button 
                                      variant="ghost" 
                                      className="h-5 px-1 text-[9px] text-primary hover:bg-primary/10" 
                                      onClick={() => {
                                        setIsPredefinedModalOpen(true);
                                        setShowPredefined(false);
                                      }}
                                    >
                                      Administrează
                                    </Button>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                                    {dbPredefinedMessages.length === 0 && (
                                      <p className="text-[10px] text-center py-4 opacity-40 italic">Niciun mesaj definit</p>
                                    )}
                                    {dbPredefinedMessages.map(m => (
                                      <button 
                                        key={m.id}
                                        className="text-left text-xs p-2 hover:bg-muted rounded-lg transition-colors truncate"
                                        onClick={() => {
                                          setMessage(m.text);
                                          setShowPredefined(false);
                                        }}
                                      >
                                        {m.text}
                                      </button>
                                    ))}
                                  </div>
                               </div>
                            </PopoverContent>
                          </Popover>

                          <div className="flex items-center gap-1">
                             {isRecording ? (
                               <div className="flex items-center gap-2 bg-red-50 px-2 py-1 rounded-full animate-pulse border border-red-100">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-[10px] font-mono text-red-600">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2)}</span>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-red-600" onClick={() => stopRecording(false)}>
                                     <X className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 text-green-600" onClick={() => stopRecording(true)}>
                                     <SendHorizontal className="w-3 h-3" />
                                  </Button>
                               </div>
                             ) : (
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={startRecording}>
                                 <Mic className="w-4 h-4" />
                               </Button>
                             )}
                          </div>
                        </>
                      )}
                    </div>
                    <Button 
                      onClick={handleSend}
                      disabled={(!message.trim() && pendingFiles.length === 0) || (isEmail && !subject.trim() && !message.trim())}
                      className={cn(
                          "h-8 rounded-lg gap-1.5 px-3 transition-all",
                          isEmail ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                      )}
                    >
                      <span className="text-xs font-semibold">{isEmail ? "Trimite Email" : "Trimite"}</span>
                      <SendHorizontal className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 opacity-20" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Selectează o conversație</h3>
            <p className="max-w-xs text-sm mt-1">
              Selectează un contact din lista din stânga pentru a vedea istoricul mesajelor WhatsApp sau email-urilor.
            </p>
          </div>
        )}
      </div>

      {/* Local Inbox File Picker Dialog */}
      <Dialog open={inboxModalOpen} onOpenChange={setInboxModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden bg-background border-muted shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-primary" />
                  <span>Local Inbox</span>
                </DialogTitle>
                <DialogDescription>
                  Selectează un fișier recepționat recent pentru a-l atașa.
                </DialogDescription>
              </div>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Caută în fișiere..." 
                className="pl-9 bg-background border-muted h-9 text-sm"
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
              />
            </div>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-2">
            <div className="grid grid-cols-1 gap-1">
              {inboxFiles
                .filter(f => f.name.toLowerCase().includes(inboxSearch.toLowerCase()))
                .map((File) => (
                <button
                  key={File.id}
                  onClick={() => handleSendLocalFile(File)}
                  disabled={isSendingLocal}
                  className="flex items-center gap-3 p-3 hover:bg-muted rounded-xl transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    {File.name.match(/\.(jpg|jpeg|png|gif)$/i) ? <Image className="w-5 h-5" /> : <File className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{File.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(File.size / 1024).toFixed(1)} KB • {new Date(File.mtime).toLocaleString()}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8">Trimite</Button>
                  </div>
                </button>
              ))}
              
              {inboxFiles.length === 0 && (
                <div className="p-8 text-center">
                  <Inbox className="w-12 h-12 text-muted-foreground opacity-20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nu există fișiere în inbox-ul local.</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/30 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setInboxModalOpen(false)}>
              Închide
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Predefined Messages Management Modal */}
      <Dialog open={isPredefinedModalOpen} onOpenChange={setIsPredefinedModalOpen}>
          <DialogContent className="max-w-md bg-background border-muted shadow-2xl rounded-2xl">
              <DialogHeader>
                  <DialogTitle>Administrare Mesaje Predefinite</DialogTitle>
                  <DialogDescription>
                      Adaugă sau șterge mesaje rapide pentru a răspunde mai ușor clienților.
                  </DialogDescription>
              </DialogHeader>
              
              <div className="flex flex-col gap-4 py-4">
                  <div className="flex gap-2">
                      <Input 
                          placeholder="Mesaj nou..." 
                          value={newPredefinedText}
                          onChange={(e) => setNewPredefinedText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSavePredefined(newPredefinedText)}
                      />
                      <Button onClick={() => handleSavePredefined(newPredefinedText)}>
                          Adaugă
                      </Button>
                  </div>

                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                      {dbPredefinedMessages.map((msg) => (
                          <div key={msg.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg group">
                              <span className="text-xs truncate flex-1 pr-4">{msg.text}</span>
                              <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeletePredefined(msg.id)}
                              >
                                  <Trash2 className="w-3 h-3" />
                              </Button>
                          </div>
                      ))}
                      {dbPredefinedMessages.length === 0 && (
                          <p className="text-center text-xs text-muted-foreground py-4">Nu sunt mesaje salvate.</p>
                      )}
                  </div>
              </div>

              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPredefinedModalOpen(false)}>Închide</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* Full Email View Modal */}
      <Dialog open={!!selectedEmailForView} onOpenChange={() => setSelectedEmailForView(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white border-muted shadow-2xl rounded-2xl">
              {selectedEmailForView && (
                <>
                  <DialogHeader className="p-6 border-b bg-blue-50/30">
                     <div className="flex justify-between items-start">
                        <div className="flex-1">
                           <DialogTitle className="text-xl font-bold text-blue-900 mb-2">
                             {selectedEmailForView.subject || "(Fără subiect)"}
                           </DialogTitle>
                           <DialogDescription className="sr-only">
                             Detalii detaliate despre email-ul selectat.
                           </DialogDescription>
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-xs">
                                 <span className="font-bold text-blue-600/60 w-12 uppercase">De la:</span>
                                 <span className="font-medium">{selectedEmailForView.fromMe ? "Eu" : (selectedEmailForView.metadata?.fromName || selectedEmailForView.chatId)}</span>
                                 <span className="text-muted-foreground">({selectedEmailForView.chatId})</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                 <span className="font-bold text-blue-600/60 w-12 uppercase">Către:</span>
                                 <span>{selectedEmailForView.metadata?.to || selectedEmailForView.to || "(Necunoscut)"}</span>
                              </div>
                              {selectedEmailForView.metadata?.cc && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="font-bold text-blue-600/60 w-12 uppercase">CC:</span>
                                  <span>{selectedEmailForView.metadata.cc}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs">
                                 <span className="font-bold text-blue-600/60 w-12 uppercase">Data:</span>
                                 <span>{new Date(Number(selectedEmailForView.timestamp)).toLocaleString('ro-RO')}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                  </DialogHeader>

                  <ScrollArea className="flex-1 p-8 bg-white">
                      <div className="max-w-3xl mx-auto">
                        {selectedEmailForView.bodyHtml ? (
                          <div 
                            className="prose prose-sm max-w-none email-content"
                            dangerouslySetInnerHTML={{ __html: selectedEmailForView.bodyHtml }}
                          />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                             {linkifyText(selectedEmailForView.body || selectedEmailForView.text)}
                          </p>
                        )}

                        {selectedEmailForView.attachments && selectedEmailForView.attachments.length > 0 && (
                          <div className="mt-12 pt-6 border-t">
                            <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                              <Paperclip className="w-4 h-4" />
                              Atașamente ({selectedEmailForView.attachments.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {selectedEmailForView.attachments.map((at: any, idx: number) => {
                                   const isImg = at.mimetype?.startsWith('image/');
                                   const fileUrl = `/api/File/view?path=${encodeURIComponent(at.path || at.localPath || at.local_path || '')}`;
                                   return (
                                     <a 
                                       key={idx}
                                       href={fileUrl}
                                       target="_blank"
                                       rel="noreferrer"
                                       className="flex items-center gap-3 p-3 border rounded-xl hover:bg-muted transition-colors group"
                                     >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                           {isImg ? <Image className="w-5 h-5" /> : <File className="w-5 h-5" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                           <p className="text-xs font-semibold truncate">{at.original_name || at.filename}</p>
                                           <p className="text-[10px] text-muted-foreground">{(at.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                     </a>
                                   );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                  </ScrollArea>

                  <div className="p-4 border-t bg-muted/20 flex justify-end gap-3">
                      <Button variant="outline" size="sm" onClick={() => {
                        setReplyingTo(selectedEmailForView);
                        setSelectedEmailForView(null);
                      }}>
                         <RotateCcw className="w-4 h-4 mr-2" />
                         Răspunde
                      </Button>
                      <Button size="sm" onClick={() => setSelectedEmailForView(null)}>
                         Închide
                      </Button>
                  </div>
                </>
              )}
          </DialogContent>
      </Dialog>

      {/* FORWARDING DIALOG */}
      <Dialog open={!!forwardingMessage} onOpenChange={(open) => {
          if(!open) {
              setForwardingMessage(null);
              setForwardSearch("");
          }
      }}>
          <DialogContent className="max-w-md bg-background border-muted shadow-2xl rounded-2xl p-0 overflow-hidden">
              <DialogHeader className="p-4 border-b bg-muted/20">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-primary" />
                      Redirecționează Mesaj
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                      Alege un contact pentru a redirecționa mesajul selectat.
                  </DialogDescription>
              </DialogHeader>
              <div className="p-2 space-y-2">
                  <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                          placeholder="Caută contact..." 
                          className="pl-9 bg-muted/30 border-none h-9 text-sm focus-visible:ring-1 focus-visible:ring-primary/20"
                          value={forwardSearch}
                          onChange={(e) => setForwardSearch(e.target.value)}
                      />
                  </div>
                  <ScrollArea className="h-[350px] pr-2">
                      <div className="space-y-1">
                          {conversations
                            .filter(c => 
                                c.name.toLowerCase().includes(forwardSearch.toLowerCase()) || 
                                c.chatId.toLowerCase().includes(forwardSearch.toLowerCase())
                            )
                            .slice(0, 30).map(c => (
                              <button
                                  key={c.id}
                                  onClick={() => handleForward(c.chatId, c.type)}
                                  className="w-full flex items-center gap-3 p-2 hover:bg-primary/5 rounded-xl transition-all group"
                              >
                                  <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                      {c.avatar ? <AvatarImage src={c.avatar} /> : <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{c.name.substring(0, 2).toUpperCase()}</AvatarFallback>}
                                  </Avatar>
                                  <div className="flex-1 text-left min-w-0">
                                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{c.name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{c.provider || c.type}</p>
                                  </div>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                          <SendHorizontal className="w-3.5 h-3.5" />
                                      </div>
                                  </div>
                              </button>
                          ))}
                          {conversations.filter(c => 
                            c.name.toLowerCase().includes(forwardSearch.toLowerCase()) || 
                            c.chatId.toLowerCase().includes(forwardSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="text-center py-10 opacity-40 italic text-xs">
                              Niciun contact găsit
                            </div>
                          )}
                      </div>
                  </ScrollArea>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  );
}


