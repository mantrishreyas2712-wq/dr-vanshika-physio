// API Configuration
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

let authToken = localStorage.getItem('adminToken');

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        verifyToken();
    } else {
        showLogin();
    }
});

// Show login form
function showLogin() {
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('dashboardSection').style.display = 'none';

    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', handleLogin);
}

// Show dashboard
function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadAppointments();
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();

    const form = e.target;
    const loginMessage = document.getElementById('loginMessage');
    const submitButton = form.querySelector('button[type="submit"]');
    const btnText = submitButton.querySelector('.btn-text');
    const btnLoader = submitButton.querySelector('.btn-loader');

    const credentials = {
        username: form.username.value,
        password: form.password.value
    };

    submitButton.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline';
    loginMessage.style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(credentials)
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            localStorage.setItem('adminToken', authToken);
            showDashboard();
        } else {
            showMessage(loginMessage, data.message || 'Invalid credentials', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showMessage(loginMessage, 'Login failed. Please try again.', 'error');
    } finally {
        submitButton.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Verify token
async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            showDashboard();
        } else {
            localStorage.removeItem('adminToken');
            authToken = null;
            showLogin();
        }
    } catch (error) {
        console.error('Token verification error:', error);
        showLogin();
    }
}

// Logout
function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    showLogin();
}

// Load appointments
async function loadAppointments() {
    try {
        const response = await fetch(`${API_URL}/appointments`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const appointments = await response.json();
            updateStats(appointments);
            renderAppointments(appointments);
        } else {
            console.error('Failed to load appointments');
        }
    } catch (error) {
        console.error('Error loading appointments:', error);
    }
}

// Update statistics
function updateStats(appointments) {
    const today = new Date().toISOString().split('T')[0];

    const stats = {
        total: appointments.length,
        pending: appointments.filter(a => a.status === 'pending').length,
        confirmed: appointments.filter(a => a.status === 'confirmed').length,
        today: appointments.filter(a => a.date === today).length
    };

    document.getElementById('totalAppointments').textContent = stats.total;
    document.getElementById('pendingAppointments').textContent = stats.pending;
    document.getElementById('confirmedAppointments').textContent = stats.confirmed;
    document.getElementById('todayAppointments').textContent = stats.today;
}

// Render appointments table
function renderAppointments(appointments) {
    const tbody = document.getElementById('appointmentsTableBody');

    if (appointments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #999;">
                    No appointments found
                </td>
            </tr>
        `;
        return;
    }

    // Sort by date (newest first)
    appointments.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateB - dateA;
    });

    tbody.innerHTML = appointments.map(appointment => `
        <tr>
            <td>${formatDate(appointment.date)}</td>
            <td>${formatTime(appointment.time)}</td>
            <td><strong>${appointment.patient_name}</strong><br>${appointment.email}</td>
            <td>${appointment.phone}</td>
            <td>${formatService(appointment.service)}</td>
            <td><span class="status-badge status-${appointment.status}">${appointment.status}</span></td>
            <td>
                <div class="action-buttons">
                    ${appointment.status === 'pending' ? `
                        <button class="btn-small btn-confirm" onclick="updateStatus(${appointment.id}, 'confirmed')">Confirm</button>
                    ` : ''}
                    ${appointment.status !== 'cancelled' ? `
                        <button class="btn-small btn-cancel" onclick="updateStatus(${appointment.id}, 'cancelled')">Cancel</button>
                    ` : ''}
                    ${appointment.status === 'confirmed' ? `
                        <button class="btn-small" style="background: var(--primary); color: white;" onclick="updateStatus(${appointment.id}, 'completed')">Complete</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Update appointment status
async function updateStatus(appointmentId, newStatus) {
    if (!confirm(`Are you sure you want to ${newStatus} this appointment?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            loadAppointments(); // Reload appointments
        } else {
            alert('Failed to update appointment status');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        alert('Failed to update appointment status');
    }
}

// Helper functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
}

function formatService(service) {
    const serviceMap = {
        'musculoskeletal': 'Musculoskeletal Therapy',
        'sports': 'Sports Rehabilitation',
        'pain': 'Pain Management',
        'post-surgical': 'Post-Surgical Rehab',
        'geriatric': 'Geriatric Care',
        'strengthening': 'Strengthening Program',
        'other': 'Other'
    };
    return serviceMap[service] || service;
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `form-message ${type}`;
    element.style.display = 'block';
}

// Auto-refresh appointments every 30 seconds
setInterval(() => {
    if (authToken && document.getElementById('dashboardSection').style.display === 'block') {
        loadAppointments();
    }
}, 30000);
