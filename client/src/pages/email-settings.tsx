import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Settings2, Globe, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailSettings {
  emailPrefix: string;
  domain?: string;
}

export default function EmailSettings() {
  const { toast } = useToast();
  const [emailPrefix, setEmailPrefix] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // دریافت تنظیمات ایمیل
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["/api/email-settings"],
    queryFn: async (): Promise<EmailSettings> => {
      const response = await createAuthenticatedRequest("/api/email-settings");
      if (!response.ok) return { emailPrefix: "" };
      return response.json();
    },
  });

  // بروزرسانی emailPrefix هنگام بارگذاری تنظیمات
  useEffect(() => {
    if (settings?.emailPrefix && emailPrefix !== settings.emailPrefix) {
      setEmailPrefix(settings.emailPrefix);
    }
  }, [settings?.emailPrefix]);

  // دامنه واقعی از سرور (نه browser hostname)
  const domainName = settings?.domain || (typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "");

  // آدرس ایمیل کامل
  const fullEmailAddress = domainName ? `${emailPrefix}@${domainName}` : emailPrefix;

  // ذخیره تنظیمات
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!emailPrefix.trim()) {
        toast({ title: "خطا", description: "پیشوند ایمیل نمی‌تواند خالی باشد", variant: "destructive" });
        return;
      }

      const response = await createAuthenticatedRequest("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPrefix: emailPrefix.trim() }),
      });

      if (!response.ok) throw new Error("خطا در ذخیره");
      return response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "عملیات موفق", 
        description: "تنظیمات ایمیل با موفقیت در سیستم ثبت شد.",
        variant: "default"
      });
      refetch();
    },
    onError: () => {
      toast({ title: "خطا در سیستم", description: "متأسفانه در ذخیره تنظیمات ایمیل خطایی رخ داد.", variant: "destructive" });
    },
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = emailPrefix !== settings?.emailPrefix;

  return (
    <div className="w-full p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-6">
        {/* Main Settings Card */}
        <Card className="md:col-span-3 shadow-sm border-muted-foreground/10 overflow-hidden">
          <CardHeader className="bg-muted/30 pb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <CardTitle>پیکربندی آدرس ایمیل</CardTitle>
            </div>
            <CardDescription>
              آدرس ایمیلی را انتخاب کنید که می‌خواهید پیام‌های مشتریان به آن ارسال شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="emailPrefix" className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  پیشوند ایمیل اختصاصی
                </Label>
                <div className="flex items-center group">
                  <div className="px-4 py-3 bg-muted border border-l-0 rounded-r-md text-sm font-mono text-muted-foreground whitespace-nowrap">
                    @{domainName}
                  </div>
                  <div className="relative flex-1">
                    <Input
                      id="emailPrefix"
                      type="text"
                      placeholder="مثلاً support یا info"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                      className="pl-10 pr-4 h-12 text-left font-mono border-primary/20 focus-visible:ring-primary/30 rounded-l-md rounded-r-none border-r-0"
                      disabled={isSaving}
                      style={{ direction: 'ltr' }}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  فقط از حروف انگلیسی کوچک، اعداد و علائم مجاز (._-) استفاده کنید.
                </p>
              </div>

              <Separator className="my-2" />

              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-primary/20 rounded-full">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">آدرس ایمیل نهایی شما:</p>
                    <code className="text-primary font-bold text-base block font-mono select-all cursor-pointer hover:opacity-80 transition-opacity">
                      {fullEmailAddress}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 border-t pt-4 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges || !emailPrefix.trim()}
              className="w-full md:w-auto min-w-[140px] gap-2 shadow-sm"
              size="lg"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent"></div>
                  در حال ثبت...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  ذخیره تغییرات
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
