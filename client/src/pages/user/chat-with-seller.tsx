import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { createAuthenticatedRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { User as UserType } from "@shared/schema";

export default function ChatWithSeller() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  // Get admin information
  const { data: parentUser } = useQuery<UserType | null>({
    queryKey: ["/api/users/admin-main"],
    enabled: !!user,
    queryFn: async () => {
      const response = await createAuthenticatedRequest("/api/users/admin-main");
      if (!response.ok) {
        console.error("Failed to fetch admin user");
        return null;
      }
      return await response.json();
    },
    staleTime: 60000,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      let adminId = parentUser?.id;
      
      if (!adminId) {
        const response = await createAuthenticatedRequest("/api/users/admin-main");
        if (response.ok) {
          const admin = await response.json();
          adminId = admin?.id;
        }
      }

      if (!adminId) {
        throw new Error("مدیر سیستم یافت نشد. لطفا صفحه را مجددا بارگذاری کنید.");
      }

      const response = await createAuthenticatedRequest("/api/internal-chats", {
        method: "POST",
        body: JSON.stringify({
          receiverId: adminId,
          message: messageText,
        }),
      });
      if (!response.ok) {
        throw new Error("خطا در ارسال پیام");
      }
      return response.json();
    },
    onSuccess: () => {
      setMessage("");
      setMessageSent(true);
      toast({
        title: "موفقیت",
        description: "پیام شما با موفقیت ارسال شد و مدیر آن را دریافت خواهد کرد",
      });
      setTimeout(() => setMessageSent(false), 5000);
    },
    onError: (error: Error) => {
      toast({
        title: "خطا",
        description: error.message || "خطا در ارسال پیام",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!user || (user.role !== "user_level_2" && user.role !== "user_level_1")) {
    return (
      <DashboardLayout title="ارسال پیام به مدیر">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">دسترسی غیر مجاز</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="ارسال پیام به مدیر">
      <div className="max-w-2xl mx-auto" data-testid="chat-with-seller-content">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>ارسال پیام به مدیریت</CardTitle>
            <CardDescription>
              پیام خود را بنویسید و ارسال کنید. مدیر پیام شما را در بخش پیام‌های مشتریان دریافت خواهد کرد.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {messageSent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-green-700 text-sm">پیام شما با موفقیت ارسال شد!</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">متن پیام</label>
              <Textarea
                placeholder="پیام خود را اینجا بنویسید..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="min-h-[150px] resize-none"
                disabled={sendMessageMutation.isPending}
              />
            </div>
            
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
              className="w-full"
              size="lg"
            >
              {sendMessageMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2" />
                  در حال ارسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 ml-2" />
                  ارسال پیام
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
