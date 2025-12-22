class LBKI_CSV {
    /**
     * Конструктор класса LBKI_CSV.
     * Инициализирует переменные, настраивает обработчики событий, drag&drop и модальные окна.
     */
    constructor() {
        this.rawData = [];         // исходные данные
        this.filteredData = [];    // после фильтрации/сортировки
        this.displayStart = 0;     // отображение от
        this.displayCount = 50;    // сколько показать
        this.currentSeparator = ',';
        this.columnNames = [];
        this.filters = [];         // массив фильтров: [{ column, type, op, value }, ...]
        this.fileName = null;

        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.dataInfoElement = document.getElementById('dataInfo');
        this.snackbar = document.getElementById('snackbar');
        this.headerSubtitle = document.getElementById('headerSubtitle');

        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupModals();
    }

    /**
     * Настраивает основные обработчики событий для кнопок и прокрутки таблицы.
     */
    setupEventListeners() {
        document.getElementById('loadBtn').addEventListener('click', () => this.loadCSV());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetToOriginal());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveCSV());
        document.getElementById('dedupeBtn').addEventListener('click', () => this.dedupe());
        document.getElementById('splitBtnModal').addEventListener('click', () => this.openSplitModal());
        document.getElementById('showColsBtnModal').addEventListener('click', () => this.openShowColsModal());
        document.getElementById('pivotBtnModal').addEventListener('click', () => this.openPivotModal());
        document.getElementById('filtersBtnModal').addEventListener('click', () => this.openFiltersModal()); // <-- НОВОЕ
        document.getElementById('addFilterBtn').addEventListener('click', () => this.addFilter());
        document.getElementById('csvFile').addEventListener('change', () => this.onFileSelected()); // <-- НОВОЕ

        const tableContainer = document.getElementById('tableContainer');
        tableContainer.addEventListener('scroll', () => this.handleScroll(tableContainer));
    }

    /**
     * Настраивает модальные окна и их обработчики.
     */
    setupModals() {
        this.showColsModal = document.getElementById('showColsModal');
        this.pivotModal = document.getElementById('pivotModal');
        this.splitModal = document.getElementById('splitModal');
        this.filtersModal = document.getElementById('filtersModal'); // <-- НОВОЕ

        this.columnListChipsContainer = document.getElementById('columnListChips');
        this.pivotColChipsContainer = document.getElementById('pivotColChips');

        document.getElementById('applyColsBtn').addEventListener('click', () => {
            this.showOnlyColumnsFromModal();
            this.closeModal(this.showColsModal);
        });

        document.getElementById('applyPivotBtn').addEventListener('click', () => {
            this.pivotByColumnFromModal();
            this.closeModal(this.pivotModal);
        });

        document.getElementById('applySplitBtn').addEventListener('click', () => {
            this.splitFile();
            this.closeModal(this.splitModal);
        });

    

        document.querySelectorAll('.modal .close').forEach(span => {
            span.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        window.addEventListener('click', (e) => {
            if (e.target === this.showColsModal) this.closeModal(this.showColsModal);
            if (e.target === this.pivotModal) this.closeModal(this.pivotModal);
            if (e.target === this.splitModal) this.closeModal(this.splitModal);
            if (e.target === this.filtersModal) this.closeModal(this.filtersModal); // <-- НОВОЕ
        });
    }

    /**
     * Открывает модальное окно для выбора столбцов.
     */
    openShowColsModal() {
        this.showColsModal.style.display = 'block';
    }

    /**
     * Открывает модальное окно для создания сводной таблицы.
     */
    openPivotModal() {
        this.pivotModal.style.display = 'block';
    }

    /**
     * Открывает модальное окно для разделения файла.
     */
    openSplitModal() {
        this.splitModal.style.display = 'block';
    }

    /**
     * Открывает модальное окно для фильтров.
     */
    openFiltersModal() {
        this.filtersModal.style.display = 'block';
    }

    /**
     * Закрывает указанное модальное окно.
     * @param {HTMLElement} modal - Элемент модального окна.
     */
    closeModal(modal) {
        modal.style.display = 'none';
    }

    /**
     * Обработчик события изменения файла.
     */
    onFileSelected() {
        // Можно добавить логику, например, сброс кодировки при смене файла
    }

    /**
     * Заполняет чипы для выбора столбцов в модальных окнах.
     */
    populateColumnSelects() {
        this.columnListChipsContainer.innerHTML = '';
        this.pivotColChipsContainer.innerHTML = '';

        this.columnNames.forEach(col => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = col;
            chip.dataset.column = col;
            chip.addEventListener('click', (e) => {
                e.target.classList.toggle('selected');
            });
            this.columnListChipsContainer.appendChild(chip);
        });

        this.columnNames.forEach(col => {
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.textContent = col;
            chip.dataset.column = col;
            chip.addEventListener('click', (e) => {
                this.pivotColChipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
                e.target.classList.add('selected');
            });
            this.pivotColChipsContainer.appendChild(chip);
        });
    }

    /**
     * Заполняет список столбцов в модальном окне фильтров.
     */
    populateFilterColumnSelect() {
        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');
    }

    /**
     * Обновляет заголовок страницы и подзаголовок в header.
     */
    updatePageTitle() {
        document.title = this.fileName ? `LBKI_CSV - ${this.fileName}` : 'LBKI_CSV';
        this.headerSubtitle.textContent = this.fileName ? this.fileName : 'Универсальный инструмент для работы с CSV-файлами';
    }

    /**
     * Переключает видимость интерфейса до/после загрузки файла.
     * @param {boolean} showPostLoad - Показать ли интерфейс после загрузки.
     */
    toggleInterface(showPostLoad = true) {
        document.getElementById('preLoadSection').style.display = showPostLoad ? 'none' : 'flex';
        document.getElementById('postLoadSection').style.display = showPostLoad ? 'flex' : 'none'; // <-- ИЗМЕНЕНО: block -> flex
        document.querySelector('.app-header').style.display = showPostLoad ? 'flex' : 'none';
    }

    /**
     * Загружает и парсит CSV-файл.
     */
    async loadCSV() {
        this.loadingIndicator.style.display = 'flex';

        const fileInput = document.getElementById('csvFile');
        const separatorSelect = document.getElementById('separator');
        this.currentSeparator = separatorSelect.value;

        if (!fileInput.files.length) {
            this.loadingIndicator.style.display = 'none';
            this.showSnackbar("Файл не выбран.");
            return;
        }

        const file = fileInput.files[0];
        this.fileName = file.name;
        this.updatePageTitle();

        const encoding = document.getElementById('encoding').value;

        let text;
        try {
            if (encoding.toLowerCase() === 'utf-8') {
                text = await file.text();
            } else {
                const buffer = await file.arrayBuffer();
                const decoder = new TextDecoder(encoding);
                text = decoder.decode(buffer);
            }
        } catch (e) {
            this.showSnackbar(`Ошибка чтения файла в кодировке ${encoding}.`);
            this.loadingIndicator.style.display = 'none';
            return;
        }

        this.parseCSV(text);
        this.columnNames = this.rawData[0] || [];
        this.filteredData = [...this.rawData];

        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');

        this.filters = [];
        this.updateActiveFiltersDisplay();
        this.populateColumnSelects();
        this.populateFilterColumnSelect(); // <-- НОВОЕ
        this.toggleInterface(true);
        this.renderTable();
        const rowsCount = this.filteredData.length > 0 ? this.filteredData.length - 1 : 0;
        this.updateDataInfo();
        this.showSnackbar(`Файл загружен. Столбцы: ${this.columnNames.length}, Строки: ${rowsCount}`);
        this.loadingIndicator.style.display = 'none';
    }

    /**
     * Парсит CSV-текст, учитывая кавычки и экранирование.
     * @param {string} text - Текст CSV-файла.
     */
    parseCSV(text) {
        const sep = this.currentSeparator === '\\t' ? '\t' : this.currentSeparator;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const parsedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const fields = [];
            let currentField = '';
            let inQuotes = false;
            let j = 0;

            while (j < line.length) {
                const char = line[j];

                if (char === '"') {
                    if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
                        currentField += '"';
                        j += 2;
                    } else {
                        inQuotes = !inQuotes;
                        j++;
                    }
                } else if (char === sep && !inQuotes) {
                    fields.push(currentField);
                    currentField = '';
                    j++;
                } else {
                    currentField += char;
                    j++;
                }
            }
            fields.push(currentField);

            parsedLines.push(fields);
        }

        this.rawData = parsedLines;
    }

    /**
     * Добавляет новый фильтр из UI.
     */
    addFilter() {
        const col = document.getElementById('filterColumn').value;
        const type = document.getElementById('filterType').value;
        const op = document.getElementById('filterOp').value;
        const val = document.getElementById('filterValue').value.trim();

        if (!col || !val) {
            this.showSnackbar("Выберите столбец и введите значение.");
            return;
        }

        this.filters.push({ column: col, type, op, value: val });
        this.updateActiveFiltersDisplay();
        this.applyFilters();

        document.getElementById('filterValue').value = '';
    }

    /**
     * Обновляет отображение активных фильтров.
     */
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

    /**
     * Применяет все активные фильтры к данным.
     */
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
        this.updateDataInfo();
    }

    /**
     * Проверяет значение ячейки по заданному фильтру.
     * @param {string} value - Значение ячейки.
     * @param {Object} filter - Объект фильтра { type, op, value }.
     * @returns {boolean} - Соответствует ли значение фильтру.
     */
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

    /**
     * Отрисовывает таблицу с текущими данными.
     * @param {number} startIndex - Индекс строки, с которой начать отрисовку.
     */
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

    /**
     * Привязывает обработчики сортировки к заголовкам таблицы.
     */
    bindHeaderClick() {
        document.querySelectorAll('th[data-index]').forEach(th => {
            th.onclick = () => this.sortByColumn(parseInt(th.dataset.index));
        });
    }

    /**
     * Обрабатывает событие прокрутки таблицы для динамической подгрузки.
     * @param {HTMLElement} container - Контейнер таблицы.
     */
    handleScroll(container) {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
            this.displayStart += this.displayCount;
            this.appendRows();
        }
    }

    /**
     * Добавляет следующие строки в таблицу при прокрутке.
     */
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

    /**
     * Сортирует данные по выбранному столбцу.
     * @param {number} index - Индекс столбца для сортировки.
     */
    sortByColumn(index) {
        this.loadingIndicator.style.display = 'flex';
        const headerRow = this.filteredData[0];
        const dataRows = this.filteredData.slice(1);
        dataRows.sort((a, b) => a[index].localeCompare(b[index], undefined, { numeric: true }));

        this.filteredData = [headerRow, ...dataRows];
        this.displayStart = 0;
        this.renderTable(this.displayStart);
        this.updateDataInfo();
        this.loadingIndicator.style.display = 'none';
    }

    /**
     * Возвращает данные к исходному файлу.
     */
    resetToOriginal() {
        this.filters = [];
        this.updateActiveFiltersDisplay();
        this.filteredData = [...this.rawData];
        this.columnNames = this.rawData[0] || [];

        const colSelector = document.getElementById('filterColumn');
        colSelector.innerHTML = this.columnNames.map(col => `<option value="${col}">${col}</option>`).join('');

        this.populateColumnSelects();
        this.populateFilterColumnSelect(); // <-- НОВОЕ
        this.displayStart = 0;
        this.renderTable();
        this.updateDataInfo();
        this.updatePageTitle();
    }

    /**
     * Удаляет дубликаты строк из данных.
     */
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
        this.updateDataInfo();
        const removedCount = this.rawData.length - this.filteredData.length;
        this.showSnackbar(`Удалено дубликатов: ${removedCount - 1}`);
    }

    /**
     * Создаёт сводную таблицу по выбранному столбцу из модального окна.
     */
    pivotByColumnFromModal() {
        const selectedChip = this.pivotColChipsContainer.querySelector('.chip.selected');
        if (!selectedChip) {
             this.showSnackbar("Пожалуйста, выберите столбец для группировки.");
             return;
        }
        const colName = selectedChip.dataset.column;

        const colIndex = this.columnNames.indexOf(colName);
        if (colIndex === -1) {
             this.showSnackbar(`Столбец "${colName}" не найден.`);
             return;
        }

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
        this.updateDataInfo();
    }

    /**
     * Отображает только выбранные столбцы из модального окна.
     */
    showOnlyColumnsFromModal() {
        const selectedChips = this.columnListChipsContainer.querySelectorAll('.chip.selected');
        if (selectedChips.length === 0) {
            this.showSnackbar("Пожалуйста, выберите хотя бы один столбец.");
            return;
        }
        const desiredCols = Array.from(selectedChips).map(chip => chip.dataset.column);

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

        if (indices.length === 0) {
             this.showSnackbar("Ни один из указанных столбцов не найден.");
             return;
        }

        this.columnNames = newHeader;

        const newData = this.filteredData.map(row => indices.map(i => row[i]));
        this.filteredData = newData;

        this.displayStart = 0;
        this.renderTable();
        this.updateDataInfo();
    }

    /**
     * Сохраняет текущие данные в CSV-файл.
     */
    saveCSV() {
        if (this.filteredData.length === 0) {
            this.showSnackbar("Нет данных для сохранения.");
            return;
        }
        const sep = this.currentSeparator;
        const csvText = this.filteredData.map(row => row.join(sep)).join('\n');
        const blob = new Blob([csvText], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName ? `processed_${this.fileName}` : 'lbki_result.csv';
        a.click();
    }

    /**
     * Разделяет файл на части и скачивает их.
     */
    splitFile() {
        const rowCountInput = document.getElementById('splitRowCount').value;
        const templateInput = document.getElementById('splitFileNameTemplate').value;

        const rowCount = parseInt(rowCountInput);
        if (isNaN(rowCount) || rowCount < 1) {
            this.showSnackbar('Пожалуйста, введите корректное количество строк (> 0).');
            return;
        }

        const template = templateInput || 'part_{{index}}';

        const headerRow = this.rawData[0];
        const dataRows = this.rawData.slice(1);

        const parts = [];
        for (let i = 0; i < dataRows.length; i += rowCount) {
            parts.push(dataRows.slice(i, i + rowCount));
        }

        parts.forEach((part, index) => {
            const fileName = template.replace('{{index}}', index + 1) + '.csv';
            const csvText = [headerRow, ...part].map(row => row.join(this.currentSeparator)).join('\n');
            const blob = new Blob([csvText], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
        });

        this.showSnackbar(`Файл разделён на ${parts.length} частей.`);
    }

    /**
     * Настраивает drag&drop для загрузки файлов.
     */
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
                this.showSnackbar('Пожалуйста, перетащите файл с расширением .csv');
                return;
            }

            const fileInput = document.getElementById('csvFile');
            fileInput.files = files;

            this.loadCSV();
        };
    }

    /**
     * Показывает snackbar с сообщением.
     * @param {string} message - Сообщение для отображения.
     * @param {number} duration - Время отображения в мс.
     */
    showSnackbar(message, duration = 3000) {
        this.snackbar.textContent = message;
        this.snackbar.classList.add('show');

        setTimeout(() => {
            this.snackbar.classList.remove('show');
        }, duration);
    }

    /**
     * Обновляет информацию о количестве столбцов и строк в UI.
     */
    updateDataInfo() {
        if (this.columnNames.length === 0 || this.filteredData.length === 0) {
            this.dataInfoElement.textContent = 'Столбцы: 0 | Строки: 0';
            return;
        }
        const cols = this.columnNames.length;
        const rows = this.filteredData.length > 0 ? this.filteredData.length - 1 : 0;
        this.dataInfoElement.textContent = `Столбцы: ${cols} | Строки: ${rows}`;
    }
}

document.addEventListener('DOMContentLoaded', () => new LBKI_CSV());