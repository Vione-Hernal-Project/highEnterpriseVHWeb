export default function AboutPage() {
  return (
    <section className="storefront-app-view storefront-app-editorial">
      <div className="storefront-app-editorial__hero">
        <p className="storefront-app-editorial__eyebrow">About Us</p>
        <h1 className="storefront-app-editorial__title">Fashion for presence.</h1>
        <p className="storefront-app-editorial__lead">
          Vione Hernal is built on the belief that clothing should not seek attention. It should establish presence.
        </p>
      </div>
      <div className="storefront-app-editorial__sections">
        <article className="storefront-app-editorial__section">
          <p className="storefront-app-editorial__section-label">The Vision</p>
          <p>
            Founded by Miguel Oresca, the brand explores a more intentional way of dressing where structure, restraint,
            and clarity shape identity.
          </p>
          <p>
            This MVP phase focuses on the operational foundation: auth, protected customer areas, order storage, and a
            clean path to future crypto-enabled commerce.
          </p>
        </article>
        <article className="storefront-app-editorial__section">
          <p className="storefront-app-editorial__section-label">The Direction</p>
          <p>
            Vione Hernal will later expand into Base-native commerce. For now, the priority is proving that the backend
            and customer flow are working properly without changing the brand language of the site.
          </p>
          <p>This is fashion shaped not only by how it looks, but by how it exists, how it moves, and how it stays.</p>
        </article>
      </div>
      <div className="storefront-app-editorial__closing">
        <p>This is not fashion for attention.</p>
        <p>This is fashion for presence.</p>
      </div>
    </section>
  );
}
