import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Mail, Settings2, Globe, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
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

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["/api/email-settings"],
    queryFn: async (): Promise<EmailSettings> => {
      const response = await createAuthenticatedRequest("/api/email-settings");
      if (!response.ok) return { emailPrefix: "" };
      return response.json();
    },
  });

  useEffect(() => {
    if (settings?.emailPrefix && emailPrefix !== settings.emailPrefix) {
      setEmailPrefix(settings.emailPrefix);
    }
  }, [settings?.emailPrefix]);

  const domainName =
    settings?.domain ||
    (typeof window !== "undefined"
      ? window.location.hostname.replace(/^www\./, "")
      : "");

  const fullEmailAddress = domainName
    ? `${emailPrefix}@${domainName}`
    : emailPrefix;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!emailPrefix.trim()) {
        toast({
          title: "خطا",
          description: "پیشوند ایمیل نمی‌تواند خالی باشد",
          variant: "destructive",
        });
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
        description: "تنظیمات ایمیل با موفقیت ثبت شد.",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "خطا",
        description: "خطا در ذخیره تنظیمات ایمیل.",
        variant: "destructive",
      });
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
      <div className="p-4 sm:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = emailPrefix !== settings?.emailPrefix;

  return (
    <div className="p-3 sm:p-6 max-w-xl mx-auto">
      <Card className="shadow-sm">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary shrink-0" />
            <CardTitle className="text-base sm:text-lg">پیکربندی آدرس ایمیل</CardTitle>
          </div>
          <CardDescription className="text-sm">
            آدرس ایمیلی را انتخاب کنید که پیام‌های مشتریان به آن ارسال شود.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* Prefix input */}
          <div className="space-y-2">
            <Label htmlFor="emailPrefix" className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              پیشوند ایمیل اختصاصی
            </Label>

            {/* stacked on mobile, inline on sm+ */}
            <div className="flex flex-col sm:flex-row gap-0">
              {/* domain badge */}
              <div className="px-3 py-2.5 bg-muted border sm:border-l-0 rounded-md sm:rounded-r-md sm:rounded-l-none text-sm font-mono text-muted-foreground text-center sm:text-right whitespace-nowrap">
                @{domainName || "domain.com"}
              </div>
              {/* prefix input */}
              <div className="relative flex-1">
                <Input
                  id="emailPrefix"
                  type="text"
                  placeholder="support"
                  value={emailPrefix}
                  onChange={(e) =>
                    setEmailPrefix(
                      e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
                    )
                  }
                  className="h-10 text-left font-mono sm:rounded-l-md sm:rounded-r-none w-full pr-9"
                  disabled={isSaving}
                  style={{ direction: "ltr" }}
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              فقط از حروف انگلیسی کوچک، اعداد و (._-) استفاده کنید.
            </p>
          </div>

          <Separator />

          {/* Full address preview */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-primary/20 rounded-full shrink-0">
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">آدرس ایمیل نهایی شما:</p>
                <code className="text-primary font-bold text-sm sm:text-base block font-mono break-all select-all cursor-pointer hover:opacity-80 transition-opacity">
                  {fullEmailAddress || "..."}
                </code>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-muted/20 border-t pt-4">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges || !emailPrefix.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
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
  );
}
