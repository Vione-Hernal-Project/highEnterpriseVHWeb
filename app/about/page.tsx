export default function AboutPage() {
  return (
    <section className="storefront-app-view vh-about-page">
      <p className="vh-about-page__breadcrumb">HOME/ ABOUT US</p>
      <div className="vh-about-page__hero">
        <p className="vh-about-page__eyebrow">About Us</p>
        <h1 className="vh-about-page__title">
          FASHION FOR
          <br />
          PRESENCE.
        </h1>
        <p className="vh-about-page__lead">
          Vione Hernal is built on the belief that clothing should not seek attention, it should establish presence.
        </p>
      </div>
      <div className="vh-about-page__sections">
        <article className="vh-about-page__section">
          <p className="vh-about-page__section-label">The Vision</p>
          <p>
            Founded by Miguel Oresca, the brand explores a more intentional way of dressing where structure, restraint,
            and clarity shape identity. Each piece is designed with precision, balancing modern form with quiet
            confidence.
          </p>
          <p>The vision extends beyond design.</p>
          <p>
            Vione Hernal integrates blockchain as a foundation for a new kind of fashion experience where authenticity
            is verifiable, ownership is permanent, and every piece carries a digital identity. It is not about
            technology as a statement, but as a shift in how people connect with what they wear.
          </p>
          <p>
            The mission is to change not only how clothing looks, but how it is valued, owned, and experienced.
          </p>
        </article>
        <article className="vh-about-page__section">
          <p className="vh-about-page__section-label">Background</p>
          <p>
            Vione Hernal began with a simple observation: most clothing is made to be seen, but rarely to be felt.
          </p>
          <p>
            There was a gap between appearance and meaning. Between what people wear and what it represents.
          </p>
          <p>The brand was created to close that gap.</p>
          <p>
            Drawing from personal experience in both fashion and emerging systems, the foundation of Vione Hernal was
            built on control: of silhouette, of presence, and of purpose. Not louder pieces, but sharper ones. Not
            more options, but more intention.
          </p>
          <p>Each design reflects that discipline. Each release carries that direction.</p>
          <p>
            This is fashion shaped not only by how it looks, but by how it exists, how it moves, and how it stays.
          </p>
        </article>
      </div>
      <div className="vh-about-page__closing">
        <p>This is not fashion for attention.</p>
        <p>This is fashion for presence.</p>
      </div>
    </section>
  );
}
