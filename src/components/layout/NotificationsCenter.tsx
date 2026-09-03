import { useEffect, useState } from "react";
import { Bell, Check, CircleAlert, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

 type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export default function NotificationsCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async (userId: string) => {
    const { data, error: queryError } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (queryError) {
      setError("Notifications could not be loaded.");
    } else {
      setError(null);
      setNotifications(data ?? []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let active = true;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) {
        setIsLoading(false);
        return;
      }

      await loadNotifications(user.id);
      if (!active) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications((current) => [payload.new as Notification, ...current].slice(0, 50));
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
          setNotifications((current) => current.map((notification) => notification.id === payload.new.id ? payload.new as Notification : notification));
        })
        .subscribe();
    };

    setup();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const markAsRead = async (notification: Notification) => {
    if (notification.read) return;
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    const { error: updateError } = await supabase.from("notifications").update({ read: true }).eq("id", notification.id);
    if (updateError) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read: false } : item));
    }
  };

  const markAllAsRead = async () => {
    if (!unreadCount) return;
    const previous = notifications;
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error: updateError } = await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    if (updateError) setNotifications(previous);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAllAsRead} disabled={!unreadCount}>
            <Check className="mr-1.5 h-4 w-4" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="h-[min(28rem,calc(100vh-10rem))]">
          {isLoading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading notifications</div>}
          {!isLoading && error && <div className="flex items-center gap-2 p-6 text-sm text-destructive"><CircleAlert className="h-4 w-4 shrink-0" /> {error}</div>}
          {!isLoading && !error && notifications.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</div>}
          {!isLoading && !error && notifications.length > 0 && <div className="divide-y divide-border">
            {notifications.map((notification) => <button key={notification.id} type="button" onClick={() => markAsRead(notification)} className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-secondary/60", !notification.read && "bg-primary/5")}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted", !notification.read && "bg-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{notification.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{notification.message}</span>
                  <span className="mt-1.5 block text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                </span>
              </div>
            </button>)}
          </div>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
