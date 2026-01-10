"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerateCard = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/generate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate card");
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>🏎️ Yoto Formula 1 Card</h1>
        <p className={styles.description}>
          Generate custom Yoto cards with the latest Formula 1 information
        </p>

        <div className={styles.authSection}>
          <a href="/api/auth/login" className={styles.loginButton}>
            🔐 Connect with Yoto
          </a>
        </div>

        <form onSubmit={handleGenerateCard} className={styles.form}>
          <button
            type="submit"
            disabled={loading}
            className={styles.button}
          >
            {loading ? "Generating..." : "Generate F1 Card"}
          </button>
        </form>

        {error && (
          <div className={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className={styles.success}>
            <h2>✅ {result.message}</h2>
            
            <div className={styles.f1Info}>
              <h3>🏁 Next Race</h3>
              <div className={styles.raceInfo}>
                <p><strong>Race:</strong> {result.race.name}</p>
                <p><strong>Location:</strong> {result.race.location}</p>
                <p><strong>Circuit:</strong> {result.race.circuit}</p>
                <p><strong>Date:</strong> {result.race.date}</p>
                <p><strong>Time:</strong> {result.race.time}</p>
              </div>

              <h3>🏆 Top 5 Drivers</h3>
              <div className={styles.standings}>
                {result.drivers.map((driver) => (
                  <div key={driver.position} className={styles.standingItem}>
                    <span className={styles.position}>{driver.position}</span>
                    <span className={styles.name}>{driver.driver}</span>
                    <span className={styles.team}>{driver.team}</span>
                    <span className={styles.points}>{driver.points} pts</span>
                  </div>
                ))}
              </div>

              <h3>🏁 Top 5 Teams</h3>
              <div className={styles.standings}>
                {result.teams.map((team) => (
                  <div key={team.position} className={styles.standingItem}>
                    <span className={styles.position}>{team.position}</span>
                    <span className={styles.teamName}>{team.team}</span>
                    <span className={styles.points}>{team.points} pts</span>
                  </div>
                ))}
              </div>
            </div>

            <details className={styles.scriptPreview}>
              <summary>📝 View Generated Scripts (3 Chapters)</summary>
              <div className={styles.chapters}>
                <div className={styles.chapter}>
                  <h4>Chapter 1: Next Race</h4>
                  <pre>{result.script.chapter1}</pre>
                </div>
                <div className={styles.chapter}>
                  <h4>Chapter 2: Driver Standings</h4>
                  <pre>{result.script.chapter2}</pre>
                </div>
                <div className={styles.chapter}>
                  <h4>Chapter 3: Team Standings</h4>
                  <pre>{result.script.chapter3}</pre>
                </div>
              </div>
            </details>
          </div>
        )}

        <footer className={styles.footer}>
          <p>
            Built with ❤️ for the Yoto community | 
            <a href="https://yoto.dev" target="_blank" rel="noopener noreferrer"> Yoto Developer Docs</a>
          </p>
        </footer>
      </main>
    </div>
  );
}
