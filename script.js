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
    dailyMeals: {}, // Legacy map of monthKey -> mealConfig
    dailyMealSettings: {
        name: 'PG Mess / Daily Meals',
        mealsPerDay: 2,
        costPerMeal: 50,
        paymentMethod: 'UPI',
        category: 'Food'
    },
    mealSettings: {
        breakfastRate: 30,
        lunchRate: 50,
        dinnerRate: 50
    },
    mealPeriod: {
        startDate: '',
        endDate: ''
    },
    mealEntries: {}, // Map of 'YYYY-MM-DD' -> { date, breakfast, lunch, dinner, breakfastRate, lunchRate, dinnerRate, cost }
    mealPayments: [], // Array of { id, date, amount, paymentMethod, note, createdAt }
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

let familyData = {
    received: [],   // { id, amount, date, paymentMethod, utr, note, createdAt }
    roomRent: [],   // { id, month, amount, date, paymentMethod, utr, paidTo, note, createdAt }
    currentBill: [] // { id, month, amount, date, paymentMethod, utr, paidTo, note, createdAt }
};

let currentFamilyTab = 'fam-tab-received';
let currentMealTab = 'meal-tab-entries';

/* ==========================================================================
   Initialization & LocalStorage
   ========================================================================== */
function init() {
    loadData();
    loadFamilyData();
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
    const dailyMeals = localStorage.getItem('pg_daily_meals');
    const dailyMealSettings = localStorage.getItem('pg_daily_meal_settings');
    const mealSettings = localStorage.getItem('pg_meal_settings');
    const mealPeriod = localStorage.getItem('pg_meal_period');
    const mealEntries = localStorage.getItem('pg_meal_entries');
    const mealPayments = localStorage.getItem('pg_meal_payments');

    if (expenses) state.expenses = JSON.parse(expenses);
    if (income) state.income = JSON.parse(income);
    if (categories) state.categories = JSON.parse(categories);
    if (settings) state.settings = { ...state.settings, ...JSON.parse(settings) };
    if (dailyMeals) state.dailyMeals = JSON.parse(dailyMeals);
    if (dailyMealSettings) state.dailyMealSettings = { ...state.dailyMealSettings, ...JSON.parse(dailyMealSettings) };
    if (mealSettings) state.mealSettings = { ...state.mealSettings, ...JSON.parse(mealSettings) };
    if (mealPeriod) state.mealPeriod = { ...state.mealPeriod, ...JSON.parse(mealPeriod) };
    if (mealEntries) state.mealEntries = JSON.parse(mealEntries);
    if (mealPayments) state.mealPayments = JSON.parse(mealPayments);

    // Initialize default meal period if not set
    if (!state.mealPeriod.startDate || !state.mealPeriod.endDate) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`;
        const lastDayNum = new Date(y, m + 1, 0).getDate();
        const lastDay = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
        state.mealPeriod = { startDate: firstDay, endDate: lastDay };
    }
}

function saveData() {
    localStorage.setItem('pg_expenses', JSON.stringify(state.expenses));
    localStorage.setItem('pg_income', JSON.stringify(state.income));
    localStorage.setItem('pg_categories', JSON.stringify(state.categories));
    localStorage.setItem('pg_settings', JSON.stringify(state.settings));
    localStorage.setItem('pg_daily_meals', JSON.stringify(state.dailyMeals));
    localStorage.setItem('pg_daily_meal_settings', JSON.stringify(state.dailyMealSettings));
    localStorage.setItem('pg_meal_settings', JSON.stringify(state.mealSettings));
    localStorage.setItem('pg_meal_period', JSON.stringify(state.mealPeriod));
    localStorage.setItem('pg_meal_entries', JSON.stringify(state.mealEntries));
    localStorage.setItem('pg_meal_payments', JSON.stringify(state.mealPayments));
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
        case 'daily-meals': renderDailyMealsView(); break;
        case 'analysis': renderAnalysis(); break;
        case 'calendar': renderCalendar(); break;
        case 'budget': renderBudget(); break;
        case 'income': renderIncome(); break;
        case 'family-transfer': renderFamilyTransferView(); break;
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
   Daily Meal, Rate System & Partial Payment Implementation
   ========================================================================== */

function getDatesInRange(startStr, endStr) {
    const dates = [];
    if (!startStr || !endStr) return dates;
    
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    
    const curr = new Date(sy, sm - 1, sd, 12, 0, 0);
    const end = new Date(ey, em - 1, ed, 12, 0, 0);
    
    let safetyCount = 0;
    while (curr <= end && safetyCount < 120) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
        safetyCount++;
    }
    return dates;
}

function getMealCalculations(startDate = state.mealPeriod.startDate, endDate = state.mealPeriod.endDate) {
    const dates = getDatesInRange(startDate, endDate);
    
    let totalBreakfasts = 0;
    let totalLunches = 0;
    let totalDinners = 0;
    
    let breakfastCost = 0;
    let lunchCost = 0;
    let dinnerCost = 0;

    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    dates.forEach(dateStr => {
        const entry = state.mealEntries[dateStr];
        if (entry) {
            const bRate = entry.breakfastRate !== undefined ? Number(entry.breakfastRate) : defaultB;
            const lRate = entry.lunchRate !== undefined ? Number(entry.lunchRate) : defaultL;
            const dRate = entry.dinnerRate !== undefined ? Number(entry.dinnerRate) : defaultD;

            if (entry.breakfast) {
                totalBreakfasts++;
                breakfastCost += bRate;
            }
            if (entry.lunch) {
                totalLunches++;
                lunchCost += lRate;
            }
            if (entry.dinner) {
                totalDinners++;
                dinnerCost += dRate;
            }
        }
    });

    const totalMealBill = breakfastCost + lunchCost + dinnerCost;
    const totalMealsCount = totalBreakfasts + totalLunches + totalDinners;

    // Sum partial payments made within this period (or all payments if no filter applies)
    let totalPaid = 0;
    const periodPayments = state.mealPayments.filter(p => {
        if (!startDate || !endDate) return true;
        return p.date >= startDate && p.date <= endDate;
    });

    periodPayments.forEach(p => {
        totalPaid += Number(p.amount || 0);
    });

    const remainingDue = Math.max(0, totalMealBill - totalPaid);
    const advanceCredit = Math.max(0, totalPaid - totalMealBill);

    return {
        startDate,
        endDate,
        dates,
        daysCount: dates.length,
        totalBreakfasts,
        totalLunches,
        totalDinners,
        breakfastCost,
        lunchCost,
        dinnerCost,
        totalMealBill,
        totalMealsCount,
        totalPaid,
        remainingDue,
        advanceCredit,
        paymentsCount: periodPayments.length
    };
}

function renderDailyMealsView() {
    const calc = getMealCalculations();

    // Populate Rates inputs
    const rateBInput = document.getElementById('rate-breakfast');
    const rateLInput = document.getElementById('rate-lunch');
    const rateDInput = document.getElementById('rate-dinner');
    if (rateBInput) rateBInput.value = state.mealSettings.breakfastRate ?? 30;
    if (rateLInput) rateLInput.value = state.mealSettings.lunchRate ?? 50;
    if (rateDInput) rateDInput.value = state.mealSettings.dinnerRate ?? 50;

    // Populate Period inputs
    const periodStartInput = document.getElementById('meal-period-start');
    const periodEndInput = document.getElementById('meal-period-end');
    if (periodStartInput) periodStartInput.value = state.mealPeriod.startDate;
    if (periodEndInput) periodEndInput.value = state.mealPeriod.endDate;

    const activePeriodLabel = document.getElementById('meal-period-active-label');
    if (activePeriodLabel) {
        activePeriodLabel.textContent = `${formatDate(state.mealPeriod.startDate)} – ${formatDate(state.mealPeriod.endDate)}`;
    }

    const trackerSub = document.getElementById('meal-tracker-period-sub');
    if (trackerSub) {
        trackerSub.textContent = `Period: ${formatDate(state.mealPeriod.startDate)} to ${formatDate(state.mealPeriod.endDate)} (${calc.daysCount} days)`;
    }

    // Populate Meal Breakdown Cards
    const sumBCount = document.getElementById('sum-breakfast-count');
    const sumBCost = document.getElementById('sum-breakfast-cost');
    const sumBHint = document.getElementById('sum-breakfast-rate-hint');
    if (sumBCount) sumBCount.textContent = calc.totalBreakfasts;
    if (sumBCost) sumBCost.textContent = formatCurrency(calc.breakfastCost);
    if (sumBHint) sumBHint.textContent = `@ ₹${state.mealSettings.breakfastRate}/meal (Total: ${formatCurrency(calc.breakfastCost)})`;

    const sumLCount = document.getElementById('sum-lunch-count');
    const sumLCost = document.getElementById('sum-lunch-cost');
    const sumLHint = document.getElementById('sum-lunch-rate-hint');
    if (sumLCount) sumLCount.textContent = calc.totalLunches;
    if (sumLCost) sumLCost.textContent = formatCurrency(calc.lunchCost);
    if (sumLHint) sumLHint.textContent = `@ ₹${state.mealSettings.lunchRate}/meal (Total: ${formatCurrency(calc.lunchCost)})`;

    const sumDCount = document.getElementById('sum-dinner-count');
    const sumDCost = document.getElementById('sum-dinner-cost');
    const sumDHint = document.getElementById('sum-dinner-rate-hint');
    if (sumDCount) sumDCount.textContent = calc.totalDinners;
    if (sumDCost) sumDCost.textContent = formatCurrency(calc.dinnerCost);
    if (sumDHint) sumDHint.textContent = `@ ₹${state.mealSettings.dinnerRate}/meal (Total: ${formatCurrency(calc.dinnerCost)})`;

    // Populate Financial Totals
    const sumBill = document.getElementById('sum-total-meal-bill');
    const sumMealsCount = document.getElementById('sum-total-meals-count');
    if (sumBill) sumBill.textContent = formatCurrency(calc.totalMealBill);
    if (sumMealsCount) {
        sumMealsCount.innerHTML = `<i class="ph ph-fork-knife"></i> ${calc.totalMealsCount} ${calc.totalMealsCount === 1 ? 'meal taken' : 'meals taken'}`;
    }

    const sumPaid = document.getElementById('sum-total-paid');
    const sumPaymentsCount = document.getElementById('sum-payments-count');
    if (sumPaid) sumPaid.textContent = formatCurrency(calc.totalPaid);
    if (sumPaymentsCount) {
        sumPaymentsCount.innerHTML = `<i class="ph ph-receipt"></i> ${calc.paymentsCount} ${calc.paymentsCount === 1 ? 'partial payment' : 'partial payments'}`;
    }

    const sumDue = document.getElementById('sum-remaining-due');
    const sumDueTitle = document.getElementById('sum-due-title');
    const sumDueStatus = document.getElementById('sum-due-status-text');
    const sumDueCard = document.getElementById('sum-due-card');

    if (sumDue) {
        if (calc.advanceCredit > 0) {
            sumDue.textContent = formatCurrency(calc.advanceCredit);
            if (sumDueTitle) sumDueTitle.textContent = 'Advance / Credit';
            if (sumDueStatus) sumDueStatus.innerHTML = `<i class="ph ph-check-circle"></i> Paid in advance`;
            if (sumDueCard) {
                sumDueCard.className = 'summary-card meal-due-card positive';
            }
        } else {
            sumDue.textContent = formatCurrency(calc.remainingDue);
            if (sumDueTitle) sumDueTitle.textContent = 'Remaining Due';
            if (sumDueStatus) {
                sumDueStatus.innerHTML = calc.remainingDue > 0 
                    ? `<i class="ph ph-warning-circle"></i> Pending payment` 
                    : `<i class="ph ph-check-circle"></i> Fully paid / All clear`;
            }
            if (sumDueCard) {
                sumDueCard.className = 'summary-card meal-due-card' + (calc.remainingDue > 0 ? ' has-due' : ' positive');
            }
        }
    }

    // Update Tab Badges
    const badgeDays = document.getElementById('meal-badge-days-count');
    if (badgeDays) badgeDays.textContent = calc.daysCount;

    const badgePayments = document.getElementById('meal-badge-payments-count');
    if (badgePayments) badgePayments.textContent = calc.paymentsCount;

    // Update Payment Banner
    const bannerBill = document.getElementById('banner-total-bill');
    const bannerPaid = document.getElementById('banner-total-paid');
    const bannerDue = document.getElementById('banner-remaining-due');
    if (bannerBill) bannerBill.textContent = formatCurrency(calc.totalMealBill);
    if (bannerPaid) bannerPaid.textContent = formatCurrency(calc.totalPaid);
    if (bannerDue) bannerDue.textContent = calc.advanceCredit > 0 ? `+${formatCurrency(calc.advanceCredit)} (Advance)` : formatCurrency(calc.remainingDue);

    renderMealDaysList();
    renderMealPaymentsList();
}

function renderMealDaysList() {
    const container = document.getElementById('meal-days-list');
    if (!container) return;

    const search = (document.getElementById('search-meal-entries')?.value || '').toLowerCase().trim();
    const dates = getDatesInRange(state.mealPeriod.startDate, state.mealPeriod.endDate);
    const todayStr = getLocalDateString(new Date());

    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    let filteredDates = dates;
    if (search) {
        filteredDates = dates.filter(d => {
            const formatted = formatDate(d).toLowerCase();
            const dayName = new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            return d.includes(search) || formatted.includes(search) || dayName.includes(search);
        });
    }

    if (filteredDates.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <i class="ph ph-calendar-x" style="font-size: 2.5rem; margin-bottom: 0.5rem; display: block; color: var(--text-secondary);"></i>
                <p>No dates found for the selected period or search query.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filteredDates.map(dateStr => {
        const entry = state.mealEntries[dateStr] || {
            date: dateStr,
            breakfast: false,
            lunch: false,
            dinner: false,
            breakfastRate: defaultB,
            lunchRate: defaultL,
            dinnerRate: defaultD,
            cost: 0
        };

        const bRate = entry.breakfastRate !== undefined ? entry.breakfastRate : defaultB;
        const lRate = entry.lunchRate !== undefined ? entry.lunchRate : defaultL;
        const dRate = entry.dinnerRate !== undefined ? entry.dinnerRate : defaultD;

        const dayCost = (entry.breakfast ? bRate : 0) + (entry.lunch ? lRate : 0) + (entry.dinner ? dRate : 0);
        const isToday = dateStr === todayStr;

        const dObj = new Date(`${dateStr}T12:00:00`);
        const dayNum = String(dObj.getDate()).padStart(2, '0');
        const monthShort = dObj.toLocaleDateString('en-US', { month: 'short' });
        const dayWeek = dObj.toLocaleDateString('en-US', { weekday: 'short' });
        const fullDateStr = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        return `
            <div class="meal-day-row ${isToday ? 'is-today' : ''}" id="meal-row-${dateStr}">
                <div class="meal-day-date-group">
                    <div class="day-cal-icon">
                        <span>${monthShort}</span>
                        <span class="day-num">${dayNum}</span>
                    </div>
                    <div class="meal-day-info">
                        <span class="meal-day-name">
                            ${fullDateStr}
                            ${isToday ? `<span class="meal-today-badge">Today</span>` : ''}
                        </span>
                        <span class="meal-day-sub">${dayWeek}</span>
                    </div>
                </div>

                <div class="meal-day-toggles">
                    <button type="button" class="meal-toggle-btn breakfast ${entry.breakfast ? 'active' : ''}" 
                        onclick="toggleDayMeal('${dateStr}', 'breakfast')" title="Breakfast (₹${bRate})">
                        <i class="ph ${entry.breakfast ? 'ph-check-circle' : 'ph-egg'}"></i>
                        <span>Breakfast ₹${bRate}</span>
                    </button>
                    <button type="button" class="meal-toggle-btn lunch ${entry.lunch ? 'active' : ''}" 
                        onclick="toggleDayMeal('${dateStr}', 'lunch')" title="Lunch (₹${lRate})">
                        <i class="ph ${entry.lunch ? 'ph-check-circle' : 'ph-bowl-food'}"></i>
                        <span>Lunch ₹${lRate}</span>
                    </button>
                    <button type="button" class="meal-toggle-btn dinner ${entry.dinner ? 'active' : ''}" 
                        onclick="toggleDayMeal('${dateStr}', 'dinner')" title="Dinner (₹${dRate})">
                        <i class="ph ${entry.dinner ? 'ph-check-circle' : 'ph-cooking-pot'}"></i>
                        <span>Dinner ₹${dRate}</span>
                    </button>
                </div>

                <div class="meal-day-right">
                    <div class="meal-day-cost-badge ${dayCost === 0 ? 'zero' : ''}">
                        ${dayCost > 0 ? formatCurrency(dayCost) : 'Skipped'}
                    </div>
                    <div class="meal-day-quick-actions">
                        <button type="button" class="meal-day-btn-action" onclick="setDayMeals('${dateStr}', false, true, true)" title="Mark Lunch + Dinner">L+D</button>
                        <button type="button" class="meal-day-btn-action" onclick="setDayMeals('${dateStr}', true, true, true)" title="Mark All 3">All 3</button>
                        <button type="button" class="meal-day-btn-action" onclick="setDayMeals('${dateStr}', false, false, false)" title="Skip Day">Skip</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDayMeal(dateStr, mealType) {
    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    let entry = state.mealEntries[dateStr];
    if (!entry) {
        entry = {
            date: dateStr,
            breakfast: false,
            lunch: false,
            dinner: false,
            breakfastRate: defaultB,
            lunchRate: defaultL,
            dinnerRate: defaultD,
            cost: 0
        };
    }

    // If rate wasn't set on existing entry, snapshot current default rate
    if (entry.breakfastRate === undefined) entry.breakfastRate = defaultB;
    if (entry.lunchRate === undefined) entry.lunchRate = defaultL;
    if (entry.dinnerRate === undefined) entry.dinnerRate = defaultD;

    entry[mealType] = !entry[mealType];
    entry.cost = (entry.breakfast ? entry.breakfastRate : 0) + 
                 (entry.lunch ? entry.lunchRate : 0) + 
                 (entry.dinner ? entry.dinnerRate : 0);

    state.mealEntries[dateStr] = entry;
    saveData();
    renderDailyMealsView();
    renderDailyMealCard();
}

function setDayMeals(dateStr, breakfast, lunch, dinner) {
    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    let entry = state.mealEntries[dateStr] || {
        date: dateStr,
        breakfastRate: defaultB,
        lunchRate: defaultL,
        dinnerRate: defaultD
    };

    if (entry.breakfastRate === undefined) entry.breakfastRate = defaultB;
    if (entry.lunchRate === undefined) entry.lunchRate = defaultL;
    if (entry.dinnerRate === undefined) entry.dinnerRate = defaultD;

    entry.breakfast = breakfast;
    entry.lunch = lunch;
    entry.dinner = dinner;
    entry.cost = (entry.breakfast ? entry.breakfastRate : 0) + 
                 (entry.lunch ? entry.lunchRate : 0) + 
                 (entry.dinner ? entry.dinnerRate : 0);

    state.mealEntries[dateStr] = entry;
    saveData();
    renderDailyMealsView();
    renderDailyMealCard();
}

function bulkSetPeriodMeals(type) {
    const dates = getDatesInRange(state.mealPeriod.startDate, state.mealPeriod.endDate);
    if (dates.length === 0) return;

    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    dates.forEach(dateStr => {
        let entry = state.mealEntries[dateStr] || {
            date: dateStr,
            breakfastRate: defaultB,
            lunchRate: defaultL,
            dinnerRate: defaultD
        };

        if (entry.breakfastRate === undefined) entry.breakfastRate = defaultB;
        if (entry.lunchRate === undefined) entry.lunchRate = defaultL;
        if (entry.dinnerRate === undefined) entry.dinnerRate = defaultD;

        if (type === 'lunch-dinner') {
            entry.breakfast = false;
            entry.lunch = true;
            entry.dinner = true;
        } else if (type === 'all-three') {
            entry.breakfast = true;
            entry.lunch = true;
            entry.dinner = true;
        } else if (type === 'clear') {
            entry.breakfast = false;
            entry.lunch = false;
            entry.dinner = false;
        }

        entry.cost = (entry.breakfast ? entry.breakfastRate : 0) + 
                     (entry.lunch ? entry.lunchRate : 0) + 
                     (entry.dinner ? entry.dinnerRate : 0);

        state.mealEntries[dateStr] = entry;
    });

    saveData();
    renderDailyMealsView();
    renderDailyMealCard();
    showToast(type === 'clear' ? 'Period meal entries cleared' : 'Bulk meals marked successfully');
}

function saveMealRates(e) {
    if (e) e.preventDefault();
    const rateB = Math.max(0, parseFloat(document.getElementById('rate-breakfast')?.value) || 0);
    const rateL = Math.max(0, parseFloat(document.getElementById('rate-lunch')?.value) || 0);
    const rateD = Math.max(0, parseFloat(document.getElementById('rate-dinner')?.value) || 0);

    state.mealSettings = {
        breakfastRate: rateB,
        lunchRate: rateL,
        dinnerRate: rateD
    };

    saveData();
    renderDailyMealsView();
    renderDailyMealCard();
    showToast(`Meal rates saved (Breakfast: ₹${rateB}, Lunch: ₹${rateL}, Dinner: ₹${rateD}). Future entries will use these rates.`);
}

function saveMealPeriod(e) {
    if (e) e.preventDefault();
    const start = document.getElementById('meal-period-start')?.value;
    const end = document.getElementById('meal-period-end')?.value;

    if (!start || !end) {
        showToast('Please select both Start Date and End Date', 'warning');
        return;
    }

    if (start > end) {
        showToast('Start Date cannot be after End Date', 'error');
        return;
    }

    state.mealPeriod = { startDate: start, endDate: end };
    saveData();
    renderDailyMealsView();
    renderDailyMealCard();
    showToast(`Meal period set from ${formatDate(start)} to ${formatDate(end)}`);
}

function setMealPeriodPreset(preset) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();

    let startDate = '';
    let endDate = '';

    if (preset === '17-cycle') {
        // 17th of previous/current month to 16th of current/next month
        if (today >= 17) {
            const startObj = new Date(y, m, 17);
            const endObj = new Date(y, m + 1, 16);
            startDate = getLocalDateString(startObj);
            endDate = getLocalDateString(endObj);
        } else {
            const startObj = new Date(y, m - 1, 17);
            const endObj = new Date(y, m, 16);
            startDate = getLocalDateString(startObj);
            endDate = getLocalDateString(endObj);
        }
    } else if (preset === 'this-month') {
        const startObj = new Date(y, m, 1);
        const endObj = new Date(y, m + 1, 0);
        startDate = getLocalDateString(startObj);
        endDate = getLocalDateString(endObj);
    } else if (preset === 'prev-month') {
        const startObj = new Date(y, m - 1, 1);
        const endObj = new Date(y, m, 0);
        startDate = getLocalDateString(startObj);
        endDate = getLocalDateString(endObj);
    } else if (preset === '30-days') {
        const startObj = new Date();
        startObj.setDate(startObj.getDate() - 29);
        startDate = getLocalDateString(startObj);
        endDate = getLocalDateString(now);
    }

    if (startDate && endDate) {
        const startEl = document.getElementById('meal-period-start');
        const endEl = document.getElementById('meal-period-end');
        if (startEl) startEl.value = startDate;
        if (endEl) endEl.value = endDate;

        document.querySelectorAll('.period-preset-btn').forEach(b => {
            if (b.dataset.preset === preset) b.classList.add('active');
            else b.classList.remove('active');
        });

        saveMealPeriod();
    }
}

// Partial Payments Functions
function renderMealPaymentsList() {
    const container = document.getElementById('meal-payments-list');
    if (!container) return;

    const startDate = state.mealPeriod.startDate;
    const endDate = state.mealPeriod.endDate;

    // Filter payments in active period
    const payments = state.mealPayments.filter(p => {
        if (!startDate || !endDate) return true;
        return p.date >= startDate && p.date <= endDate;
    });

    // Sort newest date first
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (payments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                <i class="ph ph-hand-coins" style="font-size: 2.75rem; margin-bottom: 0.65rem; display: block; color: var(--primary);"></i>
                <h4 style="color: var(--text-primary); margin-bottom: 0.35rem;">No Partial Payments Recorded</h4>
                <p style="font-size: 0.85rem; max-width: 380px; margin: 0 auto 1rem;">You do not have to pay the full meal bill at once. Record multiple partial payments here anytime.</p>
                <button class="primary-btn btn-sm" onclick="openMealPaymentModal()">
                    <i class="ph-bold ph-plus-circle"></i> <span>Record First Payment</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = payments.map(p => `
        <div class="meal-payment-item">
            <div class="meal-payment-left">
                <div class="meal-payment-icon">
                    <i class="ph ph-hand-coins"></i>
                </div>
                <div class="meal-payment-details">
                    <span class="meal-payment-title">${formatCurrency(p.amount)} Paid</span>
                    <div class="meal-payment-meta">
                        <span><i class="ph ph-calendar-blank"></i> ${formatDate(p.date)}</span>
                        <span class="method-tag">${escapeHtml(p.paymentMethod || 'UPI')}</span>
                        ${p.note ? `<span><i class="ph ph-note"></i> ${escapeHtml(p.note)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div class="meal-payment-right">
                <span class="meal-payment-amount">+${formatCurrency(p.amount)}</span>
                <button class="record-action-btn delete" title="Delete Payment Record" onclick="deleteMealPayment('${p.id}')">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function openMealPaymentModal(editId = null) {
    const form = document.getElementById('meal-payment-form');
    if (!form) return;
    form.reset();

    const titleEl = document.getElementById('modal-meal-payment-title');
    const idInput = document.getElementById('meal-payment-id');
    const calc = getMealCalculations();

    const fullDueBtn = document.getElementById('btn-quick-pay-full-due');
    if (fullDueBtn) {
        const remainingDue = calc.remainingDue;
        fullDueBtn.textContent = remainingDue > 0 ? `Pay Full Due (${formatCurrency(remainingDue)})` : 'Full Paid';
        fullDueBtn.dataset.due = remainingDue;
    }

    if (editId) {
        const p = state.mealPayments.find(item => item.id === editId);
        if (p) {
            if (titleEl) titleEl.textContent = 'Edit Meal Payment';
            idInput.value = p.id;
            document.getElementById('meal-payment-amount').value = p.amount;
            document.getElementById('meal-payment-date').value = p.date;
            document.getElementById('meal-payment-method').value = p.paymentMethod || 'UPI';
            document.getElementById('meal-payment-note').value = p.note || '';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Record Meal Payment';
        idInput.value = '';
        document.getElementById('meal-payment-date').value = getLocalDateString(new Date());
        document.getElementById('meal-payment-method').value = 'UPI';
        // Auto-suggest remaining due if greater than 0
        if (calc.remainingDue > 0) {
            document.getElementById('meal-payment-amount').value = calc.remainingDue;
        }
    }

    openModal('meal-payment-modal');
}

function saveMealPayment(e) {
    e.preventDefault();
    const id = document.getElementById('meal-payment-id').value;
    const amount = parseFloat(document.getElementById('meal-payment-amount').value);
    const date = document.getElementById('meal-payment-date').value;
    const paymentMethod = document.getElementById('meal-payment-method').value;
    const note = document.getElementById('meal-payment-note').value.trim();

    if (!amount || amount <= 0 || !date) {
        showToast('Please enter a valid payment amount and date', 'warning');
        return;
    }

    if (id) {
        const idx = state.mealPayments.findIndex(p => p.id === id);
        if (idx !== -1) {
            state.mealPayments[idx] = {
                ...state.mealPayments[idx],
                amount,
                date,
                paymentMethod,
                note,
                updatedAt: new Date().toISOString()
            };
            showToast('Meal payment updated successfully');
        }
    } else {
        const newPayment = {
            id: 'mp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            amount,
            date,
            paymentMethod,
            note,
            createdAt: new Date().toISOString()
        };
        state.mealPayments.unshift(newPayment);
        showToast(`Meal payment of ${formatCurrency(amount)} recorded successfully`);
    }

    saveData();
    closeModal('meal-payment-modal');
    renderDailyMealsView();
    renderDailyMealCard();
}

function deleteMealPayment(id) {
    const p = state.mealPayments.find(item => item.id === id);
    if (!p) return;

    showConfirmModal(
        'Delete Meal Payment Record?',
        `Are you sure you want to delete this payment of ${formatCurrency(p.amount)} recorded on ${formatDate(p.date)}?`,
        () => {
            state.mealPayments = state.mealPayments.filter(item => item.id !== id);
            saveData();
            renderDailyMealsView();
            renderDailyMealCard();
            showToast('Payment record deleted');
        }
    );
}

function renderDailyMealCard() {
    const container = document.getElementById('daily-meal-card');
    if (!container) return;

    const calc = getMealCalculations();
    const todayStr = getLocalDateString(new Date());
    const defaultB = Number(state.mealSettings.breakfastRate) || 30;
    const defaultL = Number(state.mealSettings.lunchRate) || 50;
    const defaultD = Number(state.mealSettings.dinnerRate) || 50;

    const todayEntry = state.mealEntries[todayStr] || {
        date: todayStr,
        breakfast: false,
        lunch: false,
        dinner: false,
        breakfastRate: defaultB,
        lunchRate: defaultL,
        dinnerRate: defaultD,
        cost: 0
    };

    const bRate = todayEntry.breakfastRate !== undefined ? todayEntry.breakfastRate : defaultB;
    const lRate = todayEntry.lunchRate !== undefined ? todayEntry.lunchRate : defaultL;
    const dRate = todayEntry.dinnerRate !== undefined ? todayEntry.dinnerRate : defaultD;

    const dueText = calc.advanceCredit > 0 
        ? `<span style="color: var(--success);">Advance: ${formatCurrency(calc.advanceCredit)}</span>`
        : `<span style="color: ${calc.remainingDue > 0 ? 'var(--danger)' : 'var(--success)'};">Due: ${formatCurrency(calc.remainingDue)}</span>`;

    container.innerHTML = `
        <div class="daily-meal-card-header">
            <div class="daily-meal-title-group">
                <div class="daily-meal-icon-badge"><i class="ph ph-cooking-pot"></i></div>
                <div>
                    <h3>PG Mess Daily Meals <span class="meal-badge"><i class="ph ph-calendar"></i> ${formatDate(state.mealPeriod.startDate)} – ${formatDate(state.mealPeriod.endDate)}</span></h3>
                    <span class="daily-meal-subtitle">Track breakfast, lunch, dinner rates & partial payments</span>
                </div>
            </div>
            <button class="primary-btn btn-sm" onclick="renderView('daily-meals')">
                <i class="ph ph-cooking-pot"></i> Open Meal Manager
            </button>
        </div>
        <div class="daily-meal-content">
            <div class="daily-meal-details">
                <div class="daily-meal-formula-pill">
                    <i class="ph ph-receipt"></i> Total: ${formatCurrency(calc.totalMealBill)} (${calc.totalMealsCount} meals) • Paid: ${formatCurrency(calc.totalPaid)} • ${dueText}
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-top: 0.4rem;">
                    <span style="font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);">Today's Quick Mark:</span>
                    <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                        <button type="button" class="meal-toggle-btn breakfast ${todayEntry.breakfast ? 'active' : ''}" 
                            onclick="toggleDayMeal('${todayStr}', 'breakfast')" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;">
                            <i class="ph ${todayEntry.breakfast ? 'ph-check-circle' : 'ph-egg'}"></i> Breakfast (₹${bRate})
                        </button>
                        <button type="button" class="meal-toggle-btn lunch ${todayEntry.lunch ? 'active' : ''}" 
                            onclick="toggleDayMeal('${todayStr}', 'lunch')" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;">
                            <i class="ph ${todayEntry.lunch ? 'ph-check-circle' : 'ph-bowl-food'}"></i> Lunch (₹${lRate})
                        </button>
                        <button type="button" class="meal-toggle-btn dinner ${todayEntry.dinner ? 'active' : ''}" 
                            onclick="toggleDayMeal('${todayStr}', 'dinner')" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;">
                            <i class="ph ${todayEntry.dinner ? 'ph-check-circle' : 'ph-cooking-pot'}"></i> Dinner (₹${dRate})
                        </button>
                    </div>
                </div>
            </div>
            <div class="daily-meal-quick-actions">
                <button class="secondary-btn btn-sm" onclick="openMealPaymentModal()" title="Record Partial Payment">
                    <i class="ph-bold ph-plus-circle"></i> Pay Meal Due
                </button>
            </div>
        </div>
    `;
}

/* ==========================================================================
   UI Rendering - Expenses List
   ========================================================================== */
function renderExpensesList() {
    renderDailyMealCard();
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
        const mealBadge = exp.isDailyMeal ? `<span class="meal-badge"><i class="ph ph-cooking-pot"></i> Daily Meal</span>` : '';
        const editAction = exp.isDailyMeal 
            ? `openDailyMealModal('${exp.date.substring(0, 7)}')` 
            : `editExpense(${exp.id})`;
        const iconClass = exp.isDailyMeal ? 'ph-cooking-pot' : getIconForCategory(exp.category);

        container.innerHTML += `
            <div class="expense-item">
                <div class="expense-left">
                    <div class="cat-icon"><i class="ph ${iconClass}"></i></div>
                    <div class="expense-details">
                        <span class="expense-title">${exp.description || exp.category} ${mealBadge}</span>
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
                        <button class="action-btn" title="Edit" onclick="${editAction}"><i class="ph ph-pencil-simple"></i></button>
                        <button class="action-btn delete" title="Delete" onclick="deleteExpense(${exp.id})"><i class="ph ph-trash"></i></button>
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
    
    const monthYearEl = document.getElementById('cal-month-year');
    if (monthYearEl) monthYearEl.textContent = monthYearStr;

    const grid = document.getElementById('calendar-days');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

    // If no selected date or selected date is in another month, default to today or 1st
    if (!selectedCalendarDate || !selectedCalendarDate.startsWith(currentMonthKey)) {
        if (todayStr.startsWith(currentMonthKey)) {
            selectedCalendarDate = todayStr;
        } else {
            selectedCalendarDate = `${currentMonthKey}-01`;
        }
    }

    // Calculate daily expenses (transactions + daily mess meals) for the month
    const dailyExpenses = {};
    const dailyMealFlags = {};

    state.expenses.forEach(e => {
        if (e.date && e.date.startsWith(currentMonthKey)) {
            dailyExpenses[e.date] = (dailyExpenses[e.date] || 0) + Number(e.amount || 0);
        }
    });

    if (state.mealEntries) {
        Object.keys(state.mealEntries).forEach(dateStr => {
            if (dateStr.startsWith(currentMonthKey)) {
                const mealEntry = state.mealEntries[dateStr];
                const cost = Number(mealEntry?.cost || 0);
                if (cost > 0) {
                    dailyExpenses[dateStr] = (dailyExpenses[dateStr] || 0) + cost;
                    dailyMealFlags[dateStr] = true;
                }
            }
        });
    }

    // Find max for highlighting
    let maxDaily = 0;
    Object.values(dailyExpenses).forEach(v => { if (v > maxDaily) maxDaily = v; });

    // Empty cells for first day
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="cal-day empty"></div>`;
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalendarDate;
        const amount = dailyExpenses[dateStr] || 0;
        const hasMeal = !!dailyMealFlags[dateStr];
        
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
                ${hasMeal ? `<span class="cal-meal-dot" title="Daily Meal recorded"></span>` : ''}
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
    const mealEntry = state.mealEntries ? state.mealEntries[dateStr] : null;
    const mealCost = (mealEntry && mealEntry.cost > 0) ? mealEntry.cost : 0;
    
    const expTotal = dayExps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const dayTotal = expTotal + mealCost;
    
    const totalBadge = document.getElementById('cal-selected-total');
    if (totalBadge) totalBadge.textContent = `Total: ${formatCurrency(dayTotal)}`;

    if (dayExps.length === 0 && mealCost === 0) {
        list.innerHTML = `
            <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-secondary);">
                <i class="ph ph-receipt-x" style="font-size: 2.2rem; color: var(--text-secondary); opacity: 0.5; display: block; margin-bottom: 0.5rem;"></i>
                <p style="font-size: 0.9rem;">No expenses or meals recorded on this day.</p>
            </div>
        `;
        return;
    }

    // Render Daily Mess Meal item if present for this date
    if (mealCost > 0 && mealEntry) {
        const mealParts = [];
        if (mealEntry.breakfast) mealParts.push(`Breakfast (₹${mealEntry.breakfastRate ?? 30})`);
        if (mealEntry.lunch) mealParts.push(`Lunch (₹${mealEntry.lunchRate ?? 50})`);
        if (mealEntry.dinner) mealParts.push(`Dinner (₹${mealEntry.dinnerRate ?? 50})`);

        list.innerHTML += `
            <div class="expense-item" style="padding: 0.75rem 0.5rem; background: rgba(79, 70, 229, 0.06); border-radius: var(--radius-sm); margin-bottom: 0.5rem; border: 1px solid rgba(79, 70, 229, 0.2);">
                <div class="expense-left">
                    <div class="cat-icon" style="width:36px;height:36px;font-size:1.1rem;background:linear-gradient(135deg, var(--primary), #818cf8);color:white;">
                        <i class="ph ph-cooking-pot"></i>
                    </div>
                    <div class="expense-details">
                        <span class="expense-title">Daily Mess Meals <span class="meal-badge"><i class="ph ph-check-circle"></i> Taken</span></span>
                        <span class="expense-meta">${mealParts.join(' • ')}</span>
                    </div>
                </div>
                <div class="expense-right">
                    <span class="expense-amount" style="color: var(--primary); font-weight: 800;">${formatCurrency(mealCost)}</span>
                </div>
            </div>
        `;
    }

    // Render regular expenses
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
    const mealSelect = document.getElementById('meal-category');
    
    let opts = '';
    state.categories.forEach(c => {
        opts += `<option value="${c.name}">${c.name}</option>`;
    });
    
    if (addSelect) addSelect.innerHTML = opts;
    if (mealSelect) {
        mealSelect.innerHTML = opts;
        if (state.categories.some(c => c.name === 'Food')) {
            mealSelect.value = 'Food';
        }
    }
    
    // Keep 'All' in filter
    if (filterSelect) filterSelect.innerHTML = '<option value="all">All Categories</option>' + opts;
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

    if (exp.isDailyMeal) {
        const monthKey = exp.mealConfig?.month || exp.date.substring(0, 7);
        openDailyMealModal(monthKey);
        return;
    }
    
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
    const exp = state.expenses.find(e => e.id === id);
    const confirmed = await showConfirm('Delete Expense?', 'Are you sure you want to delete this expense?');
    if(confirmed) {
        if (exp && exp.isDailyMeal && exp.date) {
            const mKey = exp.mealConfig?.month || exp.date.substring(0, 7);
            delete state.dailyMeals[mKey];
        }
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
    const workbook = XLSX.utils.book_new();

    // 1. Expenses Sheet
    if (state.expenses.length > 0) {
        const data = state.expenses.map(e => ({
            Date: e.date,
            Category: e.category,
            Description: e.description || '',
            Amount: e.amount,
            'Payment Method': e.paymentMethod,
            Type: e.type
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, "Expenses");
    }

    // 2. Meal Entries Sheet
    const mealEntriesList = Object.values(state.mealEntries).filter(e => e.breakfast || e.lunch || e.dinner);
    if (mealEntriesList.length > 0) {
        mealEntriesList.sort((a, b) => new Date(a.date) - new Date(b.date));
        const mealData = mealEntriesList.map(e => ({
            Date: e.date,
            Breakfast: e.breakfast ? `Yes (₹${e.breakfastRate || 30})` : 'No',
            Lunch: e.lunch ? `Yes (₹${e.lunchRate || 50})` : 'No',
            Dinner: e.dinner ? `Yes (₹${e.dinnerRate || 50})` : 'No',
            'Day Total (₹)': e.cost
        }));
        const mealWorksheet = XLSX.utils.json_to_sheet(mealData);
        XLSX.utils.book_append_sheet(workbook, mealWorksheet, "Daily Meals");
    }

    // 3. Meal Payments Sheet
    if (state.mealPayments.length > 0) {
        const payData = state.mealPayments.map(p => ({
            Date: p.date,
            'Amount Paid (₹)': p.amount,
            'Payment Method': p.paymentMethod || 'UPI',
            Note: p.note || ''
        }));
        const payWorksheet = XLSX.utils.json_to_sheet(payData);
        XLSX.utils.book_append_sheet(workbook, payWorksheet, "Meal Payments");
    }

    if (workbook.SheetNames.length === 0) {
        showToast('No data to export', 'error');
        return;
    }

    // Download the file
    XLSX.writeFile(workbook, `PG_Expenses_and_Meals_${getMonthKey(new Date())}.xlsx`);
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

    // Daily Meal Navigation and Quick Actions
    const btnOpenDailyMeal = document.getElementById('btn-open-daily-meal');
    if (btnOpenDailyMeal) {
        btnOpenDailyMeal.addEventListener('click', () => renderView('daily-meals'));
    }

    const linkOpenDailyMeal = document.getElementById('link-open-daily-meal');
    if (linkOpenDailyMeal) {
        linkOpenDailyMeal.addEventListener('click', () => {
            closeModal('expense-modal');
            renderView('daily-meals');
        });
    }

    const btnToggleRates = document.getElementById('btn-toggle-meal-rates');
    if (btnToggleRates) {
        btnToggleRates.addEventListener('click', () => {
            const panel = document.getElementById('meal-rates-panel');
            if (panel) {
                panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const bInput = document.getElementById('rate-breakfast');
                if (bInput) bInput.focus();
            }
        });
    }

    const btnOpenAddMealPay = document.getElementById('btn-open-add-meal-payment');
    if (btnOpenAddMealPay) {
        btnOpenAddMealPay.addEventListener('click', () => openMealPaymentModal());
    }

    const btnAddPartialPay = document.getElementById('btn-add-partial-payment');
    if (btnAddPartialPay) {
        btnAddPartialPay.addEventListener('click', () => openMealPaymentModal());
    }

    // Meal Rates Form Submit
    const mealRatesForm = document.getElementById('meal-rates-form');
    if (mealRatesForm) {
        mealRatesForm.addEventListener('submit', saveMealRates);
    }

    // Meal Period Form Submit & Presets
    const mealPeriodForm = document.getElementById('meal-period-form');
    if (mealPeriodForm) {
        mealPeriodForm.addEventListener('submit', saveMealPeriod);
    }

    document.querySelectorAll('.period-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (preset) setMealPeriodPreset(preset);
        });
    });

    // Meal Tabs Switcher (Daily Entries vs Payments)
    const tabBtnDailyEntries = document.getElementById('tab-btn-daily-entries');
    const tabBtnMealPayments = document.getElementById('tab-btn-meal-payments');

    if (tabBtnDailyEntries && tabBtnMealPayments) {
        tabBtnDailyEntries.addEventListener('click', () => {
            tabBtnDailyEntries.classList.add('active');
            tabBtnMealPayments.classList.remove('active');
            document.getElementById('meal-tab-entries')?.classList.remove('hidden');
            document.getElementById('meal-tab-entries')?.classList.add('active');
            document.getElementById('meal-tab-payments')?.classList.add('hidden');
            document.getElementById('meal-tab-payments')?.classList.remove('active');
        });

        tabBtnMealPayments.addEventListener('click', () => {
            tabBtnMealPayments.classList.add('active');
            tabBtnDailyEntries.classList.remove('active');
            document.getElementById('meal-tab-payments')?.classList.remove('hidden');
            document.getElementById('meal-tab-payments')?.classList.add('active');
            document.getElementById('meal-tab-entries')?.classList.add('hidden');
            document.getElementById('meal-tab-entries')?.classList.remove('active');
        });
    }

    // Meal Bulk Action Buttons
    const btnBulkLD = document.getElementById('btn-bulk-lunch-dinner');
    if (btnBulkLD) {
        btnBulkLD.addEventListener('click', () => bulkSetPeriodMeals('lunch-dinner'));
    }

    const btnBulkAll = document.getElementById('btn-bulk-all-three');
    if (btnBulkAll) {
        btnBulkAll.addEventListener('click', () => bulkSetPeriodMeals('all-three'));
    }

    const btnBulkClear = document.getElementById('btn-bulk-clear');
    if (btnBulkClear) {
        btnBulkClear.addEventListener('click', async () => {
            const confirmed = await showConfirm('Clear Period Meal Entries?', 'Reset all meal markers for the selected period?');
            if (confirmed) {
                bulkSetPeriodMeals('clear');
            }
        });
    }

    // Meal Days Search Filter
    const searchMealInput = document.getElementById('search-meal-entries');
    if (searchMealInput) {
        searchMealInput.addEventListener('input', renderMealDaysList);
    }

    // Meal Payment Modal Listeners
    const btnCloseMealPayModal = document.getElementById('btn-close-meal-payment-modal');
    if (btnCloseMealPayModal) {
        btnCloseMealPayModal.addEventListener('click', () => closeModal('meal-payment-modal'));
    }

    const btnCancelMealPay = document.getElementById('btn-cancel-meal-payment');
    if (btnCancelMealPay) {
        btnCancelMealPay.addEventListener('click', () => closeModal('meal-payment-modal'));
    }

    const mealPaymentForm = document.getElementById('meal-payment-form');
    if (mealPaymentForm) {
        mealPaymentForm.addEventListener('submit', saveMealPayment);
    }

    // Quick amounts for Meal Payment Modal
    document.querySelectorAll('.quick-btn-meal-pay').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const input = document.getElementById('meal-payment-amount');
            if (!input) return;

            if (val === 'due') {
                const dueAmount = parseFloat(btn.dataset.due || 0);
                input.value = dueAmount > 0 ? dueAmount : 0;
            } else {
                input.value = (parseFloat(input.value || 0) + parseFloat(val)).toString();
            }
        });
    });

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

    // Family Transfer Events Setup
    setupFamilyTransferEventListeners();

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
    
    // Reset All Data
    const btnResetAll = document.getElementById('btn-reset-all-data');
    if (btnResetAll) {
        btnResetAll.addEventListener('click', resetAllData);
    }

    // Confirmation Modal Actions
    const btnConfirmOk = document.getElementById('btn-confirm-ok');
    if (btnConfirmOk) {
        btnConfirmOk.addEventListener('click', () => {
            closeModal('confirm-modal');
            if (confirmCallback) {
                confirmCallback();
                confirmCallback = null;
            }
        });
    }

    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    if (btnConfirmCancel) {
        btnConfirmCancel.addEventListener('click', () => {
            closeModal('confirm-modal');
            confirmCallback = null;
        });
    }

    // Monthly PDF Report Generation
    const btnPrintAnalysis = document.getElementById('btn-print-analysis');
    if (btnPrintAnalysis) {
        btnPrintAnalysis.addEventListener('click', () => {
            const selectedMonth = document.getElementById('analysis-month-select').value;
            generateMonthlyPDFReport(selectedMonth);
        });
    }

    const drawerPdfReportBtn = document.getElementById('drawer-pdf-report-btn');
    if (drawerPdfReportBtn) {
        drawerPdfReportBtn.addEventListener('click', () => {
            closeDrawer();
            generateMonthlyPDFReport(getMonthKey(new Date()));
        });
    }

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

/* ==========================================================================
   Monthly PDF Summary Statement Generator
   ========================================================================== */
function generateMonthlyPDFReport(selectedMonthKey) {
    const monthKey = selectedMonthKey || document.getElementById('analysis-month-select')?.value || getMonthKey(new Date());
    const [y, m] = monthKey.split('-').map(Number);
    const monthDate = new Date(y, m - 1, 1);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const monthExps = state.expenses.filter(e => e.date && e.date.startsWith(monthKey));
    const monthIncomes = state.income.filter(i => i.date && i.date.startsWith(monthKey));

    const totalExp = monthExps.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalInc = monthIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const budget = state.settings.budget || 12000;
    const netSavings = totalInc - totalExp;
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysPassed = monthKey === getMonthKey(new Date()) ? Math.max(1, new Date().getDate()) : daysInMonth;
    const avgDaily = totalExp / daysPassed;

    // Category breakdown
    const catMap = {};
    monthExps.forEach(e => {
        catMap[e.category] = (catMap[e.category] || 0) + Number(e.amount || 0);
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const catRows = sortedCats.map(([cat, amt]) => {
        const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
        return `
            <tr>
                <td>${cat}</td>
                <td style="text-align: right;">${formatCurrency(amt)}</td>
                <td style="text-align: right;">${pct}%</td>
            </tr>
        `;
    }).join('');

    const expRows = monthExps.map((e, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${formatDate(e.date)}</td>
            <td>${e.category}</td>
            <td>${e.description || '-'}</td>
            <td>${e.paymentMethod || 'Cash'}</td>
            <td style="text-align: right; font-weight: bold;">${formatCurrency(e.amount)}</td>
        </tr>
    `).join('');

    // Meal Calculations for the month
    const monthMealDates = Object.keys(state.mealEntries).filter(d => d.startsWith(monthKey) && state.mealEntries[d]?.cost > 0);
    let mealSectionHtml = '';
    if (monthMealDates.length > 0) {
        const daysInM = new Date(y, m, 0).getDate();
        const startOfM = `${monthKey}-01`;
        const endOfM = `${monthKey}-${String(daysInM).padStart(2, '0')}`;
        const mealCalc = getMealCalculations(startOfM, endOfM);
        
        mealSectionHtml = `
            <div class="statement-section-title">Daily Mess Meals & Payments Summary</div>
            <div class="statement-summary-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 15px;">
                <div class="summary-box">
                    <span>Meals (Breakfast/Lunch/Dinner)</span>
                    <strong>${mealCalc.totalBreakfasts}B / ${mealCalc.totalLunches}L / ${mealCalc.totalDinners}D (${mealCalc.totalMealsCount} total)</strong>
                </div>
                <div class="summary-box">
                    <span>Total Meal Bill</span>
                    <strong style="color: #4f46e5;">${formatCurrency(mealCalc.totalMealBill)}</strong>
                </div>
                <div class="summary-box">
                    <span>Payments & Remaining Due</span>
                    <strong>Paid: ${formatCurrency(mealCalc.totalPaid)} | Due: ${formatCurrency(mealCalc.remainingDue)}</strong>
                </div>
            </div>
        `;
    }

    const statementEl = document.getElementById('printable-statement');
    if (!statementEl) return;

    statementEl.innerHTML = `
        <div class="statement-header">
            <div class="statement-brand">
                <h1>Expense PG</h1>
                <p>Student Financial Statement & Expense Summary</p>
            </div>
            <div class="statement-meta">
                <p><strong>Student Name:</strong> ${state.settings.userName || 'Student'}</p>
                <p><strong>Month:</strong> ${monthName}</p>
                <p><strong>Generated On:</strong> ${formatDate(new Date().toISOString())}</p>
            </div>
        </div>

        <div class="statement-summary-grid">
            <div class="summary-box">
                <span>Monthly Budget</span>
                <strong>${formatCurrency(budget)}</strong>
            </div>
            <div class="summary-box">
                <span>Total Income / Allowance</span>
                <strong style="color: #10b981;">${formatCurrency(totalInc)}</strong>
            </div>
            <div class="summary-box">
                <span>Total Expenses</span>
                <strong style="color: #ef4444;">${formatCurrency(totalExp)}</strong>
            </div>
            <div class="summary-box">
                <span>Net Balance / Savings</span>
                <strong style="color: ${netSavings >= 0 ? '#10b981' : '#ef4444'};">${formatCurrency(netSavings)}</strong>
            </div>
        </div>

        ${mealSectionHtml}

        <div class="statement-section-title">Category-wise Expenditure</div>
        <table class="statement-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th style="text-align: right;">Amount</th>
                    <th style="text-align: right;">Share (%)</th>
                </tr>
            </thead>
            <tbody>
                ${catRows || '<tr><td colspan="3" style="text-align:center;">No expenses recorded</td></tr>'}
            </tbody>
        </table>

        <div class="statement-section-title">Itemized Transactions (${monthExps.length} records)</div>
        <table class="statement-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Method</th>
                    <th style="text-align: right;">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${expRows || '<tr><td colspan="6" style="text-align:center;">No transactions recorded for this month</td></tr>'}
            </tbody>
        </table>

        <div class="statement-footer">
            <div>
                <p>Generated automatically via Expense PG Manager</p>
                <p>Daily Average: ${formatCurrency(avgDaily)}/day</p>
            </div>
            <div class="statement-signature">
                <div class="signature-line"></div>
                <p>Verified / Student Signature</p>
            </div>
        </div>
    `;

    window.print();
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

/* ==========================================================================
   Reset All Data & Confirmation Modal
   ========================================================================== */
let confirmCallback = null;

function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title || 'Are you sure?';
    document.getElementById('confirm-message').textContent = message || 'This action cannot be undone.';
    confirmCallback = onConfirm;
    openModal('confirm-modal');
}

function resetAllData() {
    showConfirmModal(
        'Reset All Data?',
        'This will permanently erase all recorded expenses, income, custom categories, and profile settings. Are you sure?',
        () => {
            localStorage.clear();
            state.expenses = [];
            state.income = [];
            state.categories = [...DEFAULT_CATEGORIES];
            state.dailyMeals = {};
            state.dailyMealSettings = {
                name: 'PG Mess / Daily Meals',
                mealsPerDay: 2,
                costPerMeal: 50,
                paymentMethod: 'UPI',
                category: 'Food'
            };
            state.mealSettings = {
                breakfastRate: 30,
                lunchRate: 50,
                dinnerRate: 50
            };
            state.mealPeriod = {
                startDate: '',
                endDate: ''
            };
            state.mealEntries = {};
            state.mealPayments = [];
            state.settings = {
                budget: 12000,
                savingsGoal: 3000,
                currency: '₹',
                theme: 'light',
                userName: ''
            };
            familyData = {
                received: [],
                roomRent: [],
                currentBill: []
            };
            saveData();
            saveFamilyData();
            location.reload();
        }
    );
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
    } else if(id === 'meal-payment-modal') {
        syncMealPayQuickDateButtons();
        setTimeout(() => document.getElementById('meal-payment-amount')?.focus(), 100);
    } else if(id === 'family-received-modal') {
        const curEl = document.getElementById('fam-received-currency');
        if (curEl) curEl.textContent = state.settings.currency;
        syncFamilyQuickDateButtons();
        setTimeout(() => document.getElementById('fam-received-amount')?.focus(), 100);
    } else if(id === 'family-rent-modal') {
        const curEl = document.getElementById('fam-rent-currency');
        if (curEl) curEl.textContent = state.settings.currency;
        setTimeout(() => document.getElementById('fam-rent-amount')?.focus(), 100);
    } else if(id === 'family-bill-modal') {
        const curEl = document.getElementById('fam-bill-currency');
        if (curEl) curEl.textContent = state.settings.currency;
        setTimeout(() => document.getElementById('fam-bill-amount')?.focus(), 100);
    }
}

function syncMealPayQuickDateButtons() {
    const input = document.getElementById('meal-payment-date');
    if (!input) return;
    const val = input.value;
    const today = getLocalDateString(new Date());

    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterday = getLocalDateString(yestDate);

    const btnToday = document.getElementById('btn-meal-payment-date-today');
    const btnYesterday = document.getElementById('btn-meal-payment-date-yesterday');

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

/* ==========================================================================
   Family Transfer & Mess Payments Feature Implementation (Completely Isolated)
   ========================================================================== */
function loadFamilyData() {
    const raw = localStorage.getItem('pg_family_transfers');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            familyData.received = Array.isArray(parsed.received) ? parsed.received : [];
            familyData.roomRent = Array.isArray(parsed.roomRent) ? parsed.roomRent : [];
            familyData.currentBill = Array.isArray(parsed.currentBill) ? parsed.currentBill : [];
        } catch (e) {
            console.error('Error parsing family transfer data', e);
        }
    }
}

function saveFamilyData() {
    localStorage.setItem('pg_family_transfers', JSON.stringify(familyData));
}

function getLocalTimeString(date = new Date()) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function parseTime24To12(timeStr) {
    if (!timeStr) {
        const now = new Date();
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { hour: String(h).padStart(2, '0'), minute: m, ampm };
    }
    const parts = timeStr.split(':');
    let h24 = parseInt(parts[0], 10);
    const m = parts[1] ? String(parseInt(parts[1], 10)).padStart(2, '0') : '00';
    if (isNaN(h24)) h24 = 12;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return { hour: String(h12).padStart(2, '0'), minute: m, ampm };
}

function formatTime12To24(hour12, minute, ampm) {
    let h = parseInt(hour12, 10);
    if (isNaN(h)) h = 12;
    const m = String(parseInt(minute, 10) || 0).padStart(2, '0');
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
}

function setTimePickerValues(prefix, timeStr = null) {
    const { hour, minute, ampm } = parseTime24To12(timeStr);
    const hEl = document.getElementById(`${prefix}-time-hour`);
    const mEl = document.getElementById(`${prefix}-time-minute`);
    const aEl = document.getElementById(`${prefix}-time-ampm`);
    const hiddenEl = document.getElementById(`${prefix}-time`);
    
    if (hEl) hEl.value = hour;
    if (mEl) mEl.value = minute;
    if (aEl) aEl.value = ampm;
    if (hiddenEl) hiddenEl.value = formatTime12To24(hour, minute, ampm);
}

function getTimePickerValue(prefix) {
    const hEl = document.getElementById(`${prefix}-time-hour`);
    const mEl = document.getElementById(`${prefix}-time-minute`);
    const aEl = document.getElementById(`${prefix}-time-ampm`);
    if (!hEl || !mEl || !aEl) return getLocalTimeString();
    return formatTime12To24(hEl.value, mEl.value, aEl.value);
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return timeStr;
    
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(dateStr, timeStr) {
    const formattedDate = formatDate(dateStr);
    if (!timeStr) return formattedDate;
    const formattedTime = formatTime(timeStr);
    return `${formattedDate} • ${formattedTime}`;
}

function formatMonthName(monthStr) {
    if (!monthStr) return '-';
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const [y, m] = parts.map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderFamilyTransferView() {
    populateFamilyMonthFilter();
    updateFamilySummaryAndTabs();
    renderFamilyReceivedList();
    renderFamilyRentList();
    renderFamilyBillList();
}

function populateFamilyMonthFilter() {
    const filterSelect = document.getElementById('family-month-filter');
    if (!filterSelect) return;
    const currentVal = filterSelect.value || 'all';

    // Collect all distinct months
    const monthsSet = new Set();
    const currentMonthKey = getMonthKey(new Date());
    monthsSet.add(currentMonthKey);

    familyData.received.forEach(r => {
        if (r.date && r.date.length >= 7) monthsSet.add(r.date.substring(0, 7));
    });
    familyData.roomRent.forEach(r => {
        if (r.month) monthsSet.add(r.month);
        else if (r.date && r.date.length >= 7) monthsSet.add(r.date.substring(0, 7));
    });
    familyData.currentBill.forEach(b => {
        if (b.month) monthsSet.add(b.month);
        else if (b.date && b.date.length >= 7) monthsSet.add(b.date.substring(0, 7));
    });

    const sortedMonths = Array.from(monthsSet).sort().reverse();

    filterSelect.innerHTML = `<option value="all">All Time</option>` + sortedMonths.map(m => `
        <option value="${m}">${formatMonthName(m)}</option>
    `).join('');

    if (monthsSet.has(currentVal) || currentVal === 'all') {
        filterSelect.value = currentVal;
    } else {
        filterSelect.value = 'all';
    }
}

function getSelectedFamilyMonth() {
    const filterSelect = document.getElementById('family-month-filter');
    return filterSelect ? filterSelect.value : 'all';
}

function updateFamilySummaryAndTabs() {
    const selectedMonth = getSelectedFamilyMonth();

    const filteredReceived = familyData.received.filter(r => selectedMonth === 'all' || (r.date && r.date.startsWith(selectedMonth)));
    const filteredRent = familyData.roomRent.filter(r => selectedMonth === 'all' || r.month === selectedMonth || (!r.month && r.date && r.date.startsWith(selectedMonth)));
    const filteredBill = familyData.currentBill.filter(b => selectedMonth === 'all' || b.month === selectedMonth || (!b.month && b.date && b.date.startsWith(selectedMonth)));

    const totalReceived = filteredReceived.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalRoomRent = filteredRent.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalCurrentBill = filteredBill.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalMessPayments = totalRoomRent + totalCurrentBill;
    const remainingAmount = totalReceived - totalMessPayments;

    // Summary numbers
    const totalReceivedEl = document.getElementById('fam-total-received');
    if (totalReceivedEl) totalReceivedEl.textContent = formatCurrency(totalReceived);

    const totalRentEl = document.getElementById('fam-total-rent');
    if (totalRentEl) totalRentEl.textContent = formatCurrency(totalRoomRent);

    const totalBillEl = document.getElementById('fam-total-bill');
    if (totalBillEl) totalBillEl.textContent = formatCurrency(totalCurrentBill);

    const totalMessEl = document.getElementById('fam-total-mess');
    if (totalMessEl) totalMessEl.textContent = formatCurrency(totalMessPayments);

    const remainingEl = document.getElementById('fam-remaining');
    const remainingCard = document.getElementById('fam-remaining-card');
    if (remainingEl) {
        remainingEl.textContent = formatCurrency(remainingAmount);
    }
    if (remainingCard) {
        remainingCard.classList.remove('positive', 'negative');
        if (remainingAmount > 0) {
            remainingCard.classList.add('positive');
        } else if (remainingAmount < 0) {
            remainingCard.classList.add('negative');
        }
    }

    // Tab badges
    const badgeReceived = document.getElementById('fam-badge-received');
    if (badgeReceived) badgeReceived.textContent = filteredReceived.length;

    const badgeRent = document.getElementById('fam-badge-rent');
    if (badgeRent) badgeRent.textContent = filteredRent.length;

    const badgeBill = document.getElementById('fam-badge-bill');
    if (badgeBill) badgeBill.textContent = filteredBill.length;
}

function renderFamilyReceivedList() {
    const container = document.getElementById('fam-received-list');
    if (!container) return;

    const selectedMonth = getSelectedFamilyMonth();
    const query = (document.getElementById('search-fam-received')?.value || '').toLowerCase().trim();

    let items = familyData.received.filter(r => selectedMonth === 'all' || (r.date && r.date.startsWith(selectedMonth)));

    if (query) {
        items = items.filter(r => 
            (r.utr && r.utr.toLowerCase().includes(query)) ||
            (r.note && r.note.toLowerCase().includes(query)) ||
            (r.paymentMethod && r.paymentMethod.toLowerCase().includes(query)) ||
            (String(r.amount).includes(query))
        );
    }

    // Sort by date/time descending
    items.sort((a, b) => {
        const dtB = new Date(`${b.date}T${b.time || '00:00'}`);
        const dtA = new Date(`${a.date}T${a.time || '00:00'}`);
        return dtB - dtA;
    });

    if (items.length === 0) {
        container.innerHTML = `
            <div class="family-empty-state">
                <i class="ph ph-hand-coins"></i>
                <h4>No Money Received Records</h4>
                <p>Record transfers sent by your father for mess & PG expenses to keep a clean digital proof trail.</p>
                <button class="primary-btn btn-sm" onclick="openFamilyReceivedModal()">
                    <i class="ph-bold ph-plus-circle"></i> <span>Record First Transfer</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="family-record-item">
            <div class="family-record-left">
                <div class="record-icon-badge received-icon">
                    <i class="ph ph-hand-coins"></i>
                </div>
                <div class="record-details">
                    <div class="record-title-row">
                        <span class="record-title">${formatCurrency(item.amount)} received</span>
                        <span class="method-tag">${escapeHtml(item.paymentMethod || 'UPI')}</span>
                    </div>
                    <div class="record-meta-row">
                        <span class="record-meta-item"><i class="ph ph-calendar-blank"></i> ${formatDateTime(item.date, item.time)}</span>
                        <span class="utr-badge"><i class="ph ph-receipt"></i> UTR: ${escapeHtml(item.utr || 'N/A')}</span>
                    </div>
                    ${item.note ? `<p class="record-note-text"><i class="ph ph-note"></i> ${escapeHtml(item.note)}</p>` : ''}
                </div>
            </div>
            <div class="family-record-right">
                <span class="record-amount received">+${formatCurrency(item.amount)}</span>
                <div class="record-actions">
                    <button class="record-action-btn" title="View Details & Proof" onclick="openFamilyDetailsModal('received', '${item.id}')">
                        <i class="ph ph-eye"></i>
                    </button>
                    <button class="record-action-btn" title="Edit Record" onclick="openFamilyReceivedModal('${item.id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="record-action-btn delete" title="Delete Record" onclick="deleteFamilyReceived('${item.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFamilyRentList() {
    const container = document.getElementById('fam-rent-list');
    if (!container) return;

    const selectedMonth = getSelectedFamilyMonth();
    const query = (document.getElementById('search-fam-rent')?.value || '').toLowerCase().trim();

    let items = familyData.roomRent.filter(r => selectedMonth === 'all' || r.month === selectedMonth || (!r.month && r.date && r.date.startsWith(selectedMonth)));

    if (query) {
        items = items.filter(r => 
            (r.utr && r.utr.toLowerCase().includes(query)) ||
            (r.paidTo && r.paidTo.toLowerCase().includes(query)) ||
            (r.note && r.note.toLowerCase().includes(query)) ||
            (r.paymentMethod && r.paymentMethod.toLowerCase().includes(query)) ||
            (r.month && formatMonthName(r.month).toLowerCase().includes(query)) ||
            (String(r.amount).includes(query))
        );
    }

    items.sort((a, b) => {
        const dtB = new Date(`${b.date}T${b.time || '00:00'}`);
        const dtA = new Date(`${a.date}T${a.time || '00:00'}`);
        return dtB - dtA;
    });

    if (items.length === 0) {
        container.innerHTML = `
            <div class="family-empty-state">
                <i class="ph ph-house"></i>
                <h4>No Room Rent Records</h4>
                <p>Record your monthly room rent payments with UTR / Transaction ID proof reference.</p>
                <button class="primary-btn btn-sm" onclick="openFamilyRentModal()">
                    <i class="ph-bold ph-plus-circle"></i> <span>Record Room Rent</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="family-record-item">
            <div class="family-record-left">
                <div class="record-icon-badge rent-icon">
                    <i class="ph ph-house"></i>
                </div>
                <div class="record-details">
                    <div class="record-title-row">
                        <span class="record-title">${formatCurrency(item.amount)} — Rent (${formatMonthName(item.month)})</span>
                        <span class="method-tag">${escapeHtml(item.paymentMethod || 'UPI')}</span>
                    </div>
                    <div class="record-meta-row">
                        <span class="record-meta-item"><i class="ph ph-calendar-blank"></i> ${formatDateTime(item.date, item.time)}</span>
                        <span class="record-meta-item"><i class="ph ph-user"></i> Paid To: <strong>${escapeHtml(item.paidTo || 'Owner')}</strong></span>
                        <span class="utr-badge"><i class="ph ph-receipt"></i> UTR: ${escapeHtml(item.utr || 'N/A')}</span>
                    </div>
                    ${item.note ? `<p class="record-note-text"><i class="ph ph-note"></i> ${escapeHtml(item.note)}</p>` : ''}
                </div>
            </div>
            <div class="family-record-right">
                <span class="record-amount paid">-${formatCurrency(item.amount)}</span>
                <div class="record-actions">
                    <button class="record-action-btn" title="View Details & Proof" onclick="openFamilyDetailsModal('rent', '${item.id}')">
                        <i class="ph ph-eye"></i>
                    </button>
                    <button class="record-action-btn" title="Edit Record" onclick="openFamilyRentModal('${item.id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="record-action-btn delete" title="Delete Record" onclick="deleteFamilyRent('${item.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFamilyBillList() {
    const container = document.getElementById('fam-bill-list');
    if (!container) return;

    const selectedMonth = getSelectedFamilyMonth();
    const query = (document.getElementById('search-fam-bill')?.value || '').toLowerCase().trim();

    let items = familyData.currentBill.filter(b => selectedMonth === 'all' || b.month === selectedMonth || (!b.month && b.date && b.date.startsWith(selectedMonth)));

    if (query) {
        items = items.filter(b => 
            (b.utr && b.utr.toLowerCase().includes(query)) ||
            (b.paidTo && b.paidTo.toLowerCase().includes(query)) ||
            (b.note && b.note.toLowerCase().includes(query)) ||
            (b.paymentMethod && b.paymentMethod.toLowerCase().includes(query)) ||
            (b.month && formatMonthName(b.month).toLowerCase().includes(query)) ||
            (String(b.amount).includes(query))
        );
    }

    items.sort((a, b) => {
        const dtB = new Date(`${b.date}T${b.time || '00:00'}`);
        const dtA = new Date(`${a.date}T${a.time || '00:00'}`);
        return dtB - dtA;
    });

    if (items.length === 0) {
        container.innerHTML = `
            <div class="family-empty-state">
                <i class="ph ph-lightning"></i>
                <h4>No Electricity Bill Records</h4>
                <p>Record your mess electricity/current bill payments (up to 3 records per month).</p>
                <button class="primary-btn btn-sm" onclick="openFamilyBillModal()">
                    <i class="ph-bold ph-plus-circle"></i> <span>Record Current Bill</span>
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="family-record-item">
            <div class="family-record-left">
                <div class="record-icon-badge bill-icon">
                    <i class="ph ph-lightning"></i>
                </div>
                <div class="record-details">
                    <div class="record-title-row">
                        <span class="record-title">${formatCurrency(item.amount)} — Current Bill (${formatMonthName(item.month)})</span>
                        <span class="method-tag">${escapeHtml(item.paymentMethod || 'UPI')}</span>
                    </div>
                    <div class="record-meta-row">
                        <span class="record-meta-item"><i class="ph ph-calendar-blank"></i> ${formatDateTime(item.date, item.time)}</span>
                        <span class="record-meta-item"><i class="ph ph-user"></i> Paid To: <strong>${escapeHtml(item.paidTo || 'Owner')}</strong></span>
                        <span class="utr-badge"><i class="ph ph-receipt"></i> UTR: ${escapeHtml(item.utr || 'N/A')}</span>
                    </div>
                    ${item.note ? `<p class="record-note-text"><i class="ph ph-note"></i> ${escapeHtml(item.note)}</p>` : ''}
                </div>
            </div>
            <div class="family-record-right">
                <span class="record-amount paid">-${formatCurrency(item.amount)}</span>
                <div class="record-actions">
                    <button class="record-action-btn" title="View Details & Proof" onclick="openFamilyDetailsModal('bill', '${item.id}')">
                        <i class="ph ph-eye"></i>
                    </button>
                    <button class="record-action-btn" title="Edit Record" onclick="openFamilyBillModal('${item.id}')">
                        <i class="ph ph-pencil-simple"></i>
                    </button>
                    <button class="record-action-btn delete" title="Delete Record" onclick="deleteFamilyBill('${item.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Modal Openers & Form Handlers
function openFamilyReceivedModal(editId = null) {
    const form = document.getElementById('fam-received-form');
    if (!form) return;
    form.reset();

    const titleEl = document.getElementById('modal-fam-received-title');
    const idInput = document.getElementById('fam-received-id');

    if (editId) {
        const item = familyData.received.find(r => r.id === editId);
        if (item) {
            if (titleEl) titleEl.textContent = 'Edit Money Received';
            idInput.value = item.id;
            document.getElementById('fam-received-amount').value = item.amount;
            document.getElementById('fam-received-date').value = item.date;
            setTimePickerValues('fam-received', item.time || (item.createdAt ? getLocalTimeString(new Date(item.createdAt)) : getLocalTimeString()));
            document.getElementById('fam-received-payment').value = item.paymentMethod || 'UPI';
            document.getElementById('fam-received-utr').value = item.utr || '';
            document.getElementById('fam-received-note').value = item.note || '';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Record Money Received';
        idInput.value = '';
        document.getElementById('fam-received-date').value = getLocalDateString();
        setTimePickerValues('fam-received', getLocalTimeString());
        document.getElementById('fam-received-payment').value = 'UPI';
    }

    openModal('family-received-modal');
}

function saveFamilyReceived(e) {
    e.preventDefault();
    const id = document.getElementById('fam-received-id').value;
    const amount = parseFloat(document.getElementById('fam-received-amount').value);
    const date = document.getElementById('fam-received-date').value;
    const time = getTimePickerValue('fam-received');
    const paymentMethod = document.getElementById('fam-received-payment').value;
    const utr = document.getElementById('fam-received-utr').value.trim();
    const note = document.getElementById('fam-received-note').value.trim();

    if (!amount || amount <= 0 || !date || !utr) {
        showToast('Please fill in all required fields including UTR.', 'warning');
        return;
    }

    if (id) {
        const idx = familyData.received.findIndex(r => r.id === id);
        if (idx !== -1) {
            familyData.received[idx] = {
                ...familyData.received[idx],
                amount,
                date,
                time,
                paymentMethod,
                utr,
                note,
                updatedAt: new Date().toISOString()
            };
            showToast('Money received record updated');
        }
    } else {
        const newRecord = {
            id: 'fr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            amount,
            date,
            time,
            paymentMethod,
            utr,
            note,
            createdAt: new Date().toISOString()
        };
        familyData.received.unshift(newRecord);
        showToast('Money received record saved');
    }

    saveFamilyData();
    closeModal('family-received-modal');
    renderFamilyTransferView();
}

function deleteFamilyReceived(id) {
    const item = familyData.received.find(r => r.id === id);
    if (!item) return;

    showConfirmModal(
        'Delete Received Money Record?',
        `Are you sure you want to delete the record of ${formatCurrency(item.amount)} (UTR: ${item.utr})? This cannot be undone.`,
        () => {
            familyData.received = familyData.received.filter(r => r.id !== id);
            saveFamilyData();
            renderFamilyTransferView();
            showToast('Record deleted');
        }
    );
}

function openFamilyRentModal(editId = null) {
    const form = document.getElementById('fam-rent-form');
    if (!form) return;
    form.reset();

    const titleEl = document.getElementById('modal-fam-rent-title');
    const idInput = document.getElementById('fam-rent-id');

    if (editId) {
        const item = familyData.roomRent.find(r => r.id === editId);
        if (item) {
            if (titleEl) titleEl.textContent = 'Edit Room Rent Payment';
            idInput.value = item.id;
            document.getElementById('fam-rent-amount').value = item.amount;
            document.getElementById('fam-rent-month').value = item.month || getMonthKey(new Date(item.date));
            document.getElementById('fam-rent-date').value = item.date;
            setTimePickerValues('fam-rent', item.time || (item.createdAt ? getLocalTimeString(new Date(item.createdAt)) : getLocalTimeString()));
            document.getElementById('fam-rent-payment').value = item.paymentMethod || 'UPI';
            document.getElementById('fam-rent-paid-to').value = item.paidTo || '';
            document.getElementById('fam-rent-utr').value = item.utr || '';
            document.getElementById('fam-rent-note').value = item.note || '';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Record Room Rent Payment';
        idInput.value = '';
        const now = new Date();
        document.getElementById('fam-rent-month').value = getMonthKey(now);
        document.getElementById('fam-rent-date').value = getLocalDateString(now);
        setTimePickerValues('fam-rent', getLocalTimeString(now));
        document.getElementById('fam-rent-payment').value = 'UPI';
        document.getElementById('fam-rent-paid-to').value = 'PG Owner';
    }

    openModal('family-rent-modal');
}

function saveFamilyRent(e) {
    e.preventDefault();
    const id = document.getElementById('fam-rent-id').value;
    const amount = parseFloat(document.getElementById('fam-rent-amount').value);
    const month = document.getElementById('fam-rent-month').value;
    const date = document.getElementById('fam-rent-date').value;
    const time = getTimePickerValue('fam-rent');
    const paymentMethod = document.getElementById('fam-rent-payment').value;
    const paidTo = document.getElementById('fam-rent-paid-to').value.trim();
    const utr = document.getElementById('fam-rent-utr').value.trim();
    const note = document.getElementById('fam-rent-note').value.trim();

    if (!amount || amount <= 0 || !month || !date || !paidTo || !utr) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }

    if (id) {
        const idx = familyData.roomRent.findIndex(r => r.id === id);
        if (idx !== -1) {
            familyData.roomRent[idx] = {
                ...familyData.roomRent[idx],
                amount,
                month,
                date,
                time,
                paymentMethod,
                paidTo,
                utr,
                note,
                updatedAt: new Date().toISOString()
            };
            showToast('Room rent record updated');
        }
    } else {
        const newRecord = {
            id: 'frr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            amount,
            month,
            date,
            time,
            paymentMethod,
            paidTo,
            utr,
            note,
            createdAt: new Date().toISOString()
        };
        familyData.roomRent.unshift(newRecord);
        showToast('Room rent payment recorded');
    }

    saveFamilyData();
    closeModal('family-rent-modal');
    renderFamilyTransferView();
}

function deleteFamilyRent(id) {
    const item = familyData.roomRent.find(r => r.id === id);
    if (!item) return;

    showConfirmModal(
        'Delete Room Rent Record?',
        `Are you sure you want to delete rent record of ${formatCurrency(item.amount)} for ${formatMonthName(item.month)}?`,
        () => {
            familyData.roomRent = familyData.roomRent.filter(r => r.id !== id);
            saveFamilyData();
            renderFamilyTransferView();
            showToast('Record deleted');
        }
    );
}

function openFamilyBillModal(editId = null) {
    const form = document.getElementById('fam-bill-form');
    if (!form) return;
    form.reset();

    const titleEl = document.getElementById('modal-fam-bill-title');
    const idInput = document.getElementById('fam-bill-id');

    if (editId) {
        const item = familyData.currentBill.find(b => b.id === editId);
        if (item) {
            if (titleEl) titleEl.textContent = 'Edit Current Bill Payment';
            idInput.value = item.id;
            document.getElementById('fam-bill-amount').value = item.amount;
            document.getElementById('fam-bill-month').value = item.month || getMonthKey(new Date(item.date));
            document.getElementById('fam-bill-date').value = item.date;
            setTimePickerValues('fam-bill', item.time || (item.createdAt ? getLocalTimeString(new Date(item.createdAt)) : getLocalTimeString()));
            document.getElementById('fam-bill-payment').value = item.paymentMethod || 'UPI';
            document.getElementById('fam-bill-paid-to').value = item.paidTo || '';
            document.getElementById('fam-bill-utr').value = item.utr || '';
            document.getElementById('fam-bill-note').value = item.note || '';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Record Current Bill Payment';
        idInput.value = '';
        const now = new Date();
        document.getElementById('fam-bill-month').value = getMonthKey(now);
        document.getElementById('fam-bill-date').value = getLocalDateString(now);
        setTimePickerValues('fam-bill', getLocalTimeString(now));
        document.getElementById('fam-bill-payment').value = 'UPI';
        document.getElementById('fam-bill-paid-to').value = 'Mess Owner';
    }

    openModal('family-bill-modal');
}

function saveFamilyBill(e) {
    e.preventDefault();
    const id = document.getElementById('fam-bill-id').value;
    const amount = parseFloat(document.getElementById('fam-bill-amount').value);
    const month = document.getElementById('fam-bill-month').value;
    const date = document.getElementById('fam-bill-date').value;
    const time = getTimePickerValue('fam-bill');
    const paymentMethod = document.getElementById('fam-bill-payment').value;
    const paidTo = document.getElementById('fam-bill-paid-to').value.trim();
    const utr = document.getElementById('fam-bill-utr').value.trim();
    const note = document.getElementById('fam-bill-note').value.trim();

    if (!amount || amount <= 0 || !month || !date || !paidTo || !utr) {
        showToast('Please fill in all required fields.', 'warning');
        return;
    }

    // Constraint: Allow only the required 3 monthly records
    const existingForMonth = familyData.currentBill.filter(b => b.month === month && b.id !== id);
    if (existingForMonth.length >= 3) {
        showToast(`Only 3 current bill records are permitted for ${formatMonthName(month)}.`, 'error');
        return;
    }

    if (id) {
        const idx = familyData.currentBill.findIndex(b => b.id === id);
        if (idx !== -1) {
            familyData.currentBill[idx] = {
                ...familyData.currentBill[idx],
                amount,
                month,
                date,
                time,
                paymentMethod,
                paidTo,
                utr,
                note,
                updatedAt: new Date().toISOString()
            };
            showToast('Current bill record updated');
        }
    } else {
        const newRecord = {
            id: 'fcb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            amount,
            month,
            date,
            time,
            paymentMethod,
            paidTo,
            utr,
            note,
            createdAt: new Date().toISOString()
        };
        familyData.currentBill.unshift(newRecord);
        showToast('Current bill payment recorded');
    }

    saveFamilyData();
    closeModal('family-bill-modal');
    renderFamilyTransferView();
}

function deleteFamilyBill(id) {
    const item = familyData.currentBill.find(b => b.id === id);
    if (!item) return;

    showConfirmModal(
        'Delete Current Bill Record?',
        `Are you sure you want to delete electricity bill of ${formatCurrency(item.amount)} for ${formatMonthName(item.month)}?`,
        () => {
            familyData.currentBill = familyData.currentBill.filter(b => b.id !== id);
            saveFamilyData();
            renderFamilyTransferView();
            showToast('Record deleted');
        }
    );
}

function openFamilyDetailsModal(type, id) {
    let item = null;
    let typeBadge = '';
    let badgeClass = '';
    let icon = '';

    if (type === 'received') {
        item = familyData.received.find(r => r.id === id);
        typeBadge = 'Family Money Received';
        badgeClass = 'received-icon';
        icon = 'ph-hand-coins';
    } else if (type === 'rent') {
        item = familyData.roomRent.find(r => r.id === id);
        typeBadge = 'Room Rent Payment';
        badgeClass = 'rent-icon';
        icon = 'ph-house';
    } else if (type === 'bill') {
        item = familyData.currentBill.find(b => b.id === id);
        typeBadge = 'Electricity / Current Bill';
        badgeClass = 'bill-icon';
        icon = 'ph-lightning';
    }

    if (!item) return;

    const body = document.getElementById('fam-details-body');
    if (!body) return;

    body.innerHTML = `
        <div class="proof-card">
            <div class="proof-header-badge ${badgeClass}">
                <i class="ph ${icon}"></i>
                <span>${typeBadge}</span>
            </div>
            <div class="proof-amount-display" style="color: ${type === 'received' ? 'var(--success)' : 'var(--danger)'};">
                ${type === 'received' ? '+' : '-'}${formatCurrency(item.amount)}
            </div>

            <div class="proof-grid">
                ${item.month ? `
                <div class="proof-field">
                    <span class="proof-field-label">Applicable Month</span>
                    <span class="proof-field-val">${formatMonthName(item.month)}</span>
                </div>` : ''}
                <div class="proof-field">
                    <span class="proof-field-label">Date</span>
                    <span class="proof-field-val">${formatDate(item.date)}</span>
                </div>
                <div class="proof-field">
                    <span class="proof-field-label">Exact Time</span>
                    <span class="proof-field-val">${item.time ? formatTime(item.time) : '-'}</span>
                </div>
                <div class="proof-field">
                    <span class="proof-field-label">Payment Method</span>
                    <span class="proof-field-val">${escapeHtml(item.paymentMethod || 'UPI')}</span>
                </div>
                ${item.paidTo ? `
                <div class="proof-field">
                    <span class="proof-field-label">Paid To</span>
                    <span class="proof-field-val">${escapeHtml(item.paidTo)}</span>
                </div>` : `
                <div class="proof-field">
                    <span class="proof-field-label">Sender</span>
                    <span class="proof-field-val">Father</span>
                </div>`}
                ${item.note ? `
                <div class="proof-field" style="grid-column: span 2;">
                    <span class="proof-field-label">Note / Reference</span>
                    <span class="proof-field-val">${escapeHtml(item.note)}</span>
                </div>` : ''}
            </div>

            <div class="proof-utr-box">
                <div class="proof-utr-info">
                    <div class="proof-utr-label"><i class="ph ph-shield-check"></i> Official Payment Proof Reference (UTR)</div>
                    <div class="proof-utr-val">${escapeHtml(item.utr || 'N/A')}</div>
                </div>
                <button type="button" class="copy-utr-btn" id="btn-copy-utr" onclick="copyUtrToClipboard('${escapeAttr(item.utr || '')}')">
                    <i class="ph ph-copy"></i>
                    <span>Copy</span>
                </button>
            </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
            <button type="button" class="secondary-btn w-100" onclick="closeModal('family-details-modal')">Close</button>
        </div>
    `;

    openModal('family-details-modal');
}

function copyUtrToClipboard(utrText) {
    if (!utrText) return;
    navigator.clipboard.writeText(utrText).then(() => {
        const btn = document.getElementById('btn-copy-utr');
        if (btn) {
            btn.innerHTML = '<i class="ph ph-check"></i> <span>Copied!</span>';
            btn.classList.add('copied');
            setTimeout(() => {
                if (btn) {
                    btn.innerHTML = '<i class="ph ph-copy"></i> <span>Copy</span>';
                    btn.classList.remove('copied');
                }
            }, 2000);
        }
        showToast('UTR copied to clipboard');
    }).catch(() => {
        showToast('UTR: ' + utrText);
    });
}

function syncFamilyQuickDateButtons() {
    const input = document.getElementById('fam-received-date');
    if (!input) return;
    const val = input.value;
    const today = getLocalDateString(new Date());

    const yestDate = new Date();
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterday = getLocalDateString(yestDate);

    const btnToday = document.getElementById('btn-fam-received-date-today');
    const btnYesterday = document.getElementById('btn-fam-received-date-yesterday');

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

function setupFamilyTransferEventListeners() {
    // Tab switching inside Family Transfer
    document.querySelectorAll('.family-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            currentFamilyTab = targetTab;

            document.querySelectorAll('.family-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.family-tab-content').forEach(content => {
                if (content.id === targetTab) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                }
            });
        });
    });

    // Month filter
    const monthFilter = document.getElementById('family-month-filter');
    if (monthFilter) {
        monthFilter.addEventListener('change', () => {
            updateFamilySummaryAndTabs();
            renderFamilyReceivedList();
            renderFamilyRentList();
            renderFamilyBillList();
        });
    }

    // Search filters
    const searchReceived = document.getElementById('search-fam-received');
    if (searchReceived) searchReceived.addEventListener('input', renderFamilyReceivedList);

    const searchRent = document.getElementById('search-fam-rent');
    if (searchRent) searchRent.addEventListener('input', renderFamilyRentList);

    const searchBill = document.getElementById('search-fam-bill');
    if (searchBill) searchBill.addEventListener('input', renderFamilyBillList);

    // Quick Add buttons
    const btnAddReceived = document.getElementById('btn-add-fam-received');
    if (btnAddReceived) btnAddReceived.addEventListener('click', () => openFamilyReceivedModal());

    const btnAddRent = document.getElementById('btn-add-fam-rent');
    if (btnAddRent) btnAddRent.addEventListener('click', () => openFamilyRentModal());

    const btnAddBill = document.getElementById('btn-add-fam-bill');
    if (btnAddBill) btnAddBill.addEventListener('click', () => openFamilyBillModal());

    // Modal Close buttons
    const btnCloseReceived = document.getElementById('btn-close-fam-received-modal');
    if (btnCloseReceived) btnCloseReceived.addEventListener('click', () => closeModal('family-received-modal'));

    const btnCancelReceived = document.getElementById('btn-cancel-fam-received');
    if (btnCancelReceived) btnCancelReceived.addEventListener('click', () => closeModal('family-received-modal'));

    const btnCloseRent = document.getElementById('btn-close-fam-rent-modal');
    if (btnCloseRent) btnCloseRent.addEventListener('click', () => closeModal('family-rent-modal'));

    const btnCancelRent = document.getElementById('btn-cancel-fam-rent');
    if (btnCancelRent) btnCancelRent.addEventListener('click', () => closeModal('family-rent-modal'));

    const btnCloseBill = document.getElementById('btn-close-fam-bill-modal');
    if (btnCloseBill) btnCloseBill.addEventListener('click', () => closeModal('family-bill-modal'));

    const btnCancelBill = document.getElementById('btn-cancel-fam-bill');
    if (btnCancelBill) btnCancelBill.addEventListener('click', () => closeModal('family-bill-modal'));

    const btnCloseDetails = document.getElementById('btn-close-fam-details-modal');
    if (btnCloseDetails) btnCloseDetails.addEventListener('click', () => closeModal('family-details-modal'));

    // Form Submissions
    const formReceived = document.getElementById('fam-received-form');
    if (formReceived) formReceived.addEventListener('submit', saveFamilyReceived);

    const formRent = document.getElementById('fam-rent-form');
    if (formRent) formRent.addEventListener('submit', saveFamilyRent);

    const formBill = document.getElementById('fam-bill-form');
    if (formBill) formBill.addEventListener('submit', saveFamilyBill);

    // Quick amounts for Received Money modal
    document.querySelectorAll('.quick-btn-fam-received').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.val;
            const input = document.getElementById('fam-received-amount');
            if (input) {
                input.value = (parseFloat(input.value || 0) + parseFloat(val)).toString();
            }
        });
    });

    // Quick "Now" time buttons
    ['fam-received', 'fam-rent', 'fam-bill'].forEach(prefix => {
        const btnNow = document.getElementById(`btn-${prefix}-time-now`);
        if (btnNow) {
            btnNow.addEventListener('click', () => {
                setTimePickerValues(prefix, getLocalTimeString());
                showToast('Time set to current time', 'info');
            });
        }

        // Sync hidden input on dropdown changes
        ['hour', 'minute', 'ampm'].forEach(field => {
            const el = document.getElementById(`${prefix}-time-${field}`);
            if (el) {
                el.addEventListener('change', () => {
                    const hiddenInput = document.getElementById(`${prefix}-time`);
                    if (hiddenInput) {
                        hiddenInput.value = getTimePickerValue(prefix);
                    }
                });
            }
        });
    });

    // Date change listener for quick date syncing
    const famReceivedDate = document.getElementById('fam-received-date');
    if (famReceivedDate) {
        famReceivedDate.addEventListener('change', syncFamilyQuickDateButtons);
    }
}

// Start application
document.addEventListener('DOMContentLoaded', init);
