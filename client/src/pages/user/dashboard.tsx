import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Clock, CheckCircle, AlertCircle, MessageSquare, Package, TrendingUp, Grid3X3, Plus, ShoppingBag, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createAuthenticatedRequest } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserSubscription, Ticket, Product, SentMessage, Order } from "@shared/schema";

// Extended Order type with customer and address info (same as in received-orders)
type OrderWithDetails = Order & {
  addressTitle?: string;
  fullAddress?: string;
  postalCode?: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  buyerPhone?: string;
};

// Extended subscription type with subscription details
interface UserSubscriptionWithDetails extends UserSubscription {
  subscriptionName?: string | null;
  subscriptionDescription?: string | null;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const sliderRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Get user's subscription info
  const { data: userSubscription, isLoading: subscriptionLoading } = useQuery<UserSubscriptionWithDetails | null>({
    queryKey: ["/api/user-subscriptions/me"],
    enabled: !!user && user.role !== "user_level_2",
    queryFn: async () => {
      if (!user) return null;
      
      const token = localStorage.getItem("token");
      if (!token) return null;
      
      const response = await fetch("/api/user-subscriptions/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  // Get user's tickets
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    enabled: !!user && user.role !== "user_level_2",
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/tickets");
      if (!response.ok) {
        if (response.status === 401) return [];
        throw new Error("خطا در دریافت تیکت‌ها");
      }
      return response.json();
    },
  });

  // Get user's products
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!user && user.role !== "user_level_2",
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/products");
      if (!response.ok) {
        if (response.status === 401) return [];
        throw new Error("خطا در دریافت محصولات");
      }
      return response.json();
    },
  });

  // Get user's sent messages (for level 1 users)
  const { data: sentMessages = [], isLoading: messagesLoading } = useQuery<SentMessage[]>({
    queryKey: ["/api/sent-messages"],
    enabled: !!user && user.role !== "user_level_2",
    queryFn: async () => {
      try {
        const response = await createAuthenticatedRequest("/api/sent-messages");
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [];
      }
    },
  });


  // Get admin products catalog for level 1 users
  const { data: adminProducts = [], isLoading: adminProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/admin-products"],
    enabled: !!user && user.role === "user_level_1",
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/admin-products");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const importProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await createAuthenticatedRequest(`/api/admin-products/${productId}/import`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "خطا در افزودن محصول");
      }
      return response.json();
    },
    onSuccess: (_data, productId) => {
      setImportedIds(prev => new Set(prev).add(productId));
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "موفقیت", description: "محصول به کاتالوگ شما اضافه شد" });
    },
    onError: (error: Error) => {
      toast({ title: "خطا", description: error.message, variant: "destructive" });
    },
  });

  // Get pending orders (پرداخت شده و در انتظار تایید) list for dashboard (for level 1 users)
  const { data: unpaidPendingOrders = [] } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/orders/seller"],
    enabled: !!user && user.role === "user_level_1",
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/orders/seller");
      if (!response.ok) {
        if (response.status === 401) return [];
        throw new Error("خطا در دریافت سفارشات");
      }
      return response.json();
    },
    select: (data) => data.filter(order => order.status === 'pending'), // فقط سفارشات پرداخت شده و در انتظار تایید
  });

  // Get available products for level 2 users (shopping)
  const { data: availableProducts = [], isLoading: shoppingProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/shop"],
    enabled: !!user && user.role === "user_level_2",
    queryFn: async () => {
      try {
        const response = await createAuthenticatedRequest("/api/products/shop");
        if (!response.ok) return [];
        return response.json();
      } catch {
        return [];
      }
    },
  });


  const { toast } = useToast();

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      const response = await createAuthenticatedRequest("/api/cart/add", {
        method: "POST",
        body: JSON.stringify({
          productId,
          quantity,
        }),
      });
      if (!response.ok) {
        throw new Error("خطا در افزودن به سبد خرید");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
      toast({
        title: "موفقیت",
        description: "محصول به سبد خرید اضافه شد",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "خطا",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate stats
  const openTickets = tickets.filter(ticket => ticket.status !== "closed").length;
  const activeProducts = products.filter(product => product.isActive).length;
  const totalSentMessages = sentMessages.length;

  // Categorize products for shopping view
  const bestSellingProducts = useMemo(() => 
    availableProducts
      .filter(product => product.quantity && product.quantity > 0) // Use quantity as proxy for sales
      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
      .slice(0, 8),
    [availableProducts]
  );
  const allProducts = availableProducts.slice(0, 16); // Show 16 total products

  const handleAddToCart = (productId: string) => {
    addToCartMutation.mutate({ productId, quantity: 1 });
  };

  // Auto-scroll effect for best selling products
  useEffect(() => {
    if (user?.role === "user_level_2" && bestSellingProducts.length > 1) {
      const slider = sliderRef.current;
      if (!slider) return;

      // Guard: Only start autoplay when the slider actually overflows
      const hasOverflow = slider.scrollWidth > slider.clientWidth;
      if (!hasOverflow) return;

      // Calculate step dynamically from real card spacing
      const getStep = () => {
        const children = slider.children;
        if (children.length < 2) return 300; // Fallback
        
        const firstCard = (children[0] as HTMLElement).getBoundingClientRect();
        const secondCard = (children[1] as HTMLElement).getBoundingClientRect();
        return Math.round(secondCard.left - firstCard.left);
      };

      let step = getStep();

      // ResizeObserver to recompute step on viewport changes
      const resizeObserver = new ResizeObserver(() => {
        step = getStep();
      });
      resizeObserver.observe(slider);

      const interval = setInterval(() => {
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        const nextPosition = slider.scrollLeft + step;

        if (nextPosition >= maxScroll - 2) {
          // Reset to beginning
          slider.scrollTo({ left: 0, behavior: 'smooth' });
          setCurrentSlide(0);
        } else {
          // Move to next slide
          slider.scrollTo({ left: nextPosition, behavior: 'smooth' });
          setCurrentSlide(prev => (prev + 1) % bestSellingProducts.length);
        }
      }, 3000); // Auto slide every 3 seconds

      return () => {
        clearInterval(interval);
        resizeObserver.disconnect();
      };
    }
  }, [user?.role, bestSellingProducts]);

  // Shopping view for user_level_2
  if (user?.role === "user_level_2") {
    return (
      <DashboardLayout title="فروشگاه">
        <div className="space-y-6" data-testid="shopping-dashboard-content">
          {/* Best Selling Products - Horizontal Slider */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-500" />
              <h2 className="text-xl font-bold">پرفروش‌ترین محصولات</h2>
            </div>
            <div className="relative">
              <div 
                ref={sliderRef}
                className="flex overflow-x-auto pb-4 gap-4 scrollbar-hide" 
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  direction: 'ltr' // Force LTR for proper horizontal scrolling
                }}
              >
                {bestSellingProducts.map((product) => (
                  <Card key={product.id} className="group hover:shadow-lg transition-all min-w-[280px] flex-shrink-0">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {product.image && (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="w-full h-40 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-sm line-clamp-2">
                            {product.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {product.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Badge variant="secondary" className="text-xs">
                              {parseFloat(product.priceAfterDiscount || product.priceBeforeDiscount).toLocaleString()} تومان
                            </Badge>
                            <Badge variant="outline" className="text-xs block">
                              موجودی: {product.quantity || 0}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(product.id)}
                            disabled={addToCartMutation.isPending}
                            data-testid={`button-add-to-cart-bestseller-${product.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* All Products */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Grid3X3 className="h-6 w-6 text-blue-500" />
              <h2 className="text-xl font-bold">تمامی محصولات</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {allProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-all">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {product.image && (
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {product.description}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {parseFloat(product.priceAfterDiscount || product.priceBeforeDiscount).toLocaleString()} تومان
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(product.id)}
                          disabled={addToCartMutation.isPending}
                          data-testid={`button-add-to-cart-all-${product.id}`}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Admin/Level1 dashboard view
  return (
    <DashboardLayout title="پیشخوان">
      <div className="space-y-4" data-testid="dashboard-content">

        {/* Subscription Information - Hidden for user_level_2 */}
        {user?.role !== "user_level_2" && (() => {
          const isActive = userSubscription && userSubscription.status === 'active' && userSubscription.remainingDays > 0;
          const isExpiringSoon = userSubscription && userSubscription.remainingDays <= 7 && userSubscription.remainingDays > 0;
          const days = userSubscription?.remainingDays || 0;

          return (
            <div className={`relative overflow-hidden rounded-2xl border ${
              subscriptionLoading
                ? "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                : isActive
                  ? "bg-gradient-to-br from-indigo-600 to-blue-500 border-indigo-400 dark:border-indigo-700"
                  : "bg-gradient-to-br from-red-500 to-rose-600 border-red-400 dark:border-red-700"
            }`}>

              {/* decorative circle */}
              {!subscriptionLoading && (
                <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
              )}

              <div className="relative px-4 py-4">
                {subscriptionLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <div className="h-3 w-3 rounded-full bg-gray-300 animate-pulse" />
                    <span>در حال بارگذاری...</span>
                  </div>
                ) : userSubscription ? (
                  <div className="flex items-center justify-between gap-3">

                    {/* Right section: icon + name + badges */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 p-2 rounded-xl ${isActive ? "bg-white/20" : "bg-white/20"}`}>
                        <Crown className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-white truncate" data-testid="text-subscription-name">
                            {userSubscription.subscriptionName || 'نامشخص'}
                          </span>
                          {userSubscription.isTrialPeriod && (
                            <span className="text-[10px] bg-white/25 text-white px-1.5 py-0.5 rounded-full">آزمایشی</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {isActive ? (
                            <CheckCircle className="h-3 w-3 text-green-300 shrink-0" data-testid="badge-subscription-status" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-red-200 shrink-0" data-testid="badge-subscription-status" />
                          )}
                          <span className="text-[11px] text-white/80">
                            {isActive ? 'اشتراک فعال' : 'اشتراک غیرفعال'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Left section: days counter */}
                    <div className="shrink-0 text-center bg-white/20 rounded-xl px-3 py-2">
                      <div className="text-xl font-black text-white leading-none" data-testid="text-remaining-days">
                        {days}
                      </div>
                      <div className="text-[10px] text-white/80 mt-0.5 flex items-center justify-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        <span>روز باقیمانده</span>
                      </div>
                      {isExpiringSoon && (
                        <div className="mt-1 text-[9px] bg-white/30 text-white rounded-full px-1.5 py-0.5">
                          نزدیک به انقضا
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-1">
                    <div className="p-2 rounded-xl bg-white/10">
                      <Crown className="h-5 w-5 text-white/60" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">اشتراکی یافت نشد</p>
                      <p className="text-xs text-white/50 mt-0.5">برای استفاده از امکانات، اشتراک تهیه کنید</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Quick Stats - Hidden for user_level_2 */}
        {user?.role !== "user_level_2" && (
          <div className="grid grid-cols-2 gap-3">

            {/* Tickets Card */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-900 p-4 flex flex-col justify-between min-h-[100px] hover:shadow-lg transition-shadow">
              <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
              <div className="flex items-center justify-between">
                <div className="p-2 bg-white/20 rounded-xl">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                {openTickets > 0 && (
                  <span className="text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full">
                    نیاز به بررسی
                  </span>
                )}
              </div>
              <div className="mt-3">
                <div className="text-3xl font-black text-white leading-none" data-testid="stat-open-tickets">
                  {ticketsLoading ? (
                    <span className="text-lg animate-pulse">...</span>
                  ) : openTickets}
                </div>
                <div className="text-xs text-white/75 mt-1">تیکت‌های باز</div>
              </div>
            </div>

            {/* Pending Orders Card - Only for user_level_1 */}
            {user?.role === "user_level_1" && (
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-500 dark:to-orange-800 p-4 flex flex-col justify-between min-h-[100px] hover:shadow-lg transition-shadow">
                <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                  {unpaidPendingOrders.length > 0 && (
                    <span className="text-[10px] bg-white/25 text-white px-2 py-0.5 rounded-full">
                      نیاز به بررسی
                    </span>
                  )}
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-white leading-none" data-testid="stat-pending-approval-orders">
                    {unpaidPendingOrders.length}
                  </div>
                  <div className="text-xs text-white/75 mt-1">سفارشات در انتظار تایید</div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Admin Products Catalog - Only for user_level_1 */}
        {user?.role === "user_level_1" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-purple-500" />
              {adminProducts.length > 0 && (
                <span className="text-xs text-muted-foreground bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {adminProducts.length} محصول
                </span>
              )}
            </div>
            {adminProductsLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : adminProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                محصولی موجود نیست
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {adminProducts.map((product) => {
                  const isImported = importedIds.has(product.id);
                  const isLoading = importProductMutation.isPending && importProductMutation.variables === product.id;
                  return (
                    <Card key={product.id} className={`overflow-hidden hover:shadow-md transition-all ${isImported ? "ring-2 ring-green-400" : ""}`}>
                      <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-10 w-10 text-gray-300" />
                          </div>
                        )}
                        {isImported && (
                          <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full p-0.5">
                            <Check className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <p className="text-sm font-medium line-clamp-2 leading-snug">{product.name}</p>
                        <p className="text-xs font-bold text-green-600 dark:text-green-400">
                          {Number(product.priceAfterDiscount || product.priceBeforeDiscount).toLocaleString("fa-IR")} تومان
                        </p>
                        <Button
                          size="sm"
                          className="w-full text-xs h-7"
                          variant={isImported ? "secondary" : "default"}
                          disabled={isImported || isLoading}
                          onClick={() => importProductMutation.mutate(product.id)}
                        >
                          {isImported ? (
                            <><Check className="h-3 w-3 ml-1" />افزوده شد</>
                          ) : isLoading ? "در حال افزودن..." : (
                            <><Plus className="h-3 w-3 ml-1" />افزودن به سبد خرید</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Pending Orders List (پرداخت شده و در انتظار تایید) - Only for user_level_1 */}
        {user?.role === "user_level_1" && unpaidPendingOrders.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                سفارشات در انتظار تایید
              </h2>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {unpaidPendingOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-r-4 border-orange-400 bg-orange-50/30 dark:bg-orange-900/10"
                    data-testid={`dashboard-order-${order.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Package className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              سفارش #{order.orderNumber}
                            </h4>
                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                              در انتظار تایید
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                            <span className="flex items-center gap-1">
                              📅 {order.createdAt && new Date(order.createdAt).toLocaleDateString('fa-IR')}
                            </span>
                            {order.buyerFirstName && order.buyerLastName && (
                              <span className="flex items-center gap-1">
                                👤 {order.buyerFirstName} {order.buyerLastName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-semibold text-base text-green-600 dark:text-green-400">
                          {new Intl.NumberFormat('fa-IR').format(Number(order.totalAmount))} تومان
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}