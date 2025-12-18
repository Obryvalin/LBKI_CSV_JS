class LBKI_CSV {
    constructor() {
        this.rawData = [];         // исходные данные
        this.filteredData = [];    // после фильтрации/сортировки
        this.displayStart = 0;     // отображение от
        this.displayCount = 50;    // сколько показать
        this.currentSeparator = ',';
        this.columnNames = [];
        this.filters = [];         // массив фильтров: [{ column, type, op, value }, ...]

        this.setupEventListeners();
        this.setupDragAndDrop(); // <-- НОВОЕ
    }
       setupDragAndDrop() {
        const container = document.querySelector('.container'); // или document.body
        const tableContainer = document.getElementById('tableContainer');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
            tableContainer?.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, highlight, false);
            tableContainer?.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, unhighlight, false);
            tableContainer?.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            container.classList.add('drag-over');
        }

        function unhighlight(e) {
            container.classList.remove('drag-over');
        }

        container.addEventListener('drop', handleDrop, false);
        tableContainer?.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        }

        const handleFiles = (files) => {
            if (files.length === 0) return;

            const file = files[0];
            if (!file.name.toLowerCase().endsWith('.csv')) {
                alert('Пожалуйста, перетащите файл с расширением .csv');
                return;
            }

            // Имитируем выбор файла в input
            const fileInput = document.getElementById('csvFile');
            fileInput.files = files; // Присваиваем FileList

            // Загружаем файл
            this.loadCSV();
        };
    }

    setupEventListeners() {
        document.getElementById('loadBtn').addEventListener('click', () => this.loadCSV());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetToOriginal());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCSV());
        document.getElementById('dedupeBtn').addEventListener('click', () => this.dedupe());
        document.getElementById('pivotBtn').addEventListener('click', () => this.pivotByColumn());
        document.getElementById('showColsBtn').addEventListener('click', () => this.showOnlyColumns());
        document.getElementById('addFilterBtn').addEventListener('click', () => this.addFilter());
        document.getElementById('globalFilter').addEventListener('input', () => this.applyFilters());

        const tableContainer = document.getElementById('tableContainer');
        tableContainer.addEventListener('scroll', () => this.handleScroll(tableContainer));
    }

    async loadCSV() {
        const fileInput = document.getElementById('csvFile');
        const separatorSelect = document.getElementById('separator');
        this.currentSeparator = separatorSelect.value;

        if (!fileInput.files.length) return alert("Файл не выбран.");

        const file = fileInput.files[0];
        const text = await file.text();

        this.parseCSV(text);
        this.columnNames = this.rawData[0] || []; // Шапка — всегда первая строка
        this.filteredData = [...this.rawData]; // Начинаем с полных данных

        // Обновляем список столбцов в фильтрах
        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');

        this.filters = [];
        this.updateActiveFiltersDisplay();
        this.renderTable();
    }

    parseCSV(text) {
        const sep = this.currentSeparator === '\\t' ? '\t' : this.currentSeparator;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        this.rawData = lines.map(line => line.split(sep).map(field => field.trim()));
    }

    addFilter() {
        const col = document.getElementById('filterColumn').value;
        const type = document.getElementById('filterType').value;
        const op = document.getElementById('filterOp').value;
        const val = document.getElementById('filterValue').value.trim();

        if (!col || !val) return alert("Выберите столбец и введите значение.");

        this.filters.push({ column: col, type, op, value: val });
        this.updateActiveFiltersDisplay();
        this.applyFilters();

        // Очищаем форму
        document.getElementById('filterValue').value = '';
    }

    updateActiveFiltersDisplay() {
        const container = document.querySelector('.active-filters');
        container.innerHTML = '';

        this.filters.forEach((f, i) => {
            const elem = document.createElement('div');
            elem.className = 'filter-item';
            elem.textContent = `${f.column} ${f.op} "${f.value}" (${f.type})`;
            elem.innerHTML += `<span class="remove" data-index="${i}">×</span>`;
            container.appendChild(elem);
        });

        // Привязываем удаление
        document.querySelectorAll('.filter-item .remove').forEach(span => {
            span.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.filters.splice(index, 1);
                this.updateActiveFiltersDisplay();
                this.applyFilters();
            });
        });
    }

    applyFilters() {
        // Исключаем строку заголовков из фильтрации
        const dataWithoutHeader = this.rawData.slice(1);
        this.filteredData = dataWithoutHeader.filter(row => {
            for (const filter of this.filters) {
                const colIndex = this.columnNames.indexOf(filter.column);
                if (colIndex === -1) continue;

                const cellValue = row[colIndex];

                if (!this.checkCellValue(cellValue, filter)) {
                    return false;
                }
            }

            // Глобальный фильтр
            const globalFilterVal = document.getElementById('globalFilter').value.toLowerCase();
            if (globalFilterVal && !row.some(cell => cell.toLowerCase().includes(globalFilterVal))) {
                return false;
            }

            return true;
        });

        // Восстанавливаем заголовок в начало filteredData
        this.filteredData.unshift([...this.columnNames]);

        this.displayStart = 0;
        this.renderTable();
    }

    checkCellValue(value, filter) {
        const { type, op, value: val } = filter;

        if (type === 'string') {
            const lowerVal = value.toLowerCase();
            const lowerFilter = val.toLowerCase();
            switch (op) {
                case 'contains': return lowerVal.includes(lowerFilter);
                case 'equals': return lowerVal === lowerFilter;
            }
        } else if (type === 'number') {
            const numValue = parseFloat(value);
            const numFilter = parseFloat(val);
            if (isNaN(numValue) || isNaN(numFilter)) return false;
            switch (op) {
                case 'equals': return numValue === numFilter;
                case 'gt': return numValue > numFilter;
                case 'lt': return numValue < numFilter;
                case 'gte': return numValue >= numFilter;
                case 'lte': return numValue <= numFilter;
            }
        } else if (type === 'date') {
            const dateValue = new Date(value);
            const dateFilter = new Date(val);
            if (isNaN(dateValue.getTime()) || isNaN(dateFilter.getTime())) return false;
            switch (op) {
                case 'equals': return dateValue.getTime() === dateFilter.getTime();
                case 'gt': return dateValue > dateFilter;
                case 'lt': return dateValue < dateFilter;
                case 'gte': return dateValue >= dateFilter;
                case 'lte': return dateValue <= dateFilter;
            }
        }
        return false;
    }

    renderTable(startIndex = 0) {
        const container = document.getElementById('tableContainer');
        container.innerHTML = ''; // Полностью очищаем перед рендером

        if (this.columnNames.length === 0) return;

        const headers = this.columnNames;
        let rowsHTML = '<table><thead><tr>';

        headers.forEach((header, i) => {
            rowsHTML += `<th data-index="${i}">${header}</th>`;
        });

        rowsHTML += '</tr></thead><tbody id="tableBody">';

        // Начинаем от startIndex, но пропускаем строку заголовков (индекс 0)
        const adjustedStartIndex = startIndex === 0 ? 1 : startIndex; // Не отображаем заголовок снова
        const endIndex = Math.min(this.filteredData.length, adjustedStartIndex + this.displayCount);

        for (let i = adjustedStartIndex; i < endIndex; i++) {
            const row = this.filteredData[i];
            rowsHTML += '<tr>';
            row.forEach(cell => {
                rowsHTML += `<td>${cell}</td>`;
            });
            rowsHTML += '</tr>';
        }
        rowsHTML += '</tbody></table>';

        container.innerHTML = rowsHTML;
        this.bindHeaderClick();
    }

    bindHeaderClick() {
        document.querySelectorAll('th[data-index]').forEach(th => {
            th.onclick = () => this.sortByColumn(parseInt(th.dataset.index));
        });
    }

    handleScroll(container) {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
            this.displayStart += this.displayCount;
            this.appendRows();
        }
    }

    appendRows() {
        const tbody = document.getElementById('tableBody');
        // При дозагрузке также пропускаем строку заголовков
        const adjustedStartIndex = this.displayStart === 0 ? 1 : this.displayStart;
        const endIndex = Math.min(this.filteredData.length, adjustedStartIndex + this.displayCount);

        for (let i = adjustedStartIndex; i < endIndex; i++) {
            const tr = document.createElement('tr');
            this.filteredData[i].forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell;
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
    }

    sortByColumn(index) {
        // Сортируем только данные, начиная со второй строки (без шапки)
        const headerRow = this.filteredData[0];
        const dataRows = this.filteredData.slice(1);
        dataRows.sort((a, b) => a[index].localeCompare(b[index], undefined, { numeric: true }));

        this.filteredData = [headerRow, ...dataRows];
        this.displayStart = 0;
        this.renderTable(this.displayStart);
    }

    resetToOriginal() {
        this.filters = [];
        this.updateActiveFiltersDisplay();
        document.getElementById('globalFilter').value = '';

        // Восстанавливаем оригинальные данные (с заголовком)
        this.filteredData = [...this.rawData];
        this.columnNames = this.rawData[0] || [];

        // Обновляем список столбцов в фильтрах
        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');

        this.displayStart = 0;
        this.renderTable();
    }

    dedupe() {
        const headerRow = this.filteredData[0];
        const dataRows = this.filteredData.slice(1);

        const seen = new Set();
        const uniqueDataRows = dataRows.filter(row => {
            const rowStr = row.join('|');
            if (seen.has(rowStr)) return false;
            seen.add(rowStr);
            return true;
        });

        this.filteredData = [headerRow, ...uniqueDataRows];
        this.displayStart = 0;
        this.renderTable();
    }

    pivotByColumn() {
        const colName = document.getElementById('pivotCol').value;
        const colIndex = this.columnNames.indexOf(colName);
        if (colIndex === -1) return alert(`Столбец "${colName}" не найден.`);

        const headerRow = this.filteredData[0];
        const dataRows = this.filteredData.slice(1);

        const counts = {};
        dataRows.forEach(row => {
            const val = row[colIndex];
            counts[val] = (counts[val] || 0) + 1;
        });

        this.filteredData = [['value', 'count'], ...Object.entries(counts).map(([k, v]) => [k, String(v)])];
        this.columnNames = ['value', 'count'];
        this.displayStart = 0;
        this.renderTable();
    }

    showOnlyColumns() {
        const input = document.getElementById('columnList').value;
        const desiredCols = input.split(',').map(c => c.trim()).filter(Boolean);

        const headerRow = this.filteredData[0];
        const newHeader = [];
        const indices = [];

        for (let i = 0; i < desiredCols.length; i++) {
            const colName = desiredCols[i];
            const idx = headerRow.indexOf(colName);
            if (idx !== -1) {
                newHeader.push(colName);
                indices.push(idx);
            }
        }

        if (indices.length === 0) return alert("Ни один из указанных столбцов не найден.");

        this.columnNames = newHeader;

        const newData = this.filteredData.map(row => indices.map(i => row[i]));
        this.filteredData = newData;

        this.displayStart = 0;
        this.renderTable();
    }

    saveCSV() {
        if (this.filteredData.length === 0) return alert("Нет данных для сохранения.");
        const sep = this.currentSeparator;
        const csvText = this.filteredData.map(row => row.join(sep)).join('\n');
        const blob = new Blob([csvText], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lbki_result.csv';
        a.click();
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => new LBKI_CSV());