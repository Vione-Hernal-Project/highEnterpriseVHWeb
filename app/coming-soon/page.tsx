type Props = {
  searchParams: Promise<{
    feature?: string;
  }>;
};

export default async function ComingSoonPage({ searchParams }: Props) {
  const { feature } = await searchParams;
  const label = feature ? feature.replace(/-/g, " ") : "feature";

  return (
    <section className="storefront-app-view storefront-app-coming-soon">
      <div className="storefront-app-coming-soon__frame">
        <img className="storefront-app-coming-soon__media" src="/assets/images/coming-soon-background.jpg" alt="" role="presentation" />
        <video className="storefront-app-coming-soon__smoke" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
          <source src="/assets/videos/coming-soon-smoke-overlay.mp4" type="video/mp4" />
        </video>
        <div className="storefront-app-coming-soon__veil" />
        <div className="storefront-app-coming-soon__content">
          <p className="storefront-app-coming-soon__eyebrow">Vione Hernal</p>
          <h1 className="storefront-app-coming-soon__title">{label} coming soon</h1>
          <p className="storefront-app-coming-soon__description">
            This destination is being prepared with the same restraint, clarity, and presence as the rest of the house.
          </p>
        </div>
      </div>
    </section>
  );
}
