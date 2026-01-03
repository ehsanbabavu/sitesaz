import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { 
  Store, 
  Users, 
  Ticket, 
  Crown, 
  User, 
  Send, 
  Warehouse, 
  Plus, 
  List, 
  MessageSquare,
  Settings,
  ChevronDown,
  LogOut,
  BarChart3,
  Bot,
  Home,
  FolderTree,
  MessageCircle,
  ShoppingCart,
  MapPin,
  Package,
  Wallet,
  DollarSign,
  CreditCard,
  HelpCircle,
  Truck,
  Receipt,
  Database,
  History,
  FileText,
  Puzzle,
  Mail
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useMenuCountersSimple } from "@/hooks/use-menu-counters";
import { createAuthenticatedRequest } from "@/lib/auth";

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ticketsOpen, setTicketsOpen] = useState(false);
  const [level2MenuOpen, setLevel2MenuOpen] = useState(false);
  const [level1MenuOpen, setLevel1MenuOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const prevLocation = useRef(location);

  const isActive = (path: string) => location === path;

  // Call onNavigate when location changes (for mobile drawer close)
  useEffect(() => {
    if (prevLocation.current !== location && onNavigate) {
      onNavigate();
    }
    prevLocation.current = location;
  }, [location, onNavigate]);

  // استفاده از hook مرکزی برای شمارنده‌های منو
  const {
    whatsappUnreadCount,
    pendingOrdersCount,
    pendingPaymentOrdersCount,
    pendingTransactionsCount,
    internalChatsUnreadCount: unreadCount,
    cartItemsCount,
  } = useMenuCountersSimple();

  // شمارنده پیام‌های خوانده نشده چت مهمانان (فقط برای ادمین)
  const { data: guestChatsUnreadData } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/admin/guest-chats/unread-count'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/admin/guest-chats/unread-count');
      if (!response.ok) return { unreadCount: 0 };
      return response.json();
    },
    enabled: !!user && user.role === "admin",
    refetchInterval: 5000,
  });
  const guestChatsUnreadCount = guestChatsUnreadData?.unreadCount || 0;

  // چک کردن وضعیت پلاگین‌ها
  const { data: whatsappPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/whatsapp/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/whatsapp/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isWhatsappPluginEnabled = whatsappPluginData?.isEnabled ?? true;

  const { data: vatPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/vat/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/vat/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isVatPluginEnabled = vatPluginData?.isEnabled ?? true;

  const { data: aiPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/ai/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/ai/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isAiPluginEnabled = aiPluginData?.isEnabled ?? true;

  const { data: backupPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/backup/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/backup/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isBackupPluginEnabled = backupPluginData?.isEnabled ?? true;

  const { data: cryptoPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/crypto-transactions/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/crypto-transactions/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isCryptoPluginEnabled = cryptoPluginData?.isEnabled ?? true;

  const { data: guestChatsPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/guest-chats/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/guest-chats/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isGuestChatsPluginEnabled = guestChatsPluginData?.isEnabled ?? true;

  const { data: loginLogsPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/login-logs/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/login-logs/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isLoginLogsPluginEnabled = loginLogsPluginData?.isEnabled ?? true;

  const { data: emailPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/email/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/email/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isEmailPluginEnabled = emailPluginData?.isEnabled ?? true;

  const { data: subscriptionPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/subscriptions/status'],
    queryFn: async () => {
      const response = await createAuthenticatedRequest('/api/plugins/subscriptions/status');
      if (!response.ok) return { isEnabled: false };
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isSubscriptionPluginEnabled = subscriptionPluginData?.isEnabled ?? true;

  // ===== منوهای ادمین =====
  
  const communicationItems = [
    ...(isGuestChatsPluginEnabled ? [{ path: "/guest-chats", label: "چت مهمانان", icon: MessageSquare }] : []),
    { path: "/tickets", label: "تیکت‌ها", icon: Ticket },
  ];

  const whatsappItems = [
    { path: "/whatsapp-chats", label: "چت واتس‌اپ", icon: MessageSquare },
    { path: "/send-message", label: "ارسال پیام", icon: Send },
    { path: "/admin/welcome-message", label: "پیام خوش آمدگویی", icon: MessageCircle },
    { path: "/whatsapp-settings", label: "تنظیمات", icon: Settings },
  ];

  const businessItems = [
    { path: "/received-orders", label: "سفارشات دریافتی", icon: Package },
    { path: "/transactions", label: "تراکنش‌ها", icon: DollarSign },
    ...(isCryptoPluginEnabled ? [{ path: "/crypto-transactions", label: "ارز دیجیتال", icon: Wallet }] : []),
    { path: "/customer-chats", label: "چت با مشتریان", icon: MessageCircle },
  ];

  const inventoryItems = [
    { path: "/products", label: "محصولات", icon: List },
    { path: "/add-product", label: "افزودن محصول", icon: Plus },
    { path: "/categories", label: "دسته‌بندی", icon: FolderTree },
  ];

  const usersManagementItems = [
    { path: "/users", label: "کاربران", icon: Users },
    ...(isSubscriptionPluginEnabled ? [{ path: "/subscriptions", label: "اشتراک‌ها", icon: Crown }] : []),
  ];

  const settingsItems = [
    { path: "/shipping-settings", label: "ترابری", icon: Truck },
    ...(isVatPluginEnabled ? [{ path: "/vat-settings", label: "مالیات", icon: Receipt }] : []),
    { path: "/bank-card", label: "کارت بانکی", icon: CreditCard },
    { path: "/manage-faqs", label: "سوالات متداول", icon: HelpCircle },
    ...(isAiPluginEnabled ? [{ path: "/ai-token", label: "هوش مصنوعی", icon: Bot }] : []),
    ...(isLoginLogsPluginEnabled ? [{ path: "/login-logs", label: "لاگ ورود", icon: History }] : []),
    ...(isBackupPluginEnabled ? [{ path: "/database-backup", label: "پشتیبان‌گیری", icon: Database }] : []),
  ];

  const userMenuItems = [{ path: "/", label: "پیشخوان", icon: Home }];

  return (
    <aside className="w-64 bg-card border-l border-border flex flex-col sidebar-transition" data-testid="sidebar-navigation">
      <div className="p-6 border-b border-border" data-testid="section-logo">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Store className="text-primary-foreground" />
          </div>
          <h2 className="mr-3 text-lg font-bold text-foreground">ربات آریا بات</h2>
        </div>
      </div>
      
      <nav className="flex-1 p-4 custom-scrollbar overflow-y-auto" data-testid="nav-main-menu">
        <ul className="space-y-1">
          {user?.role !== "admin" && userMenuItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <Button variant={isActive(item.path) ? "default" : "ghost"} className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                  <item.icon className="w-5 h-5 ml-2" />
                  {item.label}
                </Button>
              </Link>
            </li>
          ))}

          {user?.role === "admin" && (
            <>
              <li className="pt-2">
                <span className="text-xs text-muted-foreground px-3 font-medium">پیام‌ها</span>
                <div className="mt-1 space-y-1">
                  {communicationItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                        <item.icon className="w-4 h-4 ml-2" />
                        {item.label}
                        {item.path === "/guest-chats" && guestChatsUnreadCount > 0 && (
                          <Badge variant="destructive" className="mr-auto text-xs px-2 py-0.5 min-w-[1.5rem] h-5 flex items-center justify-center animate-pulse">{guestChatsUnreadCount}</Badge>
                        )}
                      </Button>
                    </Link>
                  ))}
                </div>
              </li>

              {isWhatsappPluginEnabled && (
                <li className="pt-2">
                  <Collapsible open={whatsappOpen} onOpenChange={setWhatsappOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        <MessageSquare className="w-4 h-4 ml-2" />
                        واتس‌اپ
                        {whatsappUnreadCount > 0 && <Badge variant="default" className="mr-2 text-xs px-1.5 py-0 min-w-[1.2rem] h-4 flex items-center justify-center bg-green-500 text-white">{whatsappUnreadCount}</Badge>}
                        <ChevronDown className={cn("w-4 h-4 mr-auto transition-transform", whatsappOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mr-6 space-y-1">
                      {whatsappItems.map((item) => (
                        <Link key={item.path} href={item.path}>
                          <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive(item.path) && "bg-primary text-primary-foreground")}>
                            <item.icon className="w-3.5 h-3.5 ml-2" />
                            {item.label}
                          </Button>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              )}

              <li className="pt-2">
                <Collapsible open={level1MenuOpen} onOpenChange={setLevel1MenuOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Package className="w-4 h-4 ml-2" />
                      کسب‌وکار
                      <ChevronDown className={cn("w-4 h-4 mr-auto transition-transform", level1MenuOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mr-6 space-y-1">
                    {businessItems.map((item) => (
                      <Link key={item.path} href={item.path}>
                        <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive(item.path) && "bg-primary text-primary-foreground")}>
                          <item.icon className="w-3.5 h-3.5 ml-2" />
                          {item.label}
                          {item.path === "/customer-chats" && unreadCount > 0 && <Badge variant="destructive" className="mr-auto text-xs px-1.5 py-0 min-w-[1.2rem] h-4">{unreadCount}</Badge>}
                          {item.path === "/received-orders" && pendingOrdersCount > 0 && <Badge className="mr-auto text-xs px-1.5 py-0 min-w-[1.2rem] h-4 bg-yellow-500 text-white">{pendingOrdersCount}</Badge>}
                          {item.path === "/transactions" && pendingTransactionsCount > 0 && <Badge variant="destructive" className="mr-auto text-xs px-1.5 py-0 min-w-[1.2rem] h-4">{pendingTransactionsCount}</Badge>}
                        </Button>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>

              <li>
                <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Warehouse className="w-4 h-4 ml-2" />
                      انبار
                      <ChevronDown className={cn("w-4 h-4 mr-auto transition-transform", inventoryOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mr-6 space-y-1">
                    {inventoryItems.map((item) => (
                      <Link key={item.path} href={item.path}>
                        <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive(item.path) && "bg-primary text-primary-foreground")}>
                          <item.icon className="w-3.5 h-3.5 ml-2" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>

              <li className="pt-2">
                <span className="text-xs text-muted-foreground px-3 font-medium">کاربران</span>
                <div className="mt-1 space-y-1">
                  {usersManagementItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                        <item.icon className="w-4 h-4 ml-2" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </li>

              <li className="pt-2">
                <Link href="/plugins">
                  <Button variant={isActive("/plugins") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive("/plugins") && "bg-primary text-primary-foreground")}>
                    <Puzzle className="w-4 h-4 ml-2" />
                    پلاگین‌ها
                  </Button>
                </Link>
              </li>

              {isEmailPluginEnabled && (
                <li className="pt-2">
                  <Collapsible open={emailOpen} onOpenChange={setEmailOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        <Mail className="w-4 h-4 ml-2" />
                        ایمیل
                        <ChevronDown className={cn("w-4 h-4 mr-auto transition-transform", emailOpen && "rotate-180")} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mr-6 space-y-1">
                      <Link href="/send-email">
                        <Button variant={isActive("/send-email") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive("/send-email") && "bg-primary text-primary-foreground")}>
                          <Send className="w-3.5 h-3.5 ml-2" />
                          ارسال ایمیل
                        </Button>
                      </Link>
                      <Link href="/sent-messages">
                        <Button variant={isActive("/sent-messages") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive("/sent-messages") && "bg-primary text-primary-foreground")}>
                          <FileText className="w-3.5 h-3.5 ml-2" />
                          پیام‌های ارسالی
                        </Button>
                      </Link>
                      <Link href="/email-inbox">
                        <Button variant={isActive("/email-inbox") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive("/email-inbox") && "bg-primary text-primary-foreground")}>
                          <Mail className="w-3.5 h-3.5 ml-2" />
                          اینباکس
                        </Button>
                      </Link>
                      <Link href="/email-settings">
                        <Button variant={isActive("/email-settings") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive("/email-settings") && "bg-primary text-primary-foreground")}>
                          <Settings className="w-3.5 h-3.5 ml-2" />
                          تنظیمات
                        </Button>
                      </Link>
                    </CollapsibleContent>
                  </Collapsible>
                </li>
              )}

              <li className="pt-2">
                <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-start">
                      <Settings className="w-4 h-4 ml-2" />
                      تنظیمات
                      <ChevronDown className={cn("w-4 h-4 mr-auto transition-transform", settingsOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mr-6 space-y-1">
                    {settingsItems.map((item) => (
                      <Link key={item.path} href={item.path}>
                        <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start text-sm", isActive(item.path) && "bg-primary text-primary-foreground")}>
                          <item.icon className="w-3.5 h-3.5 ml-2" />
                          {item.label}
                        </Button>
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div className="p-4 border-t border-border">
        <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:bg-destructive/10" onClick={() => logout()}>
          <LogOut className="w-4 h-4 ml-2" />
          خروج
        </Button>
      </div>
    </aside>
  );
}
