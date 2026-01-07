import { Calendar, Home, Inbox, Search, Settings, MessageSquare, MessageCircle, Ticket, Package, DollarSign, Wallet, Users, Crown, Truck, Receipt, CreditCard, Bot, History, Database, List, Plus, FolderTree, ShoppingCart, MapPin, User, Send, Store } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { apiRequest } from "@/lib/queryClient"

export function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const isActive = (path: string) => location === path;

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

  const communicationItems = [
    ...(isGuestChatsPluginEnabled ? [{ path: "/guest-chats", label: "چت مهمانان", icon: MessageSquare }] : []),
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

          {user?.role === "user_level_1" && level2MenuItems.filter(item => !["/products", "/add-product"].includes(item.path)).map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <Button variant={isActive(item.path) ? "default" : "ghost"} className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                  <item.icon className="w-5 h-5 ml-2" />
                  {item.label}
                </Button>
              </Link>
            </li>
          ))}

          {user?.role === "user_level_2" && level2MenuItems.map((item) => (
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
                      </Button>
                    </Link>
                  ))}
                </div>
              </li>

              <li className="pt-2">
                <span className="text-xs text-muted-foreground px-3 font-medium">واتس‌اپ</span>
                <div className="mt-1 space-y-1">
                  {whatsappItems.map((item) => (
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
                <span className="text-xs text-muted-foreground px-3 font-medium">تجاری</span>
                <div className="mt-1 space-y-1">
                  {businessItems.map((item) => (
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
                <span className="text-xs text-muted-foreground px-3 font-medium">انبارداری</span>
                <div className="mt-1 space-y-1">
                  {inventoryItems.map((item) => (
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
                <span className="text-xs text-muted-foreground px-3 font-medium">مدیریت کاربران</span>
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
                <span className="text-xs text-muted-foreground px-3 font-medium">تنظیمات</span>
                <div className="mt-1 space-y-1">
                  {settingsItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                        <item.icon className="w-4 h-4 ml-2" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                  <Link href="/plugins">
                    <Button variant={isActive("/plugins") ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive("/plugins") && "bg-primary text-primary-foreground")}>
                      <Plus className="w-4 h-4 ml-2" />
                      پلاگین‌ها
                    </Button>
                  </Link>
                </div>
              </li>
            </>
          )}

          {user?.role === "user_level_1" && (
            <>
              <li className="pt-2 border-t border-border mt-2">
                <span className="text-xs text-muted-foreground px-3 font-medium">بیزنس</span>
                <div className="mt-1 space-y-1">
                  {businessItems.map((item) => (
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
                <span className="text-xs text-muted-foreground px-3 font-medium">انبارداری</span>
                <div className="mt-1 space-y-1">
                  {inventoryItems.map((item) => (
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
                <span className="text-xs text-muted-foreground px-3 font-medium">تنظیمات</span>
                <div className="mt-1 space-y-1">
                  {settingsItems.map((item) => (
                    <Link key={item.path} href={item.path}>
                      <Button variant={isActive(item.path) ? "default" : "ghost"} size="sm" className={cn("w-full justify-start", isActive(item.path) && "bg-primary text-primary-foreground")}>
                        <item.icon className="w-4 h-4 ml-2" />
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div className="p-4 border-t border-border" data-testid="section-user-footer">
        <div className="flex items-center justify-between">
          <div className="flex items-center overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="mr-2 overflow-hidden">
              <p className="text-sm font-medium text-foreground truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.role === "admin" ? "مدیر کل" : user?.role === "user_level_1" ? "فروشنده" : "کاربر عادی"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
