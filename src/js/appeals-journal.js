$(document).ready(function () {
    let offset = 0;
    const limit = 20; // Количество строк для каждой загрузки
    let loading = false; // Флаг для отслеживания состояния загрузки
    let lastQuery = ''; // Последний поисковый запрос
    let isSearchMode = false; // Флаг для режима поиска
    let totalSearchResults = 0; // Общее количество найденных записей для текущего поиска

    const table = $('#data-table').DataTable({
        paging: false,
        searching: false,
        info: false,
        order: [[0, 'desc']],
        language: {
            loadingRecords: 'Загрузка данных...',
            emptyTable: 'Нет данных для отображения'
        }
    });

    function resetLoad() {
        offset = 0;
        totalSearchResults = 0;
        isSearchMode = false;
        table.clear().draw(); // Очистить таблицу
        $(window).off('scroll'); // Убрать автоподгрузку
    }

    function loadMoreData() {
        if (loading || (isSearchMode && offset >= totalSearchResults)) return;
        loading = true;
        $('#loading-indicator').css('display', 'flex');

        const url = isSearchMode
            ? `/search-appeals?query=${encodeURIComponent(lastQuery)}&column=${$('#column-select').val()}&offset=${offset}&limit=${limit}`
            : `/get-appeals-part?offset=${offset}&limit=${limit}`;

        fetch(url)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data.length > 0) {
                    result.data.forEach(row => {
                        table.row.add([
                            row.num,
                            row.date,
                            row.card_number,
                            row.settlement,
                            row.address,
                            row.topic,
                            row.measures,
                            row.status
                        ]).draw(false);
                    });

                    offset += limit;
                    if (isSearchMode) totalSearchResults = result.total || result.data.length;
                } else if (!isSearchMode) {
                    toastr.info('Все данные загружены');
                    $(window).off('scroll');
                }

                $('#loading-indicator').hide();
                loading = false;
            })
            .catch(error => {
                console.error('Ошибка при загрузке данных:', error);
                toastr.error('Ошибка при загрузке данных');
                $('#loading-indicator').hide();
                loading = false;
            });
    }

    $('#search-input').on('input', function () {
        const query = $(this).val().trim();
        const column = $('#column-select').val();

        if (query !== lastQuery) {
            lastQuery = query;

            if (query.length > 0) {
                isSearchMode = true;
                offset = 0;
                table.clear().draw();
                loadInitialSearchData(query, column); // Загружаем первые 20 результатов
            } else {
                resetLoad();
                loadMoreData(); // Переход к обычной загрузке данных
            }
        }
    });

    function loadInitialSearchData(query, column) {
        loading = true;
        $('#loading-indicator').css('display', 'flex');

        fetch(`/search-appeals?query=${encodeURIComponent(query)}&column=${encodeURIComponent(column)}&offset=0&limit=${limit}`)
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data.length > 0) {
                    result.data.forEach(row => {
                        table.row.add([
                            row.num,
                            row.date,
                            row.card_number,
                            row.settlement,
                            row.address,
                            row.topic,
                            row.measures,
                            row.status
                        ]).draw(false);
                    });
                    totalSearchResults = result.total || result.data.length;
                    offset += limit;
                    setupScrollHandler();
                } else {
                    toastr.info('Нет данных по запросу');
                }

                $('#loading-indicator').hide();
                loading = false;
            })
            .catch(error => {
                console.error('Ошибка при поиске:', error);
                toastr.error('Ошибка при поиске данных');
                $('#loading-indicator').hide();
                loading = false;
            });
    }

    function setupScrollHandler() {
        $(window).off('scroll').on('scroll', function () {
            if (!loading && $(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
                loadMoreData();
            }
        });
    }

    setupScrollHandler();
    loadMoreData();

    $('#data-table').on('click', 'tr', function () {
        const rowData = table.row(this).data();
        if (rowData) {
            $('#modal-num').text(rowData[0]);
            $('#modal-date').text(rowData[1]);
            $('#modal-card-number').text(rowData[2]);
            $('#modal-settlement').text(rowData[3]);
            $('#modal-address').text(rowData[4]);
            $('#modal-topic').text(rowData[5]);
            $('#modal-measures').text(rowData[6]);
            $('#modal-status').text(rowData[7]);
            $('#detailsModal').modal('show');
        }
    });

    function exportTableToExcel() {
        const tableElement = document.getElementById('data-table');
        const workbook = XLSX.utils.table_to_book(tableElement, { sheet: "Журнал Обращений" });
        XLSX.writeFile(workbook, 'ЖурналОбращений.xlsx');
        toastr.success('Данные успешно экспортированы в Excel');
    }

    function importTableFromExcel() {
        const file = document.getElementById('import-file').files[0];
        if (!file) {
            toastr.warning('Выберите файл для импорта');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (event) {
            const workbook = XLSX.read(event.target.result, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

            if (data.length > 1 && data[0].length === 8) {
                table.clear();
                data.slice(1).forEach(row => {
                    if (row.length === 8) {
                        table.row.add(row);
                    }
                });
                table.draw();

                fetch('/save-table-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: data.slice(1) })
                })
                    .then(response => response.json())
                    .then(result => {
                        if (result.success) {
                            toastr.success('Данные успешно импортированы и сохранены');
                        } else {
                            toastr.error(`Ошибка сохранения данных: ${result.message}`);
                        }
                    });
            } else {
                toastr.error('Неверный формат файла. Ожидается 8 колонок.');
            }
        };
        reader.readAsBinaryString(file);
    }

    function downloadTemplate() {
        const link = document.createElement('a');
        link.href = '/path/to/your/template.xlsx';
        link.download = 'Шаблон_для_загрузки.xlsx';
        link.click();
        toastr.info('Шаблон скачан');
    }

    window.exportTableToExcel = exportTableToExcel;
    window.importTableFromExcel = importTableFromExcel;
    window.downloadTemplate = downloadTemplate;

    let tableOffset = $('#data-table').offset().top;
    let $header = $('#data-table thead');
    let $fixedHeader = $header.clone();

    $fixedHeader.addClass('fixed-header').hide();
    $('#data-table').after($('<table>').addClass('fixed-table container-fluid').append($fixedHeader));

    function matchColumnWidths() {
        $fixedHeader.find('th').each(function (index) {
            $(this).width($header.find('th').eq(index).width());
        });
    }

    matchColumnWidths();

    $(window).on('resize', matchColumnWidths);

    $(window).on('scroll', function () {
        let offset = $(this).scrollTop();

        if (offset >= tableOffset && $fixedHeader.is(':hidden')) {
            $fixedHeader.show();
        } else if (offset < tableOffset) {
            $fixedHeader.hide();
        }
    });
});
