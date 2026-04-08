import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="vh-page-shell">
      <div className="vh-empty">
        <p className="vh-mvp-eyebrow">Not Found</p>
        <h1 className="vh-mvp-title">This destination is not available.</h1>
        <div className="vh-actions" style={{ justifyContent: "center" }}>
          <Link className="vh-button" href="/">
            Return Home
          </Link>
        </div>
      </div>
    </section>
  );
}
