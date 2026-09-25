const setupView = document.querySelector("#setup");
const timerView = document.querySelector("#timer");
const timerForm = document.querySelector("#timer-form");
const durationInput = document.querySelector("#duration");
const amberInput = document.querySelector("#amber-time");
const redInput = document.querySelector("#red-time");
const formError = document.querySelector("#form-error");
const clock = document.querySelector("#clock");
const status = document.querySelector("#status");
const stopButton = document.querySelector("#stop-button");
const fullscreenButtons = document.querySelectorAll("#setup-fullscreen, #timer-fullscreen");

let timerInterval = null;
let endTime = 0;
let amberAt = 0;
let redAt = 0;
let wakeLock = null;
let audioContext = null;
let alarmPlayed = false;

const timeInputs = [durationInput, amberInput, redInput];

function formatInputDigits(digits) {
  const padded = digits.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
}

function setTimeInputDigits(input, digits, replace = false) {
  const incomingDigits = digits.replace(/\D/g, "");
  const currentDigits = replace || input.dataset.replaceOnNext === "true"
    ? ""
    : input.dataset.rawDigits || "";
  const nextDigits = `${currentDigits}${incomingDigits}`.slice(-6);

  input.dataset.rawDigits = nextDigits;
  input.dataset.replaceOnNext = "false";
  input.value = formatInputDigits(nextDigits);
}

function removeLastInputDigit(input) {
  const currentDigits = input.dataset.replaceOnNext === "true"
    ? ""
    : input.dataset.rawDigits || "";
  const nextDigits = currentDigits.slice(0, -1);

  input.dataset.rawDigits = nextDigits;
  input.dataset.replaceOnNext = "false";
  input.value = formatInputDigits(nextDigits);
}

function initializeTimeInputs() {
  timeInputs.forEach((input) => {
    input.value = formatInputDigits(input.value);
    input.dataset.rawDigits = input.value.replace(/\D/g, "");
    input.dataset.replaceOnNext = "true";

    input.addEventListener("beforeinput", (event) => {
      if (event.inputType === "deleteContentBackward") {
        event.preventDefault();
        removeLastInputDigit(input);
        return;
      }

      if (event.inputType === "deleteContentForward") {
        event.preventDefault();
        setTimeInputDigits(input, "", true);
        return;
      }

      if (event.inputType.startsWith("insert") && event.inputType !== "insertFromPaste") {
        event.preventDefault();
        setTimeInputDigits(input, event.data || "");
      }
    });

    input.addEventListener("paste", (event) => {
      event.preventDefault();
      setTimeInputDigits(input, event.clipboardData.getData("text"), true);
    });

    input.addEventListener("blur", () => {
      input.dataset.replaceOnNext = "true";
    });
  });
}

function parseTime(value) {
  const cleanValue = value.trim();

  if (/^\d+$/.test(cleanValue)) {
    return Number(cleanValue) * 60;
  }

  const parts = cleanValue.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const numbers = parts.map(Number);
  if (numbers.some((number) => !Number.isSafeInteger(number))) {
    return null;
  }

  if (numbers.length === 2) {
    return numbers[0] * 60 + numbers[1];
  }

  return numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
}

function formatTime(seconds, showHours) {
  const isNegative = seconds < 0;
  const absoluteSeconds = Math.abs(seconds);
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const remainingSeconds = absoluteSeconds % 60;
  const sign = isNegative ? "−" : "";

  if (showHours || hours > 0) {
    return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${sign}${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function setColorState(secondsRemaining) {
  timerView.classList.remove("is-amber", "is-red", "is-overdue");

  if (secondsRemaining < 0) {
    timerView.classList.add("is-overdue");
    status.textContent = "Overtime";
  } else if (secondsRemaining <= redAt) {
    timerView.classList.add("is-red");
    status.textContent = "Time remaining";
  } else if (secondsRemaining <= amberAt) {
    timerView.classList.add("is-amber");
    status.textContent = "Time remaining";
  } else {
    status.textContent = "Time remaining";
  }
}

function armAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playCompletionChime() {
  if (!audioContext) return;

  const startAt = audioContext.currentTime;
  const notes = [
    { frequency: 523.25, offset: 0 },
    { frequency: 659.25, offset: 1.2 },
    { frequency: 783.99, offset: 2.4 },
    { frequency: 659.25, offset: 3.6 },
    { frequency: 587.33, offset: 4.8 },
    { frequency: 698.46, offset: 6 },
    { frequency: 783.99, offset: 7.2 },
    { frequency: 659.25, offset: 8.4 },
  ];

  notes.forEach(({ frequency, offset }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const noteStart = startAt + offset;
    const noteEnd = Math.min(noteStart + 1.6, startAt + 10);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.11, noteStart + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd);
  });
}

function updateTimer() {
  const millisecondsRemaining = endTime - Date.now();
  const secondsRemaining = millisecondsRemaining >= 0
    ? Math.ceil(millisecondsRemaining / 1000)
    : -Math.floor(Math.abs(millisecondsRemaining) / 1000);
  const showHours = Math.abs(secondsRemaining) >= 3600;

  clock.textContent = formatTime(secondsRemaining, showHours);
  clock.classList.toggle("has-hours", showHours);
  clock.classList.toggle("is-negative", secondsRemaining < 0);
  clock.dateTime = secondsRemaining >= 0 ? `PT${secondsRemaining}S` : `-PT${Math.abs(secondsRemaining)}S`;
  setColorState(secondsRemaining);

  if (secondsRemaining === 0 && !alarmPlayed) {
    alarmPlayed = true;
    playCompletionChime();
  }

}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;

  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  await wakeLock.release();
  wakeLock = null;
}

function validateTimes() {
  const total = parseTime(durationInput.value);
  const amber = parseTime(amberInput.value);
  const red = parseTime(redInput.value);

  if (total === null || amber === null || red === null) {
    return { error: "Enter a valid HH:MM:SS value for each time." };
  }

  if (total <= 0) {
    return { error: "Total time must be greater than zero." };
  }

  if (amber >= total) {
    return { error: "Amber time must be less than the total time." };
  }

  if (red >= amber) {
    return { error: "Red time must be less than the amber time." };
  }

  return { total, amber, red };
}

function startTimer(event) {
  event.preventDefault();
  const result = validateTimes();

  if (result.error) {
    formError.textContent = result.error;
    return;
  }

  formError.textContent = "";
  armAudio();
  alarmPlayed = false;
  amberAt = result.amber;
  redAt = result.red;
  endTime = Date.now() + result.total * 1000;
  setupView.hidden = true;
  timerView.hidden = false;
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 200);
  requestWakeLock();
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }

  releaseWakeLock();
  timerView.classList.remove("is-amber", "is-red", "is-overdue");
  timerView.hidden = true;
  setupView.hidden = false;
  durationInput.focus();
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    formError.textContent = "Fullscreen is not available in this browser.";
  }
}

timerForm.addEventListener("submit", startTimer);
stopButton.addEventListener("click", stopTimer);
fullscreenButtons.forEach((button) => button.addEventListener("click", toggleFullscreen));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !timerView.hidden && !document.fullscreenElement) {
    stopTimer();
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !timerView.hidden && !wakeLock) {
    requestWakeLock();
  }
});

initializeTimeInputs();
