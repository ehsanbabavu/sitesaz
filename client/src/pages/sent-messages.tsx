import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createAuthenticatedRequest } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileText, ArrowRight, Paperclip } from "lucide-react";

interface SentMessage {
  id: string;
  to: string;
  subject: string;
  body: string;
  attachments: string[];
  status: string;
  timestamp?: string | null;
}

export default function SentMessages() {
  const [selected, setSelected] = useState<SentMessage | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: items = [], isLoading } = useQuery<SentMessage[]>({
    queryKey: ["/api/sent-messages"],
    queryFn: async () => {
      const res = await createAuthenticatedRequest("/api/sent-messages");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const openMessage = (m: SentMessage) => {
    setSelected(m);
    setShowDetail(true);
  };

  const goBack = () => {
    setShowDetail(false);
    setSelected(null);
  };

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

      {selected ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* header */}
          <div className="pb-4 mb-4 border-b">
            <h2 className="text-lg sm:text-2xl font-bold mb-2 break-words">
              {selected.subject || "بدون موضوع"}
            </h2>
            <p className="text-sm text-muted-foreground break-all">به: {selected.to}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(selected.timestamp || Date.now()).toLocaleString("fa-IR")}
            </p>
            {selected.status && (
              <Badge className="mt-2">{selected.status}</Badge>
            )}
          </div>

          {/* body */}
          <div
            className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words"
            style={{ direction: "rtl" }}
          >
            {selected.body || "متن پیام موجود نیست."}
          </div>

          {/* attachments */}
          {selected.attachments && selected.attachments.length > 0 && (
            <div className="mt-6 p-3 border rounded-lg bg-muted/40">
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Paperclip className="w-4 h-4" />
                پیوست‌ها
              </div>
              <ul className="space-y-1">
                {selected.attachments.map((a, i) => (
                  <li key={i}>
                    <a
                      href={a}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-sm truncate block hover:underline"
                    >
                      {a}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground p-8">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">یک پیام ارسالی را انتخاب کنید</p>
          </div>
        </div>
      )}
    </div>
  );

  /* ── List Panel ── */
  const ListPanel = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <p className="text-xs text-muted-foreground">
          {items.length} پیام ارسالی
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">در حال بارگذاری...</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">هیچ پیامی یافت نشد</div>
        ) : (
          <div className="divide-y">
            {items.map((m) => (
              <button
                key={m.id}
                onClick={() => openMessage(m)}
                className={cn(
                  "w-full p-3 sm:p-4 text-right hover:bg-accent transition-colors",
                  selected?.id === m.id && "bg-accent"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="font-semibold text-sm truncate">{m.to}</p>
                      <p className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(m.timestamp || Date.now()).toLocaleDateString("fa-IR")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.subject || "(بدون موضوع)"}
                    </p>
                    {m.attachments?.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {m.attachments.length} پیوست
                        </span>
                      </div>
                    )}
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
      {/* ── Mobile ── */}
      <div className="lg:hidden flex-1 overflow-hidden border rounded-lg m-3 bg-card">
        {showDetail ? <DetailPanel /> : <ListPanel />}
      </div>

      {/* ── Desktop ── */}
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
