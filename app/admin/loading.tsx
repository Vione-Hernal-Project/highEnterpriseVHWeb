const statSkeletons = ["volume", "orders", "customers", "status"];
const rowSkeletons = ["first", "second", "third", "fourth", "fifth"];

export default function AdminLoading() {
  return (
    <div className="vh-admin-page" aria-busy="true">
      <header className="vh-admin-page-header">
        <div>
          <div className="vh-loading-line vh-loading-line--title" />
          <div className="vh-loading-line vh-loading-line--copy" />
        </div>
        <div className="vh-admin-page-header__actions">
          <div className="vh-loading-block vh-admin-loading-button" />
          <div className="vh-loading-block vh-admin-loading-button" />
        </div>
      </header>

      <section className="vh-admin-stats-grid vh-admin-stats-grid--four" aria-hidden="true">
        {statSkeletons.map((item) => (
          <article key={item} className="vh-admin-stat-card vh-admin-stat-card--neutral">
            <span className="vh-admin-stat-card__icon vh-loading-block" />
            <div>
              <span className="vh-loading-line vh-admin-loading-line--label" />
              <strong className="vh-loading-line vh-admin-loading-line--value" />
              <p className="vh-loading-line vh-admin-loading-line--copy" />
            </div>
          </article>
        ))}
      </section>

      <section className="vh-admin-table-card" aria-hidden="true">
        <div className="vh-admin-tabs">
          <span className="vh-admin-tab vh-admin-tab--active">
            <span className="vh-loading-line vh-admin-loading-tab" />
          </span>
          <span className="vh-admin-tab">
            <span className="vh-loading-line vh-admin-loading-tab" />
          </span>
          <span className="vh-admin-tab">
            <span className="vh-loading-line vh-admin-loading-tab" />
          </span>
        </div>
        <div className="vh-admin-table-toolbar">
          <div className="vh-loading-block vh-admin-loading-search" />
          <div className="vh-admin-table-toolbar__filters">
            <div className="vh-loading-block vh-admin-loading-filter" />
            <div className="vh-loading-block vh-admin-loading-filter" />
          </div>
        </div>
        <div className="vh-admin-loading-table">
          {rowSkeletons.map((row) => (
            <div key={row} className="vh-admin-loading-table__row">
              <span className="vh-loading-line" />
              <span className="vh-loading-line" />
              <span className="vh-loading-line" />
              <span className="vh-loading-line" />
              <span className="vh-loading-line" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
