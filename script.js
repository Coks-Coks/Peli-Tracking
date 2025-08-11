window.addEventListener("DOMContentLoaded", function () {
  // --- Constantes ---
  const THEO_HOURS_PER_DAY = 8.5;            // 8h30 en décimal
  const THEO_WEEKLY_TOTAL  = 5 * THEO_HOURS_PER_DAY;

  // --- Helpers de stockage ---
  function getStoredData() {
    return JSON.parse(localStorage.getItem("heures") || "{}");
  }
  function saveStoredData(data) {
    localStorage.setItem("heures", JSON.stringify(data));
  }

  // --- Helpers d'affichage (toujours en h:mm) ---
  function toHourFormat(value) {
    // value est en heures décimales -> h:mm
    const h = Math.floor(Math.abs(value));
    const m = Math.round((Math.abs(value) - h) * 60);
    return `${h}h${String(m).padStart(2, "0")}`;
  }
  function formatSignedHours(value) {
    // +8h30 / -0h15 avec le bon signe
    const sign = value >= 0 ? "+" : "-";
    return `${sign}${toHourFormat(value)}`;
  }
  function spanDelta(value) {
    const cls = value >= 0 ? "delta plus" : "delta minus";
    return `<span class="${cls}">${formatSignedHours(value)}</span>`;
  }

  // --- Initialiser la date du jour dans le champ date ---
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  // --- Enregistrer / modifier une journée ---
  function saveHours() {
    const date = document.getElementById("date").value;
    const arrival = document.getElementById("arrival").value;
    const departure = document.getElementById("departure").value;
    if (!arrival || !departure || !date) {
      alert("Merci de remplir la date, l’heure d’arrivée et de départ.");
      return;
    }

    const allData = getStoredData();
    if (allData[date] && !confirm("Une entrée existe déjà pour ce jour. Voulez-vous vraiment la modifier ?"))
      return;

    const start = new Date(`1970-01-01T${arrival}`);
    const end   = new Date(`1970-01-01T${departure}`);
    const diffHours = (end - start) / 1000 / 60 / 60;   // en heures décimales
    const workedHours = Number((diffHours - 1).toFixed(3)); // -1h de pause
    const delta = Number((workedHours - THEO_HOURS_PER_DAY).toFixed(3));

    allData[date] = { arrival, departure, workedHours, delta };
    saveStoredData(allData);

    renderWeek();
    populateMonthSelect();
    renderMonth();
  }

  function deleteDay(date) {
    if (!confirm(`Supprimer les données du ${date} ?`)) return;
    const data = getStoredData();
    delete data[date];
    saveStoredData(data);
    renderWeek();
    renderMonth();
  }

  function modifyDay(date) {
    const data = getStoredData();
    if (!data[date]) return;
    document.getElementById("date").value = date;
    document.getElementById("arrival").value = data[date].arrival;
    document.getElementById("departure").value = data[date].departure;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- Helpers de dates ---
  function getWeekDates() {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Lundi
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
  function getDayName(dateStr) {
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    return days[new Date(dateStr).getDay()];
  }

  // --- Rendu SEMAINE ---
  function renderWeek() {
    const data = getStoredData();
    const weekDates = getWeekDates();
    let html = "";
    let total = 0;

    weekDates.forEach(date => {
      const entry = data[date];
      if (entry) {
        html += `
        <div>
          <strong>${date} (${getDayName(date)})</strong> :
          ${entry.arrival} → ${entry.departure}
          | ${toHourFormat(entry.workedHours)}
          (${spanDelta(entry.delta)})
          <button onclick="modifyDay('${date}')">✏️ Modifier</button>
          <button onclick="deleteDay('${date}')">🗑 Supprimer</button>
        </div>`;
        total += entry.workedHours;
      } else {
        html += `<div><strong>${date} (${getDayName(date)})</strong> : —</div>`;
      }
    });

    const weeklyDelta = total - THEO_WEEKLY_TOTAL;
    const weeklyTotalDiv = document.getElementById("weeklyTotal");
    if (weeklyTotalDiv) {
      weeklyTotalDiv.innerHTML =
        `<strong>Total semaine :</strong> ${toHourFormat(total)} sur ${toHourFormat(THEO_WEEKLY_TOTAL)}<br>` +
        `<strong>Écart :</strong> ${spanDelta(weeklyDelta)}`;
    }
    document.getElementById("history").innerHTML = html;
  }

  // --- Sélecteur de mois ---
  function populateMonthSelect() {
    const data = getStoredData();
    const select = document.getElementById("monthSelect");
    if (!select) return;
    const months = new Set();

    for (const date in data) {
      if (date && date.length === 10) {
        const [y, m] = date.split("-");
        months.add(`${y}-${m}`);
      }
    }
    select.innerHTML = "";
    [...months].sort().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      select.appendChild(opt);
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (months.has(currentMonth)) select.value = currentMonth;
  }
  function formatMonthLabel(str) {
    const [year, month] = str.split("-");
    const mois = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    return `${mois[parseInt(month) - 1]} ${year}`;
  }

  // --- Rendu MOIS + Graph ---
  let myChart;
  function drawChart(labels, below, base, over) {
    if (!document.getElementById("chartCanvas")) return;
    if (myChart) myChart.destroy();
    const ctx = document.getElementById("chartCanvas").getContext("2d");
    myChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "En-dessous 8h30", data: below, backgroundColor: "#d32f2f" }, // rouge
          { label: "Objectif atteint (8h30)", data: base, backgroundColor: "#4CAF50" }, // vert
          { label: "Surplus", data: over, backgroundColor: "#FFC107" } // jaune
        ]
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true, suggestedMax: 10 } }
      }
    });
  }

  function renderMonth() {
    const select = document.getElementById("monthSelect");
    if (!select) return;
    const selectedMonth = select.value;
    const data = getStoredData();

    let html = "";
    let total = 0;
    let workdayCount = 0;

    const chartLabels = [];
    const belowTarget = [];
    const reachedTarget = [];
    const aboveTarget = [];

    const dates = Object.keys(data).filter(d => d.startsWith(selectedMonth)).sort();
    dates.forEach(date => {
      const entry = data[date];
      const day = new Date(date).getDay();
      if (day >= 1 && day <= 5) {
        html += `
        <div>
          <strong>${date} (${getDayName(date)})</strong> :
          ${entry.arrival} → ${entry.departure}
          | ${toHourFormat(entry.workedHours)}
          (${spanDelta(entry.delta)})
          <button onclick="modifyDay('${date}')">✏️ Modifier</button>
          <button onclick="deleteDay('${date}')">🗑 Supprimer</button>
        </div>`;
        total += entry.workedHours;
        workdayCount++;

        // Données pour la barre empilée
        const w = entry.workedHours;
        chartLabels.push(date);
        if (w < THEO_HOURS_PER_DAY) {
          belowTarget.push(w);
          reachedTarget.push(0);
          aboveTarget.push(0);
        } else {
          belowTarget.push(0);
          reachedTarget.push(THEO_HOURS_PER_DAY);
          aboveTarget.push(w - THEO_HOURS_PER_DAY);
        }
      }
    });

    document.getElementById("monthlyHistory").innerHTML = html || "Aucune donnée";
    const theoMonth = workdayCount * THEO_HOURS_PER_DAY;
    const delta = total - theoMonth;
    const monthlyTotalDiv = document.getElementById("monthlyTotal");
    if (monthlyTotalDiv) {
      monthlyTotalDiv.innerHTML =
        `<strong>Total :</strong> ${toHourFormat(total)} sur ${toHourFormat(theoMonth)}<br>` +
        `<strong>Écart :</strong> ${spanDelta(delta)}`;
    }

    drawChart(chartLabels, belowTarget, reachedTarget, aboveTarget);
    renderAnnualTotal();
  }

  // --- Total ANNUEL ---
  function renderAnnualTotal() {
    const data = getStoredData();
    let total = 0;
    let workdayCount = 0;
    const yearNow = new Date().getFullYear();

    for (const date in data) {
      const d = new Date(date);
      if (d.getFullYear() === yearNow && d.getDay() >= 1 && d.getDay() <= 5) {
        total += data[date].workedHours;
        workdayCount++;
      }
    }
    const theoAnnual = workdayCount * THEO_HOURS_PER_DAY;
    const delta = total - theoAnnual;

    const annualDiv = document.getElementById("annualTotal");
    if (annualDiv) {
      annualDiv.innerHTML =
        `<strong>Année ${yearNow}</strong><br>` +
        `Heures travaillées : ${toHourFormat(total)} sur ${toHourFormat(theoAnnual)}<br>` +
        `Écart : ${spanDelta(delta)}`;
    }
  }

  // --- Export / Import CSV (inchangé, mais affiche en heures décimales pour l’Excel) ---
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
        if (date && arrival && departure) {
          data[date] = {
            arrival,
            departure,
            workedHours: parseFloat(workedHours),
            delta: parseFloat(delta)
          };
        }
      });
      saveStoredData(data);
      renderWeek(); populateMonthSelect(); renderMonth();
    };
    reader.readAsText(file);
  }

  // --- Expose global ---
  window.saveHours   = saveHours;
  window.deleteDay   = deleteDay;
  window.modifyDay   = modifyDay;
  window.renderMonth = renderMonth;
  window.exportCSV   = exportCSV;
  window.importCSV   = importCSV;

  // --- Démarrage ---
  renderWeek();
  populateMonthSelect();
  renderMonth();
});
