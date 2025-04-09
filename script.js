// --- Configuration ---
const currenciesToTrack = [ 'usd', 'aed', 'jpy', 'vnd', 'cny', 'eur', 'gbp', 'cad', 'sar', 'chf', 'sgd', 'hkd', 'aud', 'krw' ];
const baseCurrency = 'inr';
const apiBaseUrl = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1';
const daysForHistoricalData = 30;
const MIN_DOWNLOAD_DATE = '2024-04-01';
const OVERLAY_CHART_MAX_CURRENCIES = 4; // Max currencies on overlay chart
const OVERLAY_CHART_DEFAULT_CURRENCIES = ['USD', 'EUR']; // Default selection

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
// Overlay Chart Elements
const overlaySeparatorElement = document.getElementById('overlay-separator');
const overlayChartSectionElement = document.getElementById('overlay-chart-section');
const overlayCheckboxContainerElement = document.getElementById('overlay-checkbox-container');
const overlayChartCanvasElement = document.getElementById('overlay-chart-canvas');
const overlayChartStatusElement = document.getElementById('overlay-chart-status');
const overlaySelectionLimitMsgElement = document.getElementById('overlay-selection-limit-msg');


// --- Global State ---
let fullHistoricalData = null;
let latestRatesData = null;
let allCurrencies = null;
let overlayChartInstance = null; // To hold the overlay chart instance

// --- Chart Colors ---
const currencyColors = { USD: '#005ea6', AED: '#ca8a04', JPY: '#dc2626', VND: '#16a34a', CNY: '#64748b', EUR: '#6d28d9', GBP: '#db2777', CAD: '#ea580c', SAR: '#006c35', CHF: '#d52b1e', SGD: '#003b6e', HKD: '#701a75', AUD: '#00008b', KRW: '#0d9488', DEFAULT: '#6b7280' };
function getCurrencyColor(currencyCode) { return currencyColors[currencyCode.toUpperCase()] || currencyColors.DEFAULT; }
// *** MODIFIED: Reduced alpha for lighter fill ***
function getLightCurrencyColor(currencyCode) {
    const hexColor = getCurrencyColor(currencyCode);
    let r=0,g=0,b=0;
    if (hexColor.length == 7){ r=parseInt(hexColor.substring(1,3),16); g=parseInt(hexColor.substring(3,5),16); b=parseInt(hexColor.substring(5,7),16); }
    else if (hexColor.length == 4){ r=parseInt(hexColor.substring(1,2)+hexColor.substring(1,2),16); g=parseInt(hexColor.substring(2,3)+hexColor.substring(2,3),16); b=parseInt(hexColor.substring(3,4)+hexColor.substring(3,4),16); }
    return `rgba(${r}, ${g}, ${b}, 0.1)`; // Use 10% opacity for fill
}

// --- Utility Functions ---
function showElement(element) { if (element) element.style.display = 'flex'; }
function showGridElement(element) { if (element) element.style.display = 'grid'; }
function showBlockElement(element) { if (element) element.style.display = 'block'; }
function hideElement(element) { if (element) element.style.display = 'none'; }
function setStatusMessage(element, message, isError = false) { if (element) { element.textContent = message; element.className = element.className.replace(/ text-(red|slate)-[0-9]+0/g, '') + ` ${isError ? 'text-red-600' : 'text-slate-600'}`; } }
function getTodayDateString() { return new Date().toISOString().split('T')[0]; }

// --- API Fetching Functions ---
async function fetchLatestRates() { /* ... as before ... */ console.log("Fetching latest rates..."); const rates = {}; try { const response = await fetch(`${apiBaseUrl}/currencies/${baseCurrency}.json?t=${new Date().getTime()}`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); if (!data[baseCurrency]) throw new Error(`Invalid API response structure`); currenciesToTrack.forEach(currency => { const rateFromBase = data[baseCurrency][currency]; rates[currency.toUpperCase()] = (rateFromBase !== undefined && rateFromBase !== 0) ? 1 / rateFromBase : null; }); console.log("Latest rates fetched:", rates); return rates; } catch (error) { console.error("Error fetching latest rates:", error); throw error; } }
async function fetchHistoricalRates() { /* ... as before ... */ console.log("Fetching historical rates for cards..."); const historicalData = {}; const dates = []; const today = new Date(); currenciesToTrack.forEach(currency => { historicalData[currency.toUpperCase()] = {}; }); for (let i = 0; i < daysForHistoricalData; i++) { const date = new Date(today); date.setDate(today.getDate() - i); const currentDate = new Date(); if (date > currentDate) continue; dates.push(date.toISOString().split('T')[0]); } dates.sort(); const fetchTasks = []; for (const date of dates) { for (const currency of currenciesToTrack) { const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${currency}.json`; fetchTasks.push({ url, date, currency }); } } if (fetchTasks.length === 0) return { dates: [], historicalData }; const results = await Promise.allSettled(fetchTasks.map(task => fetch(task.url).then(response => { if (!response.ok) { throw new Error(`HTTP ${response.status}`); } const ct = response.headers.get("content-type"); if (!ct || !ct.includes("application/json")) throw new Error(`Unexpected content type`); return response.json(); }).then(data => ({ ...task, data })).catch(error => { throw new Error(`Fetch Error for ${task.currency} on ${task.date}: ${error.message}`); }) )); results.forEach((result, index) => { const task = fetchTasks[index]; const currencyUpper = task.currency.toUpperCase(); if (!historicalData[currencyUpper]) historicalData[currencyUpper] = {}; if (result.status === 'fulfilled') { const rateToBase = result.value.data?.[task.currency]?.[baseCurrency]; historicalData[currencyUpper][task.date] = (rateToBase !== undefined && typeof rateToBase === 'number') ? rateToBase : null; } else { historicalData[currencyUpper][task.date] = null; } }); console.log(`Historical data processing for cards complete.`); return { dates, historicalData }; }
async function fetchAllCurrenciesList() { /* ... as before ... */ console.log("Fetching list of all currencies..."); try { const response = await fetch(`${apiBaseUrl}/currencies.json`); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); const data = await response.json(); allCurrencies = Object.keys(data).map(c => c.toUpperCase()).sort(); console.log(`Fetched ${allCurrencies.length} currency codes.`); return allCurrencies; } catch (error) { console.error("Error fetching all currencies list:", error); allCurrencies = [baseCurrency.toUpperCase(), ...currenciesToTrack.map(c => c.toUpperCase())].sort(); return allCurrencies; } }


// --- UI Update Functions ---
function displayCurrencyGrid() { /* ... as before ... */ if (!currencyGridElement) return; currencyGridElement.innerHTML = ''; if (!latestRatesData || !fullHistoricalData) { console.error("Missing data for grid."); setStatusMessage(mainErrorElement, "Could not load all required currency data.", true); return; } const { dates, historicalData } = fullHistoricalData; currenciesToTrack.forEach(currencyCodeLower => { const currencyCode = currencyCodeLower.toUpperCase(); const latestRate = latestRatesData[currencyCode]; const currencyHistorical = historicalData[currencyCode]; const card = document.createElement('div'); card.className = 'currency-card bg-white rounded-lg shadow border border-slate-200 p-4 flex flex-col min-h-[220px]'; const topSection = document.createElement('div'); topSection.className = 'flex-grow'; const currencyLabel = document.createElement('span'); currencyLabel.className = 'font-semibold text-lg text-slate-700'; currencyLabel.textContent = currencyCode; const rateDisplay = document.createElement('div'); rateDisplay.className = 'text-2xl font-light text-slate-900 mb-1 mt-1'; if (typeof latestRate === 'number') { let dp = 4; if (latestRate < 0.01) dp = 6; else if (latestRate < 1) dp = 5; rateDisplay.textContent = latestRate.toFixed(dp); const baseSpan = document.createElement('span'); baseSpan.className = 'text-sm font-medium text-slate-500 ml-1'; baseSpan.textContent = baseCurrency.toUpperCase(); rateDisplay.appendChild(baseSpan); } else { rateDisplay.textContent = 'N/A'; rateDisplay.classList.add('text-slate-400', 'text-xl'); } topSection.appendChild(currencyLabel); topSection.appendChild(rateDisplay); let changeIndicator = null; if (currencyHistorical && dates && dates.length >= 2) { const lastDate = dates[dates.length - 1]; const previousDate = dates[dates.length - 2]; const rateNow = currencyHistorical[lastDate]; const ratePrevious = currencyHistorical[previousDate]; if (typeof rateNow === 'number' && typeof ratePrevious === 'number') { if (ratePrevious !== 0) { const change = rateNow - ratePrevious; const percentChange = (change / ratePrevious) * 100; changeIndicator = document.createElement('div'); changeIndicator.className = 'text-xs font-medium mt-1'; let arrow = ''; let textColor = 'text-slate-500'; if (percentChange > 0.001) { arrow = '↑ '; textColor = 'text-green-600'; } else if (percentChange < -0.001) { arrow = '↓ '; textColor = 'text-red-600'; } changeIndicator.classList.add(textColor); changeIndicator.textContent = `${arrow}${Math.abs(percentChange).toFixed(2)}%`; } } } if (changeIndicator) { topSection.appendChild(changeIndicator); } const chartContainer = document.createElement('div'); chartContainer.className = 'mini-chart-container'; const canvas = document.createElement('canvas'); const canvasId = `chart-${currencyCode}`; canvas.id = canvasId; chartContainer.appendChild(canvas); card.appendChild(topSection); card.appendChild(chartContainer); currencyGridElement.appendChild(card); if (currencyHistorical && dates && dates.length > 0) { displayMiniChart(canvasId, currencyCode, dates, currencyHistorical); } else { chartContainer.innerHTML = `<div class="text-xs text-center text-slate-400 pt-4">Chart data unavailable</div>`; } }); showGridElement(currencyGridElement); }
function displayMiniChart(canvasId, currencyCode, dates, currencyHistoricalData) { /* ... as before ... */ const canvas = document.getElementById(canvasId); if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; const dataPoints = dates.map(date => currencyHistoricalData[date] ?? null); const hasValidData = dataPoints.some(point => point !== null); if (!hasValidData) { const container = canvas.parentElement; if(container) container.innerHTML = `<div class="text-xs text-center text-slate-400 pt-4">Chart data unavailable</div>`; return; } const color = getCurrencyColor(currencyCode); const lightColor = getLightCurrencyColor(currencyCode); try { new Chart(ctx, { type: 'line', data: { labels: dates, datasets: [{ label: currencyCode, data: dataPoints, borderColor: color, backgroundColor: lightColor, borderWidth: 1.5, fill: 'origin', tension: 0.3, spanGaps: true, pointRadius: 0, }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, title: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.7)', titleFont: { size: 10, family: 'system-ui, sans-serif' }, bodyFont: { size: 10, family: 'system-ui, sans-serif' }, padding: 6, boxPadding: 3, displayColors: false, callbacks: { title: function(tooltipItems) { return tooltipItems[0]?.label || ''; }, label: function(context) { let label = ''; const value = context.parsed.y; if (value !== null) { let dp; const val = Math.abs(value); if (val === 0) dp = 0; else if (val < 0.01) dp = 7; else if (val < 0.1) dp = 6; else if (val < 1) dp = 5; else dp = 4; label += value.toFixed(dp); label += ` ${baseCurrency.toUpperCase()}`; } else { label += 'N/A'; } return label; } } } }, scales: { x: { display: false }, y: { display: false } }, elements: { line: { borderCapStyle: 'round' } }, interaction: { mode: 'nearest', intersect: false, axis: 'x' } } }); } catch (chartError) { const container = canvas.parentElement; if(container) container.innerHTML = `<div class="text-xs text-center text-red-500 pt-4">Chart error</div>`; console.error(`Error creating mini chart for ${currencyCode}:`, chartError); } }

// --- Currency Converter Functions ---
function populateConverterSelects() { /* ... as before ... */ if (!fromCurrencySelectElement || !toCurrencySelectElement || !latestRatesData) { console.error("Converter selects or rates data not available for population."); return; } fromCurrencySelectElement.innerHTML = ''; toCurrencySelectElement.innerHTML = ''; const baseOptionFrom = document.createElement('option'); baseOptionFrom.value = baseCurrency.toUpperCase(); baseOptionFrom.textContent = baseCurrency.toUpperCase(); fromCurrencySelectElement.appendChild(baseOptionFrom); const baseOptionTo = document.createElement('option'); baseOptionTo.value = baseCurrency.toUpperCase(); baseOptionTo.textContent = baseCurrency.toUpperCase(); toCurrencySelectElement.appendChild(baseOptionTo); currenciesToTrack.forEach(currencyCodeLower => { const currencyCode = currencyCodeLower.toUpperCase(); if (latestRatesData[currencyCode] !== null) { const optionFrom = document.createElement('option'); optionFrom.value = currencyCode; optionFrom.textContent = currencyCode; fromCurrencySelectElement.appendChild(optionFrom); const optionTo = document.createElement('option'); optionTo.value = currencyCode; optionTo.textContent = currencyCode; toCurrencySelectElement.appendChild(optionTo); } }); fromCurrencySelectElement.value = 'USD'; toCurrencySelectElement.value = baseCurrency.toUpperCase(); console.log("Converter dropdowns populated."); }
function convertCurrency() { /* ... as before ... */ if (!amountInputElement || !fromCurrencySelectElement || !toCurrencySelectElement || !conversionResultElement) { console.error("Converter elements not found."); return; } const amount = parseFloat(amountInputElement.value); const fromCurrency = fromCurrencySelectElement.value; const toCurrency = toCurrencySelectElement.value; conversionResultElement.classList.remove('text-red-500'); if (isNaN(amount) || amount < 0) { conversionResultElement.textContent = amount < 0 ? 'Amount cannot be negative.' : 'Please enter a valid amount.'; if (amount < 0) conversionResultElement.classList.add('text-red-500'); return; } if (amount === 0) { conversionResultElement.textContent = `0 ${fromCurrency} = 0 ${toCurrency}`; return; } if (!latestRatesData) { conversionResultElement.textContent = 'Waiting for rates...'; return; } let result = 0; const baseCurrUpper = baseCurrency.toUpperCase(); try { if (fromCurrency === toCurrency) { result = amount; } else if (fromCurrency === baseCurrUpper) { const toRate = latestRatesData[toCurrency]; if (toRate === null || toRate === 0) throw new Error(`Rate for ${toCurrency} unavailable.`); result = amount / toRate; } else if (toCurrency === baseCurrUpper) { const fromRate = latestRatesData[fromCurrency]; if (fromRate === null) throw new Error(`Rate for ${fromCurrency} unavailable.`); result = amount * fromRate; } else { const fromRate = latestRatesData[fromCurrency]; const toRate = latestRatesData[toCurrency]; if (fromRate === null) throw new Error(`Rate for ${fromCurrency} unavailable.`); if (toRate === null || toRate === 0) throw new Error(`Rate for ${toCurrency} unavailable.`); result = (amount * fromRate) / toRate; } let dp = 2; if (Math.abs(result) > 0) { const magnitude = Math.floor(Math.log10(Math.abs(result))); if (magnitude < -2) dp = 6; else if (magnitude < 0 && result !== 0) dp = 4; } const formattedAmount = amount.toLocaleString(undefined, { maximumFractionDigits: 2 }); const formattedResult = result.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }); conversionResultElement.textContent = `${formattedAmount} ${fromCurrency} = ${formattedResult} ${toCurrency}`; } catch (error) { console.error("Conversion error:", error); conversionResultElement.textContent = `Error: ${error.message}`; conversionResultElement.classList.add('text-red-500'); } }
function swapCurrencies() { /* ... as before ... */ if (!fromCurrencySelectElement || !toCurrencySelectElement) return; const fromValue = fromCurrencySelectElement.value; const toValue = toCurrencySelectElement.value; fromCurrencySelectElement.value = toValue; toCurrencySelectElement.value = fromValue; convertCurrency(); }

// --- Data Downloader Functions ---
function populateDownloadSelects() { /* ... as before ... */ const selects = [downloadCurrencySelectElement, downloadBaseCurrencySelectElement]; const availableCurrencies = allCurrencies || [baseCurrency.toUpperCase(), ...currenciesToTrack.map(c => c.toUpperCase())].sort(); selects.forEach(select => { if (!select) return; select.innerHTML = ''; availableCurrencies.forEach(currencyCode => { const option = document.createElement('option'); option.value = currencyCode; option.textContent = currencyCode; select.appendChild(option); }); }); if (downloadCurrencySelectElement) downloadCurrencySelectElement.value = 'USD'; if (downloadBaseCurrencySelectElement) downloadBaseCurrencySelectElement.value = baseCurrency.toUpperCase(); console.log("Downloader dropdowns populated."); }
function getDatesInRange(startDateStr, endDateStr) { /* ... as before ... */ const dates = []; const start = new Date(startDateStr + 'T00:00:00Z'); const end = new Date(endDateStr + 'T00:00:00Z'); let current = new Date(start); while (current <= end) { dates.push(current.toISOString().split('T')[0]); current.setDate(current.getDate() + 1); } return dates; }
async function handleDownloadClick() { /* ... as before ... */ const startDate = startDateInputElement.value; const endDate = endDateInputElement.value; const currency = downloadCurrencySelectElement.value; const base = downloadBaseCurrencySelectElement.value; const today = getTodayDateString(); setStatusMessage(downloadStatusElement, ''); if (!startDate || !endDate || !currency || !base) { setStatusMessage(downloadStatusElement, 'Please fill in all fields.', true); return; } if (startDate < MIN_DOWNLOAD_DATE) { setStatusMessage(downloadStatusElement, `Start date cannot be earlier than ${MIN_DOWNLOAD_DATE}.`, true); return; } if (endDate > today) { setStatusMessage(downloadStatusElement, `End date cannot be in the future.`, true); return; } if (startDate > endDate) { setStatusMessage(downloadStatusElement, 'Start date cannot be after end date.', true); return; } if (currency === base) { setStatusMessage(downloadStatusElement, 'Currency and Base Currency cannot be the same.', true); return; } setStatusMessage(downloadStatusElement, 'Fetching data...'); downloadButtonElement.disabled = true; const datesToFetch = getDatesInRange(startDate, endDate); const currencyLower = currency.toLowerCase(); const baseLower = base.toLowerCase(); const fetchedRates = []; const fetchTasks = datesToFetch.map(date => { const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${currencyLower}.json`; return fetch(url).then(response => { if (!response.ok) { throw new Error(`HTTP ${response.status} on ${date}`); } return response.json(); }).then(data => ({ date, data })).catch(error => ({ date, error: error.message || 'Fetch failed' })); }); try { const results = await Promise.allSettled(fetchTasks); let fetchErrors = 0; results.forEach(result => { if (result.status === 'fulfilled') { const { date, data, error } = result.value; if (error) { fetchedRates.push({ date, rate: null }); fetchErrors++; } else { const rate = data?.[currencyLower]?.[baseLower]; fetchedRates.push({ date, rate: (typeof rate === 'number' ? rate : null) }); } } else { fetchedRates.push({ date: 'Unknown', rate: null }); fetchErrors++; console.warn(`Promise rejected: ${result.reason}`); } }); if(fetchedRates.length === 0) { throw new Error("No data could be retrieved for the selected range."); } generateAndDownloadCSV(fetchedRates, currency, base, startDate, endDate); setStatusMessage(downloadStatusElement, `Download complete.${fetchErrors > 0 ? ` (${fetchErrors} days failed)` : ''}`); } catch (error) { console.error("Error during data download process:", error); setStatusMessage(downloadStatusElement, `Error: ${error.message || 'Could not download data.'}`, true); } finally { downloadButtonElement.disabled = false; } }
function generateAndDownloadCSV(data, currency, baseCurrency, startDate, endDate) { /* ... as before ... */ if (!data || data.length === 0) return; const header = `"Date","Rate (1 ${currency} = X ${baseCurrency})"\n`; const rows = data.map(entry => { const date = entry.date; const rate = entry.rate !== null ? entry.rate.toString() : 'N/A'; return `"${date}",${rate}`; }).join('\n'); const csvString = header + rows; const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); const filename = `historical_rates_${currency}_${baseCurrency}_${startDate}_to_${endDate}.csv`; link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); } else { setStatusMessage(downloadStatusElement, 'CSV download not supported by your browser.', true); } }


// --- Overlay Chart Functions ---
function populateOverlayCheckboxes() { /* ... as before ... */ if (!overlayCheckboxContainerElement) return; overlayCheckboxContainerElement.innerHTML = ''; currenciesToTrack.forEach(currencyCodeLower => { const currencyCode = currencyCodeLower.toUpperCase(); const div = document.createElement('div'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = `overlay-${currencyCode}`; checkbox.value = currencyCode; checkbox.name = 'overlayCurrency'; if (OVERLAY_CHART_DEFAULT_CURRENCIES.includes(currencyCode)) { checkbox.checked = true; } const label = document.createElement('label'); label.htmlFor = `overlay-${currencyCode}`; label.textContent = currencyCode; checkbox.addEventListener('change', handleOverlaySelectionChange); div.appendChild(checkbox); div.appendChild(label); overlayCheckboxContainerElement.appendChild(div); }); console.log("Overlay chart checkboxes populated."); }
function handleOverlaySelectionChange(event) { /* ... as before ... */ const checkboxes = overlayCheckboxContainerElement.querySelectorAll('input[type="checkbox"]:checked'); const selectedCount = checkboxes.length; const selectedCurrencies = Array.from(checkboxes).map(cb => cb.value); if(overlaySelectionLimitMsgElement) overlaySelectionLimitMsgElement.textContent = ''; if (selectedCount > OVERLAY_CHART_MAX_CURRENCIES) { if (event && event.target) { event.target.checked = false; } if(overlaySelectionLimitMsgElement) { overlaySelectionLimitMsgElement.textContent = `Please select up to ${OVERLAY_CHART_MAX_CURRENCIES} currencies.`; } const updatedCheckboxes = overlayCheckboxContainerElement.querySelectorAll('input[type="checkbox"]:checked'); const updatedSelectedCurrencies = Array.from(updatedCheckboxes).map(cb => cb.value); updateOverlayChart(updatedSelectedCurrencies); return; } if (selectedCount >= 2) { updateOverlayChart(selectedCurrencies); setStatusMessage(overlayChartStatusElement, ''); } else { if (overlayChartInstance) { overlayChartInstance.destroy(); overlayChartInstance = null; } setStatusMessage(overlayChartStatusElement, 'Select at least 2 currencies to compare.'); } }

/**
 * Updates the overlay chart with the selected currencies.
 * *** MODIFIED: Adjusted chart options for aesthetics ***
 */
function updateOverlayChart(selectedCurrencies) {
    if (!overlayChartCanvasElement || !fullHistoricalData || !fullHistoricalData.dates) {
        setStatusMessage(overlayChartStatusElement, 'Chart cannot be displayed. Missing data.', true);
        return;
    }

    const ctx = overlayChartCanvasElement.getContext('2d');
    const { dates, historicalData } = fullHistoricalData;

    const datasets = selectedCurrencies.map(currencyCode => {
        const currencyHistorical = historicalData[currencyCode];
        const dataPoints = currencyHistorical ? dates.map(date => currencyHistorical[date] ?? null) : dates.map(() => null);

        return {
            label: currencyCode,
            data: dataPoints,
            borderColor: getCurrencyColor(currencyCode),
            // *** Use light color for subtle fill ***
            backgroundColor: getLightCurrencyColor(currencyCode),
             // *** Slightly thicker line ***
            borderWidth: 2,
             // *** Add subtle fill ***
            fill: 'origin',
             // *** Smoother curve ***
            tension: 0.3,
            spanGaps: true,
            pointRadius: 0, // No points on line
             // *** Slightly larger hover point ***
            pointHoverRadius: 5,
        };
    }).filter(ds => ds.data.some(p => p !== null));

    if (overlayChartInstance) {
        overlayChartInstance.destroy();
    }

    if (datasets.length === 0) {
         setStatusMessage(overlayChartStatusElement, 'No historical data available for selected currencies.', true);
         return;
    }

    try {
        overlayChartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels: dates, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, padding: 20 } }, // Added padding
                    title: { display: true, text: `Currency Comparison vs ${baseCurrency.toUpperCase()} (Last ${daysForHistoricalData} Days)`, font: { size: 16 }, padding: { bottom: 15 } },
                    tooltip: { // Keep previous tooltip settings
                        mode: 'index', intersect: false, backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: { size: 12 }, bodyFont: { size: 11 }, padding: 8,
                        callbacks: {
                            title: function(tooltipItems) { return tooltipItems[0]?.label || ''; },
                            label: function(context) {
                                let label = context.dataset.label || ''; const value = context.parsed.y;
                                if (label) { label += ': '; }
                                if (value !== null) { let dp; const val = Math.abs(value); if (val === 0) dp = 0; else if (val < 0.01) dp = 7; else if (val < 0.1) dp = 6; else if (val < 1) dp = 5; else dp = 4; label += value.toFixed(dp); }
                                else { label += 'N/A'; } return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { display: true, title: { display: false }, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 }, color: '#64748b' } }, // slate-500 ticks
                    y: { display: true, title: { display: true, text: `Value (${baseCurrency.toUpperCase()})`, font: { size: 11 } },
                         // *** Use very subtle grid lines ***
                         grid: { color: '#f1f5f9' }, // slate-100
                         ticks: { padding: 5, font: { size: 10 }, color: '#64748b', // slate-500 ticks
                             callback: function(value) { if (value === null || value === undefined) return 'N/A'; const val = Math.abs(value); if (val === 0) return '0'; if (val < 0.00001) return value.toExponential(1); if (val < 0.01) return value.toFixed(5); if (val < 1) return value.toFixed(4); return value.toFixed(2); }
                         }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                 elements: { line: { borderCapStyle: 'round' } } // Nicer line caps
            }
        });
         setStatusMessage(overlayChartStatusElement, '');
    } catch(error) {
        console.error("Error creating overlay chart:", error);
        setStatusMessage(overlayChartStatusElement, 'Failed to render comparison chart.', true);
    }
}


// --- Main Execution ---
async function loadAllData() { /* ... as before ... */ console.log("Starting data load..."); showElement(mainLoaderElement); hideElement(currencyGridElement); hideElement(mainErrorElement); hideElement(converterSeparatorElement); hideElement(converterSectionElement); hideElement(downloadSeparatorElement); hideElement(downloaderSectionElement); hideElement(overlaySeparatorElement); hideElement(overlayChartSectionElement); try { const [ratesResult, historyResult, allCurrenciesResult] = await Promise.allSettled([ fetchLatestRates(), fetchHistoricalRates(), fetchAllCurrenciesList() ]); if (ratesResult.status === 'fulfilled') { latestRatesData = ratesResult.value; } else { console.error("Failed rates:", ratesResult.reason); throw new Error(`Failed latest rates: ${ratesResult.reason?.message || 'Unknown'}`); } if (historyResult.status === 'fulfilled') { fullHistoricalData = historyResult.value; } else { console.error("Failed history:", historyResult.reason); fullHistoricalData = { dates: [], historicalData: {} }; } hideElement(mainLoaderElement); displayCurrencyGrid(); populateConverterSelects(); convertCurrency(); showBlockElement(converterSeparatorElement); showBlockElement(converterSectionElement); populateDownloadSelects(); if(startDateInputElement) startDateInputElement.min = MIN_DOWNLOAD_DATE; if(endDateInputElement) endDateInputElement.max = getTodayDateString(); showBlockElement(downloadSeparatorElement); showBlockElement(downloaderSectionElement); populateOverlayCheckboxes(); updateOverlayChart(OVERLAY_CHART_DEFAULT_CURRENCIES); showBlockElement(overlaySeparatorElement); showBlockElement(overlayChartSectionElement); amountInputElement?.addEventListener('input', convertCurrency); fromCurrencySelectElement?.addEventListener('change', convertCurrency); toCurrencySelectElement?.addEventListener('change', convertCurrency); swapButtonElement?.addEventListener('click', swapCurrencies); downloadButtonElement?.addEventListener('click', handleDownloadClick); } catch (error) { console.error("Error loading currency data:", error); hideElement(mainLoaderElement); hideElement(currencyGridElement); hideElement(converterSeparatorElement); hideElement(converterSectionElement); hideElement(downloadSeparatorElement); hideElement(downloaderSectionElement); hideElement(overlaySeparatorElement); hideElement(overlayChartSectionElement); setErrorMessage(mainErrorElement, `Error: ${error.message || 'Could not load currency data.'}`, true); } finally { console.log("Data load process finished."); } }

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => { loadAllData(); });
