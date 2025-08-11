window.addEventListener("DOMContentLoaded", function () {
  // ---------- Constantes ----------
  const THEO_HOURS_PER_DAY = 8.5;            // 8h30 en décimal
  const THEO_WEEKLY_TOTAL  = 5 * THEO_HOURS_PER_DAY;

  // ---------- Helpers stockage ----------
  const getStoredData = () => JSON.parse(localStorage.getItem("heures") || "{}");
  const saveStoredData = (d) => localStorage.setItem("heures", JSON.stringify(d));

  // ---------- Helpers affichage ----------
  const toHourFormat = (value) => {
    const h = Math.floor(Math.abs(value));
    const m = Math.round((Math.abs(value) - h) * 60);
    return `${h}h${String(m).padStart(2, "0")}`;
  };
  const formatSignedHours = (value) => (value >= 0 ? "+" : "-") + toHourFormat(value);
  const spanDelta = (value) =>
    `<span class="delta ${value >= 0 ? "plus" : "minus"}">${formatSignedHours(value)}</span>`;

  // ---------- Helpers dates ----------
  function getWeekDates() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
  const getDayName = (dateStr) =>
    ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][new Date(dateStr).getDay()];

  // ISO week key "YYYY-Www"
  function getISOWeekKey(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); // jeudi
    const week1 = new Date(d.getFullYear(),0,4);
    const week = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay()+6)%7)) / 7);
    const year = d.getFullYear();
    return `${year}-W${String(week).padStart(2, "0")}`;
  }
  function weekLabel(isoKey) {
    const [, w] = isoKey.split("-W");
    return `Semaine ${parseInt(w,10)}`;
  }
  function monthLabel(ym) {
    const [y,m] = ym.split("-");
    const mois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    return `${mois[parseInt(m,10)-1]} ${y}`;
  }

  // ---------- Init date du jour ----------
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  // ---------- CRUD journée ----------
  function saveHours() {
    const date = document.getElementById("date").value;
    const arrival = document.getElementById("arrival").value;
    const departure = document.getElementById("departure").value;
    if (!arrival || !departure || !date) return alert("Merci de remplir la date et les heures.");

    const data = getStoredData();
    if (data[date] && !confirm("Une entrée existe déjà pour ce jour. Modifier ?")) return;

    const start = new Date(`1970-01-01T${arrival}`);
    const end   = new Date(`1970-01-01T${departure}`);
    const diffHours = (end - start) / 1000 / 60 / 60;
    const workedHours = Number((diffHours - 1).toFixed(3)); // -1h pause
    const delta = Number((workedHours - THEO_HOURS_PER_DAY).toFixed(3));
    data[date] = { arrival, departure, workedHours, delta };
    saveStoredData(data);

    renderWeek(); populateMonthSelect(); renderMonth(); renderYear(); renderAnnualTotal();
  }
  function deleteDay(date) {
    if (!confirm(`Supprimer les données du ${date} ?`)) return;
    const data = getStoredData();
    delete data[date];
    saveStoredData(data);
    renderWeek(); renderMonth(); renderYear(); renderAnnualTotal();
  }
  function modifyDay(date) {
    const data = getStoredData();
    if (!data[date]) return;
    document.getElementById("date").value = date;
    document.getElementById("arrival").value = data[date].arrival;
    document.getElementById("departure").value = data[date].departure;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- SEMAINE ----------
  function renderWeek() {
    const data = getStoredData();
    const weekDates = getWeekDates();
    let html = "";
    let total = 0;

    weekDates.forEach(date => {
      const e = data[date];
      if (e) {
        html += `
          <div class="entry-line">
            <strong>${date} (${getDayName(date)})</strong> :
            ${e.arrival} → ${e.departure} | ${toHourFormat(e.workedHours)} (${spanDelta(e.delta)})
            <button onclick="modifyDay('${date}')">✏️ Modifier</button>
            <button onclick="deleteDay('${date}')">🗑 Supprimer</button>
          </div>`;
        total += e.workedHours;
      } else {
        html += `<div class="entry-line"><strong>${date} (${getDayName(date)})</strong> : —</div>`;
      }
    });

    const weeklyDelta = total - THEO_WEEKLY_TOTAL;
    const weeklyTotalDiv = document.getElementById("weeklyTotal");
    if (weeklyTotalDiv) {
      weeklyTotalDiv.innerHTML =
        `<strong>Total semaine :</strong> ${toHourFormat(total)} sur ${toHourFormat(THEO_WEEKLY_TOTAL)}<br>` +
        `<strong>Écart :</strong> ${spanDelta(weeklyDelta)}`;
    }
    const historyDiv = document.getElementById("history");
    if (historyDiv) historyDiv.innerHTML = html;
  }

  // ---------- Sélecteur Mois ----------
  function populateMonthSelect() {
    const data = getStoredData();
    const select = document.getElementById("monthSelect");
    if (!select) return;
    const months = new Set();
    for (const date in data) if (date.length === 10) months.add(date.slice(0,7));
    select.innerHTML = "";
    [...months].sort().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = monthLabel(m);
      select.appendChild(opt);
    });
    const current = new Date().toISOString().slice(0,7);
    if (months.has(current)) select.value = current;
  }

  // ---------- MOIS (groupé par semaines) ----------
  let myChart;
  function drawChart(labels, below, base, over) {
    const canvas = document.getElementById("chartCanvas");
    if (!canvas) return;
    if (myChart) myChart.destroy();
    const ctx = canvas.getContext("2d");
    myChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "En-dessous 8h30", data: below, backgroundColor: "#d32f2f" },
          { label: "Objectif 8h30",   data: base,  backgroundColor: "#4CAF50" },
          { label: "Surplus",         data: over,  backgroundColor: "#FFC107" }
        ]
      },
      options: { responsive:true, scales:{ y:{ beginAtZero:true, suggestedMax:10 } } }
    });
  }

  function renderMonth() {
    const select = document.getElementById("monthSelect");
    if (!select) return;
    const ym = select.value;
    const data = getStoredData();

    // Grouper par semaine ISO
    const groups = {};
    let monthTotal = 0; let workedDays = 0;

    const chartLabels = []; const below=[]; const base=[]; const over=[];

    Object.keys(data).filter(d => d.startsWith(ym)).sort().forEach(date => {
      const e = data[date];
      const dow = new Date(date).getDay();
      if (dow < 1 || dow > 5) return; // Lun-Ven

      const wk = getISOWeekKey(date);
      (groups[wk] ||= []).push({ date, ...e });

      monthTotal += e.workedHours; workedDays++;

      // graph jour par jour
      chartLabels.push(date);
      if (e.workedHours < THEO_HOURS_PER_DAY) {
        below.push(e.workedHours); base.push(0); over.push(0);
      } else {
        below.push(0); base.push(THEO_HOURS_PER_DAY); over.push(e.workedHours - THEO_HOURS_PER_DAY);
      }
    });

    // Résumé du mois
    const theoMonth = workedDays * THEO_HOURS_PER_DAY;
    const monthDelta = monthTotal - theoMonth;
    const monthlyTotalDiv = document.getElementById("monthlyTotal");
    if (monthlyTotalDiv) {
      monthlyTotalDiv.innerHTML =
        `<strong>Total mois :</strong> ${toHourFormat(monthTotal)} sur ${toHourFormat(theoMonth)} — ` +
        `<strong>Écart :</strong> ${spanDelta(monthDelta)}`;
    }

    // Collapsibles semaines
    const monthlyHistory = document.getElementById("monthlyHistory");
    if (monthlyHistory) {
      monthlyHistory.innerHTML = Object.keys(groups).sort().map(isoWk => {
        const days = groups[isoWk];
        const worked = days.reduce((s,d)=>s+d.workedHours,0);
        const theo   = days.length * THEO_HOURS_PER_DAY;
        const delta  = worked - theo;

        const lines = days.map(d =>
          `<div class="entry-line">
             <strong>${d.date} (${getDayName(d.date)})</strong> :
             ${d.arrival} → ${d.departure} | ${toHourFormat(d.workedHours)} (${spanDelta(d.delta)})
             <button onclick="modifyDay('${d.date}')">✏️ Modifier</button>
             <button onclick="deleteDay('${d.date}')">🗑 Supprimer</button>
           </div>`).join("");

        return `
          <details>
            <summary>${weekLabel(isoWk)} — ${toHourFormat(worked)} sur ${toHourFormat(theo)} (${spanDelta(delta)})</summary>
            <div class="details-body">${lines}</div>
          </details>`;
      }).join("") || "<div class='entry-line'>Aucune donnée pour ce mois.</div>";
    }

    drawChart(chartLabels, below, base, over);
    renderAnnualTotal();
    renderYear();
  }

  // ---------- ANNUEL (groupé par mois → semaines) ----------
  function renderYear() {
    const data = getStoredData();
    const yearNow = new Date().getFullYear();
    const perMonth = {}; // { 'YYYY-MM': { 'YYYY-Www': [entries...] } }

    Object.keys(data).sort().forEach(date => {
      const d = new Date(date);
      if (d.getFullYear() !== yearNow) return;
      const dow = d.getDay();
      if (dow < 1 || dow > 5) return;

      const ym = date.slice(0,7);
      const wk = getISOWeekKey(date);
      perMonth[ym] ||= {};
      perMonth[ym][wk] ||= [];
      perMonth[ym][wk].push({ date, ...data[date] });
    });

    const yearHistory = document.getElementById("yearHistory");
    if (!yearHistory) return;

    yearHistory.innerHTML = Object.keys(perMonth).sort().map(ym => {
      // résumé du mois
      const weeks = perMonth[ym];
      let monthWorked = 0, monthTheo = 0;

      const weeksHtml = Object.keys(weeks).sort().map(isoWk => {
        const days = weeks[isoWk];
        const worked = days.reduce((s,d)=>s+d.workedHours,0);
        const theo   = days.length * THEO_HOURS_PER_DAY;
        const delta  = worked - theo;

        monthWorked += worked; monthTheo += theo;

        const daysHtml = days.map(d =>
          `<div class="entry-line">
             <strong>${d.date} (${getDayName(d.date)})</strong> :
             ${d.arrival} → ${d.departure} | ${toHourFormat(d.workedHours)} (${spanDelta(d.delta)})
           </div>`).join("");

        return `
          <details>
            <summary>${weekLabel(isoWk)} — ${toHourFormat(worked)} sur ${toHourFormat(theo)} (${spanDelta(delta)})</summary>
            <div class="details-body">${daysHtml}</div>
          </details>`;
      }).join("");

      const monthSummary = `${toHourFormat(monthWorked)} sur ${toHourFormat(monthTheo)} (${spanDelta(monthWorked - monthTheo)})`;

      return `
        <details>
          <summary>${monthLabel(ym)} — ${monthSummary}</summary>
          <div class="details-body">${weeksHtml || "<div class='entry-line'>Aucune donnée cette période.</div>"}</div>
        </details>`;
    }).join("") || "<div class='entry-line'>Aucune donnée pour cette année.</div>";
  }

  // ---------- Total annuel global ----------
  function renderAnnualTotal() {
    const data = getStoredData();
    let total = 0, workdayCount = 0;
    const yearNow = new Date().getFullYear();

    for (const date in data) {
      const d = new Date(date);
      if (d.getFullYear() === yearNow && d.getDay() >= 1 && d.getDay() <= 5) {
        total += data[date].workedHours;
        workdayCount++;
      }
    }
    const theo = workdayCount * THEO_HOURS_PER_DAY;
    const delta = total - theo;
    const el = document.getElementById("annualTotal");
    if (el) el.innerHTML =
      `<strong>Année ${yearNow}</strong><br>` +
      `Heures travaillées : ${toHourFormat(total)} sur ${toHourFormat(theo)} — ` +
      `<strong>Écart :</strong> ${spanDelta(delta)}`;
  }

  // ---------- Export / Import CSV ----------
  function exportCSV() {
    const data = getStoredData();
    const rows = [["Date","Heure arrivée","Heure départ","Heures travaillées (h déc)","Écart (h déc)"]];
    for (const date of Object.keys(data).sort()) {
      const e = data[date];
      rows.push([date, e.arrival, e.departure, e.workedHours, e.delta]);
    }
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "peli-tracking.csv";
    a.click();
  }
  function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const lines = content.split("\n").slice(1);
      const data = {};
      lines.forEach(line => {
        const [date, arrival, departure, workedHours, delta] = line.split(";");
        if (date && arrival && departure)
          data[date] = { arrival, departure, workedHours: parseFloat(workedHours), delta: parseFloat(delta) };
      });
      saveStoredData(data);
      renderWeek(); populateMonthSelect(); renderMonth(); renderYear(); renderAnnualTotal();
    };
    reader.readAsText(file);
  }

  // ---------- Expose ----------
  window.saveHours = saveHours;
  window.deleteDay = deleteDay;
  window.modifyDay = modifyDay;
  window.renderMonth = renderMonth;
  window.exportCSV = exportCSV;
  window.importCSV = importCSV;

  // ---------- Démarrage ----------
  renderWeek();
  populateMonthSelect();
  renderMonth();
  renderYear();
  renderAnnualTotal();
});
