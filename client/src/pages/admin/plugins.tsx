import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Puzzle, Plus, Trash2, MessageCircle, Settings, Loader2, MessageSquare, Ticket, Wallet, Package, Crown, Bot, History, Database, Receipt, Truck, CreditCard, Mail } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  icon: string;
  isEnabled: boolean;
  isBuiltIn: boolean;
  createdAt: string;
}

export default function PluginsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPlugin, setNewPlugin] = useState({
    name: "",
    displayName: "",
    description: "",
    icon: "Puzzle",
  });

  const { data: plugins = [], isLoading } = useQuery<Plugin[]>({
    queryKey: ["/api/admin/plugins"],
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/admin/plugins");
      if (!response.ok) throw new Error("Failed to fetch plugins");
      return response.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await createAuthenticatedRequest(`/api/admin/plugins/${id}/toggle`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to toggle plugin");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plugins"] });
      // آپدیت فوری وضعیت پلاگین در sidebar
      if (data?.name) {
        queryClient.invalidateQueries({ queryKey: [`/api/plugins/${data.name}/status`] });
      }
      // برای اطمینان همه پلاگین‌ها رو آپدیت کن
      queryClient.invalidateQueries({ queryKey: ["/api/plugins/whatsapp/status"] });
      toast({ title: "وضعیت پلاگین تغییر کرد" });
    },
    onError: () => {
      toast({ title: "خطا در تغییر وضعیت پلاگین", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (plugin: typeof newPlugin) => {
      const response = await createAuthenticatedRequest("/api/admin/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plugin),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to create plugin");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plugins"] });
      toast({ title: "پلاگین با موفقیت ایجاد شد" });
      setIsAddDialogOpen(false);
      setNewPlugin({ name: "", displayName: "", description: "", icon: "Puzzle" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "خطا در ایجاد پلاگین", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await createAuthenticatedRequest(`/api/admin/plugins/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to delete plugin");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plugins"] });
      toast({ title: "پلاگین با موفقیت حذف شد" });
    },
    onError: (error: Error) => {
      toast({ title: error.message || "خطا در حذف پلاگین", variant: "destructive" });
    },
  });

  const getPluginDetails = (pluginName: string) => {
    switch (pluginName) {
      case 'whatsapp':
        return { label: "واتس‌اپ", icon: MessageSquare, description: "اتصال به API واتس‌اپ و ارسال خودکار اعلان‌ها" };
      case 'internal-chats':
        return { label: "چت کاربران", icon: MessageCircle, description: "سیستم چت داخلی بین مدیر و کاربران سایت" };
      case 'tickets':
        return { label: "تیکت‌ها", icon: Ticket, description: "سیستم تیکتینگ و پشتیبانی کاربران" };
      case 'crypto-transactions':
        return { label: "ارز دیجیتال", icon: Wallet, description: "مدیریت تراکنش‌های کریپتو و درگاه پرداخت ارز دیجیتال" };
      case 'received-orders':
        return { label: "سفارشات", icon: Package, description: "مدیریت سفارشات دریافتی از مشتریان" };
      case 'subscriptions':
        return { label: "اشتراک‌ها", icon: Crown, description: "سیستم مدیریت اشتراک و سطوح دسترسی" };
      case 'ai':
        return { label: "هوش مصنوعی", icon: Bot, description: "تنظیمات و مدیریت سرویس‌های هوش مصنوعی" };
      case 'email':
        return { label: "ایمیل", icon: Mail, description: "مدیریت و ارسال ایمیل‌ها، تنظیمات SMTP و نمونه‌های ایمیل" };
      case 'login-logs':
        return { label: "لاگ ورود", icon: History, description: "مشاهده تاریخچه ورود کاربران به سیستم" };
      case 'backup':
        return { label: "پشتیبان‌گیری", icon: Database, description: "مدیریت بک‌آپ و بازیابی پایگاه داده" };
      case 'vat':
        return { label: "مالیات", icon: Receipt, description: "تنظیمات مالیات بر ارزش افزوده" };
      case 'shipping':
        return { label: "حمل و نقل", icon: Truck, description: "مدیریت روش‌های ارسال و ترابری" };
      case 'bank-card':
        return { label: "کارت بانکی", icon: CreditCard, description: "مدیریت اطلاعات حساب و کارت‌های بانکی" };
      default:
        return { label: pluginName, icon: Puzzle, description: "" };
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout title="مدیریت پلاگین‌ها">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="مدیریت پلاگین‌ها">
      <div className="space-y-6">
        <div className="flex flex-col gap-3">
          {plugins.map((plugin) => (
            <Card key={plugin.id} className={`relative ${!plugin.isEnabled ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-lg ${plugin.isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {(() => {
                    const details = getPluginDetails(plugin.name);
                    const IconComp = details.icon;
                    return <IconComp className="w-8 h-8" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{getPluginDetails(plugin.name).label}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getPluginDetails(plugin.name).description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${plugin.isEnabled ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
                    {plugin.isEnabled ? "فعال" : "غیرفعال"}
                  </span>
                  {!plugin.isBuiltIn && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(plugin.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Switch
                    checked={plugin.isEnabled}
                    onCheckedChange={() => toggleMutation.mutate(plugin.id)}
                    disabled={toggleMutation.isPending}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {plugins.length === 0 && (
          <div className="text-center py-12">
            <Puzzle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">هیچ پلاگینی وجود ندارد</h3>
            <p className="text-muted-foreground">برای شروع یک پلاگین جدید اضافه کنید</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
