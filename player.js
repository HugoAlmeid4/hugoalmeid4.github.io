// ─── MUSIC PLAYER ────────────────────────────────────────────────────────────
// Add your tracks below. Each entry needs a title and a src (path or URL).
// Example:
//   { title: "Song Name - Artist", src: "music/song.mp3" }
// ─────────────────────────────────────────────────────────────────────────────
const PLAYLIST = [
  { title: "Calming Zen - AtlasAudio", src: "music/musica.mp3" },
  { title: "Astronomy - AtlasAudio", src: "music/musica2.mp3" },
];
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const audio = new Audio();
  let currentIndex = 0;
  let isPlaying = false;

  // DOM elements
  const playBtn = document.getElementById('player-play');
  const prevBtn = document.getElementById('player-prev');
  const nextBtn = document.getElementById('player-next');
  const trackTitle = document.getElementById('player-track');
  const progressBar = document.getElementById('player-progress');
  const progressFill = document.getElementById('player-progress-fill');
  const timeEl = document.getElementById('player-time');

  function loadTrack(index) {
    currentIndex = index;
    const track = PLAYLIST[currentIndex];
    trackTitle.textContent = track.title;
    if (track.src) {
      audio.src = track.src;
      audio.load();
    }
    progressFill.style.width = '0%';
    timeEl.textContent = '0:00';
  }

  function togglePlay() {
    if (!PLAYLIST[currentIndex].src) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      playBtn.textContent = '▶';
    } else {
      audio.play().then(() => {
        isPlaying = true;
        playBtn.textContent = '❚❚';
      }).catch(e => {
        console.error('Play error:', e);
        isPlaying = false;
        playBtn.textContent = '▶';
      });
    }
  }

  function prevTrack() {
    if (PLAYLIST.length <= 1) return;
    const newIndex = (currentIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    loadTrack(newIndex);
    if (isPlaying) {
      audio.play().catch(e => console.error('Play error:', e));
    }
  }

  function nextTrack() {
    if (PLAYLIST.length <= 1) return;
    const newIndex = (currentIndex + 1) % PLAYLIST.length;
    loadTrack(newIndex);
    if (isPlaying) {
      audio.play().catch(e => console.error('Play error:', e));
    }
  }

  function formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Progress updates
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      progressFill.style.width = pct + '%';
      timeEl.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('ended', () => {
    nextTrack();
  });

  // Click on progress bar to seek
  progressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * audio.duration;
  });

  // Button events
  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', prevTrack);
  nextBtn.addEventListener('click', nextTrack);

  // Volume
  const volumeSlider = document.getElementById('player-volume');
  audio.volume = volumeSlider.value / 100;
  volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value / 100;
  });

  // Init – start on a random track
  loadTrack(Math.floor(Math.random() * PLAYLIST.length));
});
