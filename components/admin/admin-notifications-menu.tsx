"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type AdminNotification = {
  id: string;
  title: string;
  copy: string;
  href?: string;
  readAt?: string | null;
};

type Props = {
  notifications: AdminNotification[];
  readNotificationIds?: string[];
};

const EMPTY_READ_NOTIFICATION_IDS: string[] = [];

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

function haveSameIds(firstIds: string[], secondIds: string[]) {
  if (firstIds.length !== secondIds.length) {
    return false;
  }

  const firstSet = new Set(firstIds);
  return secondIds.every((id) => firstSet.has(id));
}

export function AdminNotificationsMenu({ notifications, readNotificationIds = EMPTY_READ_NOTIFICATION_IDS }: Props) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => uniqueIds([
    ...readNotificationIds,
    ...notifications.filter((notification) => notification.readAt).map((notification) => notification.id),
  ]));
  const containerRef = useRef<HTMLDivElement>(null);
  const readIdsFromProps = useMemo(
    () => uniqueIds([
      ...readNotificationIds,
      ...notifications.filter((notification) => notification.readAt).map((notification) => notification.id),
    ]),
    [notifications, readNotificationIds],
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !readIds.includes(notification.id)),
    [notifications, readIds],
  );
  const unreadCount = unreadNotifications.length;

  useEffect(() => {
    setReadIds((currentReadIds) => {
      const nextReadIds = uniqueIds([...currentReadIds, ...readIdsFromProps]);
      return haveSameIds(currentReadIds, nextReadIds) ? currentReadIds : nextReadIds;
    });
  }, [readIdsFromProps]);

  async function markNotificationsRead(ids: string[]) {
    const nextIds = uniqueIds(ids.filter(Boolean));

    if (!nextIds.length) {
      return;
    }

    setReadIds((currentReadIds) => {
      const nextReadIds = uniqueIds([...currentReadIds, ...nextIds]);
      return haveSameIds(currentReadIds, nextReadIds) ? currentReadIds : nextReadIds;
    });

    try {
      await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: nextIds }),
      });
    } catch {
      // Reading notifications is best-effort; the UI should remain usable.
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="vh-admin-notifications" ref={containerRef}>
      <button
        className="vh-admin-action-button vh-admin-notifications__button"
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen((current) => {
            const nextOpen = !current;

            if (nextOpen) {
              void markNotificationsRead(unreadNotifications.map((notification) => notification.id));
            }

            return nextOpen;
          });
        }}
      >
        <Bell size={16} strokeWidth={1.9} aria-hidden="true" />
        <span>Notifications</span>
        {unreadCount ? <b>{unreadCount}</b> : null}
      </button>

      {open ? (
        <div className="vh-admin-notifications__panel" role="dialog" aria-label="Admin notifications">
          <div className="vh-admin-notifications__header">
            <strong>Notifications</strong>
            <span>{unreadCount ? `${unreadCount} unread` : "Clear"}</span>
          </div>

          <div className="vh-admin-notifications__list">
            {notifications.length ? (
              notifications.map((notification) => {
                const content = (
                  <>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{notification.title}</strong>
                      <p>{notification.copy}</p>
                    </div>
                  </>
                );

                if (notification.href) {
                  return (
                    <Link key={notification.id} href={notification.href} onClick={() => setOpen(false)}>
                      {content}
                    </Link>
                  );
                }

                return <article key={notification.id}>{content}</article>;
              })
            ) : (
              <div className="vh-admin-notifications__empty">
                <strong>No notifications right now.</strong>
                <p>New order, payment, inventory, and ledger alerts will appear here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
