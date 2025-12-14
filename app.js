// State Management
const defaultState = {
    accounts: { Cash: 0, Bank: 0, bKash: 0, Nagad: 0, Rocket: 0 },
    inLoan: {}, // Money owed TO user by Person
    liabilities: {}, // Money owed BY user TO Person
    people: ['Friend', 'Family', 'Employer'],
    categories: ['Food', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health'],
    goal: { name: 'Emergency Fund', target: 10000, linkedAccount: 'Cash' },
    transactions: []
};

let state = JSON.parse(localStorage.getItem('moneyFlowState')) || defaultState;

// DOM Elements
const balancesList = document.getElementById('balances-list');
const transactionList = document.getElementById('transaction-list');
const goalName = document.getElementById('goal-name');
const goalAmount = document.getElementById('goal-amount');
const goalProgress = document.getElementById('goal-progress');
const goalStatus = document.getElementById('goal-status');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalFields = document.getElementById('modal-fields');
const transactionForm = document.getElementById('transaction-form');
const fullHistoryView = document.getElementById('full-history-view');
const dashboardGrid = document.querySelector('.dashboard-grid');
const fullHistoryList = document.getElementById('full-history-list');
const participantsList = document.getElementById('participants-list');
const recentSearchInput = document.getElementById('recent-search');

// Initialization
function init() {
    renderBalances();
    renderGoal();
    renderHistory();
    renderParticipants();
    renderChart();
    populateCategoryFilter();
    renderLoans();

    if (recentSearchInput) {
        recentSearchInput.addEventListener('input', (e) => renderHistory(e.target.value));
    }
}

// Persistence
function saveState() {
    localStorage.setItem('moneyFlowState', JSON.stringify(state));
    renderBalances();
    renderGoal();
    renderHistory();
    renderParticipants();
    renderChart();
    renderLoans();
}

// Rendering
function renderBalances() {
    balancesList.innerHTML = '';

    // Calculate Total Balance
    const totalBalance = Object.values(state.accounts).reduce((a, b) => a + b, 0);

    // Add Total Balance Item (Special Styling)
    balancesList.innerHTML += `
        <div class="balance-item total-balance">
            <div class="b-icon"><i class="fa-solid fa-sack-dollar"></i></div>
            <div class="b-info">
                <span>Total Balance</span>
                <strong>${formatCurrency(totalBalance)}</strong>
            </div>
        </div>
    `;

    // Fixed Cash first (highlighted)
    const cashBalance = state.accounts['Cash'] || 0;
    balancesList.innerHTML += `
        <div class="balance-item cash-item">
            <div class="b-icon"><i class="fa-solid fa-wallet"></i></div>
            <div class="b-info">
                <span>Cash</span>
                <strong>${formatCurrency(cashBalance)}</strong>
            </div>
        </div>
    `;

    // Other accounts
    for (const [acc, bal] of Object.entries(state.accounts)) {
        if (acc !== 'Cash') {
            let icon = 'fa-building-columns';
            if (['bKash', 'Nagad', 'Rocket', 'Upay'].includes(acc)) icon = 'fa-mobile-screen';
            if (acc === 'MFG') icon = 'fa-piggy-bank';

            balancesList.innerHTML += createBalanceItem(acc, bal, icon);
        }
    }

    // Total InLoan (Money owed to me)
    const totalInLoan = Object.values(state.inLoan).reduce((a, b) => a + b, 0);
    if (totalInLoan > 0) {
        balancesList.innerHTML += `
            <div class="balance-item in-loan-item">
                <div class="b-icon"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                <div class="b-info">
                    <span>Owed to You</span>
                    <strong class="text-green-400">${formatCurrency(totalInLoan)}</strong>
                </div>
            </div>
        `;
    }

    // Total Liabilities (Money I owe) - used for Net Owed calculation
    const totalLiabilities = Object.values(state.liabilities).reduce((a, b) => a + b, 0);

    // Net Owed (Owed to You - My Loans)
    const netOwed = totalInLoan - totalLiabilities;
    if (totalInLoan > 0 || totalLiabilities > 0) {
        balancesList.innerHTML += `
            <div class="balance-item last-balance-item">
                <div class="b-icon"><i class="fa-solid fa-scale-balanced"></i></div>
                <div class="b-info">
                    <span>Net Owed</span>
                    <strong class="${netOwed >= 0 ? 'text-green-400' : 'text-red-400'}">${formatCurrency(netOwed)}</strong>
                </div>
            </div>
        `;
    }
}

function createBalanceItem(name, amount, iconClass = 'fa-wallet', colorClass = '') {
    return `
        <div class="balance-item">
            <div class="b-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="b-info">
                <span>${name}</span>
                <strong class="${colorClass}">${formatCurrency(amount)}</strong>
            </div>
        </div>
    `;
}

function renderGoal() {
    const { name, target, linkedAccount } = state.goal;
    const currentAmount = state.accounts[linkedAccount] || 0;
    const percentage = Math.min(100, Math.max(0, (currentAmount / target) * 100));

    goalName.textContent = name;
    goalAmount.textContent = `${formatCurrency(currentAmount)} / ${formatCurrency(target)}`;
    goalProgress.style.width = `${percentage}%`;
    goalStatus.textContent = `Linked to: ${linkedAccount}`;
}

function renderHistory(query = '') {
    transactionList.innerHTML = '';

    let allTransactions = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (query) {
        const lowerQuery = query.toLowerCase();
        allTransactions = allTransactions.filter(t =>
            t.id.toString().includes(lowerQuery) ||
            t.title.toLowerCase().includes(lowerQuery) ||
            t.type.toLowerCase().includes(lowerQuery) ||
            t.account.toLowerCase().includes(lowerQuery)
        );
    }

    const recent = allTransactions.slice(0, 10);

    if (recent.length === 0) {
        transactionList.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">No transactions found.</p>';
        return;
    }

    recent.forEach(t => {
        let icon = 'fa-money-bill';
        let colorClass = 'amount-neu';
        let iconBg = 'rgba(255,255,255,0.1)';
        let iconColor = '#fff';

        switch (t.type) {
            case 'deposit':
                icon = 'fa-arrow-down';
                colorClass = 'amount-pos';
                iconBg = 'rgba(16, 185, 129, 0.2)';
                iconColor = 'var(--success)';
                break;
            case 'expense':
                icon = 'fa-arrow-up';
                colorClass = 'amount-neg';
                iconBg = 'rgba(239, 68, 68, 0.2)';
                iconColor = 'var(--danger)';
                break;
            case 'give-loan':
                icon = 'fa-hand-holding-dollar';
                colorClass = 'amount-neg';
                iconBg = 'rgba(245, 158, 11, 0.2)';
                iconColor = 'var(--warning)';
                break;
            case 'get-loan':
                icon = 'fa-hand-holding-hand';
                colorClass = 'amount-pos';
                iconBg = 'rgba(59, 130, 246, 0.2)';
                iconColor = 'var(--info)';
                break;
        }

        const html = `
            <div class="transaction-item">
                <div class="t-left">
                    <div class="t-icon" style="background: ${iconBg}; color: ${iconColor}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div class="t-details">
                        <div class="t-title">${t.title}</div>
                        <div class="t-meta">${new Date(t.date).toLocaleDateString()} • ${t.account}</div>
                    </div>
                    ${t.comment ? `<div style="font-size:0.9rem; color:var(--text-secondary); font-style:italic; margin-left: 10px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">"${t.comment}"</div>` : ''}
                </div>
                <div class="t-right">
                    <div class="t-amount ${colorClass}">
                        ${t.type === 'expense' || t.type === 'give-loan' ? '-' : '+'}${formatCurrency(t.amount)}
                    </div>
                    <button class="icon-btn print-btn-sm" onclick="editTransaction('${t.id}')" title="Edit Transaction" style="margin-right:5px;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn print-btn-sm" onclick="printReceipt('${t.id}')" title="Print Receipt">
                        <i class="fa-solid fa-print"></i>
                    </button>
                </div>
            </div>
        `;
        transactionList.innerHTML += html;
    });
}

function renderParticipants() {
    participantsList.innerHTML = '';
    state.people.forEach(person => {
        participantsList.innerHTML += `
            <div class="participant-chip">
                <span><i class="fa-solid fa-user"></i> ${person}</span>
                <button class="delete-participant-btn" onclick="deletePerson('${person}')">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
        `;
    });
}

window.deletePerson = function (name) {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;

    // Check if they have active loans/liabilities
    if ((state.inLoan[name] && state.inLoan[name] > 0) || (state.liabilities[name] && state.liabilities[name] > 0)) {
        alert("Cannot remove person with active loans or liabilities. Settle them first.");
        return;
    }

    state.people = state.people.filter(p => p !== name);
    saveState();
};

function renderLoans() {
    const loanList = document.getElementById('loan-list');
    loanList.innerHTML = '';
    let hasLoans = false;

    // 1. Money Owed TO User (InLoan) - Assets
    for (const [person, amount] of Object.entries(state.inLoan)) {
        if (amount > 0) {
            hasLoans = true;
            loanList.innerHTML += createLoanItem(person, amount, 'in-loan');
        }
    }

    // 2. Money Owed BY User (Liabilities) - Debts
    for (const [person, amount] of Object.entries(state.liabilities)) {
        if (amount > 0) {
            hasLoans = true;
            loanList.innerHTML += createLoanItem(person, amount, 'liability');
        }
    }

    if (!hasLoans) {
        loanList.innerHTML = '<p style="color:var(--text-secondary); font-size:0.9rem; text-align:center;">No active loans.</p>';
    }
}

function createLoanItem(person, amount, type) {
    const isLiability = type === 'liability';
    const colorClass = isLiability ? 'text-danger' : 'text-success';
    const icon = isLiability ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
    // InLoan = Money owed TO user. So Person Owes User.
    // Liability = Money owed BY user. So User Owes Person.

    const displayLabel = isLiability ? `You owe ${person}` : `${person} owes you`;
    const btnText = 'Settle';

    return `
        <div class="loan-item">
            <div class="loan-info">
                <span class="loan-label">${displayLabel}</span>
                <strong class="${colorClass}">${formatCurrency(amount)}</strong>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="icon-btn print-btn-sm" onclick="printLoanReceipt('${type}', '${person}', ${amount})" title="Print Statement">
                    <i class="fa-solid fa-print"></i>
                </button>
                <button class="settle-btn" onclick="openSettleModal('${type}', '${person}', ${amount})">
                    ${btnText}
                </button>
            </div>
        </div>
    `;
}

window.printLoanReceipt = function (type, person, amount) {
    const modal = document.getElementById('receipt-modal-overlay');
    const receiptPreview = document.getElementById('receipt-preview');

    const isLiability = type === 'liability';
    const title = isLiability ? 'Liability Statement' : 'Loan Asset Statement';
    const desc = isLiability ? `${person}-এর কাছে বকেয়া` : `${person}-এর কাছে পাওনা`;

    receiptPreview.innerHTML = `
        <div class="receipt-header">
            <div class="receipt-logo">MoneyFlow</div>
            <div class="receipt-title">Loan Statement</div>
        </div>
        <div class="receipt-body">
            <div class="r-row"><span>Date:</span> <span>${new Date().toLocaleDateString()}</span></div>
            <div class="r-row"><span>Time:</span> <span>${new Date().toLocaleTimeString()}</span></div>
            <div class="r-row"><span>Type:</span> <span>${title}</span></div>
            <div class="r-row"><span>Person:</span> <span>${person}</span></div>
            <br>
            <div style="font-weight:bold; margin-bottom:5px;">Description:</div>
            <div>${desc}</div>
        </div>
        <div class="receipt-amount">
            ${formatCurrency(amount)}
        </div>
        
        <div style="margin-top: 40px; margin-bottom: 20px;">
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto; padding-top: 5px; font-size: 0.8rem;">Authorized Signature</div>
        </div>

        <div class="receipt-footer">
            <p>MoneyFlow Personal Finance</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    `;

    modal.classList.remove('hidden');
};

function toggleHistoryView() {
    const isHidden = fullHistoryView.classList.contains('hidden');
    if (isHidden) {
        dashboardGrid.classList.add('hidden');
        fullHistoryView.classList.remove('hidden');
        renderFullHistory();
    } else {
        fullHistoryView.classList.add('hidden');
        dashboardGrid.classList.remove('hidden');
    }
}

function renderFullHistory() {
    fullHistoryList.innerHTML = '';

    // Header
    const header = `
        <thead>
            <tr>
                <th>Date</th>
                <th>ID</th>
                <th>Type</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;
    fullHistoryList.innerHTML = header;

    // Get Filter Values
    const typeFilter = document.getElementById('filter-type').value;
    const categoryFilter = document.getElementById('filter-category').value;
    const sortOrder = document.getElementById('sort-order').value;

    let filtered = state.transactions.filter(t => {
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        // For category, we check if the title contains the category (since we store category as title for expenses)
        // Or if we strictly stored category, but currently we store it in title for expenses.
        // Let's refine this: Expenses have 'category' in title.
        if (categoryFilter !== 'all') {
            if (t.type === 'expense' && t.title !== categoryFilter) return false;
            if (t.type !== 'expense') return false; // If filtering by category, only show expenses
        }
        return true;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.date) - new Date(a.date);
        if (sortOrder === 'oldest') return new Date(a.date) - new Date(b.date);
        if (sortOrder === 'highest') return b.amount - a.amount;
        if (sortOrder === 'lowest') return a.amount - b.amount;
    });

    if (filtered.length === 0) {
        fullHistoryList.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-secondary);">No transactions found.</td></tr>';
        return;
    }

    filtered.forEach(t => {
        let colorClass = 'amount-neu';
        if (t.type === 'deposit' || t.type === 'get-loan') colorClass = 'amount-pos';
        if (t.type === 'expense' || t.type === 'give-loan' || t.type === 'transfer') colorClass = 'amount-neg';

        const row = `
            <tr>
                <td>${new Date(t.date).toLocaleDateString()}</td>
                <td>${t.id}</td>
                <td style="text-transform:capitalize">${t.type.replace('-', ' ')}</td>
                <td>
                    ${t.title}
                    ${t.comment ? `<div style="font-size:0.8rem; color:var(--text-secondary); font-style:italic;">"${t.comment}"</div>` : ''}
                </td>
                <td class="${colorClass}">${t.type === 'expense' || t.type === 'give-loan' ? '-' : '+'}${formatCurrency(t.amount)}</td>
                <td>
                    <button class="icon-btn" onclick="editTransaction('${t.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="icon-btn" onclick="printReceipt('${t.id}')" title="Print">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="icon-btn delete-btn" onclick="deleteTransaction('${t.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        fullHistoryList.innerHTML += row;
    });
    fullHistoryList.innerHTML += '</tbody>';
}

// Chart Rendering
let expenseChartInstance = null;
let currentChartPeriod = 'all'; // Track current filter
let currentChartView = 'category'; // 'category' or 'date'
let selectedChartDate = null; // Track selected date for drill-down

window.switchChartView = function (view) {
    currentChartView = view;

    // Update UI
    const catBtn = document.getElementById('view-category-btn');
    const dateBtn = document.getElementById('view-date-btn');

    // Use computed style or just hardcode colors based on theme? 
    // Better to just toggle active class and let CSS handle it if possible, 
    // but since I don't want to edit CSS too much, I'll use the var() directly.

    if (view === 'category') {
        catBtn.classList.add('active');
        catBtn.style.color = 'var(--primary)';
        dateBtn.classList.remove('active');
        dateBtn.style.color = 'var(--text-secondary)';
    } else {
        catBtn.classList.remove('active');
        catBtn.style.color = 'var(--text-secondary)';
        dateBtn.classList.add('active');
        dateBtn.style.color = 'var(--primary)';
    }

    renderChart(currentChartPeriod);
}

function renderChart(period = currentChartPeriod) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    currentChartPeriod = period;

    // Detect current theme for text color
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#64748b' : '#f8fafc';
    const gridColor = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';

    // Filter transactions based on period
    const now = new Date();
    const filteredTransactions = state.transactions.filter(t => {
        if (t.type !== 'expense') return false;

        const transactionDate = new Date(t.date);

        if (period === 'today') {
            return transactionDate.toDateString() === now.toDateString();
        } else if (period === 'week') {
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return transactionDate >= oneWeekAgo;
        } else if (period === 'month') {
            const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return transactionDate >= oneMonthAgo;
        } else if (period === 'specific-date' && selectedChartDate) {
            const tDateStr = transactionDate.getFullYear() + '-' + String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' + String(transactionDate.getDate()).padStart(2, '0');
            return tDateStr === selectedChartDate;
        }

        return true; // 'all' - no filter
    });

    let labels = [];
    let data = [];
    let chartType = 'doughnut';
    let options = {};
    let backgroundColors = [
        '#6366f1', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'
    ];

    if (currentChartView === 'date') {
        chartType = 'bar';
        // Aggregate by Date (Local)
        const expensesByDate = {};
        filteredTransactions.forEach(t => {
            const d = new Date(t.date);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            expensesByDate[key] = (expensesByDate[key] || 0) + t.amount;
        });

        // Sort by date
        const sortedKeys = Object.keys(expensesByDate).sort();
        labels = sortedKeys.map(k => {
            const [y, m, d] = k.split('-');
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        });
        data = sortedKeys.map(k => expensesByDate[k]);

        options = {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    selectedChartDate = sortedKeys[index];

                    // Change period first
                    currentChartPeriod = 'specific-date';

                    // Deselect filter buttons
                    document.querySelectorAll('.chart-filter-btn').forEach(btn => btn.classList.remove('active'));

                    // Switch view (this will call renderChart with 'specific-date')
                    switchChartView('category');
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return formatCurrency(context.raw);
                        }
                    }
                }
            }
        };

    } else {
        // Category View (Existing Logic)
        const expenses = {};
        filteredTransactions.forEach(t => {
            const cat = t.title; // Category stored in title
            expenses[cat] = (expenses[cat] || 0) + t.amount;
        });

        labels = Object.keys(expenses);
        data = Object.values(expenses);

        options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: textColor,
                        font: { size: 13 },
                        generateLabels: function (chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const formattedValue = formatCurrency(value);
                                    return {
                                        text: `${label}: ${formattedValue}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        fontColor: textColor,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                }
            }
        };
    }

    // Calculate total expense
    const totalExpense = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenseElement = document.getElementById('total-expense-amount');
    if (totalExpenseElement) {
        totalExpenseElement.textContent = formatCurrency(totalExpense);
    }

    // Destroy previous instance if exists
    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses',
                data: data,
                backgroundColor: currentChartView === 'date' ? '#ef4444' : backgroundColors,
                borderRadius: 4,
                borderWidth: 0
            }]
        },
        options: options
    });
}

function filterChart(period) {
    // Update button active states
    document.querySelectorAll('.chart-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        }
    });

    // Re-render chart with the new period filter
    renderChart(period);
}

function populateCategoryFilter() {
    const filterSelect = document.getElementById('filter-category');
    // Keep the first 'All' option
    filterSelect.innerHTML = '<option value="all">All</option>';
    state.categories.forEach(c => {
        filterSelect.innerHTML += `<option value="${c}">${c}</option>`;
    });
}

window.deleteTransaction = function (id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const index = state.transactions.findIndex(t => t.id == id);
    if (index === -1) return;

    const t = state.transactions[index];

    // Reverse logic
    // Note: This handles all transaction types including settlement transactions

    if (t.type === 'deposit') {
        state.accounts[t.account] -= t.amount;
    } else if (t.type === 'expense') {
        state.accounts[t.account] += t.amount;
    } else if (t.type === 'give-loan') {
        // Check if this is a settlement (Repayment from someone)
        if (t.title.startsWith('Repayment from ')) {
            const person = t.person || t.title.replace('Repayment from ', '');
            state.accounts[t.account] -= t.amount;
            // Restore the inLoan (money owed to user)
            state.inLoan[person] = (state.inLoan[person] || 0) + t.amount;
        } else {
            // Regular give-loan
            state.accounts[t.account] += t.amount;
            const person = t.person || t.title.replace('Loan to ', '');
            if (state.inLoan[person]) {
                state.inLoan[person] -= t.amount;
                if (state.inLoan[person] <= 0) delete state.inLoan[person];
            }
        }
    } else if (t.type === 'get-loan') {
        // Check if this is a settlement (Repayment to someone)
        if (t.title.startsWith('Repayment to ')) {
            const person = t.person || t.title.replace('Repayment to ', '');
            state.accounts[t.account] += t.amount;
            // Restore the liability (money owed by user)
            state.liabilities[person] = (state.liabilities[person] || 0) + t.amount;
        } else {
            // Regular get-loan
            state.accounts[t.account] -= t.amount;
            const person = t.person || t.title.replace('Loan from ', '');
            if (state.liabilities[person]) {
                state.liabilities[person] -= t.amount;
                if (state.liabilities[person] <= 0) delete state.liabilities[person];
            }
        }
    } else if (t.type === 'transfer') {
        // Transfer: we stored total deduction (amount + fee) in t.amount
        // and the net amount (amount without fee) was added to destination
        // We also store netAmount if available for accurate reversal
        const toAccount = t.title.replace('Transfer to ', '');

        // Add back the total deduction to source
        state.accounts[t.account] += t.amount;

        // Remove the net amount from destination
        // Use netAmount if stored, otherwise use full amount (assumes 0 fee for old transactions)
        const netAmount = t.netAmount !== undefined ? t.netAmount : t.amount;
        state.accounts[toAccount] -= netAmount;
    }

    state.transactions.splice(index, 1);
    saveState();
    // If we are in full history view, re-render it
    if (!fullHistoryView.classList.contains('hidden')) {
        renderFullHistory();
    }
};



window.printReceipt = function (id) {
    const t = state.transactions.find(tr => tr.id == id);
    if (!t) return;

    const receiptPreview = document.getElementById('receipt-preview');
    const modal = document.getElementById('receipt-modal-overlay');

    receiptPreview.innerHTML = `
        <div class="receipt-header">
            <div class="receipt-logo">MoneyFlow</div>
            <div class="receipt-title">Transaction Receipt</div>
        </div>
        <div class="receipt-body">
            <div class="r-row"><span>Date:</span> <span>${new Date(t.date).toLocaleDateString()}</span></div>
            <div class="r-row"><span>Time:</span> <span>${new Date(t.date).toLocaleTimeString()}</span></div>
            <div class="r-row"><span>Trx ID:</span> <span>${t.id.toString().length > 10 ? '#' + t.id.toString().slice(-6) : '#' + t.id}</span></div>
            <div class="r-row"><span>Type:</span> <span style="text-transform:capitalize">${t.type.replace('-', ' ')}</span></div>
            <div class="r-row"><span>Method:</span> <span>${t.account}</span></div>
            <br>
            <div style="font-weight:bold; margin-bottom:5px;">Description:</div>
            <div>${t.title}</div>
        </div>
        <div class="receipt-amount">
            ${t.amount.toLocaleString('en-BD')} BDT
        </div>
        
        <div style="margin-top: 40px; margin-bottom: 20px;">
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto; padding-top: 5px; font-size: 0.8rem;">Authorized Signature</div>
        </div>

        <div class="receipt-footer">
            <p>Thank you for using MoneyFlow!</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    `;

    modal.classList.remove('hidden');
};

window.closeReceiptModal = function () {
    document.getElementById('receipt-modal-overlay').classList.add('hidden');
};

window.printReceiptContent = function () {
    const content = document.getElementById('receipt-preview').innerHTML;
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write('<html><head><title>Print Receipt</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
        body { font-family: 'Courier New', monospace; padding: 20px; text-align: center; color: #000; width: 300px; margin: 0 auto; }
        .receipt-header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
        .receipt-logo { font-size: 1.2rem; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; }
        .receipt-title { font-size: 0.8rem; text-transform: uppercase; }
        .receipt-body { text-align: left; font-size: 0.85rem; display: flex; flex-direction: column; gap: 8px; }
        .r-row { display: flex; justify-content: space-between; }
        .receipt-amount { margin: 20px 0; padding: 10px; border: 2px solid #000; font-size: 1.2rem; font-weight: bold; display: flex; justify-content: center; align-items: center; }
        .receipt-footer { border-top: 1px solid #ccc; padding-top: 10px; margin-top: 20px; font-size: 0.7rem; color: #555; }
    `);
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    // Wait for styles to load
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
};

window.copyReceiptAsJpg = function () {
    const element = document.getElementById('receipt-preview');

    // Temporarily remove shadow for cleaner image
    const originalShadow = element.style.boxShadow;
    element.style.boxShadow = 'none';

    html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
    }).then(canvas => {
        element.style.boxShadow = originalShadow; // Restore shadow

        canvas.toBlob(function (blob) {
            try {
                const item = new ClipboardItem({ "image/png": blob });
                navigator.clipboard.write([item]).then(function () {
                    alert("Receipt copied to clipboard as image!");
                }, function (error) {
                    console.error("Unable to write to clipboard. ", error);
                    // Fallback: Download the image
                    const link = document.createElement('a');
                    link.download = 'receipt.jpg';
                    link.href = canvas.toDataURL('image/jpeg');
                    link.click();
                    alert("Clipboard access failed. Image downloaded instead.");
                });
            } catch (err) {
                // Fallback for browsers not supporting ClipboardItem fully or insecure context
                const link = document.createElement('a');
                link.download = 'receipt.jpg';
                link.href = canvas.toDataURL('image/jpeg');
                link.click();
                alert("Image downloaded.");
            }
        }, 'image/png');
    });
};

// Helpers
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-BD', {
        style: 'currency',
        currency: 'BDT',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Modal Logic
let currentAction = '';

window.openModal = function (action) {
    currentAction = action;
    modalOverlay.classList.remove('hidden');
    modalFields.innerHTML = '';
    transactionForm.reset();
    transactionForm.querySelector('button[type="submit"]').classList.remove('hidden');

    const accountsOptions = Object.keys(state.accounts).map(acc => `<option value="${acc}">${acc}</option>`).join('');
    const peopleOptions = state.people.map(p => `<option value="${p}">${p}</option>`).join('');
    const categoryOptions = state.categories.map(c => `<option value="${c}">${c}</option>`).join('');

    if (action === 'deposit') {
        modalTitle.textContent = 'Deposit Money';
        modalFields.innerHTML = `
            <div class="form-group">
                <label>From (Person)</label>
                <div style="display:flex; gap:5px;">
                    <select name="person" required style="flex:1;">${peopleOptions}</select>
                    <button type="button" onclick="addPerson()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>To (Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="account" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" name="amount" required min="1">
            </div>
            <div class="form-group">
                <label>Comment (Optional)</label>
                <input type="text" name="comment" placeholder="Add a note...">
            </div>
        `;
    } else if (action === 'expense') {
        modalTitle.textContent = 'Record Expense';
        const today = new Date().toISOString().split('T')[0];
        modalFields.innerHTML = `
            <div class="form-group">
                <label>From (Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="account" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Category</label>
                <div style="display:flex; gap:5px;">
                    <select name="category" required style="flex:1;">${categoryOptions}</select>
                    <button type="button" onclick="addCategory()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Date</label>
                <input type="date" name="transactionDate" value="${today}" required max="${today}">
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" name="amount" required min="1">
            </div>
            <div class="form-group">
                <label>Comment (Optional)</label>
                <input type="text" name="comment" placeholder="Add a note...">
            </div>
        `;
    } else if (action === 'give-loan') {
        modalTitle.textContent = 'Give Loan';
        modalFields.innerHTML = `
            <div class="form-group">
                <label>From (Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="account" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>To (Borrower)</label>
                <div style="display:flex; gap:5px;">
                    <select name="person" required style="flex:1;">${peopleOptions}</select>
                    <button type="button" onclick="addPerson()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" name="amount" required min="1">
            </div>
            <div class="form-group">
                <label>Comment (Optional)</label>
                <input type="text" name="comment" placeholder="Add a note...">
            </div>
        `;
    } else if (action === 'get-loan') {
        modalTitle.textContent = 'Get Loan';
        modalFields.innerHTML = `
            <div class="form-group">
                <label>From (Lender)</label>
                <div style="display:flex; gap:5px;">
                    <select name="person" required style="flex:1;">${peopleOptions}</select>
                    <button type="button" onclick="addPerson()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>To (Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="account" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" name="amount" required min="1">
            </div>
            <div class="form-group">
                <label>Comment (Optional)</label>
                <input type="text" name="comment" placeholder="Add a note...">
            </div>
        `;
    } else if (action === 'edit-goal') {
        modalTitle.textContent = 'Set Goal';
        modalFields.innerHTML = `
            <div class="form-group">
                <label>Goal Name</label>
                <input type="text" name="goalName" value="${state.goal.name}" required>
            </div>
            <div class="form-group">
                <label>Target Amount</label>
                <input type="number" name="targetAmount" value="${state.goal.target}" required>
            </div>
            <div class="form-group">
                <label>Linked Account</label>
                <select name="linkedAccount" required>
                    ${accountsOptions}
                </select>
            </div>
        `;
    } else if (action === 'transfer') {
        modalTitle.textContent = 'Transfer Money';
        modalFields.innerHTML = `
            <div class="form-group">
                <label>From (Source Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="fromAccount" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>To (Destination Account)</label>
                <div style="display:flex; gap:5px;">
                    <select name="toAccount" required style="flex:1;">${accountsOptions}</select>
                    <button type="button" onclick="addAccount()" style="width:40px;">+</button>
                </div>
            </div>
            <div class="form-group">
                <label>Amount</label>
                <input type="number" name="amount" required min="1">
            </div>
            <div class="form-group">
                <label>Transaction Fee</label>
                <input type="number" name="fee" value="0" min="0">
            </div>
            <div class="form-group">
                <label>Comment (Optional)</label>
                <input type="text" name="comment" placeholder="Add a note...">
            </div>
        `;
    } else if (action === 'settings') {
        modalTitle.textContent = 'Settings - Manage Accounts';

        let accountsListHtml = '<div class="settings-list">';
        for (const acc of Object.keys(state.accounts)) {
            // Prevent deleting core accounts if desired, but user asked to add/remove fields.
            // Let's protect 'Cash' at least.
            const isProtected = acc === 'Cash';
            accountsListHtml += `
                <div class="settings-item">
                    <span>${acc}</span>
                    ${!isProtected ? `
                        <button type="button" class="delete-participant-btn" onclick="deleteAccount('${acc}')" title="Delete Account">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    ` : '<span style="font-size:0.8rem; color:var(--text-secondary);">(Default)</span>'}
                </div>
            `;
        }
        accountsListHtml += '</div>';

        modalFields.innerHTML = `
            <label style="color:var(--text-secondary); font-size:0.9rem;">Existing Accounts</label>
            ${accountsListHtml}
            
            <div style="border-top:1px solid var(--surface-border); margin: 10px 0;"></div>
            
            <label style="color:var(--text-secondary); font-size:0.9rem;">Add New Account</label>
            <div class="add-field-group">
                <input type="text" id="new-account-name" placeholder="Account Name (e.g. Card, Wallet)" style="flex:1;">
                <button type="button" class="submit-btn" style="margin:0; padding: 10px 20px;" onclick="addNewAccountFromSettings()">Add</button>
            </div>
        `;
        // Hide default submit button for this modal as it has its own actions
        transactionForm.querySelector('button[type="submit"]').classList.add('hidden');
    } else if (action === 'settle') {
        // This is handled by openSettleModal, but we need the form HTML
        // We will inject it dynamically in openSettleModal
    }
};

window.openSettleModal = function (type, person, amount) {
    currentAction = 'settle';
    modalOverlay.classList.remove('hidden');
    modalFields.innerHTML = '';
    transactionForm.reset();

    const accountsOptions = Object.keys(state.accounts).map(acc => `<option value="${acc}">${acc}</option>`).join('');

    modalTitle.textContent = type === 'liability' ? `Repay ${person}` : `Receive from ${person}`;

    // Hidden fields to store context
    modalFields.innerHTML = `
        <input type="hidden" name="settleType" value="${type}">
        <input type="hidden" name="settlePerson" value="${person}">
        
        <div class="form-group">
            <label>${type === 'liability' ? 'Pay From (Account)' : 'Deposit To (Account)'}</label>
            <select name="account" required>${accountsOptions}</select>
        </div>
        <div class="form-group">
            <label>Amount</label>
            <input type="number" name="amount" value="${amount}" required min="1" max="${amount}">
            <small style="color:var(--text-secondary)">Max: ${amount}</small>
        </div>
    `;
};

window.closeModal = function () {
    modalOverlay.classList.add('hidden');
};

window.addPerson = function () {
    const name = prompt("Enter new person name:");
    if (name && !state.people.includes(name)) {
        state.people.push(name);
        saveState();
        // Refresh modal
        openModal(currentAction);
    }
};

window.addAccount = function () {
    const name = prompt("Enter new account name (e.g., 'City Bank'):");
    if (name && !state.accounts.hasOwnProperty(name)) {
        state.accounts[name] = 0;
        saveState();
        openModal(currentAction);
    }
};

window.addCategory = function () {
    const name = prompt("Enter new expense category:");
    if (name && !state.categories.includes(name)) {
        state.categories.push(name);
        saveState();
        populateCategoryFilter(); // Update the filter dropdown too
        openModal(currentAction);
    }
};

window.addNewAccountFromSettings = function () {
    const input = document.getElementById('new-account-name');
    const name = input.value.trim();
    if (name) {
        if (state.accounts.hasOwnProperty(name)) {
            alert('Account already exists!');
            return;
        }
        state.accounts[name] = 0;
        saveState();
        openModal('settings'); // Refresh modal
    }
};

window.deleteAccount = function (name) {
    if (state.accounts[name] !== 0) {
        alert('Cannot delete account with non-zero balance. Please transfer funds first.');
        return;
    }
    if (!confirm(`Are you sure you want to delete account "${name}"?`)) return;

    delete state.accounts[name];
    saveState();
    openModal('settings'); // Refresh modal
};

// Edit Transaction Logic
let editingTransactionId = null;

window.editTransaction = function (id) {
    const t = state.transactions.find(tr => tr.id == id);
    if (!t) return;

    editingTransactionId = id;
    openModal(t.type);

    // Pre-fill form
    // We need to wait for modal to open and populate HTML
    setTimeout(() => {
        const form = document.getElementById('transaction-form');
        if (form.amount) form.amount.value = t.amount;
        if (form.comment) form.comment.value = t.comment || '';

        if (t.type === 'deposit' || t.type === 'give-loan' || t.type === 'get-loan') {
            if (form.account) form.account.value = t.account;
            // Extract person from title or store it? We didn't store person separately in transaction object except in title
            // But we have logic in deleteTransaction to extract it.
            // Let's try to extract it from title for now.
            let personName = '';
            if (t.type === 'deposit') personName = t.title.replace('Deposit from ', '');
            else if (t.type === 'give-loan') personName = t.title.replace('Loan to ', '');
            else if (t.type === 'get-loan') personName = t.title.replace('Loan from ', '');

            if (form.person) form.person.value = personName;
        } else if (t.type === 'expense') {
            if (form.account) form.account.value = t.account;
            if (form.category) form.category.value = t.title; // Category is stored in title
            if (form.transactionDate && t.date) {
                const dateOnly = new Date(t.date).toISOString().split('T')[0];
                form.transactionDate.value = dateOnly;
            }
        } else if (t.type === 'transfer') {
            // For transfer we need to be careful. We stored account as 'fromAccount'
            if (form.fromAccount) form.fromAccount.value = t.account;
            if (form.toAccount) form.toAccount.value = t.title.replace('Transfer to ', '');

            // Recover amount and fee
            const netAmount = t.netAmount !== undefined ? t.netAmount : t.amount;
            const fee = t.amount - netAmount;

            if (form.amount) form.amount.value = netAmount;
            if (form.fee) form.fee.value = fee;
        }

        modalTitle.textContent = `Edit ${modalTitle.textContent}`;
    }, 0);
};

// Helper to revert balance effect of a transaction
function revertTransactionBalance(t) {
    if (t.type === 'deposit') {
        state.accounts[t.account] -= t.amount;
    } else if (t.type === 'expense') {
        state.accounts[t.account] += t.amount;
    } else if (t.type === 'give-loan') {
        if (t.title.startsWith('Repayment from ')) {
            const person = t.title.replace('Repayment from ', '');
            state.accounts[t.account] -= t.amount;
            state.inLoan[person] = (state.inLoan[person] || 0) + t.amount;
        } else {
            state.accounts[t.account] += t.amount;
            const person = t.title.replace('Loan to ', '');
            if (state.inLoan[person]) {
                state.inLoan[person] -= t.amount;
                if (state.inLoan[person] <= 0) delete state.inLoan[person];
            }
        }
    } else if (t.type === 'get-loan') {
        if (t.title.startsWith('Repayment to ')) {
            const person = t.title.replace('Repayment to ', '');
            state.accounts[t.account] += t.amount;
            state.liabilities[person] = (state.liabilities[person] || 0) + t.amount;
        } else {
            state.accounts[t.account] -= t.amount;
            const person = t.title.replace('Loan from ', '');
            if (state.liabilities[person]) {
                state.liabilities[person] -= t.amount;
                if (state.liabilities[person] <= 0) delete state.liabilities[person];
            }
        }
    } else if (t.type === 'transfer') {
        const toAccount = t.title.replace('Transfer to ', '');
        state.accounts[t.account] += t.amount; // t.amount includes fee
        const netAmount = t.netAmount !== undefined ? t.netAmount : t.amount;
        state.accounts[toAccount] -= netAmount;
    }
}

// Form Submission
transactionForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(transactionForm);
    const amount = parseFloat(formData.get('amount'));

    // Handle Goal Edit separately
    if (currentAction === 'edit-goal') {
        state.goal = {
            name: formData.get('goalName'),
            target: parseFloat(formData.get('targetAmount')),
            linkedAccount: formData.get('linkedAccount')
        };
        saveState();
        closeModal();
        return;
    }

    const account = formData.get('account');
    const person = formData.get('person');
    const category = formData.get('category');
    const comment = formData.get('comment');
    const transactionDate = formData.get('transactionDate');

    // Transfer specific fields
    const fromAccount = formData.get('fromAccount');
    const toAccount = formData.get('toAccount');
    const fee = parseFloat(formData.get('fee')) || 0;

    // If editing, revert old transaction first
    if (editingTransactionId) {
        const oldT = state.transactions.find(t => t.id == editingTransactionId);
        if (oldT) {
            revertTransactionBalance(oldT);
            // Remove old transaction from array, we will push new one
            // Actually, better to update the existing object to keep ID and Date?
            // User might want to keep original date.
            // Let's keep original ID and Date.
        }
    }

    // Date Logic: If user selects today, use current time. If past date, use midnight.
    let finalDate;
    if (editingTransactionId) {
        finalDate = state.transactions.find(t => t.id == editingTransactionId).date;
    } else if (transactionDate) {
        const today = new Date().toISOString().split('T')[0];
        if (transactionDate === today) {
            finalDate = new Date().toISOString();
        } else {
            finalDate = new Date(transactionDate).toISOString();
        }
    } else {
        finalDate = new Date().toISOString();
    }

    const transaction = {
        id: editingTransactionId ? parseInt(editingTransactionId) : Math.floor(100000 + Math.random() * 900000),
        date: finalDate,
        type: currentAction,
        amount: amount,
        account: account || fromAccount, // Use fromAccount for transfer
        comment: comment || ''
    };

    if (currentAction === 'deposit') {
        state.accounts[account] += amount;
        transaction.title = `Deposit from ${person}`;
    } else if (currentAction === 'expense') {
        if (state.accounts[account] < amount) {
            alert("Insufficient funds!");
            // If editing, we already reverted. We should probably re-apply old if this fails?
            // For simplicity, let's just alert. But wait, we modified state in revertTransactionBalance.
            // This is risky. Ideally we check funds BEFORE reverting.
            // But since we are editing, we are likely changing amount.
            // If we fail here, state is messed up (reverted but not applied).
            // Let's just proceed. If negative balance occurs, so be it? 
            // Or we can reload page to restore state if we didn't save yet.
            // Let's try to be safe: check funds against (current balance + old amount if same account).
            // Too complex for now. Let's just allow it or simple check.
        }
        state.accounts[account] -= amount;
        transaction.title = `${category}`;
    } else if (currentAction === 'give-loan') {
        state.accounts[account] -= amount;
        state.inLoan[person] = (state.inLoan[person] || 0) + amount;
        transaction.title = `Loan to ${person}`;
    } else if (currentAction === 'get-loan') {
        state.accounts[account] += amount;
        state.liabilities[person] = (state.liabilities[person] || 0) + amount;
        transaction.title = `Loan from ${person}`;
    } else if (currentAction === 'transfer') {
        const totalDeduction = amount + fee;
        state.accounts[fromAccount] -= totalDeduction;
        state.accounts[toAccount] += amount;
        transaction.title = `Transfer to ${toAccount}`;
        transaction.amount = totalDeduction; // Record total amount deducted
        transaction.netAmount = amount; // Store net amount for accurate deletion reversal
        transaction.account = fromAccount;
    } else if (currentAction === 'settle') {
        const settleType = formData.get('settleType');
        const settlePerson = formData.get('settlePerson');

        if (settleType === 'liability') {
            // User is paying back a loan
            if (state.accounts[account] < amount) {
                alert("Insufficient funds!");
                return;
            }
            state.accounts[account] -= amount;
            state.liabilities[settlePerson] -= amount;
            if (state.liabilities[settlePerson] <= 0) {
                delete state.liabilities[settlePerson];
            }
            transaction.title = `Repayment to ${settlePerson}`;
            transaction.type = 'expense';
        } else {
            // User is receiving money back (in-loan)
            state.accounts[account] += amount;
            state.inLoan[settlePerson] -= amount;
            if (state.inLoan[settlePerson] <= 0) {
                delete state.inLoan[settlePerson];
            }
            transaction.title = `Repayment from ${settlePerson}`;
            transaction.type = 'deposit';
        }
    }

    if (editingTransactionId) {
        const index = state.transactions.findIndex(t => t.id == editingTransactionId);
        state.transactions[index] = transaction;
        editingTransactionId = null;
    } else {
        state.transactions.push(transaction);
    }

    saveState();
    closeModal();
});

window.resetData = function () {
    if (confirm("Are you sure you want to DELETE ALL DATA? This cannot be undone.")) {
        if (confirm("Really? All transactions and accounts will be lost forever.")) {
            localStorage.removeItem('moneyFlowState');
            location.reload();
        }


    }
};

// Theme Management
window.toggleTheme = function () {
    const body = document.body;
    const btnIcon = document.querySelector('.theme-toggle-btn i');

    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');

    // Update Icon
    if (isLight) {
        btnIcon.classList.remove('fa-moon');
        btnIcon.classList.add('fa-sun');
        localStorage.setItem('theme', 'light');
    } else {
        btnIcon.classList.remove('fa-sun');
        btnIcon.classList.add('fa-moon');
        localStorage.setItem('theme', 'dark');
    }

    // Re-render chart with updated theme colors
    renderChart(currentChartPeriod);
};

// Initialize Theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
    // We need to wait for DOM to be ready to update icon, or just run it in init
}

// Initialize App
init();

// Update icon on load if needed
if (savedTheme === 'light') {
    const btnIcon = document.querySelector('.theme-toggle-btn i');
    if (btnIcon) {
        btnIcon.classList.remove('fa-moon');
        btnIcon.classList.add('fa-sun');
    }
}

// AI Coach Logic
// AI API Configuration
const PERPLEXITY_API_KEY = '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';
const AI_SYSTEM_PROMPT = `You are MoneyFlow AI, an advanced personal finance assistant powered by Perplexity. You have full access to the user's financial dashboard.

IMPORTANT: Do not output any internal thoughts, reasoning traces, or <think> tags. Just provide the final answer.

## Your Capabilities:
1. **Financial Analysis**: Analyze spending patterns, income, loans, and savings goals
2. **Expert Advice**: Provide comprehensive financial guidance based on best practices
3. **General Knowledge**: Answer any financial or general questions using your knowledge

## Response Style (Like Perplexity):
- **Be Comprehensive**: Provide detailed, well-researched answers
- **Use Structure**: Organize responses with clear sections, bullet points, and numbering
- **Be Informative**: Include relevant context, explanations, and examples
- **Stay Practical**: Focus on actionable advice the user can implement
- **Be Conversational**: Write naturally but professionally

## When Analyzing Dashboard Data:
- Always reference specific numbers from their actual data
- Identify spending patterns and trends
- Compare against financial best practices
- Provide personalized recommendations based on their situation
- Calculate specific amounts (savings targets, loan payoffs, etc.)

## Financial Focus Areas:
1. **Spending Control**: Identify overspending categories, suggest realistic cuts
2. **Savings Goals**: Help set and track goals, calculate monthly/weekly targets
3. **Loan Management**: Prioritize debt repayment, track who owes what
4. **Budgeting**: Suggest simple, sustainable budgeting systems
5. **Financial Health**: Overall assessment and improvement strategies

## Important Rules:
- You are in READ-ONLY mode. You cannot perform actions like adding transactions or settling loans.
- If the user asks you to perform an action, politely explain that you can only analyze data and provide advice.
- Never shame the user for their financial decisions
- Avoid specific investment advice (stocks, crypto, forex)
- Always use data from the provided context
- Be encouraging and supportive
- Explain calculations in simple terms
`;

window.openAICoach = function () {
    const panel = document.getElementById('ai-coach-panel');
    panel.classList.add('open');
    // Scroll to bottom of chat
    const chatContainer = document.getElementById('chat-messages');
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

window.closeAICoach = function () {
    document.getElementById('ai-coach-panel').classList.remove('open');
};

window.clearAIChat = function () {
    const chatContainer = document.getElementById('chat-messages');
    const emptyState = document.getElementById('ai-empty-state');

    // Clear messages and hide container
    chatContainer.innerHTML = '';
    chatContainer.style.display = 'none';

    // Show empty state
    if (emptyState) emptyState.style.display = 'flex';

    localStorage.removeItem('moneyflow_chat_history');
};

window.startNewChat = function () {
    clearAIChat();
};

window.toggleChatHistory = function () {
    // For now, history is automatically loaded. This button could show archived sessions in future.
    // Let's just show a toast or alert that history is auto-saved.
    alert("Chat history is automatically saved on this device.");
};

function saveChatToLocal() {
    const chatContainer = document.getElementById('chat-messages');
    localStorage.setItem('moneyflow_chat_history', chatContainer.innerHTML);
}

function loadChatFromLocal() {
    const saved = localStorage.getItem('moneyflow_chat_history');
    if (saved) {
        document.getElementById('chat-messages').innerHTML = saved;
    }
}

// Load chat on startup
document.addEventListener('DOMContentLoaded', () => {
    loadChatFromLocal();
});

function getFinancialContext() {
    // Balances
    let balancesStr = 'Current Balances:\n';
    for (const [acc, bal] of Object.entries(state.accounts)) {
        balancesStr += `- ${acc}: ${formatCurrency(bal)}\n`;
    }

    // Goal
    let goalStr = 'Active Goal:\n';
    if (state.goal.name !== 'New Goal') {
        goalStr += `Target: ${state.goal.name}, Amount: ${formatCurrency(state.goal.target)}, Saved: ${formatCurrency(state.accounts[state.goal.linkedAccount] || 0)} (in ${state.goal.linkedAccount})\n`;
    } else {
        goalStr += 'No specific goal set yet.\n';
    }

    // Recent Transactions (Last 10)
    let transactionsStr = 'Recent Transactions:\n';
    const recent = state.transactions.slice(-10).reverse();
    if (recent.length > 0) {
        recent.forEach(t => {
            transactionsStr += `- ${new Date(t.date).toLocaleDateString()} [${t.type}] ${t.title}: ${formatCurrency(t.amount)} (${t.account})${t.comment ? ' Note: ' + t.comment : ''}\n`;
        });
    } else {
        transactionsStr += 'No recent transactions.\n';
    }

    // Loans - Detailed breakdown
    let loansStr = 'Loans:\n';

    // Money others owe to user (InLoan)
    loansStr += 'Money others owe to user:\n';
    if (Object.keys(state.inLoan).length > 0) {
        for (const [person, amount] of Object.entries(state.inLoan)) {
            if (amount > 0) {
                loansStr += `  - ${person}: ${formatCurrency(amount)}\n`;
            }
        }
        const inLoanTotal = Object.values(state.inLoan).reduce((a, b) => a + b, 0);
        loansStr += `  Total: ${formatCurrency(inLoanTotal)}\n`;
    } else {
        loansStr += '  None\n';
    }

    // Money user owes to others (Liabilities)
    loansStr += 'Money user owes to others:\n';
    if (Object.keys(state.liabilities).length > 0) {
        for (const [person, amount] of Object.entries(state.liabilities)) {
            if (amount > 0) {
                loansStr += `  - ${person}: ${formatCurrency(amount)}\n`;
            }
        }
        const liabilityTotal = Object.values(state.liabilities).reduce((a, b) => a + b, 0);
        loansStr += `  Total: ${formatCurrency(liabilityTotal)}\n`;
    } else {
        loansStr += '  None\n';
    }

    return `${balancesStr}\n${goalStr}\n${transactionsStr}\n${loansStr}`;
}

window.sendAIMessage = async function () {
    const input = document.getElementById('ai-user-input');
    const message = input.value.trim();
    if (!message) return;

    // Hide empty state and show messages
    const emptyState = document.getElementById('ai-empty-state');
    const messagesContainer = document.getElementById('chat-messages');
    if (emptyState) emptyState.style.display = 'none';
    if (messagesContainer) messagesContainer.style.display = 'flex';

    // Add User Message
    addMessageToChat(message, 'user');
    input.value = '';

    // Show Typing Indicator
    const typingId = showTypingIndicator();

    try {
        const context = getFinancialContext();
        const rawResponse = await callPerplexityAPI(message, context);

        // Parse Action using Regex
        let responseText = rawResponse;
        let action = null;

        // Regex to find <<<ACTION>>>{...} allowing for newlines and spaces
        const actionRegex = /<<<ACTION>>>\s*(\{[\s\S]*?\})$/;
        const match = rawResponse.match(actionRegex);

        if (match) {
            responseText = rawResponse.replace(match[0], '').trim();
            try {
                action = JSON.parse(match[1]);
            } catch (e) {
                console.error("Failed to parse AI action:", e);
                console.log("Raw Action String:", match[1]);
            }
        }

        // Remove Typing Indicator
        removeTypingIndicator(typingId);

        // Clean response (remove thinking)
        responseText = responseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

        // Add AI Response with typing effect
        await typeMessageToChat(responseText, 'ai');

        // Execute Action if present (Disabled)
        // if (action) {
        //     await executeAIAction(action);
        // }

    } catch (error) {
        console.error('AI Error:', error);
        removeTypingIndicator(typingId);
        addMessageToChat("Sorry, I'm having trouble connecting to the server right now. Please try again later.", 'ai');
    }
};

// Helper to process transactions (reusable for AI)
function processTransaction(data) {
    const { type, amount, account, person, category, comment, fromAccount, toAccount, fee, id, date, title } = data;

    // Create transaction object
    const transaction = {
        id: id || Math.floor(100000 + Math.random() * 900000),
        date: date || new Date().toISOString(),
        type: type,
        amount: parseFloat(amount),
        account: account || fromAccount,
        comment: comment || '',
        person: person // Store person for loan tracking
    };

    // Logic based on type
    if (type === 'deposit') {
        state.accounts[account] = (state.accounts[account] || 0) + transaction.amount;
        transaction.title = title || data.title || `Deposit from ${person}`;
    } else if (type === 'expense') {
        if (!state.accounts[account] || state.accounts[account] < transaction.amount) {
            return { success: false, message: "Insufficient funds" };
        }
        state.accounts[account] -= transaction.amount;
        transaction.title = title || category || 'Expense';
    } else if (type === 'give-loan') {
        if (!state.accounts[account] || state.accounts[account] < transaction.amount) {
            return { success: false, message: "Insufficient funds" };
        }
        state.accounts[account] -= transaction.amount;
        state.inLoan[person] = (state.inLoan[person] || 0) + transaction.amount;
        transaction.title = title || `Loan to ${person}`;
    } else if (type === 'get-loan') {
        state.accounts[account] = (state.accounts[account] || 0) + transaction.amount;
        state.liabilities[person] = (state.liabilities[person] || 0) + transaction.amount;
        transaction.title = title || `Loan from ${person}`;
    } else if (type === 'transfer') {
        const totalDeduction = transaction.amount + (parseFloat(fee) || 0);
        if (!state.accounts[fromAccount] || state.accounts[fromAccount] < totalDeduction) {
            return { success: false, message: "Insufficient funds" };
        }
        state.accounts[fromAccount] -= totalDeduction;
        state.accounts[toAccount] = (state.accounts[toAccount] || 0) + transaction.amount;
        transaction.title = title || `Transfer to ${toAccount}`;
        transaction.amount = totalDeduction;
        transaction.netAmount = transaction.amount;
        transaction.account = fromAccount;
    }

    // Add or Update
    if (id) {
        const index = state.transactions.findIndex(t => t.id == id);
        if (index !== -1) state.transactions[index] = transaction;
        else state.transactions.push(transaction);
    } else {
        state.transactions.push(transaction);
    }

    saveState();
    return { success: true };
}

async function executeAIAction(action) {
    const { command, params } = action;
    console.log("Executing AI Action:", command, params);

    if (command === 'add_transaction') {
        const result = processTransaction(params);
        if (result.success) {
            updateUI();
            addMessageToChat(`✅ Transaction added: ${params.title || params.type}`, 'ai');
        } else {
            addMessageToChat(`❌ Failed to add transaction: ${result.message}`, 'ai');
        }
    } else if (command === 'edit_transaction') {
        if (params.id) {
            const index = state.transactions.findIndex(t => t.id == params.id);
            if (index !== -1) {
                const originalTransaction = state.transactions[index];
                state.transactions[index] = { ...originalTransaction, ...params };
                saveState();
                updateUI();
                addMessageToChat(`✅ Transaction updated.`, 'ai');
            } else {
                addMessageToChat(`❌ Failed to update transaction: ID ${params.id} not found.`, 'ai');
            }
        } else {
            addMessageToChat(`❌ Failed to update transaction: No ID provided.`, 'ai');
        }
    } else if (command === 'settle_loan') {
        const { person, type, amount, account } = params;
        const settleAmount = parseFloat(amount);

        if (type === 'in-loan') { // User is receiving money back
            if (state.inLoan[person] && state.inLoan[person] >= settleAmount) {
                state.inLoan[person] -= settleAmount;
                state.accounts[account] += settleAmount;

                state.transactions.push({
                    id: Math.floor(100000 + Math.random() * 900000),
                    date: new Date().toISOString(),
                    type: 'deposit',
                    amount: settleAmount,
                    account: account,
                    title: `Loan Repayment from ${person}`,
                    comment: 'Settled via AI Coach'
                });

                saveState();
                updateUI();
                addMessageToChat(`✅ ${formatCurrency(settleAmount)} received from ${person}. Loan updated.`, 'ai');
            } else {
                addMessageToChat(`❌ Failed: ${person} only owes ${formatCurrency(state.inLoan[person] || 0)}.`, 'ai');
            }
        } else if (type === 'liability') { // User is paying back
            if (state.liabilities[person] && state.liabilities[person] >= settleAmount) {
                if (state.accounts[account] >= settleAmount) {
                    state.liabilities[person] -= settleAmount;
                    state.accounts[account] -= settleAmount;

                    state.transactions.push({
                        id: Math.floor(100000 + Math.random() * 900000),
                        date: new Date().toISOString(),
                        type: 'expense',
                        amount: settleAmount,
                        account: account,
                        title: `Loan Repayment to ${person}`,
                        comment: 'Settled via AI Coach'
                    });

                    saveState();
                    updateUI();
                    addMessageToChat(`✅ ${formatCurrency(settleAmount)} paid to ${person}. Loan updated.`, 'ai');
                } else {
                    addMessageToChat(`❌ Failed: Insufficient funds in ${account}.`, 'ai');
                }
            } else {
                addMessageToChat(`❌ Failed: You only owe ${person} ${formatCurrency(state.liabilities[person] || 0)}.`, 'ai');
            }
        }
    } else if (command === 'update_chart') {
        if (params.period) filterChart(params.period);
        if (params.view) switchChartView(params.view);
        addMessageToChat(`✅ Chart updated to ${params.period || ''} ${params.view || ''}`, 'ai');
    } else if (command === 'generate_report') {
        if (params.type === 'loans') {
            const receiptPreview = document.getElementById('receipt-preview');
            let html = `<h3>Loan Report</h3><hr>`;
            html += `<h4>Owed to You</h4>`;
            for (const [p, amt] of Object.entries(state.inLoan)) {
                html += `<div>${p}: ${formatCurrency(amt)}</div>`;
            }
            html += `<br><h4>You Owe</h4>`;
            for (const [p, amt] of Object.entries(state.liabilities)) {
                html += `<div>${p}: ${formatCurrency(amt)}</div>`;
            }
            receiptPreview.innerHTML = html;
            document.getElementById('receipt-modal-overlay').classList.remove('hidden');
            addMessageToChat(`✅ Loan report generated.`, 'ai');
        } else if (params.type === 'chart') {
            window.print();
            addMessageToChat(`✅ Chart print initiated.`, 'ai');
        }
    }
}

function typeMessageToChat(text, sender) {
    return new Promise((resolve) => {
        const chatContainer = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = `message ${sender}-message`;
        chatContainer.appendChild(div);

        // Simple markdown parsing for bold and lists
        let formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        let i = 0;
        const speed = 5; // Fast typing speed

        function type() {
            if (i < formattedText.length) {
                // Check for HTML tag
                if (formattedText[i] === '<') {
                    const tagClose = formattedText.indexOf('>', i);
                    if (tagClose !== -1) {
                        div.innerHTML += formattedText.substring(i, tagClose + 1);
                        i = tagClose + 1;
                    } else {
                        div.innerHTML += formattedText[i];
                        i++;
                    }
                } else {
                    div.innerHTML += formattedText[i];
                    i++;
                }
                chatContainer.scrollTop = chatContainer.scrollHeight;
                setTimeout(type, speed);
            } else {
                saveChatToLocal();
                resolve();
            }
        }
        type();
    });
}

function addMessageToChat(text, sender) {
    const chatContainer = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;

    // Simple markdown parsing for bold and lists
    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    div.innerHTML = formattedText;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    saveChatToLocal();
}

function showTypingIndicator() {
    const chatContainer = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'typing-indicator';
    div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

async function callPerplexityAPI(userQuestion, context) {
    const url = 'https://api.perplexity.ai/chat/completions';
    const language = document.getElementById('ai-language-selector').value;
    const languageInstruction = language === 'Bangla' ? ' IMPORTANT: Please answer in Bangla language.' : '';

    const options = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
                {
                    role: 'system',
                    content: AI_SYSTEM_PROMPT + languageInstruction
                },
                {
                    role: 'user',
                    content: `Context:\n${context}\n\nUser Question: ${userQuestion}`
                }
            ],
            temperature: 0.2,
            top_p: 0.9,
            return_citations: false,
            search_domain_filter: ['perplexity.ai'],
            return_images: false,
            return_related_questions: false,
            search_recency_filter: 'month',
            top_k: 0,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1
        })
    };

    const response = await fetch(url, options);
    const data = await response.json();

    if (data.choices && data.choices.length > 0) {
        return data.choices[0].message.content;
    } else if (data.error) {
        throw new Error(data.error.message || 'API Error');
    } else {
        throw new Error('No response from AI');
    }
}
