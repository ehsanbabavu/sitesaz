import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Send, MessageCircle, User, Clock, ArrowRight } from "lucide-react";
import { type InternalChat, type User as UserType } from "@shared/schema";
import { DashboardLayout } from "@/components/dashboard-layout";

interface ChatWithUser extends InternalChat {
  senderName?: string;
  receiverName?: string;
}

export default function SellerChats() {
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: level1Users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/users");
      if (!response.ok) return [];
      const users = await response.json();
      return users.filter((u: UserType) => u.role === "user_level_1");
    },
  });

  const { data: allChats = [], isLoading: chatsLoading } = useQuery<ChatWithUser[]>({
    queryKey: ["/api/internal-chats"],
    refetchInterval: 5000,
  });

  const sellers = level1Users.map(seller => {
    const sellerChats = allChats.filter(chat => 
      chat.senderId === seller.id || chat.receiverId === seller.id
    );
    
    const latestChat = sellerChats.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })[0];

    const unreadCount = sellerChats.filter(c => 
      String(c.senderId) === String(seller.id) && 
      !c.isRead
    ).length;

    // Use a unique key for the badge to force re-render when unreadCount changes
    const badgeKey = `unread-${seller.sellerId}-${unreadCount}`;

    return {
      sellerId: seller.id,
      sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.username || "نام نامشخص",
      latestMessage: latestChat,
      unreadCount,
      badgeKey
    };
  }).sort((a, b) => {
    const aTime = a.latestMessage?.createdAt ? new Date(a.latestMessage.createdAt).getTime() : 0;
    const bTime = b.latestMessage?.createdAt ? new Date(b.latestMessage.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  const selectedSellerChats = allChats && selectedSellerId
    ? allChats.filter(chat => 
        (chat.senderId === selectedSellerId && chat.receiverId === user?.id) ||
        (chat.senderId === user?.id && chat.receiverId === selectedSellerId)
      ).sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
      })
    : [];

  const markAllAsReadMutation = useMutation({
    mutationFn: async (senderId: string) => {
      const response = await createAuthenticatedRequest("/api/internal-chats/mark-all-read", {
        method: "PATCH",
        body: JSON.stringify({ senderId })
      });
      if (!response.ok) {
        throw new Error("خطا در علامت‌گذاری پیام‌ها");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chats/unread-count"] });
    },
  });

  useEffect(() => {
    if (user && user.role === "admin" && selectedSellerId && allChats && allChats.length > 0) {
      const hasUnreadFromSelected = allChats.some(chat => 
        String(chat.senderId) === String(selectedSellerId) && 
        String(chat.receiverId) === String(user.id) && 
        !chat.isRead
      );
      
      if (hasUnreadFromSelected) {
        markAllAsReadMutation.mutate(selectedSellerId);
      }
    }
  }, [user, allChats, selectedSellerId]);

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: string; message: string }) => {
      const response = await createAuthenticatedRequest("/api/internal-chats", {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("خطا در ارسال پیام");
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/internal-chats"] });
      toast({
        title: "موفقیت",
        description: "پیام شما ارسال شد",
      });
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    },
    onError: () => {
      toast({
        title: "خطا",
        description: "خطا در ارسال پیام",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedSellerId || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate({
      receiverId: selectedSellerId,
      message: newMessage.trim(),
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (selectedSellerChats.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedSellerChats]);

  if (user?.role !== "admin") {
    return (
      <DashboardLayout title="چت با فروشندگان">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">دسترسی غیر مجاز</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (chatsLoading) {
    return (
      <DashboardLayout title="چت با فروشندگان">
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-lg">در حال بارگذاری چت‌ها...</div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="چت با فروشندگان">
      <div className="h-[calc(100vh-8rem)] flex gap-4" data-testid="seller-chats-content">
        <div className={`w-full md:w-80 md:flex-shrink-0 ${selectedSellerId ? 'hidden md:block' : 'block'}`}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" />
                فروشندگان ({sellers.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-5rem)]">
              <ScrollArea className="h-full">
                {sellers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    هیچ فروشنده‌ای موجود نیست
                  </div>
                ) : (
                  sellers.map((seller) => (
                    <div
                      key={seller.sellerId}
                      className={`p-3 border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors ${
                        selectedSellerId === seller.sellerId
                          ? "bg-primary/10 border-r-2 border-r-primary"
                          : ""
                      }`}
                      onClick={() => setSelectedSellerId(seller.sellerId)}
                      data-testid={`seller-chat-${seller.sellerId}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-sm truncate">
                              {seller.sellerName}
                            </h3>
                            {seller.unreadCount > 0 && (
                              <Badge key={seller.badgeKey} variant="destructive" className="h-5 px-1.5 text-xs">
                                {seller.unreadCount}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {seller.latestMessage?.message || "بدون پیام"}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {seller.latestMessage?.createdAt ? new Date(seller.latestMessage.createdAt).toLocaleDateString("fa-IR", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className={`w-full md:flex-1 ${selectedSellerId ? 'block' : 'hidden md:block'}`}>
          {selectedSellerId ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="md:hidden -mr-2"
                    onClick={() => setSelectedSellerId(null)}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  چت با {sellers.find(s => s.sellerId === selectedSellerId)?.sellerName || "فروشنده"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col p-0">
                <ScrollArea className="flex-1 p-4">
                  {selectedSellerChats.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-muted-foreground">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">هنوز پیامی موجود نیست</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedSellerChats.map((chat) => (
                        <div
                          key={chat.id}
                          className={`flex ${chat.senderId === user?.id ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-lg px-3 py-2 ${
                              chat.senderId === user?.id
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                            data-testid={`message-${chat.id}`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{chat.message}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3 opacity-70" />
                              <span className="text-xs opacity-70">
                                {chat.createdAt ? new Date(chat.createdAt).toLocaleTimeString("fa-IR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }) : ""}
                              </span>
                              {chat.senderId === user?.id && (
                                <span className="text-xs opacity-70 mr-1">
                                  {chat.isRead ? "✓✓" : "✓"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                <div className="border-t p-3">
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="پیام خود را بنویسید..."
                      className="flex-1 min-h-[40px] max-h-[100px] resize-none"
                      data-testid="input-message"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      size="sm"
                      data-testid="button-send"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Enter برای ارسال، Shift+Enter برای خط جدید
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>یک فروشنده را برای مشاهده چت انتخاب کنید</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
