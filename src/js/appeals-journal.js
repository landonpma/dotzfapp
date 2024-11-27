$(document).ready(function() {
	let offset = 0
	const limit = 20 // Количество строк для каждой загрузки
	let loading = false // Флаг для отслеживания состояния загрузки
	let lastQuery = '' // Последний поисковый запрос
	let isSearchMode = false // Флаг для режима поиска
	let totalSearchResults = 0 // Общее количество найденных записей для текущего поиска

	const tableContainer = $('#table-container')
	const table = $('#data-table').DataTable({
		paging: false,
		searching: false,
		info: false,
		order: [[0, 'desc']],
		language: {
			loadingRecords: 'Загрузка данных...',
			emptyTable: 'Нет данных для отображения.'
		}
	})

	function resetLoad() {
		offset = 0
		totalSearchResults = 0
		isSearchMode = false
		table.clear().draw() // Очистить таблицу
		$(window).off('scroll') // Убрать автоподгрузку
	}

	function loadMoreData() {
		if (loading || (isSearchMode && offset >= totalSearchResults)) return
		loading = true
		$('#loading-indicator').css('display', 'flex')

		const url = isSearchMode
			? `/search-appeals?query=${encodeURIComponent(lastQuery)}&column=${$('#column-select').val()}&offset=${offset}&limit=${limit}`
			: `/get-appeals-part?offset=${offset}&limit=${limit}`

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
							row.coordinates,
							row.topic,
							row.measures,
							row.status,
							row.source,
							row.employee
						]).draw(false)
					})

					offset += limit
					if (isSearchMode) totalSearchResults = result.total || result.data.length
				} else if (!isSearchMode) {
					toastr.info('Все данные загружены')
					$(window).off('scroll')
				}

				$('#loading-indicator').hide()
				loading = false
			})
			.catch(error => {
				console.error('Ошибка при загрузке данных:', error)
				toastr.error('Ошибка при загрузке данных')
				$('#loading-indicator').hide()
				loading = false
			})
	}

	$('#search-input').on('input', function() {
		const query = $(this).val().trim()
		const column = $('#column-select').val()

		if (query !== lastQuery) {
			lastQuery = query

			if (query.length > 0) {
				isSearchMode = true
				offset = 0
				table.clear().draw()
				loadInitialSearchData(query, column) // Загружаем первые 20 результатов
			} else {
				resetLoad()
				loadMoreData() // Переход к обычной загрузке данных
			}
		}
	})

	function loadInitialSearchData(query, column) {
		loading = true
		$('#loading-indicator').css('display', 'flex')

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
							row.coordinates,
							row.topic,
							row.measures,
							row.status,
							row.source,
							row.employee
						]).draw(false)
					})
					totalSearchResults = result.total || result.data.length
					offset += limit
					setupScrollHandler()
				} else {
					toastr.info('Нет данных по запросу')
				}

				$('#loading-indicator').hide()
				loading = false
			})
			.catch(error => {
				console.error('Ошибка при поиске:', error)
				toastr.error('Ошибка при поиске данных')
				$('#loading-indicator').hide()
				loading = false
			})
	}

	function setupScrollHandler() {
		tableContainer.off('scroll').on('scroll', function() {
			const scrollHeight = $(this)[0].scrollHeight
			const scrollTop = $(this).scrollTop()
			const containerHeight = $(this).outerHeight()

			if (!loading && scrollTop + containerHeight >= scrollHeight - 50) {
				loadMoreData()
			}
		})
	}

	setupScrollHandler()
	loadMoreData()

	$('#data-table').on('click', 'tr', function() {
		const rowData = table.row(this).data()
		if (rowData) {
			$('#modal-num').text(rowData[0])
			$('#modal-date').text(rowData[1])
			$('#modal-card-number').text(rowData[2])
			$('#modal-settlement').text(rowData[3])
			$('#modal-address').text(rowData[4])
			$('#modal-coordinates').text(rowData[5])
			$('#modal-topic').text(rowData[6])
			$('#modal-measures').text(rowData[7])
			$('#modal-status').text(rowData[8])
			$('#modal-source').text(rowData[9]) // Источник
			$('#modal-employee').text(rowData[10]) // Ответственный сотрудник
			$('#detailsModal').modal('show')
		}
	})

	function exportTableToExcel() {
		const tableElement = document.getElementById('data-table')
		const workbook = XLSX.utils.table_to_book(tableElement, { sheet: 'Журнал Обращений' })
		XLSX.writeFile(workbook, 'ЖурналОбращений.xlsx')
		toastr.success('Данные успешно экспортированы в Excel')
	}

	function importTableFromExcel() {
		const file = document.getElementById('import-file').files[0]
		if (!file) {
			toastr.warning('Выберите файл для импорта')
			return
		}

		const reader = new FileReader()
		reader.onload = function(event) {
			const workbook = XLSX.read(event.target.result, { type: 'binary' })
			const sheetName = workbook.SheetNames[0]
			const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 })

			if (data.length > 1 && data[0].length === 11) {
				table.clear()
				const processedData = []

				// Функция преобразования даты из Excel
				const excelDateToJSDate = (excelDate) => {
					const date = new Date(0) // Базовая дата в JavaScript
					date.setUTCDate(excelDate - 25567) // Excel хранит даты с 1900-01-01
					return date.toISOString().split('T')[0] // Форматируем в YYYY-MM-DD
				}

				data.slice(1).forEach(row => {
					if (row.every(cell => cell !== null && cell !== undefined && cell !== '')) {
						// Если дата в формате числа, преобразуем ее
						if (!isNaN(row[1]) && typeof row[1] === 'number') {
							row[1] = excelDateToJSDate(row[1])
						}

						table.row.add(row)
						processedData.push(row)
					}
				})

				table.draw()
				console.log('Отправляемые данные на сервер:', processedData)

				fetch('/save-table-data', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ data: processedData })
				})
					.then(response => response.json())
					.then(result => {
						if (result.success) {
							toastr.success('Данные успешно импортированы и сохранены')
						} else {
							toastr.error(`Ошибка сохранения данных: ${result.message}`)
						}
					})
					.catch(error => {
						console.error('Ошибка при отправке данных:', error)
					})
			} else {
				toastr.error('Неверный формат файла. Ожидается 11 колонок.')
			}
		}
		reader.readAsBinaryString(file)
	}


	function downloadTemplate() {
		const link = document.createElement('a')
		link.href = '/path/to/your/template.xlsx'
		link.download = 'Шаблон_для_загрузки.xlsx'
		link.click()
		toastr.info('Шаблон скачан')
	}

	window.exportTableToExcel = exportTableToExcel
	window.importTableFromExcel = importTableFromExcel
	window.downloadTemplate = downloadTemplate


	$('#edit-button').on('click', function() {
		// Заполнить форму редактирования текущими данными
		const rowData = {
			num: $('#modal-num').text(),
			date: $('#modal-date').text(),
			card_number: $('#modal-card-number').text(),
			settlement: $('#modal-settlement').text(),
			address: $('#modal-address').text(),
			coordinates: $('#modal-coordinates').text(),
			topic: $('#modal-topic').text(),
			measures: $('#modal-measures').text(),
			status: $('#modal-status').text(),
			source: $('#modal-source').text(),
			employee: $('#modal-employee').text()
		}

		// Заполнить поля формы
		$('#edit-num').val(rowData.num)
		$('#edit-date').val(rowData.date)
		$('#edit-card-number').val(rowData.card_number)
		$('#edit-settlement').val(rowData.settlement)
		$('#edit-address').val(rowData.address)
		$('#edit-coordinates').val(rowData.coordinates)
		$('#edit-topic').val(rowData.topic)
		$('#edit-measures').val(rowData.measures)
		$('#edit-status').val(rowData.status)
		$('#edit-source').val(rowData.source)
		$('#edit-employee').val(rowData.employee)

		// Закрыть главное модальное окно
		$('#detailsModal').modal('hide')
		// Открыть модальное окно для редактирования
		$('#editModal').modal('show')
	})

	$('#save-edit-button').on('click', function() {
		const updatedData = {
			num: $('#edit-num').val(),
			date: $('#edit-date').val(),
			card_number: $('#edit-card-number').val(),
			settlement: $('#edit-settlement').val(),
			address: $('#edit-address').val(),
			coordinates: $('#edit-coordinates').val(),
			topic: $('#edit-topic').val(),
			measures: $('#edit-measures').val(),
			status: $('#edit-status').val(),
			source: $('#edit-source').val(),
			employee: $('#edit-employee').val()
		}

		// Проверка формата координат
		if (!isValidCoordinates(updatedData.coordinates)) {
			toastr.error('Ошибка: Некорректный формат координат. Используйте формат "latitude,longitude".')
			return
		}

		fetch('/update-appeal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updatedData)
		})
			.then(response => response.json())
			.then(result => {
				if (result.success) {
					toastr.success('Данные успешно обновлены')
					$('#editModal').modal('hide')

					// Обновляем таблицу с использованием маршрута /get-appeals-part
					table.clear().draw() // Очистить таблицу
					fetch('/get-appeals-part')
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
										row.coordinates,
										row.topic,
										row.measures,
										row.status,
										row.source,
										row.employee
									]).draw(false)
								})
							} else {
								toastr.info('Нет данных для отображения.')
							}
						})
						.catch(error => {
							console.error('Ошибка загрузки данных:', error)
							toastr.error('Ошибка загрузки данных.')
						})
				} else {
					toastr.error(`Ошибка обновления данных: ${result.message}`)
				}
			})
			.catch(error => {
				console.error('Ошибка при обновлении данных:', error)
				toastr.error('Ошибка при обновлении данных')
			})
	})


	// Кнопка "Добавить"
	$('#add-button').on('click', function() {
		// Очистить поля модального окна
		$('#add-num').val('')
		$('#add-date').val('')
		$('#add-card-number').val('')
		$('#add-settlement').val('')
		$('#add-address').val('')
		$('#add-coordinates').val('')
		$('#add-topic').val('')
		$('#add-measures').val('')
		$('#add-status').val('')
		$('#add-source').val('')
		$('#add-employee').val('')

		// Получить следующий номер обращения с сервера
		fetch('/get-next-appeal-number')
			.then(response => response.json())
			.then(result => {
				if (result.success) {
					$('#add-num').val(result.nextNum) // Установить следующий номер
					$('#addModal').modal('show') // Открыть модальное окно
				} else {
					toastr.error('Ошибка получения следующего номера обращения')
				}
			})
			.catch(error => {
				console.error('Ошибка получения следующего номера обращения:', error)
				toastr.error('Ошибка получения следующего номера обращения')
			})
	})

	// Сохранение нового обращения
	$('#save-add-button').on('click', function() {
		const newData = {
			num: $('#add-num').val(),
			date: $('#add-date').val(),
			card_number: $('#add-card-number').val(),
			settlement: $('#add-settlement').val(),
			address: $('#add-address').val(),
			coordinates: $('#add-coordinates').val(),
			topic: $('#add-topic').val(),
			measures: $('#add-measures').val(),
			status: $('#add-status').val(),
			source: $('#add-source').val(),
			employee: $('#add-employee').val()
		}

		// Проверяем формат координат
		if (!isValidCoordinates(newData.coordinates)) {
			toastr.error('Ошибка: Некорректный формат координат. Используйте формат "latitude,longitude".')
			return
		}

		fetch('/add-appeal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(newData)
		})
			.then(response => response.json())
			.then(result => {
				if (result.success) {
					toastr.success('Новое обращение успешно добавлено')
					$('#addModal').modal('hide')
					resetLoad()
					loadMoreData()
				} else {
					toastr.error(`Ошибка добавления: ${result.message}`)
				}
			})
			.catch(error => {
				console.error('Ошибка добавления обращения:', error)
				toastr.error('Ошибка добавления обращения')
			})
	})


	let appealToDelete = null // Переменная для хранения номера обращения

// Обработчик кнопки "Удалить" в модальном окне "Детальная информация"
	$('#delete-button').on('click', function() {
		appealToDelete = $('#modal-num').text() // Получить номер обращения из модального окна

		if (!appealToDelete) {
			toastr.error('Ошибка: Номер обращения отсутствует.')
			return
		}

		// Закрыть модальное окно "Детальная информация"
		$('#detailsModal').modal('hide')

		// Открыть модальное окно подтверждения
		$('#confirmDeleteModal').modal('show')
	})

	// Обработчик кнопки подтверждения удаления
	$('#confirmDeleteButton').on('click', function() {
		if (!appealToDelete) {
			toastr.error('Ошибка: Номер обращения отсутствует.')
			return
		}

		// Отправить запрос на удаление
		fetch('/delete-appeal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ num: appealToDelete })
		})
			.then(response => response.json())
			.then(result => {
				if (result.success) {
					toastr.success('Обращение успешно удалено.')
					$('#confirmDeleteModal').modal('hide') // Закрыть окно подтверждения
					resetLoad() // Сбросить таблицу
					loadMoreData() // Обновить таблицу
				} else {
					toastr.error(`Ошибка удаления: ${result.message}`)
				}
			})
			.catch(error => {
				console.error('Ошибка удаления обращения:', error)
				toastr.error('Ошибка удаления обращения.')
			})
			.finally(() => {
				appealToDelete = null // Сбросить переменную
			})
	})

})

function isValidCoordinates(coordinates) {
	const regex = /^[-+]?[0-9]*\.?[0-9]+,[-+]?[0-9]*\.?[0-9]+$/
	return regex.test(coordinates.trim())
}

let map, placemark, targetInput;

function initMap() {
	map = new ymaps.Map("map", {
		center: [55.39, 37.33],
		zoom: 9,
	});


	// Событие клика на карте
	map.events.add('click', function (e) {
		const coords = e.get('coords');

		// Если метка уже существует, обновить её координаты
		if (placemark) {
			placemark.geometry.setCoordinates(coords);
		} else {
			// Если метки нет, создать новую
			placemark = new ymaps.Placemark(coords, {}, { draggable: true });
			map.geoObjects.add(placemark);
		}

		// Обновить координаты в поле
		if (targetInput) {
			targetInput.value = coords.map(coord => coord.toFixed(6)).join(',');
		}
	});
}

function toggleMap(inputId) {
	const mapContainer = document.getElementById('map'); // Контейнер для карты
	targetInput = document.getElementById(inputId); // Поле для ввода координат

	// Показать или скрыть карту
	if (mapContainer.style.display === 'block') {
		mapContainer.style.display = 'none'; // Скрыть карту
	} else {
		mapContainer.style.display = 'block'; // Показать карту
		if (!map) {
			ymaps.ready(initMap); // Инициализировать карту, если она ещё не была создана
		}
	}
}
