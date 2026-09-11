const authForm = document.getElementById('authForm');
const gameArea = document.getElementById('gameArea');
const pointsLabel = document.getElementById('pointsLabel');
const questionProgress = document.getElementById('questionProgress');
const seasonLabel = document.getElementById('seasonLabel');
const playerChip = document.getElementById('playerChip');
const avatarTrigger = document.getElementById('avatarTrigger');
const profileAvatarTrigger = document.getElementById('profileAvatarTrigger');
const avatarInput = document.getElementById('avatarInput');
const avatarStatus = document.getElementById('avatarStatus');
const profileForm = document.getElementById('profileForm');
const continueGame = document.getElementById('continueGame');
const logoutButton = document.getElementById('logoutButton');
const profileGate = document.getElementById('profileGate');
const gameShell = document.getElementById('gameShell');
let questionTimerId = null;
let gameAudioContext = null;
let activeQuestionId = null;
let questionResolved = false;
let resultSoundStopTimer = null;
const incorrectSound = new Audio('/audio/incorrecto.mp4');
const resultSounds = {
  correct: new Audio('/audio/correcto.mp4'),
  wrong: incorrectSound,
  timeout: incorrectSound
};

setupAvatarPicker();
setupProfile();

let authMode = 'login';

document.querySelectorAll('[data-auth-mode]').forEach(tab => {
  tab.addEventListener('click', () => {
    authMode = tab.dataset.authMode;
    document.querySelectorAll('[data-auth-mode]').forEach(item => item.classList.toggle('active', item === tab));
    const submit = document.getElementById('authSubmit');
    const password = document.getElementById('password');
    const hint = document.getElementById('passwordHint');
    if (submit) submit.textContent = authMode === 'login' ? 'Entrar a jugar' : 'Crear mi cuenta';
    if (password) password.autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
    if (hint) hint.textContent = authMode === 'login' ? 'Ingresá tu contraseña para continuar.' : 'Mínimo 6 caracteres. No necesitás email.';
  });
});

if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('nickname').value.trim();
    const password = document.getElementById('password').value;
    const widget = document.querySelector('altcha-widget');
    const altcha = widget?.value || document.querySelector('input[name="altcha"]')?.value || '';
    const errorEl = document.getElementById('registerError');
    errorEl.textContent = '';

    if (!altcha) {
      errorEl.textContent = 'Esperá un segundo, estamos verificando que no sos un bot...';
      return;
    }

    try {
      const res = await fetch(authMode === 'login' ? '/api/login' : '/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, password, altcha })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Algo salió mal.';
        return;
      }
      window.location.reload();
    } catch (err) {
      errorEl.textContent = 'No se pudo conectar. Probá de nuevo.';
    }
  });
}

if (gameArea) {
  loadMe();
  if (!continueGame) loadQuestion();
}

async function loadMe() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (!data.player) return;
  if (pointsLabel) pointsLabel.textContent = data.score.points;
  if (seasonLabel) seasonLabel.textContent = data.season.name;
  const playerName = document.getElementById('playerName');
  if (playerName) playerName.textContent = data.player.nickname;
  updateAvatarPreview(data.player.avatarData, data.player.nickname);
}

function setupAvatarPicker() {
  if (!avatarInput) return;

  [avatarTrigger, profileAvatarTrigger].filter(Boolean).forEach(button => {
    button.addEventListener('click', () => avatarInput.click());
  });
  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarStatus('Elegí JPG, PNG o WebP.');
      avatarInput.value = '';
      return;
    }

    setAvatarStatus('Subiendo...');
    try {
      const avatarData = await compressAvatar(file);
      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la foto.');
      updateAvatarPreview(data.avatarData, document.getElementById('playerName')?.textContent || '');
      setAvatarStatus('Foto lista');
      setTimeout(() => setAvatarStatus(''), 1800);
    } catch (error) {
      setAvatarStatus(error.message);
    } finally {
      avatarInput.value = '';
    }
  });
}

function setupProfile() {
  if (profileForm) {
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('profileError');
      error.textContent = '';
      const nickname = document.getElementById('profileNickname').value.trim();
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname })
      });
      const data = await res.json();
      if (!res.ok) {
        error.textContent = data.error || 'No se pudo guardar el nickname.';
        return;
      }
      document.getElementById('profileNickname').value = data.nickname;
      const playerName = document.getElementById('playerName');
      if (playerName) playerName.textContent = data.nickname;
      error.textContent = 'Cambios guardados.';
      error.classList.add('success-msg');
    });
  }

  if (continueGame) {
    continueGame.addEventListener('click', () => {
      profileGate.hidden = true;
      gameShell.hidden = false;
      loadQuestion();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.reload();
    });
  }
}

function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = 320;
        const scale = Math.min(1, size / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', .82));
      };
      image.onerror = () => reject(new Error('No se pudo leer la foto.'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('No se pudo leer la foto.'));
    reader.readAsDataURL(file);
  });
}

function updateAvatarPreview(avatarData, nickname) {
  const avatar = document.getElementById('playerAvatar');
  const profileAvatar = document.getElementById('profileAvatar');
  const content = avatarData
    ? `<img src="${escapeHtml(avatarData)}" alt="">`
    : escapeHtml((nickname || '?').charAt(0).toUpperCase());
  if (avatar) avatar.innerHTML = content;
  if (profileAvatar) profileAvatar.innerHTML = content;
}

function setAvatarStatus(message) {
  if (avatarStatus) avatarStatus.textContent = message;
}

function playGameSound(type) {
  if (resultSounds[type]) {
    const sound = resultSounds[type];
    clearTimeout(resultSoundStopTimer);
    Object.values(resultSounds).forEach(activeSound => {
      activeSound.pause();
      activeSound.currentTime = 0;
    });
    sound.currentTime = 0;
    const stopIncorrectSoundAtHalf = () => {
      if (type !== 'wrong' && type !== 'timeout') return;
      if (!Number.isFinite(sound.duration) || sound.duration <= 0) return;
      resultSoundStopTimer = setTimeout(() => {
        sound.pause();
        sound.currentTime = 0;
      }, sound.duration * 500);
    };
    if (sound.readyState >= 1) stopIncorrectSoundAtHalf();
    else sound.addEventListener('loadedmetadata', stopIncorrectSoundAtHalf, { once: true });
    sound.play().catch(() => {});
    return;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!gameAudioContext) gameAudioContext = new AudioContextClass();
    if (gameAudioContext.state === 'suspended') gameAudioContext.resume();

    const now = gameAudioContext.currentTime;
    const sounds = {
      correct: [{ frequency: 520, start: 0, duration: .12 }, { frequency: 760, start: .1, duration: .18 }],
      wrong: [{ frequency: 240, start: 0, duration: .16 }, { frequency: 150, start: .13, duration: .2 }],
      timeout: [{ frequency: 170, start: 0, duration: .22 }, { frequency: 120, start: .2, duration: .28 }]
    };

    (sounds[type] || []).forEach(({ frequency, start, duration }) => {
      const oscillator = gameAudioContext.createOscillator();
      const gain = gameAudioContext.createGain();
      oscillator.type = type === 'correct' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, now + start);
      gain.gain.setValueAtTime(.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(.12, now + start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, now + start + duration);
      oscillator.connect(gain);
      gain.connect(gameAudioContext.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration + .02);
    });
  } catch (error) {
    gameAudioContext = null;
  }
}

function playCountdownSound(seconds) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!gameAudioContext) gameAudioContext = new AudioContextClass();
    if (gameAudioContext.state === 'suspended') gameAudioContext.resume();

    const now = gameAudioContext.currentTime;
    const oscillator = gameAudioContext.createOscillator();
    const gain = gameAudioContext.createGain();
    oscillator.type = seconds <= 3 ? 'square' : 'sine';
    oscillator.frequency.setValueAtTime(seconds <= 3 ? 720 : 480, now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(seconds <= 3 ? .08 : .045, now + .01);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .07);
    oscillator.connect(gain);
    gain.connect(gameAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + .08);
  } catch (error) {
    gameAudioContext = null;
  }
}

async function loadQuestion() {
  gameArea.innerHTML = `
    <div class="question-card">
      <div class="question-text">Cargando pregunta...</div>
    </div>`;

  const res = await fetch('/api/question');
  const data = await res.json();

  if (data.done) {
    const avgTimeHtml = (data.gameComplete && data.avgResponseTimeMs != null)
      ? `<p class="avg-time-result">Tiempo promedio de respuesta: ${(data.avgResponseTimeMs / 1000).toFixed(1)}s</p>`
      : '';
    gameArea.innerHTML = `
      <div class="question-card">
        <div class="done-card">
          <p>${data.message}</p>
          ${avgTimeHtml}
          ${data.gameComplete ? '<button type="button" class="btn btn-primary play-again-btn" id="playAgain"><span aria-hidden="true">▶</span> Jugar</button>' : ''}
        </div>
      </div>`;
    const playAgain = document.getElementById('playAgain');
    if (playAgain) playAgain.addEventListener('click', startNewGame);
    return;
  }

  if (data.timedOut) {
    gameArea.innerHTML = `
      <div class="question-card">
        <div class="done-card timeout-card">
          <strong>¡Tiempo!</strong>
          <p>${escapeHtml(data.message)}</p>
        </div>
      </div>`;
    setTimeout(loadQuestion, 900);
    return;
  }

  if (questionProgress) questionProgress.textContent = `Pregunta ${data.questionNumber} de 10`;
  renderQuestion(data.question, data.timeLimitMs, data.questionStartedAt);
}

async function startNewGame() {
  const res = await fetch('/api/game/new', { method: 'POST' });
  if (!res.ok) return;
  await loadQuestion();
}

function renderQuestion(q, timeLimitMs, questionStartedAt) {
  activeQuestionId = q.id;
  questionResolved = false;
  const options = [
    { key: 'a', text: q.option_a },
    { key: 'b', text: q.option_b },
    { key: 'c', text: q.option_c },
    { key: 'd', text: q.option_d }
  ];

  gameArea.innerHTML = `
    <div class="question-card question-card-play">
      <div class="question-timer" id="questionTimer" aria-live="polite">${Math.ceil(timeLimitMs / 1000)}</div>
      <div class="question-text">${escapeHtml(q.question_text)}</div>
      ${q.image_url ? `
        <div class="question-visual">
          <img src="${escapeHtml(q.image_url)}" alt="Ilustración de la pregunta" loading="eager">
        </div>` : ''}
      <div class="options" id="optionsList">
        ${options.map(o => `
          <button class="option-btn" data-key="${o.key}">${escapeHtml(o.text)}</button>
        `).join('')}
      </div>
      <div class="feedback" id="feedback"></div>
    </div>`;

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => submitAnswer(q.id, btn.dataset.key));
  });
  startQuestionTimer(q.id, timeLimitMs, questionStartedAt);
}

function startQuestionTimer(questionId, timeLimitMs = 10000, questionStartedAt = Date.now()) {
  clearInterval(questionTimerId);
  const timer = document.getElementById('questionTimer');
  const deadline = Number(questionStartedAt) + timeLimitMs;
  let lastAnnouncedSecond = null;

  const tick = () => {
    if (questionResolved || activeQuestionId !== questionId) return;
    const remaining = Math.max(0, deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    if (seconds !== lastAnnouncedSecond && seconds > 0) {
      lastAnnouncedSecond = seconds;
      playCountdownSound(seconds);
    }
    if (timer) {
      timer.textContent = seconds;
      timer.classList.toggle('urgent', seconds <= 3);
    }
    if (remaining <= 0) {
      clearInterval(questionTimerId);
      expireQuestion(questionId);
    }
  };

  tick();
  questionTimerId = setInterval(tick, 100);
}

async function expireQuestion(questionId) {
  if (questionResolved || activeQuestionId !== questionId) return;
  questionResolved = true;
  clearInterval(questionTimerId);
  document.querySelectorAll('.option-btn').forEach(button => button.disabled = true);
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption: null })
    });
    const data = await res.json();
    const feedback = document.getElementById('feedback');
    if (res.ok || res.status === 408) {
      playGameSound('timeout');
      if (feedback) feedback.innerHTML = '<div class="points wrong">¡Tiempo!</div>';
      setTimeout(loadQuestion, 900);
    } else if (feedback) {
      feedback.innerHTML = `<div class="points wrong">${escapeHtml(data.error || 'No se pudo registrar la respuesta.')}</div>`;
      setTimeout(loadQuestion, 1200);
    }
  } catch (error) {
    const feedback = document.getElementById('feedback');
    if (feedback) feedback.innerHTML = '<div class="points wrong">No se pudo conectar. Reintentando...</div>';
    setTimeout(loadQuestion, 1200);
  }
}

async function submitAnswer(questionId, selectedOption) {
  if (questionResolved || activeQuestionId !== questionId) return;
  questionResolved = true;
  clearInterval(questionTimerId);
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);

  const feedback = document.getElementById('feedback');
  try {
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, selectedOption })
    });
    const data = await res.json();
    if (!res.ok) {
      if (feedback) feedback.innerHTML = `<div class="points wrong">${escapeHtml(data.error || 'No se pudo registrar la respuesta.')}</div>`;
      setTimeout(loadQuestion, 1200);
      return;
    }

    document.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.dataset.key === data.correctOption) btn.classList.add('correct');
      else if (btn.dataset.key === selectedOption) btn.classList.add('wrong');
    });

    playGameSound(data.correct ? 'correct' : 'wrong');
    if (feedback) {
      feedback.innerHTML = data.correct
        ? `<div class="points correct">¡Bieeen! +${data.pointsEarned}</div>`
        : `<div class="points wrong">¡Ay nooo! La correcta era ${escapeHtml(data.correctOption.toUpperCase())}</div>`;
    }

    if (pointsLabel) {
      pointsLabel.textContent = parseInt(pointsLabel.textContent, 10) + data.pointsEarned;
    }

    setTimeout(loadQuestion, 1400);
  } catch (error) {
    if (feedback) feedback.innerHTML = '<div class="points wrong">No se pudo conectar. Reintentando...</div>';
    setTimeout(loadQuestion, 1200);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}