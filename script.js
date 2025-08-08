window.addEventListener("DOMContentLoaded", function () {
  const THEO_HOURS_PER_DAY = 8.5;
  const THEO_WEEKLY_TOTAL = 5 * THEO_HOURS_PER_DAY;

  document.getElementById("date").value = new Date().toISOString().slice(0, 10);

  function getStoredData() {
    return JSON.parse(localStorage.getItem("heures") || "{}");
  }

  function saveStoredData(data) {
    localStorage.setItem("heures", JSON.stringify(data));
  }

  function toHourFormat(value) {
    const h = Math.floor(value);
    const m = Math.round((value - h) * 60);
    return `${h}h${m.toString().padStart(2, "0")}`;
  }

  function saveHours() {
    const date = document.getElementById("date").value;
    const arrival = document.getElementById("arrival").value;
    const departure = document.getElementById("departure").value;

    if (!arrival || !departure || !date) {
      alert("Merci de remplir la date, l’heure d’arrivée et de départ.");
      return;
    }

    const allData = getStoredData();
    if (allData[date] && !confirm("Une entrée existe déjà pour ce jour. Voulez-vous vraiment la modifier ?")) {
      return;
    }

    const start = new Date(`1970-01-01T${arrival}`);
    const end = new Date(`1970-01-01T${departure}`);
    const diff = (end - start) / 1000 / 60 / 60;
    const workedHours = parseFloat((diff - 1).toFixed(2));
    const delta = parseFloat((workedHours - THEO_HOURS_PER_DAY).toFixed(2));

    allData[date] = { arrival, departure, workedHours, delta };
    saveStoredData(allData);

    renderWeek();
    populateMonthSelect();
    renderMonth();
  }

  function deleteDay(date) {
    if (confirm(`Supprimer les données du ${date} ?`)) {
      const data = getStoredData();
      delete data[date];
      saveStoredData(data);
      renderWeek();
      renderMonth();
    }
  }

  function modifyDay(date) {
    const data = getStoredData();
    if (data[date]) {
      document.getElementById("date").value = date;
      document.getElementById("arrival").value = data[date].arrival;
      document.getElementById("departure").value = data[date].departure;
    }
  }

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

  function getDayName(dateStr) {
    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
    const date = new Date(dateStr);
    return days[date.getDay()];
  }

  function renderWeek() {
    const data = getStoredData();
    const weekDates = getWeekDates();
    let html = "";
    let total = 0;

    weekDates.forEach(date => {
      const entry = data[date];
      if (entry) {
        html += `<div><strong>${date} (${getDayName(date)})</strong> : ${entry.arrival} → ${entry.departure} | ${toHourFormat(entry.workedHours)} (${entry.delta >= 0 ? "+" : ""}${toHourFormat(Math.abs(entry.delta))}) 
          <button onclick="modifyDay('${date}')">✏️ Modifier</button>
          <button onclick="deleteDay('${date}')">🗑 Supprimer</button>
        </div>`;
        total += entry.workedHours;
      } else {
        html += `<div><strong>${date} (${getDayName(date)})</strong> : —</div>`;
      }
    });

    const weeklyDelta = total - THEO_WEEKLY_TOTAL;
    document.getElementById("history").innerHTML = html;
  }

  function populateMonthSelect() {
    const data = getStoredData();
    const select = document.getElementById("monthSelect");
    select.innerHTML = "";
    const months = new Set();

    for (const date in data) {
      if (date && date.length === 10) {
        const [year, month] = date.split("-");
        months.add(`${year}-${month}`);
      }
    }

    [...months].sort().forEach(m => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = formatMonthLabel(m);
      select.appendChild(option);
    });

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (months.has(currentMonth)) {
      select.value = currentMonth;
    }
  }

  function formatMonthLabel(str) {
    const [year, month] = str.split("-");
    const mois = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
    return `${mois[parseInt(month) - 1]} ${year}`;
  }

  function renderMonth() {
    const selectedMonth = document.getElementById("monthSelect").value;
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
        html += `<div><strong>${date} (${getDayName(date)})</strong> : ${entry.arrival} → ${entry.departure} | ${toHourFormat(entry.workedHours)} (${entry.delta >= 0 ? "+" : ""}${toHourFormat(Math.abs(entry.delta))}) 
          <button onclick="modifyDay('${date}')">✏️ Modifier</button>
          <button onclick="deleteDay('${date}')">🗑 Supprimer</button>
        </div>`;
        total += entry.workedHours;
        workdayCount++;

        chartLabels.push(date);

        const worked = entry.workedHours;
        if (worked < THEO_HOURS_PER_DAY) {
          belowTarget.push(worked);
          reachedTarget.push(0);
          aboveTarget.push(0);
        } else {
          belowTarget.push(0);
          reachedTarget.push(THEO_HOURS_PER_DAY);
          aboveTarget.push(worked - THEO_HOURS_PER_DAY);
        }
      }
    });

    const theoMonth = workdayCount * THEO_HOURS_PER_DAY;
    const delta = total - theoMonth;

    document.getElementById("monthlyHistory").innerHTML = html || "Aucune donnée";
    document.getElementById("monthlyTotal").innerHTML =
      `<strong>Total :</strong> ${toHourFormat(total)} sur ${toHourFormat(theoMonth)}<br>` +
      `<strong>Écart :</strong> ${delta >= 0 ? "+" : ""}${toHourFormat(Math.abs(delta))}`;

    drawChart(chartLabels, belowTarget, reachedTarget, aboveTarget);
    renderAnnualTotal();
  }

  let myChart;
  function drawChart(labels, below, base, over) {
    if (myChart) myChart.destroy();
    const ctx = document.getElementById("chartCanvas").getContext("2d");
    myChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "En-dessous 8h30", data: below, backgroundColor: "#f44336" },
          { label: "Objectif atteint", data: base, backgroundColor: "#4CAF50" },
          { label: "Surplus", data: over, backgroundColor: "#FFC107" }
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, suggestedMax: 10 }
        }
      }
    });
  }

  function renderAnnualTotal() {
    const data = getStoredData();
    let total = 0;
    let workdayCount = 0;

    for (const date in data) {
      const d = new Date(date);
      if (d.getFullYear() === new Date().getFullYear() && d.getDay() >= 1 && d.getDay() <= 5) {
        total += data[date].workedHours;
        workdayCount++;
      }
    }

    const theoAnnual = workdayCount * THEO_HOURS_PER_DAY;
    const delta = total - theoAnnual;

    document.getElementById("annualTotal").innerHTML =
      `<strong>Année ${new Date().getFullYear()}</strong><br>` +
      `Heures travaillées : ${toHourFormat(total)} sur ${toHourFormat(theoAnnual)}<br>` +
      `Écart : ${delta >= 0 ? "+" : ""}${toHourFormat(Math.abs(delta))}`;
  }

  function exportCSV() {
    const data = getStoredData();
    const rows = [["Date", "Heure arrivée", "Heure départ", "Heures travaillées", "Écart"]];
    for (const date in data) {
      const entry = data[date];
      rows.push([date, entry.arrival, entry.departure, entry.workedHours, entry.delta]);
    }

    const csvContent = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "peli-tracking.csv";
    a.click();
  }

  function importCSV(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
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
      renderWeek();
      populateMonthSelect();
      renderMonth();
    };
    reader.readAsText(file);
  }

  // Expose functions globally
  window.saveHours = saveHours;
  window.deleteDay = deleteDay;
  window.modifyDay = modifyDay;
  window.renderMonth = renderMonth;
  window.exportCSV = exportCSV;
  window.importCSV = importCSV;

  // Init
  renderWeek();
  populateMonthSelect();
  renderMonth();
});
