import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Trash2, CheckCircle2, Circle, ArrowRight, RefreshCw } from "lucide-react";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Email {
  id: string;
  sender: string;
  message: string;
  status: string;
  timestamp?: string;
  createdAt?: string;
}

export default function EmailInbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { data: emails = [], isLoading, refetch } = useQuery<Email[]>({
    queryKey: ["/api/emails"],
    queryFn: async () => {
      setFetchError(null);
      const response = await createAuthenticatedRequest("/api/emails");
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setFetchError(err?.message || "خطا در دریافت ایمیل‌ها");
        return [];
      }
      return response.json();
    },
  });

  const filteredEmails = emails.filter(
    (email) =>
      email.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const markAsRead = async (emailId: string) => {
    await createAuthenticatedRequest(`/api/emails/${emailId}/read`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    refetch();
  };

  const deleteEmail = async (emailId: string) => {
    await createAuthenticatedRequest(`/api/emails/${emailId}`, {
      method: "DELETE",
    });
    setSelectedEmail(null);
    setShowDetail(false);
    refetch();
  };

  const openEmail = (email: Email) => {
    setSelectedEmail(email);
    setShowDetail(true);
    if (email.status === "خوانده نشده") markAsRead(email.id);
  };

  const goBack = () => {
    setShowDetail(false);
    setSelectedEmail(null);
  };

  const unreadCount = emails.filter((e) => e.status === "خوانده نشده").length;

  /* ── Detail Panel ── */
  const DetailPanel = () => (
    <div className="flex flex-col h-full">
      {/* mobile back bar */}
      <div className="flex items-center gap-2 p-3 border-b lg:hidden">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 px-2">
          <ArrowRight className="w-4 h-4" />
          بازگشت
        </Button>
      </div>

      {selectedEmail ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* header */}
          <div className="pb-4 mb-4 border-b">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-2xl font-bold mb-1 break-words">
                  {selectedEmail.sender}
                </h2>
                <p className="text-sm text-muted-foreground break-all">
                  از: {selectedEmail.sender}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(
                    selectedEmail.createdAt || selectedEmail.timestamp || Date.now()
                  ).toLocaleString("fa-IR")}
                </p>
                {selectedEmail.status && (
                  <Badge
                    variant={selectedEmail.status === "خوانده شده" ? "secondary" : "default"}
                    className="mt-2"
                  >
                    {selectedEmail.status}
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => markAsRead(selectedEmail.id)}
                  title="خواندن"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => deleteEmail(selectedEmail.id)}
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* body */}
          <div
            className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words"
            style={{ direction: "rtl" }}
          >
            {selectedEmail.message}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">یک ایمیل را انتخاب کنید</p>
          </div>
        </div>
      )}
    </div>
  );

  /* ── List Panel ── */
  const ListPanel = () => (
    <div className="flex flex-col h-full">
      {/* toolbar */}
      <div className="p-3 border-b flex items-center gap-2">
        <Input
          placeholder="جستجو..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="text-right h-9 text-sm flex-1"
        />
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="shrink-0 text-xs">
            {unreadCount}
          </Badge>
        )}
      </div>

      {/* list body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">در حال بارگذاری...</div>
        ) : fetchError ? (
          <div className="p-6 text-center text-destructive text-sm">{fetchError}</div>
        ) : filteredEmails.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">ایمیلی یافت نشد</div>
        ) : (
          <div className="divide-y">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => openEmail(email)}
                className={cn(
                  "w-full p-3 sm:p-4 text-right hover:bg-accent transition-colors",
                  selectedEmail?.id === email.id && "bg-accent",
                  email.status === "خوانده نشده" && "bg-blue-50 dark:bg-blue-950/40"
                )}
              >
                <div className="flex items-start gap-2">
                  {email.status === "خوانده نشده" ? (
                    <Circle className="w-2 h-2 fill-blue-500 text-blue-500 mt-1.5 shrink-0" />
                  ) : (
                    <span className="w-2 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="font-semibold text-sm truncate">{email.sender}</p>
                      <p className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(
                          email.createdAt || email.timestamp || Date.now()
                        ).toLocaleDateString("fa-IR")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {email.message.substring(0, 60)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      {/* ── Mobile: toggle between list and detail ── */}
      <div className="lg:hidden flex-1 overflow-hidden border rounded-lg m-3 bg-card">
        {showDetail ? <DetailPanel /> : <ListPanel />}
      </div>

      {/* ── Desktop: side-by-side ── */}
      <div className="hidden lg:grid lg:grid-cols-3 flex-1 gap-4 p-6 overflow-hidden">
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
          <ListPanel />
        </div>
        <div className="lg:col-span-2 border rounded-lg bg-card overflow-hidden flex flex-col">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}
