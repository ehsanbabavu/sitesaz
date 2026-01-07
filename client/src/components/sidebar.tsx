import { 
  Calendar, Home, Inbox, Search, Settings, MessageSquare, MessageCircle, 
  Ticket, Package, DollarSign, Wallet, Users, Crown, Truck, Receipt, 
  CreditCard, Bot, History, Database, List, Plus, FolderTree, ShoppingCart, 
  MapPin, User, Send, Store, ChevronDown, Mail 
} from "lucide-react"
import { Link, useLocation } from "wouter"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"
import { 
  Sidebar, SidebarContent, SidebarProvider, SidebarTrigger, useSidebar, 
  SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupContent, SidebarGroupLabel 
} from "./ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function AppSidebar() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const sidebar = useSidebar();

  const isActive = (path: string) => location === path;

  const handleNavigate = (path: string) => {
    setLocation(path);
    if (sidebar) sidebar.setOpenMobile(false);
  };

  const { data: vatPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/vat/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/vat/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isVatPluginEnabled = vatPluginData?.isEnabled ?? true;

  const { data: aiPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/ai/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/ai/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isAiPluginEnabled = aiPluginData?.isEnabled ?? true;

  const { data: backupPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/backup/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/backup/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isBackupPluginEnabled = backupPluginData?.isEnabled ?? true;

  const { data: cryptoPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/crypto-transactions/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/crypto-transactions/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isCryptoPluginEnabled = cryptoPluginData?.isEnabled ?? true;

  const { data: guestChatsPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/guest-chats/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/guest-chats/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isGuestChatsPluginEnabled = guestChatsPluginData?.isEnabled ?? true;

  const { data: loginLogsPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/login-logs/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/login-logs/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isLoginLogsPluginEnabled = loginLogsPluginData?.isEnabled ?? true;

  const { data: emailPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/email/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/email/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isEmailPluginEnabled = emailPluginData?.isEnabled ?? true;

  const { data: subscriptionPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/subscriptions/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/subscriptions/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isSubscriptionPluginEnabled = subscriptionPluginData?.isEnabled ?? true;

  const { data: internalChatsPluginData } = useQuery<{ isEnabled: boolean }>({
    queryKey: ['/api/plugins/internal-chats/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plugins/internal-chats/status');
      return response.json();
    },
    enabled: !!user,
    staleTime: 30000,
  });
  const isInternalChatsPluginEnabled = internalChatsPluginData?.isEnabled ?? true;

  const { data: unreadGuestChats } = useQuery<number>({
    queryKey: ['/api/admin/guest-chats/unread-count'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/guest-chats/unread-count');
      return response.json();
    },
    enabled: !!user && user.role === "admin" && isGuestChatsPluginEnabled,
    refetchInterval: 30000,
  });

  const communicationItems = [
    ...(isGuestChatsPluginEnabled ? [{ path: "/guest-chats", label: "چت مهمانان", icon: MessageSquare, badge: unreadGuestChats }] : []),
    ...(isInternalChatsPluginEnabled ? [{ path: "/seller-chats", label: "چت کاربران", icon: MessageCircle }] : []),
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
    { path: "/my-tickets", label: "تیکت‌ها", icon: Ticket },
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
    ...(isAiPluginEnabled ? [{ path: "/ai-token", label: "هوش مصنوعی", icon: Bot }] : []),
    ...(isLoginLogsPluginEnabled ? [{ path: "/login-logs", label: "لاگ ورود", icon: History }] : []),
    ...(isBackupPluginEnabled ? [{ path: "/database-backup", label: "پشتیبان‌گیری", icon: Database }] : []),
  ];

  const emailItems = [
    { path: "/email-inbox", label: "صندوق دریافت", icon: Inbox },
    { path: "/send-email", label: "ارسال ایمیل", icon: Send },
    { path: "/sent-messages", label: "پیام‌های ارسالی", icon: Send },
    { path: "/email-settings", label: "تنظیمات ایمیل", icon: Settings },
  ];

  const userMenuItems = [{ path: "/", label: "پیشخوان", icon: Home }];

  const level2MenuItems = [
    { path: "/products", label: "محصولات", icon: List },
    { path: "/add-product", label: "افزودن محصول", icon: Plus },
    { path: "/cart", label: "سبد خرید", icon: ShoppingCart },
    { path: "/addresses", label: "آدرس‌ها", icon: MapPin },
    { path: "/financial", label: "امور مالی", icon: Wallet },
    ...(isInternalChatsPluginEnabled ? [{ path: "/chat-with-seller", label: "چت با مدیر", icon: MessageCircle }] : []),
    { path: "/send-ticket", label: "ارسال تیکت", icon: Send },
    { path: "/profile", label: "پروفایل", icon: User },
  ];

  const renderMenuItem = (item: { path: string; label: string; icon: any; badge?: number }) => (
    <li key={item.path}>
      <Button 
        variant={isActive(item.path) ? "default" : "ghost"} 
        className={cn("w-full justify-start relative", isActive(item.path) && "bg-primary text-primary-foreground")}
        onClick={() => handleNavigate(item.path)}
      >
        <item.icon className="w-5 h-5 ml-2" />
        {item.label}
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {item.badge > 99 ? "+99" : item.badge}
          </span>
        )}
      </Button>
    </li>
  );

  const renderCollapsibleMenu = (label: string, items: { path: string; label: string; icon: any; badge?: number }[]) => {
    const totalBadge = items.reduce((sum, item) => sum + (item.badge || 0), 0);
    
    return (
      <Collapsible className="group/collapsible w-full">
        <SidebarMenuItem className="list-none">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors relative">
              <div className="flex items-center">
                <span className="text-sm font-medium">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                {totalBadge > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {totalBadge > 99 ? "+99" : totalBadge}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </div>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-1 space-y-1 pr-4 border-r border-border/50 mr-2">
              {items.map((item) => (
                <li key={item.path}>
                  <Link href={item.path}>
                    <Button 
                      variant={isActive(item.path) ? "default" : "ghost"} 
                      size="sm" 
                      className={cn(
                        "w-full justify-start text-xs relative", 
                        isActive(item.path) && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => sidebar?.setOpenMobile(false)}
                    >
                      <item.icon className="w-4 h-4 ml-2" />
                      {item.label}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                          {item.badge > 99 ? "+99" : item.badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  };

  return (
    <aside className="w-64 bg-card border-l border-border flex flex-col sidebar-transition" data-testid="sidebar-navigation">
      <div className="p-6 border-b border-border" data-testid="section-logo">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <Store className="text-primary-foreground" />
          </div>
          <h2 className="mr-3 text-lg font-bold text-foreground">سایت ساز رخش</h2>
        </div>
      </div>
      
      <nav className="flex-1 p-4 custom-scrollbar overflow-y-auto" data-testid="nav-main-menu">
        <SidebarMenu className="space-y-1">
          {user?.role !== "admin" && userMenuItems.map(renderMenuItem)}

          {user?.role === "user_level_1" && level2MenuItems.filter(item => !["/products", "/add-product"].includes(item.path)).map(renderMenuItem)}

          {user?.role === "user_level_2" && level2MenuItems.map(renderMenuItem)}

          {user?.role === "admin" && (
            <>
              {renderCollapsibleMenu("پیام‌ها", communicationItems)}
              {renderCollapsibleMenu("واتس‌اپ", whatsappItems)}
              {renderCollapsibleMenu("تجاری", businessItems)}
              {renderCollapsibleMenu("انبارداری", inventoryItems)}
              {isEmailPluginEnabled && renderCollapsibleMenu("ایمیل", emailItems)}
              {renderCollapsibleMenu("مدیریت کاربران", usersManagementItems)}
              {renderCollapsibleMenu("تنظیمات", settingsItems)}
              <li key="/plugins">
                <Link href="/plugins">
                  <Button 
                    variant={isActive("/plugins") ? "default" : "ghost"} 
                    className={cn("w-full justify-start", isActive("/plugins") && "bg-primary text-primary-foreground")}
                    onClick={() => handleNavigate("/plugins")}
                  >
                    <Plus className="w-5 h-5 ml-2" />
                    پلاگین‌ها
                  </Button>
                </Link>
              </li>
            </>
          )}

          {user?.role === "user_level_1" && (
            <>
              <div className="pt-4 pb-2">
                <span className="text-xs text-muted-foreground px-3 font-medium">بخش فروشگاه</span>
              </div>
              {renderCollapsibleMenu("بیزنس", businessItems)}
              {renderCollapsibleMenu("انبارداری", inventoryItems)}
              {renderCollapsibleMenu("تنظیمات", settingsItems)}
            </>
          )}
        </SidebarMenu>
      </nav>
    </aside>
  );
}

export { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger };
