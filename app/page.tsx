import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <div className="badge">Danube Dragons</div>

        <h1>Attendance Dashboard</h1>

        <p className="intro">
          Interne Web App für Trainingszusagen, Spielerstatus,
          Auswertungen und Admin Verwaltung.
        </p>

        <div className="actions">
          <Link href="/login" className="primaryButton">
            Zum Login
          </Link>
          <Link href="/dashboard" className="secondaryButton">
            Demo Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
