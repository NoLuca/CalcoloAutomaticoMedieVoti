// ==UserScript==
// @name         Media Materie Bearzi
// @namespace    https://gesco.bearzi.it/
// @version      3.8
// @description  Medie, grafici e andamento voti Bearzi
// @match        https://gesco.bearzi.it/secure/scuola/famiglie/allievo/28455/valutazioni-tabella
// @run-at       document-end
// @grant        none
//
// @connect      raw.githubusercontent.com
// @downloadURL  https://raw.githubusercontent.com/NoLuca/CalcoloAutomaticoMedieVoti/main/bearzi-medie.user.js
// @updateURL    https://raw.githubusercontent.com/NoLuca/CalcoloAutomaticoMedieVoti/main/bearzi-medie.user.js
// ==/UserScript==

(function () {
    'use strict';

    function loadChartJS(cb) {
        if (window.Chart) return cb();
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/chart.js";
        s.onload = cb;
        document.head.appendChild(s);
    }

    function votoColor(v) {
        if (v < 4.5) return "#e74c3c";
        if (v < 6) return "#f1c40f";
        return "#2ecc71";
    }

    function estraiVoti() {
    // ⚠️ Array vero, così possiamo invertirlo
    const celle = Array.from(
        document.querySelectorAll("td[data-valutazione][data-peso]")
    ).reverse(); // ⬅️ QUI l’inversione temporale

    const perMateria = {};
    const timeline = [];

    celle.forEach((td, i) => {
        const voto = parseFloat(td.dataset.valutazione);
        const peso = parseFloat(td.dataset.peso);
        if (isNaN(voto) || isNaN(peso)) return;

        const riga = td.closest("tr");
        const materia = riga?.querySelector("td.align-middle, td")?.innerText.trim();
        if (!materia) return;

        if (!perMateria[materia]) perMateria[materia] = [];
        perMateria[materia].push(voto);

        timeline.push({ voto, peso, index: i + 1 });
    });

    return { perMateria, timeline };
}


function creaBox(medie, mediaGen) {

    // --- calcolo buche ---
    const buche = Object.entries(medie)
        .filter(([_, v]) => v < 5.5)
        .sort((a, b) => a[1] - b[1]); // dalla peggiore

    let html = `
    <div style="display:flex;justify-content:space-between;align-items:center">
        <b>📊 Medie</b>
        <button id="closeBox" style="
            background:none;
            border:none;
            color:#aaa;
            font-size:18px;
            cursor:pointer
        ">✕</button>
    </div>

    <table style="width:100%;margin-top:6px">`;

    for (const m in medie) {
        html += `
        <tr>
          <td>${m}</td>
          <td style="text-align:right;color:${votoColor(medie[m])}">
            <b>${medie[m].toFixed(2)}</b>
          </td>
        </tr>`;
    }

    html += `</table><hr>`;

    // --- sezione buche ---
    if (buche.length > 0) {
        html += `
        <div style="margin-bottom:6px">
            <div style="font-size:15px;color:#e74c3c">
                ⚠ Buche: <b>${buche.length}</b>
            </div>
            <div style="font-size:13px;color:#ddd">
                ${buche.map(([m, v]) => `${m} (${v.toFixed(2)})`).join(", ")}
            </div>
        </div>
        <hr>`;
    }

    html += `
    <div style="text-align:center;font-size:16px;color:${votoColor(mediaGen)}">
      Media generale: <b>${mediaGen.toFixed(2)}</b>
    </div>

    <button id="graficiBtn" style="width:100%;margin-top:8px">
        📈 Grafici
    </button>`;

    let box = document.getElementById("bearzi-box");
    const isNew = !box;

    if (!box) {
        box = document.createElement("div");
        box.id = "bearzi-box";
        box.style = `
            position: fixed;
            top: 80px;
            right: 15px;
            width: 320px;
            background: #1e1e1e;
            color: #fff;
            padding: 12px;
            border-radius: 12px;
            z-index: 99999;
            font-family: system-ui;
            box-shadow: 0 10px 30px rgba(0,0,0,.4);
            transform: scale(0.85);
            opacity: 0;
            transition: transform .35s ease, opacity .35s ease;
        `;
        document.body.appendChild(box);
    }

    box.innerHTML = html;

    if (isNew || box.style.display === "none") {
        box.style.display = "block";
        requestAnimationFrame(() => {
            box.style.transform = "scale(1)";
            box.style.opacity = "1";
        });
    }

    box.querySelector("#closeBox").onclick = () => {
        box.style.transform = "scale(0.85)";
        box.style.opacity = "0";
        setTimeout(() => {
            box.style.display = "none";
            document.getElementById("openBearziBox").style.display = "block";
        }, 300);
    };

    let openBtn = document.getElementById("openBearziBox");
    if (!openBtn) {
        openBtn = document.createElement("button");
        openBtn.id = "openBearziBox";
        openBtn.textContent = "📊 Medie";
        openBtn.style = `
            position: fixed;
            top: 80px;
            right: 15px;
            background: #3498db;
            color: #fff;
            border: none;
            padding: 8px 12px;
            border-radius: 20px;
            cursor: pointer;
            z-index: 99998;
            display: none;
            box-shadow: 0 4px 12px rgba(0,0,0,.3);
            transition: transform .25s ease;
        `;
        openBtn.onmouseenter = () => openBtn.style.transform = "scale(1.05)";
        openBtn.onmouseleave = () => openBtn.style.transform = "scale(1)";
        openBtn.onclick = () => {
            openBtn.style.display = "none";
            box.style.display = "block";
            requestAnimationFrame(() => {
                box.style.transform = "scale(1)";
                box.style.opacity = "1";
            });
        };
        document.body.appendChild(openBtn);
    }
}



    function mostraGrafici(dati, timeline) {
        loadChartJS(() => {
            const modal = document.createElement("div");
            modal.style = `
                position:fixed;inset:0;
                background:rgba(0,0,0,.6);
                display:flex;align-items:center;justify-content:center;
                z-index:100000;
            `;

            modal.innerHTML = `
                  <div style="
                        background:#fff;
                        padding:20px;
                        border-radius:14px;
                        width:700px;
                        position:relative;
                    ">
                    
                    <!-- ❌ X di chiusura -->
                    <button id="closeModal" style="
                        position:absolute;
                        top:10px;
                        right:12px;
                        background:none;
                        border:none;
                        font-size:20px;
                        cursor:pointer;
                        color:#666;
                    ">✕</button>
                
                    <canvas id="mediaGen"></canvas>
                    <hr>
                    <select id="materiaSel" style="margin-bottom:8px;width:100%"></select>
                    <canvas id="materiaChart"></canvas>
                  </div>
                `;

            document.body.appendChild(modal);

            // MEDIA GENERALE NEL TEMPO
            let cum = 0, peso = 0;
            const mg = timeline.map(t => {
                cum += t.voto * t.peso;
                peso += t.peso;
                return cum / peso;
            });

            new Chart(document.getElementById("mediaGen"), {
                type: "line",
                data: {
                    labels: mg.map((_, i) => i + 1),
                    datasets: [{
                        label: "Media generale",
                        data: mg,
                        borderColor: "#3498db",
                        tension: 0.4,
                        fill: false
                    }]
                }
            });

            // PER MATERIA
            const sel = modal.querySelector("#materiaSel");
            Object.keys(dati).forEach(m => {
                const o = document.createElement("option");
                o.value = m;
                o.textContent = m;
                sel.appendChild(o);
            });

            let chart;
            function drawMateria(m) {
                if (chart) chart.destroy();
                chart = new Chart(document.getElementById("materiaChart"), {
                    type: "line",
                    data: {
                        labels: dati[m].map((_, i) => i + 1),
                        datasets: [{
                            label: m,
                            data: dati[m],
                            borderColor: votoColor(
                                dati[m].reduce((a, b) => a + b, 0) / dati[m].length
                            ),
                            tension: 0.4,
                            pointBackgroundColor: dati[m].map(votoColor)
                        }]
                    }
                });
            }

            drawMateria(sel.value);
            sel.onchange = () => drawMateria(sel.value);
            // chiusura modal
            modal.querySelector("#closeModal").onclick = () => modal.remove();
            
            // chiudi cliccando sullo sfondo
            modal.onclick = e => {
                if (e.target === modal) modal.remove();
            };
        });
    }

    function avvia() {
        const { perMateria, timeline } = estraiVoti();
        if (!Object.keys(perMateria).length) return false;

        const medie = {};
        for (const m in perMateria)
            medie[m] = perMateria[m].reduce((a, b) => a + b, 0) / perMateria[m].length;

        const mediaGen =
            timeline.reduce((s, x) => s + x.voto * x.peso, 0) /
            timeline.reduce((s, x) => s + x.peso, 0);

        creaBox(medie, mediaGen);
        document.getElementById("graficiBtn").onclick =
            () => mostraGrafici(perMateria, timeline);

        return true;
    }

    let t = 0;
    const timer = setInterval(() => {
        if (avvia() || ++t > 15) clearInterval(timer);
    }, 500);
})();




