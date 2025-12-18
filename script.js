class LBKI_CSV {
    constructor() {
        this.rawData = [];         // исходные данные
        this.filteredData = [];    // после фильтрации/сортировки
        this.displayStart = 0;     // отображение от
        this.displayCount = 50;    // сколько показать
        this.currentSeparator = ',';
        this.columnNames = [];
        this.filters = [];         // массив фильтров: [{ column, type, op, value }, ...]
        this.fileName = null;

        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupModals();
    }

    setupEventListeners() {
        document.getElementById('loadBtn').addEventListener('click', () => this.loadCSV());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetToOriginal());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCSV());
        document.getElementById('dedupeBtn').addEventListener('click', () => this.dedupe());
        document.getElementById('splitBtnModal').addEventListener('click', () => this.openSplitModal()); // <-- НОВОЕ
        document.getElementById('showColsBtnModal').addEventListener('click', () => this.openShowColsModal());
        document.getElementById('pivotBtnModal').addEventListener('click', () => this.openPivotModal());
        document.getElementById('addFilterBtn').addEventListener('click', () => this.addFilter());

        const tableContainer = document.getElementById('tableContainer');
        tableContainer.addEventListener('scroll', () => this.handleScroll(tableContainer));
    }

    // --- НОВЫЕ МЕТОДЫ: работа с модалками ---
    setupModals() {
        this.showColsModal = document.getElementById('showColsModal');
        this.pivotModal = document.getElementById('pivotModal');
        this.splitModal = document.getElementById('splitModal'); // <-- НОВОЕ

        // Кнопка "Применить" для столбцов
        document.getElementById('applyColsBtn').addEventListener('click', () => {
            this.showOnlyColumnsFromModal();
            this.closeModal(this.showColsModal);
        });

        // Кнопка "Создать" для сводки
        document.getElementById('applyPivotBtn').addEventListener('click', () => {
            this.pivotByColumnFromModal();
            this.closeModal(this.pivotModal);
        });

        // <-- НОВОЕ: Кнопка "Разделить и скачать" -->
        document.getElementById('applySplitBtn').addEventListener('click', () => {
            this.splitFile();
            this.closeModal(this.splitModal);
        });
        // <-- КОНЕЦ НОВОГО -->

        // Кнопки закрытия (крестики)
        document.querySelectorAll('.modal .close').forEach(span => {
            span.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        // Закрытие по клику вне окна
        window.addEventListener('click', (e) => {
            if (e.target === this.showColsModal) this.closeModal(this.showColsModal);
            if (e.target === this.pivotModal) this.closeModal(this.pivotModal);
            if (e.target === this.splitModal) this.closeModal(this.splitModal); // <-- НОВОЕ
        });
    }

    openShowColsModal() {
        this.showColsModal.style.display = 'block';
    }

    openPivotModal() {
        this.pivotModal.style.display = 'block';
    }

    openSplitModal() { // <-- НОВОЕ
        this.splitModal.style.display = 'block';
    }

    closeModal(modal) {
        modal.style.display = 'none';
    }
    // --- КОНЕЦ НОВЫХ МЕТОДОВ ---

    updatePageTitle() {
        document.title = this.fileName ? `LBKI_CSV - ${this.fileName}` : 'LBKI_CSV';
    }

    toggleInterface(showPostLoad = true) {
        document.getElementById('preLoadSection').style.display = showPostLoad ? 'none' : 'flex';
        document.getElementById('postLoadSection').style.display = showPostLoad ? 'block' : 'none';
    }

    async loadCSV() {
        const fileInput = document.getElementById('csvFile');
        const separatorSelect = document.getElementById('separator');
        this.currentSeparator = separatorSelect.value;

        if (!fileInput.files.length) return alert("Файл не выбран.");

        const file = fileInput.files[0];
        this.fileName = file.name;
        this.updatePageTitle();

        const text = await file.text();

        this.parseCSV(text);
        this.columnNames = this.rawData[0] || [];
        this.filteredData = [...this.rawData];

        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');

        this.filters = [];
        this.updateActiveFiltersDisplay();
        this.toggleInterface(true);
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
            return true;
        });

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
        container.innerHTML = '';

        if (this.columnNames.length === 0) return;

        const headers = this.columnNames;
        let rowsHTML = '<table><thead><tr>';

        headers.forEach((header, i) => {
            rowsHTML += `<th data-index="${i}">${header}</th>`;
        });

        rowsHTML += '</tr></thead><tbody id="tableBody">';

        const adjustedStartIndex = startIndex === 0 ? 1 : startIndex;
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
        this.filteredData = [...this.rawData];
        this.columnNames = this.rawData[0] || [];

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

    pivotByColumnFromModal() {
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

    showOnlyColumnsFromModal() {
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
        a.download = this.fileName ? `processed_${this.fileName}` : 'lbki_result.csv';
        a.click();
    }

    // --- НОВЫЙ МЕТОД: разделение файла ---
    splitFile() {
        const rowCountInput = document.getElementById('splitRowCount').value;
        const templateInput = document.getElementById('splitFileNameTemplate').value;

        const rowCount = parseInt(rowCountInput);
        if (isNaN(rowCount) || rowCount < 1) {
            alert('Пожалуйста, введите корректное количество строк (> 0).');
            return;
        }

        const template = templateInput || 'part_{{index}}'; // шаблон по умолчанию

        // Получаем данные БЕЗ заголовка
        const headerRow = this.rawData[0];
        const dataRows = this.rawData.slice(1);

        // Делим на части
        const parts = [];
        for (let i = 0; i < dataRows.length; i += rowCount) {
            parts.push(dataRows.slice(i, i + rowCount));
        }

        // Создаём и скачиваем файлы
        parts.forEach((part, index) => {
            const fileName = template.replace('{{index}}', index + 1) + '.csv';
            const csvText = [headerRow, ...part].map(row => row.join(this.currentSeparator)).join('\n');
            const blob = new Blob([csvText], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url); // Очищаем память
        });

        alert(`Файл разделён на ${parts.length} частей.`);
    }
    // --- КОНЕЦ НОВОГО МЕТОДА ---

    // --- ИСПРАВЛЕННЫЙ МЕТОД: drag and drop ---
    setupDragAndDrop() {
        const container = document.querySelector('.container');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            container.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            container.addEventListener(eventName, unhighlight, false);
        });

        function highlight(e) {
            container.classList.add('drag-over');
        }

        function unhighlight(e) {
            container.classList.remove('drag-over');
        }

        // --- ИСПРАВЛЕНИЕ: handleDrop определена ДО использования ---
        const handleDrop = (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        };

        container.addEventListener('drop', handleDrop, false);

        const handleFiles = (files) => {
            if (files.length === 0) return;

            const file = files[0];
            if (!file.name.toLowerCase().endsWith('.csv')) {
                alert('Пожалуйста, перетащите файл с расширением .csv');
                return;
            }

            const fileInput = document.getElementById('csvFile');
            fileInput.files = files;

            this.loadCSV();
        };
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => new LBKI_CSV());