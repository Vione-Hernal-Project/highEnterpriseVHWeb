type NotificationHistoryRow = {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

type Props = {
  rows: NotificationHistoryRow[];
};

function formatNotificationDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function AdminNotificationHistoryList({ rows }: Props) {
  if (!rows.length) {
    return (
      <div className="vh-admin-empty-inline">
        <strong>No notification records yet.</strong>
        <p>Order, payment, inventory, customer, and security events will appear here once triggered.</p>
      </div>
    );
  }

  return (
    <div className="vh-admin-notification-history">
      {rows.map((row) => (
        <article className="vh-admin-notification-history__item" key={row.id}>
          <span className="vh-admin-notification-history__meta">
            <strong>{row.channel.toUpperCase()}</strong>
            <i>{row.status}</i>
            <small>{formatNotificationDate(row.createdAt)}</small>
          </span>
          <span>
            <strong>{row.title}</strong>
            <small>{row.type}</small>
            <p>{row.message}</p>
            {row.errorMessage ? <em>{row.errorMessage}</em> : null}
          </span>
        </article>
      ))}
    </div>
  );
}
