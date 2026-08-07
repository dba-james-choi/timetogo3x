const WEATHER_CODE_EMOJI = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌦️",
  56: "🌧️",
  57: "🌧️",
  61: "🌧️",
  63: "🌧️",
  65: "🌧️",
  66: "🌨️",
  67: "🌨️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  77: "❄️",
  80: "🌦️",
  81: "🌧️",
  82: "⛈️",
  85: "🌨️",
  86: "❄️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

function weatherEmoji(code) {
  return WEATHER_CODE_EMOJI[code] || "🌡️";
}

function formatHour(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatWeekday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("ko-KR", { weekday: "short" });
}

function formatMonthDay(dateStr) {
  const [, m, day] = dateStr.split("-");
  return `${Number(m)}/${Number(day)}`;
}

function formatUpdatedAt(iso) {
  if (!iso) return "데이터 없음";
  const d = new Date(iso);
  return `업데이트: ${d.toLocaleString("ko-KR", { timeZone: "America/Vancouver" })} (Victoria 현지시각)`;
}

function pmClass(value, isPm25) {
  if (value === null || value === undefined) return "";
  const moderateAt = isPm25 ? 15 : 55;
  const unhealthyAt = isPm25 ? 35 : 155;
  if (value >= unhealthyAt) return "pm-unhealthy";
  if (value >= moderateAt) return "pm-moderate";
  return "pm-good";
}

function pmText(value) {
  return value === null || value === undefined ? "-" : value;
}

function renderCurrent(data) {
  const el = document.getElementById("current");
  const c = data.current;
  if (!c) {
    el.innerHTML = '<p class="loading-text">첫 GitHub Actions 실행 후 데이터가 표시됩니다.</p>';
    return;
  }
  el.innerHTML = `
    <div class="current-main">
      <span class="current-emoji">${weatherEmoji(c.weather_code)}</span>
      <span class="current-temp">${Math.round(c.temperature)}°C</span>
    </div>
    <div class="current-stats">
      <div class="stat-tile">
        <span class="stat-label">강수확률</span>
        <span class="stat-value">${c.precipitation_probability ?? "-"}%</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">바람</span>
        <span class="stat-value">${Math.round(c.wind_speed)} km/h</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">미세먼지(PM10)</span>
        <span class="stat-value ${pmClass(c.pm10, false)}">${pmText(c.pm10)}</span>
      </div>
      <div class="stat-tile">
        <span class="stat-label">초미세먼지(PM2.5)</span>
        <span class="stat-value ${pmClass(c.pm2_5, true)}">${pmText(c.pm2_5)}</span>
      </div>
    </div>
  `;
}

function renderHourly(data) {
  const el = document.getElementById("hourly");
  if (!data.hourly || data.hourly.length === 0) {
    el.innerHTML = '<p class="loading-text">첫 GitHub Actions 실행 후 데이터가 표시됩니다.</p>';
    return;
  }
  el.innerHTML = data.hourly
    .map(
      (h) => `
    <div class="hour-card">
      <div class="hour-time">${formatHour(h.time)}</div>
      <div class="hour-emoji">${weatherEmoji(h.weather_code)}</div>
      <div class="hour-temp">${Math.round(h.temperature)}°</div>
      <div class="hour-detail">☔ ${h.precipitation_probability ?? "-"}%</div>
      <div class="hour-detail">💨 ${Math.round(h.wind_speed)}km/h</div>
      <div class="hour-detail ${pmClass(h.pm10, false)}">PM10 ${pmText(h.pm10)}</div>
      <div class="hour-detail ${pmClass(h.pm2_5, true)}">PM2.5 ${pmText(h.pm2_5)}</div>
    </div>
  `
    )
    .join("");
}

function renderDaily(data) {
  const el = document.getElementById("daily");
  if (!data.daily || data.daily.length === 0) {
    el.innerHTML = '<p class="loading-text">첫 GitHub Actions 실행 후 데이터가 표시됩니다.</p>';
    return;
  }
  el.innerHTML = data.daily
    .map(
      (d) => `
    <div class="day-card">
      <div class="day-name">${formatWeekday(d.date)} <span class="day-date">${formatMonthDay(d.date)}</span></div>
      <div class="day-emoji">${weatherEmoji(d.weather_code)}</div>
      <div class="day-temp">
        <span class="day-temp-max">${Math.round(d.temp_max)}°</span>
        <span class="day-temp-min">${Math.round(d.temp_min)}°</span>
      </div>
      <div class="day-detail">☔ ${d.precipitation_probability_max ?? "-"}%</div>
      <div class="day-detail">💨 ${Math.round(d.wind_speed_max)}km/h</div>
      <div class="day-detail ${pmClass(d.pm10_avg, false)}">PM10 ${pmText(d.pm10_avg)}</div>
      <div class="day-detail ${pmClass(d.pm2_5_avg, true)}">PM2.5 ${pmText(d.pm2_5_avg)}</div>
    </div>
  `
    )
    .join("");
}

async function loadWeather() {
  const updatedEl = document.getElementById("weather-updated-at");
  let data;
  try {
    const res = await fetch(`data/weather.json?_=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    document.getElementById("current").innerHTML =
      '<p class="loading-text">데이터를 불러오지 못했습니다.</p>';
    updatedEl.textContent = "데이터 없음";
    return;
  }

  updatedEl.textContent = formatUpdatedAt(data.updated_at);
  renderCurrent(data);
  renderHourly(data);
  renderDaily(data);
}

loadWeather();
