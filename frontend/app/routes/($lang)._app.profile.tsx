import { useState, useEffect } from "react";
import { useLoaderData, useActionData, useNavigation, Form, useParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useAuth } from "~/hooks/useAuth";
import { useConfig } from "~/hooks/useConfig";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { User, Briefcase, Shield, Check, Save, RefreshCcw, LogOut, Bell, Globe, Languages, Clock } from "lucide-react";
import { toast } from "sonner";
import { getDb } from '~/lib/d1.server';
import { verifyAuth } from '~/lib/auth-core.server';
import { renderString, getRegistry } from "~/lib/core";
import { ensureSystemTables } from "~/lib/db-init.server";
import { isGlobalAdmin } from "~/lib/auth-utils";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const env = (context as any).cloudflare.env;
  const db = getDb(env);

  // Level 8 Self-Healing: Ensure system tables exist before querying
  await ensureSystemTables(db, request.url, context).catch(e => {
    console.error("[Profile] DB Initialization failed:", e);
  });

  const user = await verifyAuth(request, env);

  if (!user) {
    return { workspace: [], profile: null };
  }

  const registry = await getRegistry(db);
  const isGlobal = isGlobalAdmin(user, registry);

  const workspaceQuery = isGlobal 
    ? `SELECT w.*, COALESCE(wu.role, ?) as userRole 
       FROM workspace w 
       LEFT JOIN workspace_user wu ON w.id = wu.workspaceId AND wu.userId = ?
       WHERE w.archived = 0 AND w.deletedAt IS NULL`
    : `SELECT w.*, wu.role as userRole 
       FROM workspace w 
       JOIN workspace_user wu ON w.id = wu.workspaceId 
       WHERE wu.userId = ? AND w.archived = 0 AND w.deletedAt IS NULL`;

  const queryParams = isGlobal ? [user.role, user.sub] : [user.sub];

  const [workspace, profile] = await Promise.all([
    db.query(workspaceQuery, queryParams).catch(e => {
      console.error("[Profile] Workspace query failed:", e);
      return [];
    }),
    db.get("contact", user.sub)
  ]);

  let list = Array.isArray(workspace) ? workspace : [];
  
  // Superadmin failsafe: if no workspace found for superadmin, fetch all
  if (isGlobal && list.length === 0) {
    try {
      const allWs = await db.query("SELECT *, ? as userRole FROM workspace WHERE archived = 0 AND deletedAt IS NULL", [user.role]);
      list = Array.isArray(allWs) ? allWs : [];
    } catch (e) {
      console.error("[Profile] Superadmin failsafe query failed:", e);
    }
  }
  
  // Fallback for dev mode
  if (list.length === 0 && user.workspaceId) {
    const ws = await db.get("workspace", user.workspaceId);
    if (ws) {
      list.push({ ...ws, userRole: "admin" });
    }
  }

  return { workspace: list, profile };
}

export async function action({ request, context }: ActionFunctionArgs) {
  const env = (context as any).cloudflare.env;
  const db = getDb(env);
  const user = await verifyAuth(request, env);

  if (!user) return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const phone = formData.get("phone") as string;
  const language = formData.get("language") as string;
  const timezone = formData.get("timezone") as string;

  try {
    await db.set("contact", user.sub, {
      name,
      phone,
      language,
      timezone,
      updatedAt: new Date().toISOString()
    });
    return Response.json({ success: true });
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export default function ProfilePage() {
  const { user, switchWorkspace, logout } = useAuth();
  const { workspace, profile } = useLoaderData<typeof loader>();
  const params = useParams();
  const lang = params.lang || "ro";
  const actionData = useActionData<any>();
  const navigation = useNavigation();
  const { t } = useTranslation(["common", "auth"]);
  
  const [profileData, setProfileData] = useState({
    name: profile?.name || user?.name || "",
    email: profile?.email || user?.email || "",
    phone: profile?.phone || user?.phone || "",
    avatar: profile?.avatar || user?.avatar || "",
    language: profile?.language || lang || "ro",
    timezone: profile?.timezone || "Europe/Bucharest",
    notificationsEnabled: typeof window !== 'undefined' ? Notification.permission === 'granted' : false
  });

  const requestBrowserNotification = async () => {
    if (!("Notification" in window)) {
      toast.error(t("common:browser_notifs_not_supported"));
      return false;
    }

    if (Notification.permission === "granted") return true;

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      toast.success(t("common:browser_notifs_enabled"));
      setProfileData(prev => ({ ...prev, notificationsEnabled: true }));
      return true;
    } else {
      toast.error(t("common:browser_notifs_denied"));
      setProfileData(prev => ({ ...prev, notificationsEnabled: false }));
      return false;
    }
  };

  const isUpdating = navigation.state === "submitting" && navigation.formData?.get("_action") === "update_profile";
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (actionData?.success) {
      toast.success(t("common:profile_updated"));
    } else if (actionData?.error) {
      toast.error(actionData.error);
    }
  }, [actionData, t]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === user.workspaceId) return;
    
    setIsSwitching(workspaceId);
    try {
      await switchWorkspace(workspaceId);
      toast.success(t("common:workspace_switched"));
    } catch (error) {
      toast.error(t("common:workspace_switch_failed"));
    } finally {
      setIsSwitching(null);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("common:edit_profile")}</h1>
          <p className="text-muted-foreground">{t("common:manage_account_desc")}</p>
        </div>
        <Button variant="outline" onClick={() => logout()} className="text-destructive hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          {t("common:logout")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile & Preferences Form */}
        <div className="lg:col-span-2 space-y-8">
          <Form method="post">
            <input type="hidden" name="_action" value="update_profile" />
            <input type="hidden" name="language" value={profileData.language} />
            <input type="hidden" name="timezone" value={profileData.timezone} />
            
            <div className="grid gap-8">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {t("common:personal_info")}
                  </CardTitle>
                  <CardDescription>{t("common:personal_info_desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("common:full_name")}</Label>
                      <Input 
                        id="name" 
                        name="name"
                        value={profileData.name} 
                        onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t("common:name_placeholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("common:email")}</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={profileData.email} 
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("common:phone")}</Label>
                      <Input 
                        id="phone" 
                        name="phone"
                        value={profileData.phone} 
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder={t("common:phone_placeholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("common:role")}</Label>
                      <div className="pt-2 flex gap-2">
                        <Badge variant="outline" className="capitalize">
                          <Shield className="h-3 w-3 mr-1" />
                          {user.role ? (renderString(t(`common:role.${user.role}`), lang) || user.role) : renderString(t("common:role.user"), lang)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Preferences Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    {t("common:preferences")}
                  </CardTitle>
                  <CardDescription>{t("common:preferences_desc") || "Setările personale pentru limbă și notificări."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Localization Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Languages className="h-4 w-4" />
                        {t("common:localization") || "Localizare"}
                      </div>
                      <div className="space-y-2">
                        <Label>{t("common:language") || "Limbă"}</Label>
                        <Select 
                          value={profileData.language} 
                          onValueChange={(val) => setProfileData(prev => ({ ...prev, language: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selectează limba" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ro">Română 🇷🇴</SelectItem>
                            <SelectItem value="en">English 🇬🇧</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("common:timezone") || "Fus Orar"}</Label>
                        <Select 
                          value={profileData.timezone} 
                          onValueChange={(val) => setProfileData(prev => ({ ...prev, timezone: val }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selectează fus orar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Europe/Bucharest">(GMT+02:00) Bucharest</SelectItem>
                            <SelectItem value="UTC">(UTC) Coordinated Universal Time</SelectItem>
                            <SelectItem value="Europe/London">(GMT+00:00) London</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Notifications Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Bell className="h-4 w-4" />
                        {t("common:notifications") || "Notificări"}
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-base">{t("common:browser_notifications") || "Notificări Browser"}</Label>
                          <p className="text-xs text-muted-foreground">
                            {t("common:browser_notifications_desc") || "Primește alerte în timp real pe desktop."}
                          </p>
                        </div>
                        <Switch 
                          checked={profileData.notificationsEnabled}
                          onCheckedChange={(checked) => {
                            if (checked) requestBrowserNotification();
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isUpdating} size="lg" className="rounded-xl px-12">
                  {isUpdating ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {t("common:save_changes")}
                </Button>
              </div>
            </div>
          </Form>
        </div>

        {/* workspace Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              {t("common:workspace")}
            </CardTitle>
            <CardDescription>{t("common:workspaces_desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspace.map((ws: any) => (
                <div 
                  key={ws.id} 
                  className={`p-4 rounded-lg border flex items-center justify-between transition-all ${
                    ws.id === user.workspaceId 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "hover:border-muted-foreground/50 bg-card"
                  }`}
                >
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold flex items-center gap-2">
                      {ws.name}
                      {ws.id === user.workspaceId && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <Badge variant="secondary" className="w-fit text-[10px] uppercase">
                      {ws.userRole ? (renderString(t(`common:role.${ws.userRole}`), lang) || ws.userRole) : renderString(t("common:role.member"), lang)}
                    </Badge>
                  </div>
                  
                  {ws.id !== user.workspaceId && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleSwitchWorkspace(ws.id)}
                      disabled={!!isSwitching}
                    >
                      {isSwitching === ws.id ? <RefreshCcw className="h-3 w-3 animate-spin" /> : t("common:switch")}
                    </Button>
                  )}
                </div>
              ))}

              {workspace.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  {t("common:no_workspaces_found")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


