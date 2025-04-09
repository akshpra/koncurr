// --- Configuration ---
const currenciesToTrack = [ 'usd', 'aed', 'jpy', 'vnd', 'cny', 'eur', 'gbp', 'cad', 'sar', 'chf', 'sgd', 'hkd', 'aud', 'krw' ];
const baseCurrency = 'inr';
const apiBaseUrl = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';
const daysForHistoricalData = 30; // For cards
const MIN_DOWNLOAD_DATE = '2024-04-01'; // Minimum start date for download

// --- DOM Elements ---
const mainLoaderElement = document.getElementById('main-loader');
const mainErrorElement = document.getElementById('main-error');
const currencyGridElement = document.getElementById('currency-grid');
// Converter Elements
const converterSeparatorElement = document.getElementById('converter-separator');
const converterSectionElement = document.getElementById('currency-converter');
const amountInputElement = document.getElementById('amount');
const fromCurrencySelectElement = document.getElementById('from-currency');
const toCurrencySelectElement = document.getElementById('to-currency');
const swapButtonElement = document.getElementById('swap-button');
const conversionResultElement = document.getElementById('conversion-result');
// Downloader Elements
const downloadSeparatorElement = document.getElementById('download-separator');
const downloaderSectionElement = document.getElementById('data-downloader');
const startDateInputElement = document.getElementById('start-date');
const endDateInputElement = document.getElementById('end-date');
const downloadCurrencySelectElement = document.getElementById('download-currency');
const downloadBaseCurrencySelectElement = document.getElementById('download-base-currency');
const downloadButtonElement = document.getElementById('download-button');
const downloadStatusElement = document.getElementById('download-status');


// --- Global State ---
let fullHistoricalData = null; // For cards
let latestRatesData = null; // For cards and converter
let allCurrencies = null; // To store list of all available currencies for downloader

// --- Chart Colors ---
const currencyColors = { USD: '#005ea6', AED: '#ca8a04', JPY: '#dc2626', VND: '#16a34a', CNY: '#64748b', EUR: '#6d28d9', GBP: '#db2777', CAD: '#ea580c', SAR: '#006c35', CHF: '#d52b1e', SGD: '#003b6e', HKD: '#701a75', AUD: '#00008b', KRW: '#0d9488', DEFAULT: '#6b7280' };
function getCurrencyColor(currencyCode) { return currencyColors[currencyCode.toUpperCase()] || currencyColors.DEFAULT; }
function getLightCurrencyColor(currencyCode) { const hexColor = getCurrencyColor(currencyCode); let r=0,g=0,b=0; if (hexColor.length == 7){ r=parseInt(hexColor.substring(1,3),16); g=parseInt(hexColor.substring(3,5),16); b=parseInt(hexColor.substring(5,7),16); } else if (hexColor.length == 4){ r=parseInt(hexColor.substring(1,2)+hexColor.substring(1,2),16); g=parseInt(hexColor.substring(2,3)+hexColor.substring(2,3),16); b=parseInt(hexColor.substring(3,4)+hexColor.substring(3,4),16); } return `rgba(${r}, ${g}, ${b}, 0.15)`; }

// --- Utility Functions ---
function showElement(element) { if (element) element.style.display = 'flex'; }
function showGridElement(element) { if (element) element.style.display = 'grid'; }
function showBlockElement(element) { if (element) element.style.display = 'block'; }
function hideElement(element) { if (element) element.style.display = 'none'; }
function setStatusMessage(element, message, isError = false) {
    if (element) {
        element.textContent = message;
        element.className = `mt-6 text-sm text-center min-h-[1.25rem] ${isError ? 'text-red-600' : 'text-slate-600'}`;
    }
}
// Get today's date in YYYY-MM-DD format
function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

// --- API Fetching Functions ---
async function fetchLatestRates() { /* ... as before ... */ console.log("Fetching latest rates..."); const rates = {}; try { const response = await fetch(`${apiBaseUrl}/currencies/${baseCurrency}.json?t=${new Date().getTime()}`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); if (!data[baseCurrency]) throw new Error(`Invalid API response structure`); currenciesToTrack.forEach(currency => { const rateFromBase = data[baseCurrency][currency]; rates[currency.toUpperCase()] = (rateFromBase !== undefined && rateFromBase !== 0) ? 1 / rateFromBase : null; }); console.log("Latest rates fetched:", rates); return rates; } catch (error) { console.error("Error fetching latest rates:", error); throw error; } }
async function fetchHistoricalRates() { /* ... as before ... */ console.log("Fetching historical rates for cards..."); const historicalData = {}; const dates = []; const today = new Date(); currenciesToTrack.forEach(currency => { historicalData[currency.toUpperCase()] = {}; }); for (let i = 0; i < daysForHistoricalData; i++) { const date = new Date(today); date.setDate(today.getDate() - i); const currentDate = new Date(); if (date > currentDate) continue; dates.push(date.toISOString().split('T')[0]); } dates.sort(); const fetchTasks = []; for (const date of dates) { for (const currency of currenciesToTrack) { const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${currency}.json`; fetchTasks.push({ url, date, currency }); } } if (fetchTasks.length === 0) return { dates: [], historicalData }; const results = await Promise.allSettled(fetchTasks.map(task => fetch(task.url).then(response => { if (!response.ok) { throw new Error(`HTTP ${response.status}`); } const ct = response.headers.get("content-type"); if (!ct || !ct.includes("application/json")) throw new Error(`Unexpected content type`); return response.json(); }).then(data => ({ ...task, data })).catch(error => { throw new Error(`Fetch Error for ${task.currency} on ${task.date}: ${error.message}`); }) )); results.forEach((result, index) => { const task = fetchTasks[index]; const currencyUpper = task.currency.toUpperCase(); if (!historicalData[currencyUpper]) historicalData[currencyUpper] = {}; if (result.status === 'fulfilled') { const rateToBase = result.value.data?.[task.currency]?.[baseCurrency]; historicalData[currencyUpper][task.date] = (rateToBase !== undefined && typeof rateToBase === 'number') ? rateToBase : null; } else { historicalData[currencyUpper][task.date] = null; } }); console.log(`Historical data processing for cards complete.`); return { dates, historicalData }; }
/**
 * Fetches the list of all available currencies from the API.
 */
async function fetchAllCurrenciesList() {
    console.log("Fetching list of all currencies...");
    try {
        const response = await fetch(`${apiBaseUrl}/currencies.json`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // data is expected to be an object like { "usd": "United States Dollar", ... }
        // We only need the keys (currency codes)
        allCurrencies = Object.keys(data).map(c => c.toUpperCase()).sort();
        console.log(`Fetched ${allCurrencies.length} currency codes.`);
        return allCurrencies;
    } catch (error) {
        console.error("Error fetching all currencies list:", error);
        // Fallback to tracked currencies + base if fetching all fails
        allCurrencies = [baseCurrency.toUpperCase(), ...currenciesToTrack.map(c => c.toUpperCase())].sort();
        return allCurrencies;
    }
}


// --- UI Update Functions ---
function displayCurrencyGrid() { /* ... as before ... */ if (!currencyGridElement) return; currencyGridElement.innerHTML = ''; if (!latestRatesData || !fullHistoricalData) { console.error("Missing data for grid."); setStatusMessage(mainErrorElement, "Could not load all required currency data.", true); return; } const { dates, historicalData } = fullHistoricalData; currenciesToTrack.forEach(currencyCodeLower => { const currencyCode = currencyCodeLower.toUpperCase(); const latestRate = latestRatesData[currencyCode]; const currencyHistorical = historicalData[currencyCode]; const card = document.createElement('div'); card.className = 'currency-card bg-white rounded-lg shadow border border-slate-200 p-4 flex flex-col min-h-[220px]'; const topSection = document.createElement('div'); topSection.className = 'flex-grow'; const currencyLabel = document.createElement('span'); currencyLabel.className = 'font-semibold text-lg text-slate-700'; currencyLabel.textContent = currencyCode; const rateDisplay = document.createElement('div'); rateDisplay.className = 'text-2xl font-light text-slate-900 mb-1 mt-1'; if (typeof latestRate === 'number') { let dp = 4; if (latestRate < 0.01) dp = 6; else if (latestRate < 1) dp = 5; rateDisplay.textContent = latestRate.toFixed(dp); const baseSpan = document.createElement('span'); baseSpan.className = 'text-sm font-medium text-slate-500 ml-1'; baseSpan.textContent = baseCurrency.toUpperCase(); rateDisplay.appendChild(baseSpan); } else { rateDisplay.textContent = 'N/A'; rateDisplay.classList.add('text-slate-400', 'text-xl'); } topSection.appendChild(currencyLabel); topSection.appendChild(rateDisplay); let changeIndicator = null; if (currencyHistorical && dates && dates.length >= 2) { const lastDate = dates[dates.length - 1]; const previousDate = dates[dates.length - 2]; const rateNow = currencyHistorical[lastDate]; const ratePrevious = currencyHistorical[previousDate]; if (typeof rateNow === 'number' && typeof ratePrevious === 'number') { if (ratePrevious !== 0) { const change = rateNow - ratePrevious; const percentChange = (change / ratePrevious) * 100; changeIndicator = document.createElement('div'); changeIndicator.className = 'text-xs font-medium mt-1'; let arrow = ''; let textColor = 'text-slate-500'; if (percentChange > 0.001) { arrow = '↑ '; textColor = 'text-green-600'; } else if (percentChange < -0.001) { arrow = '↓ '; textColor = 'text-red-600'; } changeIndicator.classList.add(textColor); changeIndicator.textContent = `${arrow}${Math.abs(percentChange).toFixed(2)}%`; } } } if (changeIndicator) { topSection.appendChild(changeIndicator); } const chartContainer = document.createElement('div'); chartContainer.className = 'mini-chart-container'; const canvas = document.createElement('canvas'); const canvasId = `chart-${currencyCode}`; canvas.id = canvasId; chartContainer.appendChild(canvas); card.appendChild(topSection); card.appendChild(chartContainer); currencyGridElement.appendChild(card); if (currencyHistorical && dates && dates.length > 0) { displayMiniChart(canvasId, currencyCode, dates, currencyHistorical); } else { chartContainer.innerHTML = `<div class="text-xs text-center text-slate-400 pt-4">Chart data unavailable</div>`; } }); showGridElement(currencyGridElement); }
function displayMiniChart(canvasId, currencyCode, dates, currencyHistoricalData) { /* ... as before ... */ const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const dataPoints = dates.map(date => currencyHistoricalData[date] ?? null); const hasValidData = dataPoints.some(point => point !== null); if (!hasValidData) { const container = canvas.parentElement; if(container) container.innerHTML = `<div class="text-xs text-center text-slate-400 pt-4">Chart data unavailable</div>`; return; } const color = getCurrencyColor(currencyCode); const lightColor = getLightCurrencyColor(currencyCode); try { new Chart(ctx, { type: 'line', data: { labels: dates, datasets: [{ label: currencyCode, data: dataPoints, borderColor: color, backgroundColor: lightColor, borderWidth: 1.5, fill: 'origin', tension: 0.3, spanGaps: true, pointRadius: 0, }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.7)', titleFont: { size: 10, family: 'system-ui, sans-serif' }, bodyFont: { size: 10, family: 'system-ui, sans-serif' }, padding: 6, boxPadding: 3, displayColors: false, callbacks: { title: function(tooltipItems) { return tooltipItems[0]?.label || ''; }, label: function(context) { let label = ''; const value = context.parsed.y; if (value !== null) { let dp; const val = Math.abs(value); if (val === 0) dp = 0; else if (val < 0.01) dp = 7; else if (val < 0.1) dp = 6; else if (val < 1) dp = 5; else dp = 4; label += value.toFixed(dp); label += ` ${baseCurrency.toUpperCase()}`; } else { label += 'N/A'; } return label; } } } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderCapStyle: 'round' } }, interaction: { mode: 'nearest', intersect: false, axis: 'x' } } }); } catch (chartError) { const container = canvas.parentElement; if(container) container.innerHTML = `<div class="text-xs text-center text-red-500 pt-4">Chart error</div>`; console.error(`Error creating mini chart for ${currencyCode}:`, chartError); } }

// --- Currency Converter Functions ---
function populateConverterSelects() { /* ... as before ... */ if (!fromCurrencySelectElement || !toCurrencySelectElement || !latestRatesData) { console.error("Converter selects or rates data not available for population."); return; } fromCurrencySelectElement.innerHTML = ''; toCurrencySelectElement.innerHTML = ''; const baseOptionFrom = document.createElement('option'); baseOptionFrom.value = baseCurrency.toUpperCase(); baseOptionFrom.textContent = baseCurrency.toUpperCase(); fromCurrencySelectElement.appendChild(baseOptionFrom); const baseOptionTo = document.createElement('option'); baseOptionTo.value = baseCurrency.toUpperCase(); baseOptionTo.textContent = baseCurrency.toUpperCase(); toCurrencySelectElement.appendChild(baseOptionTo); currenciesToTrack.forEach(currencyCodeLower => { const currencyCode = currencyCodeLower.toUpperCase(); if (latestRatesData[currencyCode] !== null) { const optionFrom = document.createElement('option'); optionFrom.value = currencyCode; optionFrom.textContent = currencyCode; fromCurrencySelectElement.appendChild(optionFrom); const optionTo = document.createElement('option'); optionTo.value = currencyCode; optionTo.textContent = currencyCode; toCurrencySelectElement.appendChild(optionTo); } }); fromCurrencySelectElement.value = 'USD'; toCurrencySelectElement.value = baseCurrency.toUpperCase(); console.log("Converter dropdowns populated."); }
function convertCurrency() { /* ... as before ... */ if (!amountInputElement || !fromCurrencySelectElement || !toCurrencySelectElement || !conversionResultElement) { console.error("Converter elements not found."); return; } const amount = parseFloat(amountInputElement.value); const fromCurrency = fromCurrencySelectElement.value; const toCurrency = toCurrencySelectElement.value; conversionResultElement.classList.remove('text-red-500'); if (isNaN(amount) || amount < 0) { conversionResultElement.textContent = amount < 0 ? 'Amount cannot be negative.' : 'Please enter a valid amount.'; if (amount < 0) conversionResultElement.classList.add('text-red-500'); return; } if (amount === 0) { conversionResultElement.textContent = `0 ${fromCurrency} = 0 ${toCurrency}`; return; } if (!latestRatesData) { conversionResultElement.textContent = 'Waiting for rates...'; return; } let result = 0; const baseCurrUpper = baseCurrency.toUpperCase(); try { if (fromCurrency === toCurrency) { result = amount; } else if (fromCurrency === baseCurrUpper) { const toRate = latestRatesData[toCurrency]; if (toRate === null || toRate === 0) throw new Error(`Rate for ${toCurrency} unavailable.`); result = amount / toRate; } else if (toCurrency === baseCurrUpper) { const fromRate = latestRatesData[fromCurrency]; if (fromRate === null) throw new Error(`Rate for ${fromCurrency} unavailable.`); result = amount * fromRate; } else { const fromRate = latestRatesData[fromCurrency]; const toRate = latestRatesData[toCurrency]; if (fromRate === null) throw new Error(`Rate for ${fromCurrency} unavailable.`); if (toRate === null || toRate === 0) throw new Error(`Rate for ${toCurrency} unavailable.`); result = (amount * fromRate) / toRate; } let dp = 2; if (Math.abs(result) > 0) { const magnitude = Math.floor(Math.log10(Math.abs(result))); if (magnitude < -2) dp = 6; else if (magnitude < 0 && result !== 0) dp = 4; } const formattedAmount = amount.toLocaleString(undefined, { maximumFractionDigits: 2 }); const formattedResult = result.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }); conversionResultElement.textContent = `${formattedAmount} ${fromCurrency} = ${formattedResult} ${toCurrency}`; } catch (error) { console.error("Conversion error:", error); conversionResultElement.textContent = `Error: ${error.message}`; conversionResultElement.classList.add('text-red-500'); } }
function swapCurrencies() { /* ... as before ... */ if (!fromCurrencySelectElement || !toCurrencySelectElement) return; const fromValue = fromCurrencySelectElement.value; const toValue = toCurrencySelectElement.value; fromCurrencySelectElement.value = toValue; toCurrencySelectElement.value = fromValue; convertCurrency(); }


// --- Data Downloader Functions ---

/**
 * Populates the currency dropdowns in the downloader section.
 * Uses the globally fetched 'allCurrencies' list if available,
 * otherwise falls back to tracked currencies + base.
 */
function populateDownloadSelects() {
    const selects = [downloadCurrencySelectElement, downloadBaseCurrencySelectElement];
    const availableCurrencies = allCurrencies || [baseCurrency.toUpperCase(), ...currenciesToTrack.map(c => c.toUpperCase())].sort();

    selects.forEach(select => {
        if (!select) return;
        select.innerHTML = ''; // Clear previous options
        availableCurrencies.forEach(currencyCode => {
            const option = document.createElement('option');
            option.value = currencyCode;
            option.textContent = currencyCode;
            select.appendChild(option);
        });
    });

    // Set default selections
    if (downloadCurrencySelectElement) downloadCurrencySelectElement.value = 'USD';
    if (downloadBaseCurrencySelectElement) downloadBaseCurrencySelectElement.value = baseCurrency.toUpperCase();

    console.log("Downloader dropdowns populated.");
}

/**
 * Generates an array of date strings (YYYY-MM-DD) between start and end dates.
 */
function getDatesInRange(startDateStr, endDateStr) {
    const dates = [];
    const start = new Date(startDateStr + 'T00:00:00Z'); // Use UTC to avoid timezone issues
    const end = new Date(endDateStr + 'T00:00:00Z');
    let current = new Date(start);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * Handles the download button click event.
 */
async function handleDownloadClick() {
    // 1. Validate Inputs
    const startDate = startDateInputElement.value;
    const endDate = endDateInputElement.value;
    const currency = downloadCurrencySelectElement.value;
    const base = downloadBaseCurrencySelectElement.value;
    const today = getTodayDateString();

    setStatusMessage(downloadStatusElement, ''); // Clear previous status

    if (!startDate || !endDate || !currency || !base) {
        setStatusMessage(downloadStatusElement, 'Please fill in all fields.', true);
        return;
    }
    if (startDate < MIN_DOWNLOAD_DATE) {
         setStatusMessage(downloadStatusElement, `Start date cannot be earlier than ${MIN_DOWNLOAD_DATE}.`, true);
         return;
    }
    if (endDate > today) {
         setStatusMessage(downloadStatusElement, `End date cannot be in the future.`, true);
         return;
    }
     if (startDate > endDate) {
        setStatusMessage(downloadStatusElement, 'Start date cannot be after end date.', true);
        return;
    }
     if (currency === base) {
         setStatusMessage(downloadStatusElement, 'Currency and Base Currency cannot be the same.', true);
         return;
     }


    // 2. Prepare for Fetching
    setStatusMessage(downloadStatusElement, 'Fetching data...');
    downloadButtonElement.disabled = true;
    const datesToFetch = getDatesInRange(startDate, endDate);
    const currencyLower = currency.toLowerCase();
    const baseLower = base.toLowerCase();
    const fetchedRates = [];

    // 3. Fetch Data Concurrently
    const fetchTasks = datesToFetch.map(date => {
        const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${currencyLower}.json`;
        return fetch(url)
            .then(response => {
                if (!response.ok) { throw new Error(`HTTP ${response.status} on ${date}`); }
                return response.json();
            })
            .then(data => ({ date, data }))
            .catch(error => ({ date, error: error.message || 'Fetch failed' })); // Capture error per date
    });

    try {
        const results = await Promise.allSettled(fetchTasks);

        // 4. Process Results
        let fetchErrors = 0;
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const { date, data, error } = result.value; // Destructure potential error caught in .catch
                if (error) {
                    // Error during fetch/parse for this date
                    fetchedRates.push({ date, rate: null });
                    fetchErrors++;
                    // console.warn(`Failed fetching for ${date}: ${error}`);
                } else {
                    // Fetch successful, extract the specific base currency rate
                    const rate = data?.[currencyLower]?.[baseLower];
                    fetchedRates.push({ date, rate: (typeof rate === 'number' ? rate : null) });
                }
            } else {
                // Promise itself rejected (less likely with .catch inside map)
                fetchedRates.push({ date: 'Unknown', rate: null }); // Placeholder if date isn't available
                fetchErrors++;
                console.warn(`Promise rejected: ${result.reason}`);
            }
        });

        if(fetchedRates.length === 0) {
            throw new Error("No data could be retrieved for the selected range.");
        }

        // 5. Generate and Download CSV
        generateAndDownloadCSV(fetchedRates, currency, base, startDate, endDate);
        setStatusMessage(downloadStatusElement, `Download complete.${fetchErrors > 0 ? ` (${fetchErrors} days failed)` : ''}`);

    } catch (error) {
        console.error("Error during data download process:", error);
        setStatusMessage(downloadStatusElement, `Error: ${error.message || 'Could not download data.'}`, true);
    } finally {
        downloadButtonElement.disabled = false; // Re-enable button
    }
}

/**
 * Generates a CSV string and triggers a browser download.
 */
function generateAndDownloadCSV(data, currency, baseCurrency, startDate, endDate) {
    if (!data || data.length === 0) return;

    // Create CSV Header
    const header = `"Date","Rate (1 ${currency} = X ${baseCurrency})"\n`;

    // Create CSV Rows
    const rows = data.map(entry => {
        const date = entry.date;
        const rate = entry.rate !== null ? entry.rate.toString() : 'N/A';
        // Basic CSV escaping (just quotes around date for safety)
        return `"${date}",${rate}`;
    }).join('\n');

    const csvString = header + rows;

    // Create Blob and Trigger Download
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // Feature detection
        const url = URL.createObjectURL(blob);
        const filename = `historical_rates_${currency}_${baseCurrency}_${startDate}_to_${endDate}.csv`;
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up
    } else {
         setStatusMessage(downloadStatusElement, 'CSV download not supported by your browser.', true);
    }
}


// --- Main Execution ---
async function loadAllData() {
    console.log("Starting data load...");
    showElement(mainLoaderElement); hideElement(currencyGridElement); hideElement(mainErrorElement);
    hideElement(converterSeparatorElement); hideElement(converterSectionElement);
    hideElement(downloadSeparatorElement); hideElement(downloaderSectionElement); // Hide downloader initially

    try {
        // Fetch all necessary data concurrently
        const [ratesResult, historyResult, allCurrenciesResult] = await Promise.allSettled([
            fetchLatestRates(),
            fetchHistoricalRates(),
            fetchAllCurrenciesList() // Fetch the list of all currencies
        ]);

        // Process results
        if (ratesResult.status === 'fulfilled') { latestRatesData = ratesResult.value; }
        else { console.error("Failed rates:", ratesResult.reason); throw new Error(`Failed latest rates: ${ratesResult.reason?.message || 'Unknown'}`); }

        if (historyResult.status === 'fulfilled') { fullHistoricalData = historyResult.value; }
        else { console.error("Failed history:", historyResult.reason); fullHistoricalData = { dates: [], historicalData: {} }; }

        // allCurrencies list is fetched but stored globally, used in populateDownloadSelects

        hideElement(mainLoaderElement);

        // Display Grid and Converter
        displayCurrencyGrid();
        populateConverterSelects();
        convertCurrency();
        showBlockElement(converterSeparatorElement);
        showBlockElement(converterSectionElement);

        // Populate Downloader and Show
        populateDownloadSelects(); // Uses global 'allCurrencies' or fallback
        // Set date input constraints
        if(startDateInputElement) startDateInputElement.min = MIN_DOWNLOAD_DATE;
        if(endDateInputElement) endDateInputElement.max = getTodayDateString();

        showBlockElement(downloadSeparatorElement);
        showBlockElement(downloaderSectionElement);

        // Add event listeners *after* elements are populated and visible
        amountInputElement?.addEventListener('input', convertCurrency);
        fromCurrencySelectElement?.addEventListener('change', convertCurrency);
        toCurrencySelectElement?.addEventListener('change', convertCurrency);
        swapButtonElement?.addEventListener('click', swapCurrencies);
        downloadButtonElement?.addEventListener('click', handleDownloadClick); // Add listener for download


    } catch (error) {
        console.error("Error loading currency data:", error);
        hideElement(mainLoaderElement); hideElement(currencyGridElement);
        hideElement(converterSeparatorElement); hideElement(converterSectionElement);
        hideElement(downloadSeparatorElement); hideElement(downloaderSectionElement);
        setErrorMessage(mainErrorElement, `Error: ${error.message || 'Could not load currency data.'}`, true);
    } finally {
        console.log("Data load process finished.");
    }
}

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});
