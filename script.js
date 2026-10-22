// --- 1. FIREBASE CONFIGURATION (REPLACE WITH YOUR KEYS) ---
const firebaseConfig = {
  apiKey: "AIzaSyDoN5Rf5KuK0cTrfROhg5dEdDVtcM8xQjY",
  authDomain: "jaltrack-3bcb2.firebaseapp.com",
  databaseURL: "https://jaltrack-3bcb2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jaltrack-3bcb2",
  storageBucket: "jaltrack-3bcb2.firebasestorage.app",
  messagingSenderId: "888789709176",
  appId: "1:888789709176:web:a03a48efc2c644dce5588d",
  measurementId: "G-4QPCFJ70P4"
};

try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.log("Firebase init note:", e);
}

// Global state variables for limits & logs
let dailyLimit = 500;
let warningThreshold = 80;
let sessionLogs = [];

// --- 2. AUTHENTICATION LOGIC ---
let isRegistering = false;

function toggleAuthMode() {
    isRegistering = !isRegistering;
    document.getElementById("auth-title").innerText = isRegistering ? "Create Account" : "JalTrack Portal";
    document.getElementById("login-form").style.display = isRegistering ? "none" : "block";
    document.getElementById("register-form").style.display = isRegistering ? "block" : "none";
}

function handleLogin() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            enterDashboard(userCredential.user.email);
        })
        .catch((error) => {
            alert("Login Failed: " + error.message);
        });
}

function handleRegister() {
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then(() => {
            alert("Account registered successfully! Please sign in.");
            toggleAuthMode();
        })
        .catch((error) => {
            alert("Registration Failed: " + error.message);
        });
}

function enterDashboard(email) {
    document.getElementById("auth-box").style.display = "none";
    document.getElementById("dashboard-box").style.display = "block";
    document.getElementById("user-email-display").innerText = email;
    setupChart();
    listenToFirebase();
}

function logoutUser() {
    firebase.auth().signOut().then(() => {
        document.getElementById("dashboard-box").style.display = "none";
        document.getElementById("auth-box").style.display = "block";
    });
}

// --- 3. TAB NAVIGATION ---
function showTab(tabName) {
    ['home', 'limits', 'reports', 'settings', 'profile'].forEach(tab => {
        document.getElementById(`tab-${tab}`).style.display = tab === tabName ? "block" : "none";
        document.getElementById(`tab-btn-${tab}`).className = tab === tabName ? "active" : "";
    });
}

// --- 4. THEME TOGGLE ---
function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById("theme-icon");
    if (body.classList.contains("light-theme")) {
        body.classList.remove("light-theme");
        body.classList.add("dark-theme");
        icon.className = "fa-solid fa-sun";
    } else {
        body.classList.remove("dark-theme");
        body.classList.add("light-theme");
        icon.className = "fa-solid fa-moon";
    }
}

// --- 5. SAVE LIMIT RULES ---
function saveLimits() {
    dailyLimit = parseFloat(document.getElementById("daily-limit-input").value) || 500;
    warningThreshold = parseFloat(document.getElementById("threshold-input").value) || 80;
    alert("Water consumption limit rules updated successfully!");
    showTab('home');
}

// --- 6. CHART.JS WAVEFORM SETUP ---
let flowChart;
function setupChart() {
    const ctx = document.getElementById("flowChart").getContext("2d");
    flowChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: [],
            datasets: [{
                label: "Flow Rate (L/min)",
                data: [],
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(200, 200, 200, 0.1)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- 7. EXPORT CSV REPORT ---
function exportCSV() {
    if (sessionLogs.length === 0) {
        alert("No historical logs recorded yet!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,Timestamp,FlowRate (L/min),TotalLitres (L)\n";
    sessionLogs.forEach(row => {
        csvContent += `${row.time},${row.flow},${row.total}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "jaltrack_historical_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 8. REAL-TIME FIREBASE DATABASE SYNC & ALERTS ---
function listenToFirebase() {
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("connection-status");
    const alertBanner = document.getElementById("alert-banner");
    const alertText = document.getElementById("alert-text");
    
    // Connection status check
    firebase.database().ref(".info/connected").on("value", (snap) => {
        if (snap.val() === true) {
            statusDot.style.background = "#10b981";
            statusText.innerText = "Online (Connected)";
        } else {
            statusDot.style.background = "#ef4444";
            statusText.innerText = "Offline";
        }
    });

    // Listen to ESP32 data path: /jaltrack/current
    const dbRef = firebase.database().ref("jaltrack/current");
    dbRef.on("value", (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const flow = Number(data.flowRate) || 0;
            const total = Number(data.totalLitres) || 0;
            const currentTime = new Date().toLocaleTimeString();

            // Update cards
            document.getElementById("flowRate-val").innerText = flow.toFixed(2);
            document.getElementById("totalLitres-val").innerText = total.toFixed(3);

            // Update Daily Progress Bar & Limits
            const percentage = Math.min((total / dailyLimit) * 100, 100);
            document.getElementById("progress-fill").style.width = percentage + "%";
            document.getElementById("progress-text").innerText = `${total.toFixed(2)} / ${dailyLimit} L (${percentage.toFixed(1)}%)`;

            // Trigger Alert Thresholds
            if (total >= dailyLimit) {
                alertBanner.style.display = "flex";
                alertText.innerText = `CRITICAL: Daily water limit of ${dailyLimit}L has been exceeded!`;
            } else if (percentage >= warningThreshold) {
                alertBanner.style.display = "flex";
                alertText.innerText = `WARNING: You have reached ${percentage.toFixed(1)}% of your daily water allowance!`;
            } else {
                alertBanner.style.display = "none";
            }

            // Append to History Table Logs
            sessionLogs.unshift({ time: currentTime, flow: flow.toFixed(2), total: total.toFixed(3) });
            if (sessionLogs.length > 50) sessionLogs.pop(); // keep last 50 logs

            const tableBody = document.querySelector("#history-table tbody");
            tableBody.innerHTML = sessionLogs.map(row => `
                <tr>
                    <td>${row.time}</td>
                    <td>${row.flow} L/min</td>
                    <td>${row.total} L</td>
                </tr>
            `).join('');

            // Update live graph
            if (flowChart.data.labels.length > 12) {
                flowChart.data.labels.shift();
                flowChart.data.datasets[0].data.shift();
            }
            flowChart.data.labels.push(currentTime);
            flowChart.data.datasets[0].data.push(flow);
            flowChart.update();
        }
    });
}