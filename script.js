/* ==========================================================================
   State & Constants
   ========================================================================== */
const DEFAULT_CATEGORIES = [
    { name: 'Food', icon: 'ph-hamburger' },
    { name: 'Groceries', icon: 'ph-shopping-cart' },
    { name: 'Snacks', icon: 'ph-cookie' },
    { name: 'Tea/Coffee', icon: 'ph-coffee' },
    { name: 'Transport', icon: 'ph-bus' },
    { name: 'PG Rent', icon: 'ph-house' },
    { name: 'Electricity', icon: 'ph-lightning' },
    { name: 'Mobile Recharge', icon: 'ph-device-mobile' },
    { name: 'Internet', icon: 'ph-wifi-high' },
    { name: 'Laundry', icon: 'ph-t-shirt' },
    { name: 'Medicine', icon: 'ph-pill' },
    { name: 'Education', icon: 'ph-books' },
    { name: 'College', icon: 'ph-student' },
    { name: 'Entertainment', icon: 'ph-film-strip' },
    { name: 'Shopping', icon: 'ph-bag' },
    { name: 'Personal Care', icon: 'ph-sparkle' },
    { name: 'Other', icon: 'ph-dots-three' }
];

let state = {
    expenses: [],
    income: [],
    categories: [...DEFAULT_CATEGORIES],
    settings: {
        budget: 12000,
        savingsGoal: 3000,
        currency: '₹',
        theme: 'light',
        userName: ''
    },
    currentView: 'dashboard',
    charts: {} // Store chart instances
};

/* ==========================================================================
   Initialization & LocalStorage
   ========================================================================== */
function init() {
    loadData();
    applyTheme(state.settings.theme);
    setupEventListeners();
    populateCategoryDropdowns();
    
    if (!state.settings.userName) {
        document.getElementById('onboarding-modal').classList.add('active');
    } else {
        renderView(state.currentView);
        setTimeout(checkSmartAlerts, 1000); // Check alerts 1s after load
    }
}

function loadData() {
    const expenses = localStorage.getItem('pg_expenses');
    const income = localStorage.getItem('pg_income');
    const categories = localStorage.getItem('pg_categories');
    const settings = localStorage.getItem('pg_settings');

    if (expenses) state.expenses = JSON.parse(expenses);
    if (income) state.income = JSON.parse(income);
    if (categories) state.categories = JSON.parse(categories);
    if (settings) state.settings = { ...state.settings, ...JSON.parse(settings) };
}

function saveData() {
    localStorage.setItem('pg_expenses', JSON.stringify(state.expenses));
    localStorage.setItem('pg_income', JSON.stringify(state.income));
    localStorage.setItem('pg_categories', JSON.stringify(state.categories));
    localStorage.setItem('pg_settings', JSON.stringify(state.settings));
}

/* ==========================================================================
   Utility Functions
   ========================================================================== */
function formatCurrency(amount) {
    // Assuming standard Indian format for ₹, fallback for others
    const formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    // Replace standard symbol with custom setting
    return formatter.format(amount).replace('₹', state.settings.currency);
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}

function getMonthKey(dateObj) {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
}

function getIconForCategory(catName) {
    const cat = state.categories.find(c => c.name === catName);
    return cat ? cat.icon : 'ph-dots-three';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ph-check-circle';
    if(type === 'error') icon = 'ph-x-circle';
    if(type === 'warning') icon = 'ph-warning';

    toast.innerHTML = `<i class="ph ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function checkSmartAlerts() {
    const calc = getCalculations();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentMonthKey = getMonthKey(now);
    
    // 1. Daily Evening Reminder
    const lastReminder = localStorage.getItem('pg_last_reminder');
    if (calc.todayExpense === 0 && now.getHours() >= 17 && lastReminder !== todayStr) {
        showToast("Did you forget to log today's expenses?", 'warning');
        localStorage.setItem('pg_last_reminder', todayStr);
    }

    // 2. High Budget Usage Alert (on load)
    const budgetPct = (calc.thisMonthExpense / state.settings.budget) * 100;
    const lastBudgetAlert = localStorage.getItem('pg_last_budget_alert');
    if (budgetPct >= 90 && lastBudgetAlert !== currentMonthKey) {
        setTimeout(() => {
            showToast(`Warning: You have used ${budgetPct.toFixed(1)}% of your monthly budget!`, 'error');
        }, 1500);
        localStorage.setItem('pg_last_budget_alert', currentMonthKey);
    }
}

function getGreetingTime() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
}

/* ==========================================================================
   Calculations
   ========================================================================== */
function getCalculations(targetDate = new Date()) {
    const currentMonthKey = getMonthKey(targetDate);
    const prevMonthDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevMonthDate);
    const todayStr = targetDate.toISOString().split('T')[0];

    let todayExpense = 0;
    let thisMonthExpense = 0;
    let prevMonthExpense = 0;
    let categoryTotals = {};
    let categoryTotalsPrev = {};

    state.expenses.forEach(exp => {
        const expMonth = exp.date.substring(0, 7);
        if (exp.date === todayStr) {
            todayExpense += exp.amount;
        }
        if (expMonth === currentMonthKey) {
            thisMonthExpense += exp.amount;
            categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        }
        if (expMonth === prevMonthKey) {
            prevMonthExpense += exp.amount;
            categoryTotalsPrev[exp.category] = (categoryTotalsPrev[exp.category] || 0) + exp.amount;
        }
    });

    // Income
    let thisMonthIncome = 0;
    state.income.forEach(inc => {
        if (inc.date.substring(0, 7) === currentMonthKey) {
            thisMonthIncome += inc.amount;
        }
    });

    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    const daysPassed = targetDate.getDate();
    const remainingDays = daysInMonth - daysPassed + 1; // +1 to include today

    const avgDaily = daysPassed > 0 ? (thisMonthExpense / daysPassed) : 0;
    const remainingBudget = state.settings.budget - thisMonthExpense;
    const projection = daysPassed > 0 ? (thisMonthExpense / daysPassed) * daysInMonth : 0;
    const dailyLimit = remainingDays > 0 ? (remainingBudget / remainingDays) : 0;

    return {
        todayExpense,
        thisMonthExpense,
        prevMonthExpense,
        categoryTotals,
        categoryTotalsPrev,
        thisMonthIncome,
        avgDaily,
        remainingBudget,
        projection,
        dailyLimit,
        daysInMonth,
        daysPassed,
        remainingDays
    };
}

/* ==========================================================================
   UI Rendering - Main Navigation
   ========================================================================== */
function renderView(viewName) {
    // Hide all sections
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    
    // Update nav links
    document.querySelectorAll('.nav-item').forEach(item => {
        if(item.dataset.target === viewName) item.classList.add('active');
        else item.classList.remove('active');
    });

    // Update mobile drawer links
    document.querySelectorAll('.drawer-nav-item').forEach(item => {
        if(item.dataset.target === viewName) item.classList.add('active');
        else item.classList.remove('active');
    });

    // Show target section
    const target = document.getElementById(viewName);
    if(target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    state.currentView = viewName;

    // Render specific data
    switch(viewName) {
        case 'dashboard': renderDashboard(); break;
        case 'expenses': renderExpensesList(); break;
        case 'analysis': renderAnalysis(); break;
        case 'calendar': renderCalendar(); break;
        case 'budget': renderBudget(); break;
        case 'income': renderIncome(); break;
        case 'settings': renderSettings(); break;
    }
}

/* ==========================================================================
   UI Rendering - Dashboard
   ========================================================================== */
function renderDashboard() {
    document.getElementById('dashboard-date').textContent = formatDate(new Date().toISOString());
    document.getElementById('greeting-text').textContent = getGreetingTime();
    document.getElementById('user-name-display').textContent = state.settings.userName;
    
    const calc = getCalculations();

    // Summary Cards
    document.getElementById('dash-today').textContent = formatCurrency(calc.todayExpense);
    document.getElementById('dash-month').textContent = formatCurrency(calc.thisMonthExpense);
    document.getElementById('dash-remaining').textContent = formatCurrency(calc.remainingBudget);
    document.getElementById('dash-avg').textContent = formatCurrency(calc.avgDaily);

    // Budget Progress
    document.getElementById('dash-budget-text').textContent = `${formatCurrency(calc.thisMonthExpense)} / ${formatCurrency(state.settings.budget)}`;
    let pct = (calc.thisMonthExpense / state.settings.budget) * 100;
    if (pct > 100) pct = 100;
    
    const pBar = document.getElementById('dash-budget-progress');
    pBar.style.width = `${pct}%`;
    pBar.className = 'progress-bar'; // reset
    if (pct >= 85) pBar.classList.add('danger');
    else if (pct >= 70) pBar.classList.add('warning');
    
    document.getElementById('dash-budget-percent').textContent = `${pct.toFixed(1)}% used`;

    // Top Categories
    const topCatList = document.getElementById('dash-top-categories');
    topCatList.innerHTML = '';
    const sortedCats = Object.entries(calc.categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    sortedCats.forEach(([cat, amount]) => {
        topCatList.innerHTML += `
            <li class="category-item">
                <div class="cat-info">
                    <div class="cat-icon"><i class="ph ${getIconForCategory(cat)}"></i></div>
                    <span class="cat-name">${cat}</span>
                </div>
                <span class="cat-amount">${formatCurrency(amount)}</span>
            </li>
        `;
    });

    if(sortedCats.length === 0) {
        topCatList.innerHTML = '<li class="category-item"><span class="text-secondary">No expenses yet.</span></li>';
    }

    // Previous Month Comparison
    document.getElementById('dash-prev-month').textContent = formatCurrency(calc.prevMonthExpense);
    document.getElementById('dash-curr-month').textContent = formatCurrency(calc.thisMonthExpense);
    
    const compResult = document.getElementById('dash-comp-result');
    if (calc.prevMonthExpense === 0) {
        compResult.innerHTML = `<span class="text-secondary">No previous month data available.</span>`;
    } else {
        const diff = calc.thisMonthExpense - calc.prevMonthExpense;
        const pctDiff = (Math.abs(diff) / calc.prevMonthExpense) * 100;
        if (diff > 0) {
            compResult.innerHTML = `
                <div class="comp-result-item">
                    <span style="color:var(--danger)">🔴 You spent ${formatCurrency(diff)} more this month. (↑ ${pctDiff.toFixed(2)}%)</span>
                </div>`;
        } else {
            compResult.innerHTML = `
                <div class="comp-result-item">
                    <span style="color:var(--success)">🟢 Great! You spent ${formatCurrency(Math.abs(diff))} less this month. (↓ ${pctDiff.toFixed(2)}%)</span>
                </div>`;
        }
    }

    // Projection & Limits
    document.getElementById('dash-projection').textContent = formatCurrency(calc.projection);
    const projWarn = document.getElementById('dash-projection-warn');
    if (calc.projection > state.settings.budget) {
        projWarn.textContent = "⚠️ At your current spending rate, you may exceed your budget.";
        projWarn.style.color = "var(--danger)";
    } else {
        projWarn.textContent = "On track to stay within budget.";
        projWarn.style.color = "var(--text-secondary)";
    }
    
    let limit = calc.dailyLimit > 0 ? calc.dailyLimit : 0;
    document.getElementById('dash-daily-limit').textContent = `${formatCurrency(limit)}/day`;

    // Smart Insights
    renderInsights(calc, sortedCats);

    // Render Chart
    renderDashboardChart();
}

function renderInsights(calc, sortedCats) {
    const list = document.getElementById('dash-insights');
    list.innerHTML = '';
    const insights = [];

    // Highest category insight
    if (sortedCats.length > 0) {
        insights.push({ icon: '💡', text: `${sortedCats[0][0]} is your highest spending category this month.` });
    }
    
    // Budget insight
    const budgetPct = (calc.thisMonthExpense / state.settings.budget) * 100;
    if (budgetPct >= 85) {
        insights.push({ icon: '⚠️', text: `You have used ${budgetPct.toFixed(1)}% of your monthly budget.` });
    }

    // Daily avg insight
    if (calc.todayExpense > calc.avgDaily * 1.5 && calc.avgDaily > 0) {
        insights.push({ icon: '⚠️', text: `Today's spending is significantly higher than your daily average.` });
    }

    if(calc.prevMonthExpense > 0) {
        if(calc.thisMonthExpense > calc.prevMonthExpense) {
            insights.push({ icon: '📈', text: `Your spending is higher than last month.` });
        }
    }

    if (insights.length === 0) {
        list.innerHTML = '<div class="insight-item"><span class="insight-text text-secondary">Keep adding expenses to generate insights.</span></div>';
    } else {
        insights.forEach(ins => {
            list.innerHTML += `
                <div class="insight-item">
                    <span class="insight-icon">${ins.icon}</span>
                    <span class="insight-text">${ins.text}</span>
                </div>
            `;
        });
    }
}

function renderDashboardChart() {
    const ctx = document.getElementById('dashboardTrendChart').getContext('2d');
    
    // Aggregate last 6 months
    const labels = [];
    const data = [];
    const d = new Date();
    
    for(let i=5; i>=0; i--) {
        const monthDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
        labels.push(monthDate.toLocaleDateString('en-US', { month: 'short' }));
        const key = getMonthKey(monthDate);
        
        let sum = 0;
        state.expenses.forEach(e => {
            if(e.date.startsWith(key)) sum += e.amount;
        });
        data.push(sum);
    }

    if(state.charts.dashTrend) state.charts.dashTrend.destroy();

    state.charts.dashTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Monthly Expense',
                data: data,
                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

/* ==========================================================================
   UI Rendering - Expenses List
   ========================================================================== */
function renderExpensesList() {
    const container = document.getElementById('expenses-container');
    const search = document.getElementById('search-expense').value.toLowerCase();
    const filterDate = document.getElementById('filter-date').value;
    const filterCat = document.getElementById('filter-category').value;
    const sortBy = document.getElementById('sort-expense').value;

    let filtered = [...state.expenses];

    // Filter by Date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currMonth = getMonthKey(today);
    const prevMonth = getMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    
    // get week start (Sunday)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    if (filterDate === 'today') {
        filtered = filtered.filter(e => e.date === todayStr);
    } else if (filterDate === 'week') {
        filtered = filtered.filter(e => new Date(e.date) >= weekStart);
    } else if (filterDate === 'month') {
        filtered = filtered.filter(e => e.date.startsWith(currMonth));
    } else if (filterDate === 'prev_month') {
        filtered = filtered.filter(e => e.date.startsWith(prevMonth));
    }

    // Filter by Category
    if (filterCat !== 'all') {
        filtered = filtered.filter(e => e.category === filterCat);
    }

    // Search
    if (search) {
        filtered = filtered.filter(e => 
            e.description.toLowerCase().includes(search) || 
            e.category.toLowerCase().includes(search)
        );
    }

    // Sort
    if (sortBy === 'newest') filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === 'oldest') filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (sortBy === 'highest') filtered.sort((a, b) => b.amount - a.amount);
    else if (sortBy === 'lowest') filtered.sort((a, b) => a.amount - b.amount);

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 2rem; color: var(--text-secondary);">
                <i class="ph ph-receipt" style="font-size: 3rem; margin-bottom:1rem; opacity:0.5;"></i>
                <p>No expenses found.</p>
                <p style="font-size:0.85rem">Start tracking your spending by adding your first expense.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    filtered.forEach(exp => {
        container.innerHTML += `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="cat-icon"><i class="ph ${getIconForCategory(exp.category)}"></i></div>
                    <div class="expense-details">
                        <span class="expense-title">${exp.description || exp.category}</span>
                        <div class="expense-meta">
                            <span>${formatDate(exp.date)}</span> • 
                            <span>${exp.category}</span> • 
                            <span>${exp.paymentMethod}</span>
                        </div>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount">${formatCurrency(exp.amount)}</span>
                    <div class="expense-actions">
                        <button class="action-btn" onclick="editExpense(${exp.id})"><i class="ph ph-pencil-simple"></i></button>
                        <button class="action-btn delete" onclick="deleteExpense(${exp.id})"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    });
}

/* ==========================================================================
   UI Rendering - Analysis
   ========================================================================== */
function updateMonthSelector() {
    const selector = document.getElementById('analysis-month-select');
    if (!selector) return;

    const previousSelected = selector.value;
    const months = new Set();
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    months.add(currentMonthKey);
    
    state.expenses.forEach(e => {
        if (e.date && e.date.length >= 7) {
            months.add(e.date.substring(0, 7));
        }
    });

    const sortedMonths = Array.from(months).sort().reverse();
    const currentOptions = Array.from(selector.options).map(o => o.value);
    
    const needsRefresh = currentOptions.length !== sortedMonths.length ||
                         !currentOptions.every((val, i) => val === sortedMonths[i]);

    if (needsRefresh) {
        selector.innerHTML = '';
        sortedMonths.forEach(m => {
            const [y, mth] = m.split('-').map(Number);
            const dateObj = new Date(y, mth - 1, 1);
            const label = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            selector.add(new Option(label, m));
        });

        if (previousSelected && months.has(previousSelected)) {
            selector.value = previousSelected;
        } else {
            selector.value = currentMonthKey;
        }
    }
}

function renderAnalysis() {
    updateMonthSelector();
    const selector = document.getElementById('analysis-month-select');
    if (!selector) return;

    const selectedMonthStr = selector.value;
    if (!selectedMonthStr) return;

    const [year, month] = selectedMonthStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, 1);
    const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const subLabel = document.getElementById('analysis-selected-month-label');
    if (subLabel) subLabel.textContent = monthLabel;

    const currentMonthKey = selectedMonthStr;
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let totalExpense = 0;
    let count = 0;
    let categoryData = {};
    let paymentData = {};
    let dailyData = {};
    let weekData = [0, 0, 0, 0, 0];

    state.expenses.forEach(exp => {
        if (exp.date && exp.date.startsWith(currentMonthKey)) {
            const amt = Number(exp.amount) || 0;
            totalExpense += amt;
            count++;
            
            categoryData[exp.category] = (categoryData[exp.category] || 0) + amt;
            paymentData[exp.paymentMethod] = (paymentData[exp.paymentMethod] || 0) + amt;
            dailyData[exp.date] = (dailyData[exp.date] || 0) + amt;

            // Week calculation (1-7 is week 0, etc)
            const day = parseInt(exp.date.split('-')[2], 10);
            const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
            weekData[weekIdx] += amt;
        }
    });

    const now = new Date();
    const isCurrentMonth = getMonthKey(now) === currentMonthKey;
    const daysToDivide = isCurrentMonth ? now.getDate() : daysInMonth;
    const avgDaily = daysToDivide > 0 ? totalExpense / daysToDivide : 0;

    // Find highest day
    let highestDayDate = '-';
    let highestDayVal = 0;
    Object.entries(dailyData).forEach(([date, val]) => {
        if(val > highestDayVal) {
            highestDayVal = val;
            highestDayDate = formatDate(date);
        }
    });

    // Update Summary
    document.getElementById('analysis-total').textContent = formatCurrency(totalExpense);
    document.getElementById('analysis-count').textContent = count;
    document.getElementById('analysis-avg').textContent = formatCurrency(avgDaily);
    document.getElementById('analysis-highest-day-val').textContent = formatCurrency(highestDayVal);
    document.getElementById('analysis-highest-day-date').textContent = highestDayDate;

    // Render Charts
    renderAnalysisCharts(categoryData, paymentData, weekData);
}

function renderAnalysisCharts(catData, payData, weekData) {
    const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
    const hasCatData = Object.keys(catData).length > 0;
    const hasPayData = Object.keys(payData).length > 0;
    
    // Category Donut
    const ctxCat = document.getElementById('categoryDonutChart').getContext('2d');
    if(state.charts.catDonut) state.charts.catDonut.destroy();
    state.charts.catDonut = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: hasCatData ? Object.keys(catData) : ['No Data'],
            datasets: [{
                data: hasCatData ? Object.values(catData) : [1],
                backgroundColor: hasCatData ? colors : ['#9ca3af33'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Payment Pie
    const ctxPay = document.getElementById('paymentPieChart').getContext('2d');
    if(state.charts.payPie) state.charts.payPie.destroy();
    state.charts.payPie = new Chart(ctxPay, {
        type: 'pie',
        data: {
            labels: hasPayData ? Object.keys(payData) : ['No Data'],
            datasets: [{
                data: hasPayData ? Object.values(payData) : [1],
                backgroundColor: hasPayData ? ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6'] : ['#9ca3af33'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Weekly Bar
    const ctxWeek = document.getElementById('weeklyBarChart').getContext('2d');
    if(state.charts.weekBar) state.charts.weekBar.destroy();
    state.charts.weekBar = new Chart(ctxWeek, {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            datasets: [{
                label: 'Spending',
                data: weekData,
                backgroundColor: '#4f46e5',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

/* ==========================================================================
   UI Rendering - Calendar
   ========================================================================== */
let currentCalendarDate = new Date();
let selectedCalendarDate = null;

function formatCalAmount(amt) {
    if (!amt || amt <= 0) return '';
    if (amt >= 1000) {
        const k = (amt / 1000).toFixed(amt % 1000 === 0 ? 0 : 1);
        return `${state.settings.currency}${k}k`;
    }
    return `${state.settings.currency}${Math.round(amt)}`;
}

function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthObj = new Date(year, month, 1);
    const monthYearStr = monthObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    document.getElementById('cal-month-year').textContent = monthYearStr;

    const grid = document.getElementById('calendar-days');
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // If no selected date or selected date is in another month, default to today or 1st
    if (!selectedCalendarDate || !selectedCalendarDate.startsWith(currentMonthKey)) {
        if (todayStr.startsWith(currentMonthKey)) {
            selectedCalendarDate = todayStr;
        } else {
            selectedCalendarDate = `${currentMonthKey}-01`;
        }
    }

    // Calculate daily expenses for the month
    const dailyExpenses = {};
    state.expenses.forEach(e => {
        if(e.date && e.date.startsWith(currentMonthKey)) {
            dailyExpenses[e.date] = (dailyExpenses[e.date] || 0) + Number(e.amount);
        }
    });

    // Find max for highlighting
    let maxDaily = 0;
    Object.values(dailyExpenses).forEach(v => { if(v > maxDaily) maxDaily = v; });

    // Empty cells for first day
    for(let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="cal-day empty"></div>`;
    }

    // Days
    for(let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalendarDate;
        const amount = dailyExpenses[dateStr] || 0;
        
        let highlightClass = '';
        if (amount > 0) {
            highlightClass = 'has-data';
            if (amount > (maxDaily * 0.4)) highlightClass += ' medium';
            if (amount > (maxDaily * 0.75)) highlightClass += ' high';
        }

        const amountText = formatCalAmount(amount);

        grid.innerHTML += `
            <div class="cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${highlightClass}" data-date="${dateStr}" onclick="showCalendarDetails('${dateStr}')">
                <span class="cal-date">${d}</span>
                ${amountText ? `<span class="cal-amount">${amountText}</span>` : ''}
            </div>
        `;
    }

    // Render details for active selected date
    if (selectedCalendarDate) {
        showCalendarDetails(selectedCalendarDate);
    }
}

function showCalendarDetails(dateStr) {
    selectedCalendarDate = dateStr;

    // Highlight active calendar day in grid
    document.querySelectorAll('.cal-day').forEach(el => {
        if (el.dataset.date === dateStr) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    const detailsCard = document.getElementById('calendar-details-card');
    if (!detailsCard) return;
    detailsCard.style.display = 'block';

    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const formatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('cal-selected-date').textContent = formatted;
    
    const list = document.getElementById('cal-day-expenses');
    list.innerHTML = '';
    
    const dayExps = state.expenses.filter(e => e.date === dateStr);
    const dayTotal = dayExps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    const totalBadge = document.getElementById('cal-selected-total');
    if (totalBadge) totalBadge.textContent = `Total: ${formatCurrency(dayTotal)}`;

    if(dayExps.length === 0) {
        list.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-receipt-x" style="font-size: 2.2rem; color: var(--text-secondary); opacity: 0.5; display: block; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 0.9rem;">No expenses recorded on this day.</p>
            </div>
        `;
        return;
    }

    dayExps.forEach(exp => {
        list.innerHTML += `
            <div class="expense-item" style="padding: 0.75rem 0.5rem;">
                <div class="expense-left">
                    <div class="cat-icon" style="width:36px;height:36px;font-size:1.1rem;"><i class="ph ${getIconForCategory(exp.category)}"></i></div>
                    <div class="expense-details">
                        <span class="expense-title">${exp.description || exp.category}</span>
                        <span class="expense-meta">${exp.category} • ${exp.paymentMethod || 'Cash'}</span>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount">${formatCurrency(exp.amount)}</span>
                </div>
            </div>
        `;
    });
}

document.getElementById('cal-prev').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
});

/* ==========================================================================
   UI Rendering - Budget
   ========================================================================== */
function renderBudget() {
    const calc = getCalculations();
    
    document.getElementById('budget-total-val').textContent = formatCurrency(state.settings.budget);
    document.getElementById('budget-spent-val').textContent = formatCurrency(calc.thisMonthExpense);
    document.getElementById('budget-rem-val').textContent = formatCurrency(calc.remainingBudget);
    
    let pct = (calc.thisMonthExpense / state.settings.budget) * 100;
    if(pct > 100) pct = 100;
    const pBar = document.getElementById('budget-page-progress');
    pBar.style.width = `${pct}%`;
    pBar.className = 'progress-bar';
    if (pct >= 85) pBar.classList.add('danger');
    else if (pct >= 70) pBar.classList.add('warning');

    // Savings
    const savingTarget = state.settings.savingsGoal;
    const currentSaving = calc.thisMonthIncome - calc.thisMonthExpense;
    
    document.getElementById('saving-target').textContent = formatCurrency(savingTarget);
    document.getElementById('saving-current').textContent = formatCurrency(currentSaving);
    
    const statusDiv = document.getElementById('saving-status');
    const savingDiff = currentSaving - savingTarget;
    if(savingDiff >= 0) {
        statusDiv.innerHTML = `<span style="color:var(--success)">🟢 You are ${formatCurrency(savingDiff)} ahead of your savings target.</span>`;
    } else {
        statusDiv.innerHTML = `<span style="color:var(--danger)">🔴 You are ${formatCurrency(Math.abs(savingDiff))} short of your savings target.</span>`;
    }

    // Fixed Expenses
    const fixedList = document.getElementById('fixed-expenses-list');
    fixedList.innerHTML = '';
    const currentMonthKey = getMonthKey(new Date());
    const fixedExps = state.expenses.filter(e => e.type === 'fixed' && e.date.startsWith(currentMonthKey));
    
    if(fixedExps.length === 0) {
        fixedList.innerHTML = '<span class="text-secondary">No fixed expenses recorded this month.</span>';
    } else {
        fixedExps.forEach(exp => {
            fixedList.innerHTML += `
                <div class="expense-item" style="padding: 0.5rem 0;">
                    <div class="expense-left">
                        <div class="cat-icon"><i class="ph ${getIconForCategory(exp.category)}"></i></div>
                        <div class="expense-details">
                            <span class="expense-title">${exp.description || exp.category}</span>
                            <span class="expense-meta">${formatDate(exp.date)}</span>
                        </div>
                    </div>
                    <div class="expense-right">
                        <span class="expense-amount">${formatCurrency(exp.amount)}</span>
                    </div>
                </div>
            `;
        });
    }

    // Chart
    const ctx = document.getElementById('incomeExpenseChart').getContext('2d');
    if(state.charts.incExp) state.charts.incExp.destroy();
    state.charts.incExp = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Current Month'],
            datasets: [
                {
                    label: 'Income',
                    data: [calc.thisMonthIncome],
                    backgroundColor: '#10b981'
                },
                {
                    label: 'Expense',
                    data: [calc.thisMonthExpense],
                    backgroundColor: '#ef4444'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

/* ==========================================================================
   UI Rendering - Income
   ========================================================================== */
function renderIncome() {
    const calc = getCalculations();
    
    document.getElementById('income-total').textContent = formatCurrency(calc.thisMonthIncome);
    document.getElementById('income-expenses').textContent = formatCurrency(calc.thisMonthExpense);
    document.getElementById('income-remaining').textContent = formatCurrency(calc.thisMonthIncome - calc.thisMonthExpense);
    
    const list = document.getElementById('income-list');
    list.innerHTML = '';
    
    const sortedIncome = [...state.income].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if(sortedIncome.length === 0) {
        list.innerHTML = '<span class="text-secondary">No income records found.</span>';
    } else {
        sortedIncome.forEach(inc => {
            list.innerHTML += `
                <div class="expense-item">
                    <div class="expense-left">
                        <div class="cat-icon" style="background-color:rgba(16, 185, 129, 0.1); color:var(--success);"><i class="ph ph-money"></i></div>
                        <div class="expense-details">
                            <span class="expense-title">${inc.source}</span>
                            <div class="expense-meta">
                                <span>${formatDate(inc.date)}</span> • 
                                <span>${inc.note || '-'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="expense-right">
                        <span class="expense-amount income">+${formatCurrency(inc.amount)}</span>
                        <div class="expense-actions">
                            <button class="action-btn delete" onclick="deleteIncome(${inc.id})"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
        });
    }
}

/* ==========================================================================
   UI Rendering - Settings
   ========================================================================== */
function renderSettings() {
    document.getElementById('setting-name').value = state.settings.userName || '';
    document.getElementById('setting-budget').value = state.settings.budget;
    document.getElementById('setting-savings').value = state.settings.savingsGoal;
    document.getElementById('setting-currency').value = state.settings.currency;
    
    renderCategorySettings();
}

function renderCategorySettings() {
    const list = document.getElementById('settings-category-list');
    list.innerHTML = '';
    
    state.categories.forEach((cat, index) => {
        // Can't delete defaults easily, but let's allow deleting custom ones (simplified: allow deleting any for now)
        list.innerHTML += `
            <li class="category-item">
                <div class="cat-info">
                    <div class="cat-icon"><i class="ph ${cat.icon}"></i></div>
                    <span class="cat-name">${cat.name}</span>
                </div>
                <button class="action-btn delete" onclick="deleteCategory(${index})"><i class="ph ph-trash"></i></button>
            </li>
        `;
    });
}

function populateCategoryDropdowns() {
    const addSelect = document.getElementById('expense-category');
    const filterSelect = document.getElementById('filter-category');
    
    let opts = '';
    state.categories.forEach(c => {
        opts += `<option value="${c.name}">${c.name}</option>`;
    });
    
    addSelect.innerHTML = opts;
    
    // Keep 'All' in filter
    filterSelect.innerHTML = '<option value="all">All Categories</option>' + opts;
}

/* ==========================================================================
   CRUD Operations
   ========================================================================== */
function submitExpenseForm(e) {
    e.preventDefault();
    
    const id = document.getElementById('expense-id').value;
    const amount = parseFloat(document.getElementById('expense-amount').value);
    
    if (amount <= 0 || isNaN(amount)) {
        showToast('Amount must be greater than 0', 'error');
        return;
    }

    const expense = {
        id: id ? parseInt(id) : Date.now(),
        amount: amount,
        category: document.getElementById('expense-category').value,
        date: document.getElementById('expense-date').value,
        paymentMethod: document.getElementById('expense-payment').value,
        type: document.getElementById('expense-type').value,
        description: document.getElementById('expense-desc').value
    };

    if (id) {
        const index = state.expenses.findIndex(e => e.id === expense.id);
        if (index > -1) state.expenses[index] = expense;
        showToast('Expense updated successfully');
    } else {
        state.expenses.push(expense);
        showToast('Expense added successfully');
    }

    saveData();
    closeModal('expense-modal');
    renderView(state.currentView); // Refresh current view
    
    // Real-time Budget Check after adding an expense
    const calc = getCalculations();
    if (calc.thisMonthExpense > state.settings.budget) {
        setTimeout(() => showToast('Alert: You have exceeded your monthly budget!', 'error'), 500);
    } else if (calc.thisMonthExpense >= state.settings.budget * 0.9) {
        setTimeout(() => showToast('Warning: You are very close to your budget limit!', 'warning'), 500);
    }
}

function editExpense(id) {
    const exp = state.expenses.find(e => e.id === id);
    if (!exp) return;
    
    document.getElementById('modal-expense-title').textContent = 'Edit Expense';
    document.getElementById('expense-id').value = exp.id;
    document.getElementById('expense-amount').value = exp.amount;
    document.getElementById('expense-category').value = exp.category;
    document.getElementById('expense-date').value = exp.date;
    document.getElementById('expense-payment').value = exp.paymentMethod;
    document.getElementById('expense-type').value = exp.type;
    document.getElementById('expense-desc').value = exp.description || '';
    
    openModal('expense-modal');
}

function showConfirm(title, message) {
    return new Promise((resolve) => {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        openModal('confirm-modal');

        const btnOk = document.getElementById('btn-confirm-ok');
        const btnCancel = document.getElementById('btn-confirm-cancel');

        // Cleanup function to remove event listeners
        const cleanup = () => {
            closeModal('confirm-modal');
            btnOk.replaceWith(btnOk.cloneNode(true));
            btnCancel.replaceWith(btnCancel.cloneNode(true));
        };

        btnOk.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        btnCancel.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
    });
}

async function deleteExpense(id) {
    const confirmed = await showConfirm('Delete Expense?', 'Are you sure you want to delete this expense?');
    if(confirmed) {
        state.expenses = state.expenses.filter(e => e.id !== id);
        saveData();
        showToast('Expense deleted');
        renderView(state.currentView);
    }
}

function submitIncomeForm(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('income-amount').value);
    if (amount <= 0 || isNaN(amount)) return;

    const income = {
        id: Date.now(),
        amount: amount,
        source: document.getElementById('income-source').value,
        date: document.getElementById('income-date').value,
        note: document.getElementById('income-desc').value
    };

    state.income.push(income);
    saveData();
    showToast('Income added successfully');
    closeModal('income-modal');
    renderView(state.currentView);
}

async function deleteIncome(id) {
    const confirmed = await showConfirm('Delete Income?', 'Delete this income record?');
    if(confirmed) {
        state.income = state.income.filter(i => i.id !== id);
        saveData();
        showToast('Income deleted');
        renderView(state.currentView);
    }
}

async function deleteCategory(index) {
    if(state.categories.length <= 1) {
        showToast('You must have at least one category', 'error');
        return;
    }
    const confirmed = await showConfirm('Delete Category?', 'Existing expenses will keep the name. Proceed?');
    if(confirmed) {
        state.categories.splice(index, 1);
        saveData();
        populateCategoryDropdowns();
        renderCategorySettings();
    }
}

/* ==========================================================================
   Data Export & Import
   ========================================================================== */
function exportExcel() {
    if(state.expenses.length === 0) {
        showToast('No expenses to export', 'error');
        return;
    }
    
    // Prepare data for Excel
    const data = state.expenses.map(e => ({
        Date: e.date,
        Category: e.category,
        Description: e.description || '',
        Amount: e.amount,
        'Payment Method': e.paymentMethod,
        Type: e.type
    }));

    // Generate workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");

    // Download the file
    XLSX.writeFile(workbook, `PG_Expenses_${getMonthKey(new Date())}.xlsx`);
    showToast('Excel Downloaded Successfully');
}

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */
function setupEventListeners() {
    // Nav links (Desktop Sidebar & Mobile Bottom Nav)
    document.querySelectorAll('.nav-item').forEach(item => {
        if (!item.classList.contains('nav-menu-trigger')) {
            item.addEventListener('click', () => renderView(item.dataset.target));
        }
    });

    // Mobile Drawer Openers (Three-line hamburger buttons in headers & bottom menu tab)
    document.querySelectorAll('.mobile-menu-btn').forEach(btn => {
        btn.addEventListener('click', openDrawer);
    });

    const bottomMenuTrigger = document.getElementById('bottom-menu-trigger');
    if (bottomMenuTrigger) {
        bottomMenuTrigger.addEventListener('click', openDrawer);
    }

    // Mobile Drawer Closers
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', closeDrawer);
    }

    const drawerOverlay = document.getElementById('drawer-overlay');
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeDrawer);
    }

    // Drawer Nav items
    document.querySelectorAll('.drawer-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            renderView(item.dataset.target);
            closeDrawer();
        });
    });

    // Drawer Theme Toggle
    const drawerThemeToggle = document.getElementById('drawer-theme-toggle');
    if (drawerThemeToggle) {
        drawerThemeToggle.addEventListener('click', () => {
            const newTheme = state.settings.theme === 'light' ? 'dark' : 'light';
            state.settings.theme = newTheme;
            applyTheme(newTheme);
            saveData();
        });
    }

    // Drawer Excel Export
    const drawerExportBtn = document.getElementById('drawer-export-btn');
    if (drawerExportBtn) {
        drawerExportBtn.addEventListener('click', () => {
            closeDrawer();
            exportExcel();
        });
    }

    // Calendar "Add For This Date" button
    const calAddExpenseBtn = document.getElementById('cal-add-expense-btn');
    if (calAddExpenseBtn) {
        calAddExpenseBtn.addEventListener('click', () => {
            document.getElementById('expense-form').reset();
            document.getElementById('expense-id').value = '';
            document.getElementById('expense-date').value = selectedCalendarDate || getLocalDateString();
            document.getElementById('modal-expense-title').textContent = 'Add Expense';
            openModal('expense-modal');
        });
    }

    // Quick Date Buttons (Today / Yesterday)
    document.querySelectorAll('.quick-date-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const offset = parseInt(btn.dataset.offset, 10) || 0;
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + offset);
            const dateStr = getLocalDateString(targetDate);
            
            const input = document.getElementById(targetId);
            if (input) {
                input.value = dateStr;
                syncQuickDateButtons(targetId);
            }
        });
    });

    ['expense-date', 'income-date'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', () => syncQuickDateButtons(id));
        }
    });

    // Header Theme Toggle (desktop and header buttons)
    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const newTheme = state.settings.theme === 'light' ? 'dark' : 'light';
            state.settings.theme = newTheme;
            applyTheme(newTheme);
            saveData();
        });
    });

    // Modals
    document.getElementById('fab-add-expense').addEventListener('click', () => {
        document.getElementById('expense-form').reset();
        document.getElementById('expense-id').value = '';
        document.getElementById('expense-date').value = getLocalDateString();
        document.getElementById('modal-expense-title').textContent = 'Add Expense';
        openModal('expense-modal');
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => closeModal('expense-modal'));
    
    document.getElementById('btn-add-income').addEventListener('click', () => {
        document.getElementById('income-form').reset();
        document.getElementById('income-id').value = '';
        document.getElementById('income-date').value = getLocalDateString();
        openModal('income-modal');
    });
    document.getElementById('btn-close-income-modal').addEventListener('click', () => closeModal('income-modal'));

    // Form Submits
    document.getElementById('expense-form').addEventListener('submit', submitExpenseForm);
    document.getElementById('income-form').addEventListener('submit', submitIncomeForm);

    // Quick Amounts
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const input = document.getElementById('expense-amount');
            input.value = (parseFloat(input.value || 0) + parseFloat(val)).toString();
        });
    });

    // Expense Filters
    ['search-expense', 'filter-date', 'filter-category', 'sort-expense'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderExpensesList);
    });

    // Analysis Month Select
    document.getElementById('analysis-month-select').addEventListener('change', renderAnalysis);

    // Settings
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const nameVal = document.getElementById('setting-name').value.trim();
        if (nameVal) {
            state.settings.userName = nameVal;
            const drawerUserName = document.getElementById('drawer-user-name');
            if (drawerUserName) drawerUserName.textContent = nameVal;
        }
        
        state.settings.budget = parseFloat(document.getElementById('setting-budget').value) || 12000;
        state.settings.savingsGoal = parseFloat(document.getElementById('setting-savings').value) || 3000;
        
        const newCurr = document.getElementById('setting-currency').value.trim() || '₹';
        state.settings.currency = newCurr;
        
        // Update currency symbols in UI directly
        document.getElementById('modal-currency').textContent = newCurr;
        
        saveData();
        showToast('Settings saved');
        renderView('settings'); // re-render to update
    });

    document.getElementById('btn-add-category').addEventListener('click', () => {
        const input = document.getElementById('new-category-name');
        const name = input.value.trim();
        if(name) {
            state.categories.push({ name, icon: 'ph-tag' });
            saveData();
            input.value = '';
            populateCategoryDropdowns();
            renderCategorySettings();
            showToast('Category added');
        }
    });

    // Data Actions
    document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
    
    // Onboarding
    document.getElementById('onboarding-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('onboarding-name').value.trim();
        if(nameInput) {
            state.settings.userName = nameInput;
            saveData();
            document.getElementById('onboarding-modal').classList.remove('active');
            renderView('dashboard');
            setTimeout(checkSmartAlerts, 1000);
        }
    });
}

function openDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('mobile-drawer');
    if (overlay && drawer) {
        overlay.classList.add('active');
        drawer.classList.add('active');
    }
    const drawerUserName = document.getElementById('drawer-user-name');
    if (drawerUserName) {
        drawerUserName.textContent = state.settings.userName || 'User';
    }
}

function closeDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('mobile-drawer');
    if (overlay && drawer) {
        overlay.classList.remove('active');
        drawer.classList.remove('active');
    }
}

function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function syncQuickDateButtons(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const val = input.value;
    const today = getLocalDateString(new Date());
    
    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterday = getLocalDateString(yestDate);
    
    const prefix = inputId === 'expense-date' ? 'expense' : 'income';
    const btnToday = document.getElementById(`btn-${prefix}-date-today`);
    const btnYesterday = document.getElementById(`btn-${prefix}-date-yesterday`);
    
    if (btnToday && btnYesterday) {
        if (val === today) {
            btnToday.classList.add('active');
            btnYesterday.classList.remove('active');
        } else if (val === yesterday) {
            btnToday.classList.remove('active');
            btnYesterday.classList.add('active');
        } else {
            btnToday.classList.remove('active');
            btnYesterday.classList.remove('active');
        }
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    // Ensure currency symbol matches settings
    if(id === 'expense-modal') {
        document.getElementById('modal-currency').textContent = state.settings.currency;
        syncQuickDateButtons('expense-date');
        // Autofocus amount
        setTimeout(() => document.getElementById('expense-amount').focus(), 100);
    } else if(id === 'income-modal') {
        syncQuickDateButtons('income-date');
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    document.querySelectorAll('.theme-toggle i').forEach(icon => {
        icon.className = themeName === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    });

    const drawerThemeIcon = document.querySelector('#drawer-theme-toggle i');
    const drawerThemeText = document.getElementById('drawer-theme-text');
    if (drawerThemeIcon) {
        drawerThemeIcon.className = themeName === 'dark' ? 'ph ph-sun' : 'ph ph-moon';
    }
    if (drawerThemeText) {
        drawerThemeText.textContent = themeName === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
