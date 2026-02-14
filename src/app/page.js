"use client";
import { useState, useEffect } from "react";
import styles from "./page.module.css";

// Maximum file size for audio uploads (100MB)
const MAX_FILE_SIZE_MB = 100;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [jobStatus, setJobStatus] = useState(null);
  const [pollingJobId, setPollingJobId] = useState(null);
  const [uploadingMyo, setUploadingMyo] = useState(false);
  const [myoResult, setMyoResult] = useState(null);
  const [sendingToYoto, setSendingToYoto] = useState(false);
  const [yotoResult, setYotoResult] = useState(null);
  const [refreshingPlaylist, setRefreshingPlaylist] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/status");
        const data = await response.json();
        setIsAuthenticated(data.authenticated);
      } catch (err) {
        console.error("Failed to check auth status:", err);
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Poll job status when a job is active
  useEffect(() => {
    if (!pollingJobId) return;

    const pollJobStatus = async () => {
      try {
        const response = await fetch(`/api/job-status?jobId=${pollingJobId}`);
        const data = await response.json();

        if (data.success && data.job) {
          setJobStatus(data.job);

          // Stop polling if job is completed or failed
          if (data.job.status === 'completed' || data.job.status === 'failed') {
            setPollingJobId(null);
          }
        }
      } catch (err) {
        console.error("Failed to check job status:", err);
      }
    };

    // Poll immediately, then every 3 seconds
    // Note: TTS job status polling uses 3 seconds as TTS generation is typically slower
    // and less frequent status updates are sufficient, whereas audio transcoding (1 second)
    // is faster and benefits from more frequent polling for better UX
    pollJobStatus();
    const interval = setInterval(pollJobStatus, 3000);

    return () => clearInterval(interval);
  }, [pollingJobId]);

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
      setYotoResult(null); // Clear previous yoto result when generating new card
      setPollingJobId(null); // Clear any existing polling job when starting a new card
      setJobStatus(null);    // Clear previous job status to avoid stale information
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadToMyo = async (e) => {
    e.preventDefault();
    setUploadingMyo(true);
    setError(null);
    setMyoResult(null);

    try {
      const fileInput = e.target.elements.audioFile;
      if (!fileInput.files[0]) {
        throw new Error('Please select an audio file');
      }

      // Validate file size (100MB limit)
      const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024; // Convert MB to bytes
      if (fileInput.files[0].size > maxSize) {
        throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please choose a smaller file.`);
      }

      const formData = new FormData();
      formData.append('audio', fileInput.files[0]);
      formData.append('title', 'F1: Next Race');
      formData.append('updateExisting', 'true');

      const response = await fetch('/api/upload-to-myo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          throw new Error('Please connect with Yoto first using the button above.');
        }
        throw new Error(data.error || 'Failed to upload to MYO card');
      }

      setMyoResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMyo(false);
    }
  };

  const handleSendToYoto = async () => {
    if (!result || !result.chapters) {
      setError('No card data to send. Please generate a card first.');
      return;
    }

    setSendingToYoto(true);
    setError(null);
    setYotoResult(null);

    try {
      const response = await fetch('/api/send-to-yoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapters: result.chapters,
          title: 'F1: Next Race',
          updateExisting: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          throw new Error('Please connect with Yoto first using the button above.');
        }
        throw new Error(data.error || 'Failed to send card to Yoto');
      }

      setYotoResult(data);
      
      // Start polling if we have a jobId
      if (data.yoto && data.yoto.jobId) {
        setPollingJobId(data.yoto.jobId);
        setJobStatus({
          status: data.yoto.status,
          progress: data.yoto.progress,
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingToYoto(false);
    }
  };

  const handleRefreshPlaylist = async () => {
    setRefreshingPlaylist(true);
    setError(null);
    setRefreshResult(null);

    try {
      const response = await fetch('/api/refresh-myo-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          throw new Error('Please connect with Yoto first using the button above.');
        }
        throw new Error(data.error || 'Failed to refresh playlist');
      }

      setRefreshResult(data);
      
      // Start polling if we have a jobId
      if (data.yoto && data.yoto.jobId) {
        setPollingJobId(data.yoto.jobId);
        setJobStatus({
          status: data.yoto.status,
          progress: { completed: 0, total: 0 },
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshingPlaylist(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setResult(null);
      setMyoResult(null);
      setError(null);
      setJobStatus(null);
      setPollingJobId(null);
      setYotoResult(null);
      setSendingToYoto(false);
      setRefreshingPlaylist(false);
      setRefreshResult(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>🏎️ Yoto Formula 1 Card</h1>
        <p className={styles.description}>
          Generate custom Yoto cards with the latest Formula 1 information
        </p>

        {checkingAuth ? (
          <div className={styles.loading}>
            <p>Checking authentication...</p>
          </div>
        ) : !isAuthenticated ? (
          <div className={styles.authSection}>
            <p className={styles.authMessage}>
              Please authenticate with Yoto to create and manage your F1 cards
            </p>
            <a href="/api/auth/login" className={styles.loginButton}>
              🔐 Connect with Yoto
            </a>
          </div>
        ) : (
          <>
            <form onSubmit={handleGenerateCard} className={styles.form}>
              <button
                type="submit"
                disabled={loading}
                className={styles.button}
              >
                {loading ? "Generating..." : "Generate F1 Card"}
              </button>
            </form>

            <div className={styles.refreshSection}>
              <h3 className={styles.refreshTitle}>🔄 Auto-Refresh from Cloudflare Worker</h3>
              <p className={styles.refreshDescription}>
                Fetch the latest F1 data from the Cloudflare Worker (updated daily) and create a fresh playlist.
                This uses your configured worker URL and automatically generates TTS content.
              </p>
              <button
                onClick={handleRefreshPlaylist}
                disabled={refreshingPlaylist}
                className={styles.buttonRefresh}
              >
                {refreshingPlaylist ? "Refreshing..." : "🔄 Refresh Playlist from Worker"}
              </button>
            </div>

            {refreshResult && (
              <div className={styles.success}>
                <h2>✅ {refreshResult.message}</h2>
                
                <div className={styles.refreshStatus}>
                  <h3>🔄 Playlist Refresh Status</h3>
                  
                  <div className={styles.dataSource}>
                    <h4>📡 Data Source</h4>
                    <p><strong>Type:</strong> {refreshResult.dataSource.type}</p>
                    <p><strong>URL:</strong> <code>{refreshResult.dataSource.url}</code></p>
                    <p><strong>Last Updated:</strong> {new Date(refreshResult.dataSource.lastUpdated).toLocaleString()}</p>
                  </div>

                  <div className={styles.raceInfo}>
                    <h4>🏁 Race Information</h4>
                    <p><strong>Name:</strong> {refreshResult.race.name}</p>
                    <p><strong>Location:</strong> {refreshResult.race.location}, {refreshResult.race.country}</p>
                    <p><strong>Date:</strong> {refreshResult.race.date}</p>
                    <p><strong>Time:</strong> {refreshResult.race.time}</p>
                  </div>

                  {refreshResult.sessions && refreshResult.sessions.length > 0 && (
                    <div className={styles.sessions}>
                      <h4>📅 Sessions ({refreshResult.sessions.length})</h4>
                      <ul>
                        {refreshResult.sessions.map((session, idx) => (
                          <li key={idx}>
                            <strong>{session.name}:</strong> {session.date} at {session.time}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {refreshResult.weather && (
                    <div className={styles.weather}>
                      <h4>🌤️ Weather Conditions</h4>
                      {refreshResult.weather.airTemperature && (
                        <p><strong>Air Temp:</strong> {Math.round(refreshResult.weather.airTemperature)}°C</p>
                      )}
                      {refreshResult.weather.trackTemperature && (
                        <p><strong>Track Temp:</strong> {Math.round(refreshResult.weather.trackTemperature)}°C</p>
                      )}
                      {refreshResult.weather.humidity && (
                        <p><strong>Humidity:</strong> {Math.round(refreshResult.weather.humidity)}%</p>
                      )}
                    </div>
                  )}

                  {refreshResult.yoto && refreshResult.yoto.jobId && (
                    <div className={styles.yotoJobStatus}>
                      <h4>📱 Yoto Processing</h4>
                      <p><strong>Job ID:</strong> {refreshResult.yoto.jobId}</p>
                      <p><strong>Card ID:</strong> {refreshResult.yoto.cardId}</p>
                      <p><strong>Status:</strong> {jobStatus ? (
                        <span>
                          {jobStatus.status === 'queued' && '⏳ Queued'}
                          {jobStatus.status === 'processing' && '🔄 Processing'}
                          {jobStatus.status === 'completed' && '✅ Completed'}
                          {jobStatus.status === 'failed' && '❌ Failed'}
                        </span>
                      ) : refreshResult.yoto.status}</p>
                      {jobStatus && jobStatus.progress && (
                        <p><strong>Progress:</strong> {jobStatus.progress.completed || 0} / {jobStatus.progress.total || 0} tracks</p>
                      )}
                      {jobStatus && jobStatus.status === 'completed' && (
                        <p className={styles.completedNote}>
                          ✅ <strong>TTS generation complete!</strong> Your refreshed card is ready in your Yoto library.
                        </p>
                      )}
                    </div>
                  )}

                  {refreshResult.deviceDeployment && (
                    <div className={styles.deviceDeployment}>
                      <h4>📡 Device Deployment</h4>
                      <p>
                        <strong>Deployed:</strong> {refreshResult.deviceDeployment.success} of {refreshResult.deviceDeployment.total} device(s)
                      </p>
                      {refreshResult.deviceDeployment.success > 0 && (
                        <p className={styles.deploymentSuccess}>
                          ✅ Playlist has been sent to your device(s)!
                        </p>
                      )}
                    </div>
                  )}

                  {refreshResult.note && (
                    <div className={styles.infoNote}>
                      <p>ℹ️ {refreshResult.note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result && (
              <div className={styles.success}>
                <h2>✅ {result.message}</h2>
                
                {!yotoResult && (
                  <div className={styles.sendToYotoSection}>
                    <p className={styles.devNote}>
                      🔧 Review the generated content below, then click the button to send to Yoto.
                    </p>
                    <button
                      onClick={handleSendToYoto}
                      disabled={sendingToYoto}
                      className={styles.buttonPrimary}
                    >
                      {sendingToYoto ? "Sending to Yoto..." : "📤 Send to Yoto"}
                    </button>
                  </div>
                )}

                {yotoResult && (
                  <>
                    <div className={styles.yotoStatus}>
                      <h3>📱 Yoto Card Status</h3>
                      {yotoResult.isUpdate && (
                        <p className={styles.updateBadge}>🔄 Updated Existing Card</p>
                      )}
                      {yotoResult.yoto && yotoResult.yoto.jobId && (
                        <>
                          <p><strong>Job ID:</strong> {yotoResult.yoto.jobId}</p>
                          <p><strong>Status:</strong> {jobStatus ? (
                            <span>
                              {jobStatus.status === 'queued' && '⏳ Queued'}
                              {jobStatus.status === 'processing' && '🔄 Processing'}
                              {jobStatus.status === 'completed' && '✅ Completed'}
                              {jobStatus.status === 'failed' && '❌ Failed'}
                            </span>
                          ) : yotoResult.yoto.status}</p>
                          {jobStatus && jobStatus.progress && (
                            <p><strong>Progress:</strong> {jobStatus.progress.completed || 0} / {jobStatus.progress.total || 0} tracks</p>
                          )}
                          {jobStatus && jobStatus.status === 'completed' && (
                            <p className={styles.completedNote}>
                              ✅ <strong>TTS generation complete!</strong> Your card is ready in your Yoto library.
                            </p>
                          )}
                          {jobStatus && jobStatus.status === 'failed' && (
                            <p className={styles.failedNote}>
                              ❌ <strong>TTS generation failed.</strong> Please try again.
                            </p>
                          )}
                          {(!jobStatus || (jobStatus.status !== 'completed' && jobStatus.status !== 'failed')) && (
                            <p className={styles.statusNote}>
                              {yotoResult.isUpdate 
                                ? "Your existing card is being updated with the latest race information. The changes will appear in your Yoto library shortly."
                                : "The card is being processed and will appear in your Yoto library shortly. Future updates will automatically refresh this same card!"}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    {yotoResult.deviceDeployment && (
                      <div className={styles.deviceDeployment}>
                        <h3>📡 Device Deployment</h3>
                        {yotoResult.deviceDeployment.error ? (
                          <p className={styles.deploymentError}>
                            ⚠️ Could not deploy to devices: {yotoResult.deviceDeployment.error}
                          </p>
                        ) : (
                          <>
                            <p>
                              <strong>Deployed:</strong> {yotoResult.deviceDeployment.success} of {yotoResult.deviceDeployment.total} device(s)
                            </p>
                            {yotoResult.deviceDeployment.failed > 0 && (
                              <p className={styles.deploymentWarning}>
                                ⚠️ {yotoResult.deviceDeployment.failed} device(s) failed to receive the playlist
                              </p>
                            )}
                            {yotoResult.deviceDeployment.total === 0 && (
                              <p className={styles.deploymentNote}>
                                ℹ️ No devices found. The playlist is in your library and can be played on any device.
                              </p>
                            )}
                            {yotoResult.deviceDeployment.success > 0 && (
                              <p className={styles.deploymentSuccess}>
                                ✅ Playlist has been sent to your device(s) and should start playing shortly!
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
                
                <div className={styles.f1Info}>
                  <h3>🏁 Race Weekend</h3>
                  <div className={styles.raceInfo}>
                    <p><strong>Name:</strong> {result.race.name}</p>
                    <p><strong>Location:</strong> {result.race.location}, {result.race.country}</p>
                    <p><strong>Circuit:</strong> {result.race.circuit}</p>
                    <p><strong>Date:</strong> {result.race.date}</p>
                    <p><strong>Time:</strong> {result.race.time}</p>
                  </div>
                </div>

                <details className={styles.scriptPreview}>
                  <summary>📝 View Generated Content ({result.chapters?.length || 0} chapters)</summary>
                  <div className={styles.chapters}>
                    {result.chapters?.map((chapter, index) => (
                      <div key={index} className={styles.chapter}>
                        <h4>
                          {chapter.icon && '🏎️ '} 
                          Chapter {index + 1}: {chapter.title}
                        </h4>
                        {chapter.tracks?.map((track, trackIndex) => (
                          <div key={trackIndex} className={styles.track}>
                            <p className={styles.trackTitle}>
                              <strong>Track:</strong> {track.title}
                            </p>
                            <pre className={styles.trackText}>{track.text}</pre>
                          </div>
                        ))}
                      </div>
                    ))}
                    {(!result.chapters || result.chapters.length === 0) && result.script && (
                      <>
                        <div className={styles.chapter}>
                          <h4>Chapter 1: Next Race</h4>
                          <pre>{result.script.chapter1}</pre>
                        </div>
                        {result.script.chapter2 && (
                          <div className={styles.chapter}>
                            <h4>Chapter 2: Driver Standings</h4>
                            <pre>{result.script.chapter2}</pre>
                          </div>
                        )}
                        {result.script.chapter3 && (
                          <div className={styles.chapter}>
                            <h4>Chapter 3: Team Standings</h4>
                            <pre>{result.script.chapter3}</pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </details>
              </div>
            )}

            {myoResult && (
              <div className={styles.success}>
                <h2>✅ {myoResult.message}</h2>
                
                <div className={styles.myoStatus}>
                  <h3>🎵 MYO Card Ready</h3>
                  {myoResult.isUpdate && (
                    <p className={styles.updateBadge}>🔄 Updated Existing Card</p>
                  )}
                  <p><strong>Card ID:</strong> {myoResult.card.cardId}</p>
                  <p><strong>Title:</strong> {myoResult.card.title}</p>
                  {myoResult.coverImage && (
                    <p><strong>Cover Image:</strong> {myoResult.coverImage}</p>
                  )}
                  <div className={styles.myoInstructions}>
                    <h4>📲 Next Steps:</h4>
                    <ol>
                      <li>Open the Yoto app on your phone</li>
                      <li>Go to your Library</li>
                      <li>Find "{myoResult.card.title}"</li>
                      <li>Tap to link it to your physical MYO card</li>
                      <li>Your card is now ready to play!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.divider}>
              <span>OR</span>
            </div>

            <form onSubmit={handleUploadToMyo} className={styles.form}>
              <h3 className={styles.formTitle}>Upload Audio to MYO Card</h3>
              <p className={styles.formDescription}>
                Upload your own audio file to create a MYO-compatible card with cover art
              </p>
              <input
                type="file"
                name="audioFile"
                accept="audio/*"
                className={styles.fileInput}
                disabled={uploadingMyo}
              />
              <button
                type="submit"
                disabled={uploadingMyo}
                className={styles.buttonSecondary}
              >
                {uploadingMyo ? "Uploading..." : "Upload to MYO Card"}
              </button>
            </form>

            {error && (
              <div className={styles.error}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </>
        )}

        <footer className={styles.footer}>
          <p>
            Built with ❤️ for the Yoto community | 
            <a href="https://yoto.dev" target="_blank" rel="noopener noreferrer"> Yoto Developer Docs</a>
          </p>
          {isAuthenticated && (
            <div className={styles.logoutSection}>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          )}
        </footer>
      </main>
    </div>
  );
}
