// ==UserScript==
// @name         Media Materie Bearzi
// @namespace    https://gesco.bearzi.it/
// @version      3.5
// @description  Medie, grafici e andamento voti Bearzi
// @match        https://gesco.bearzi.it/secure/scuola/famiglie/allievo/28455/valutazioni-tabella
// @run-at       document-end
// @grant        none
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
        const celle = document.querySelectorAll("td[data-valutazione][data-peso]");
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
        let html = `<b>📊 Medie</b><table style="width:100%;margin-top:6px">`;

        for (const m in medie) {
            html += `
            <tr>
              <td>${m}</td>
              <td style="text-align:right;color:${votoColor(medie[m])}">
                <b>${medie[m].toFixed(2)}</b>
              </td>
            </tr>`;
        }

        html += `</table><hr>
        <div style="text-align:center;font-size:16px;color:${votoColor(mediaGen)}">
          Media generale: <b>${mediaGen.toFixed(2)}</b>
        </div>
        <button id="graficiBtn" style="width:100%;margin-top:8px">📈 Grafici</button>`;

        let box = document.getElementById("bearzi-box");
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
            `;
            document.body.appendChild(box);
        }

        box.innerHTML = html;
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
              <div style="background:#fff;padding:20px;border-radius:14px;width:700px">
                <canvas id="mediaGen"></canvas>
                <hr>
                <select id="materiaSel"></select>
                <canvas id="materiaChart"></canvas>
                <button id="close">Chiudi</button>
              </div>`;

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
            modal.querySelector("#close").onclick = () => modal.remove();
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
