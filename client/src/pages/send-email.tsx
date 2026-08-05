import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createAuthenticatedRequest } from "@/lib/auth";
import { CheckCircle, Send, Paperclip, X, AlertCircle } from "lucide-react";

export default function SendEmailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);

  const validateEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5 - attachments.length);
    setAttachments((prev) => [...prev, ...arr]);
  };

  const removeAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index));

  const reset = () => {
    setTo(""); setSubject(""); setMessage(""); setAttachments([]); setResult(null);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (!validateEmail(to))
      return setResult({ ok: false, text: "آدرس گیرنده نامعتبر است" });
    if (!message.trim())
      return setResult({ ok: false, text: "متن پیام نمی‌تواند خالی باشد" });

    setLoading(true);
    try {
      const form = new FormData();
      form.append("to", to.trim());
      form.append("subject", subject);
      form.append("message", message);
      attachments.forEach((f) => form.append("attachments", f));

      const res = await createAuthenticatedRequest("/api/emails/send", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "خطا در ارسال");

      setResult({ ok: true, text: "ایمیل با موفقیت ارسال شد" });
      reset();
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || "خطا در ارسال ایمیل" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-3 sm:p-6">
        <form onSubmit={send} className="space-y-4">
          {/* To */}
          <div>
            <Label htmlFor="to" className="text-sm font-medium">
              گیرنده (To)
            </Label>
            <Input
              id="to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="mt-1 text-left"
              style={{ direction: "ltr" }}
              inputMode="email"
              autoComplete="email"
            />
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="subject" className="text-sm font-medium">
              موضوع
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="موضوع ایمیل"
              className="mt-1 text-right"
            />
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message" className="text-sm font-medium">
              متن پیام
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="متن پیام..."
              rows={10}
              className="mt-1 text-right resize-y"
              style={{ direction: "rtl" }}
            />
          </div>

          {/* Attachments */}
          <div>
            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              id="attachments"
            />
            <label
              htmlFor="attachments"
              className={`inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer hover:bg-accent transition-colors ${
                attachments.length >= 5 ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              <Paperclip className="w-4 h-4" />
              {attachments.length >= 5 ? "حداکثر ۵ فایل" : "افزودن پیوست"}
            </label>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2 py-1 border rounded-md text-xs bg-muted max-w-full"
                  >
                    <span className="truncate max-w-[140px] sm:max-w-[200px]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      aria-label={`حذف ${f.name}`}
                      className="shrink-0"
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={`flex items-start gap-2 p-3 rounded-md text-sm ${
                result.ok
                  ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"
              }`}
            >
              {result.ok ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{result.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? "در حال ارسال..." : "ارسال ایمیل"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={loading}
            >
              پاک کردن
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
