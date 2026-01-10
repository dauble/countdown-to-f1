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
        // If authentication is needed, show specific message
        if (data.needsAuth) {
          throw new Error("Please connect with Yoto first using the button above.");
        }
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
            
            {result.yoto && (
              <div className={styles.yotoStatus}>
                <h3>📱 Yoto Card Status</h3>
                {result.isUpdate && (
                  <p className={styles.updateBadge}>🔄 Updated Existing Card</p>
                )}
                <p><strong>Job ID:</strong> {result.yoto.jobId}</p>
                <p><strong>Status:</strong> {result.yoto.status}</p>
                <p className={styles.statusNote}>
                  {result.isUpdate 
                    ? "Your existing card is being updated with the latest race information. The changes will appear in your Yoto library shortly."
                    : "The card is being processed and will appear in your Yoto library shortly. Future updates will automatically refresh this same card!"}
                </p>
              </div>
            )}
            
            <div className={styles.f1Info}>
              <h3>🏁 Next Race</h3>
              <div className={styles.raceInfo}>
                <p><strong>Race:</strong> {result.race.name}</p>
                <p><strong>Location:</strong> {result.race.location}</p>
                <p><strong>Circuit:</strong> {result.race.circuit}</p>
                <p><strong>Date:</strong> {result.race.date}</p>
                <p><strong>Time:</strong> {result.race.time}</p>
              </div>
            </div>

            <details className={styles.scriptPreview}>
              <summary>📝 View Generated Script</summary>
              <div className={styles.chapters}>
                <div className={styles.chapter}>
                  <h4>Chapter 1: Next Race</h4>
                  <pre>{result.script.chapter1}</pre>
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
