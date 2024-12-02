let myMap
let objectManager

ymaps.ready().then(function() {
	myMap = new ymaps.Map('map', {
		center: [55.39, 37.33],
		zoom: 10,
		controls: []
	}, {
		suppressMapOpenBlock: true
	})

	ymaps.modules.require(['ext.mapStyleManager'], function(initMapStyleManager) {
		initMapStyleManager(myMap)
	})

	ymaps.modules.require(['ext.filterByDistricts'], function(filterByDistricts) {
		filterByDistricts([])
	})

	const customClusterBalloonLayout = ymaps.templateLayoutFactory.createClass(
		`<div class="custom-cluster-balloon">
        <div class="balloon-header">
            <h2>Список обращений:</h2>
        </div>
        <div class="scrollable-content">
            <ul>
                {% for geoObject in properties.geoObjects %}
                    <li class="balloon-item" data-num="{{ geoObject.properties.number }}">
                        <strong>Заявление № {{ geoObject.properties.number }}</strong>
                        <p><strong>Дата:</strong> {{ geoObject.properties.date }}</p>
                    </li>
                {% endfor %}
            </ul>
        </div>
    </div>`
	)

	objectManager = new ymaps.ObjectManager({
		clusterize: true,
		gridSize: 46,
		clusterDisableClickZoom: true,
		clusterOpenBalloonOnClick: true,
		clusterBalloonContentLayout: customClusterBalloonLayout,
		clusterIconLayout: 'default#imageWithContent',
		clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
			`<div class="custom-cluster">{{ properties.geoObjects.length }}</div>`
		),
		clusterIconImageHref: '',
		clusterIconImageSize: [40, 40],
		clusterIconImageOffset: [-20, -20]

	})

	// Настройка маркеров
	objectManager.objects.options.set({
		hasBalloon: false,
		hasHint: false,
		zIndex: 1,
		iconLayout: 'default#imageWithContent',
		iconContentLayout: ymaps.templateLayoutFactory.createClass(
			`<div class="custom-point" style="background-color: {{ properties.color }}">{{ properties.number }}</div>`
		),
		iconImageHref: '',
		iconImageSize: [0, 0],
		iconContentOffset: [-15, -15],
		iconShape: {
			type: 'Circle',
			coordinates: [0, 0],
			radius: 15
		}
	})

	// Добавляем ObjectManager на карту
	myMap.geoObjects.add(objectManager)

	// Сброс фильтра по дате
	document.getElementById('resetDateFilter').addEventListener('click', function() {
		// Очистка полей ввода даты
		document.getElementById('startDate').value = ''
		document.getElementById('endDate').value = ''

		loadAppeals()
	})

	loadAppeals()


	// Добавляем обработчик событий для клика на маркеры
	objectManager.objects.events.add('click', function(e) {
		const objectId = e.get('objectId')
		const object = objectManager.objects.getById(objectId)

		if (object) {
			// Заполняем данные модального окна
			document.getElementById('modal-num').textContent = object.properties.number || 'Не указано'
			document.getElementById('modal-date').textContent = object.properties.date || 'Не указано'
			document.getElementById('modal-card-number').textContent = object.properties.card_number || 'Не указано'
			document.getElementById('modal-settlement').textContent = object.properties.settlement || 'Не указано'
			document.getElementById('modal-address').textContent = object.properties.address || 'Не указано'
			document.getElementById('modal-coordinates').textContent = object.geometry.coordinates.join(', ') || 'Не указано'
			document.getElementById('modal-topic').textContent = object.properties.topic || 'Не указано'
			document.getElementById('modal-measures').textContent = object.properties.measures || 'Не указано'
			document.getElementById('modal-status').textContent = object.properties.status || 'Не указано'
			document.getElementById('modal-source').textContent = object.properties.source || 'Не указано'
			document.getElementById('modal-employee').textContent = object.properties.employee || 'Не указано'

			// Открываем модальное окно
			const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'))
			detailsModal.show()
		}
	})


	// Обработчик события открытия балуна кластера
	objectManager.clusters.events.add('balloonopen', function(e) {
		const clusterId = e.get('objectId') // Получаем ID кластера
		const cluster = objectManager.clusters.getById(clusterId) // Получаем данные кластера

		if (cluster) {
			// Устанавливаем обработчики для элементов <li> внутри балуна
			const listItems = document.querySelectorAll('.balloon-item')
			if (!listItems || listItems.length === 0) {
				return // Если объектов нет, выходим
			}

			listItems.forEach(item => {
				item.addEventListener('click', function() {
					const objectNum = item.getAttribute('data-num') // Получаем num объекта

					if (!objectNum) {
						return // Если num объекта не найден, выходим
					}

					// Ищем объект по num в кластере
					const object = cluster.properties.geoObjects.find(obj => obj.properties.number === parseInt(objectNum, 10))

					if (!object) {
						return // Если объект не найден, выходим
					}

					// Проверяем наличие модального окна
					const modalElement = document.getElementById('detailsModal')
					if (!modalElement) {
						return // Если модальное окно не найдено, выходим
					}

					// Заполняем данные модального окна
					document.getElementById('modal-num').textContent = object.properties.number || 'Не указано'
					document.getElementById('modal-date').textContent = object.properties.date || 'Не указано'
					document.getElementById('modal-card-number').textContent = object.properties.card_number || 'Не указано'
					document.getElementById('modal-settlement').textContent = object.properties.settlement || 'Не указано'
					document.getElementById('modal-address').textContent = object.properties.address || 'Не указано'
					document.getElementById('modal-coordinates').textContent = object.geometry.coordinates.join(', ') || 'Не указано'
					document.getElementById('modal-topic').textContent = object.properties.topic || 'Не указано'
					document.getElementById('modal-measures').textContent = object.properties.measures || 'Не указано'
					document.getElementById('modal-status').textContent = object.properties.status || 'Не указано'
					document.getElementById('modal-source').textContent = object.properties.source || 'Не указано'
					document.getElementById('modal-employee').textContent = object.properties.employee || 'Не указано'

					// Открываем модальное окно
					const detailsModal = new bootstrap.Modal(modalElement)
					detailsModal.show()
				})
			})
		}
	})


	// Общая функция для изменения стиля на наведение
	function handleHover(eventType, entityType, entityId) {
		if (entityType === 'object') {
			const object = objectManager.objects.getById(entityId)
			if (eventType === 'mouseenter') {
				// Увеличиваем точку, сохраняя её цвет
				objectManager.objects.setObjectOptions(entityId, {
					iconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-point" 
                          style="background-color: ${object.properties.color}; transform: scale(1.2);">
                        {{ properties.number }}
                     </div>`
					)
				})
			} else if (eventType === 'mouseleave') {
				// Восстанавливаем стиль точки
				objectManager.objects.setObjectOptions(entityId, {
					iconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-point" 
                          style="background-color: ${object.properties.color};">
                        {{ properties.number }}
                     </div>`
					)
				})
			}
		} else if (entityType === 'cluster') {
			const cluster = objectManager.clusters.getById(entityId)
			if (eventType === 'mouseenter') {
				// Увеличиваем кластер
				objectManager.clusters.setClusterOptions(entityId, {
					clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-cluster hover" style="transform: scale(1.2);">
                        {{ properties.geoObjects.length }}
                     </div>`
					)
				})
			} else if (eventType === 'mouseleave') {
				// Восстанавливаем стиль кластера
				objectManager.clusters.setClusterOptions(entityId, {
					clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-cluster">
                        {{ properties.geoObjects.length }}
                     </div>`
					)
				})
			}
		}
	}

// События для точек
	objectManager.objects.events.add(['mouseenter', 'mouseleave'], function(e) {
		const eventType = e.get('type') // 'mouseenter' или 'mouseleave'
		const objectId = e.get('objectId')
		handleHover(eventType, 'object', objectId)
	})

// События для кластеров
	objectManager.clusters.events.add(['mouseenter', 'mouseleave'], function(e) {
		const eventType = e.get('type') // 'mouseenter' или 'mouseleave'
		const clusterId = e.get('objectId')
		handleHover(eventType, 'cluster', clusterId)
	})

// Логика для отображения балуна
	objectManager.objects.events.add('mouseenter', function(e) {
		const objectId = e.get('objectId')
		const object = objectManager.objects.getById(objectId)

		if (object) {
			const customBalloon = document.getElementById('customBalloon')
			if (customBalloon) {
				customBalloon.style.display = 'block'
				customBalloon.innerHTML = object.properties.balloonContent
				customBalloon.style.position = 'absolute'

				// Получение позиции мыши
				const pageX = e.get('pagePixels')[0]
				const pageY = e.get('pagePixels')[1]

				// Вычисление позиции с учетом границ экрана
				const balloonWidth = customBalloon.offsetWidth
				const balloonHeight = customBalloon.offsetHeight
				const screenWidth = window.innerWidth
				const screenHeight = window.innerHeight

				let left = pageX + 20 // Отступ вправо от мыши
				let top = pageY + 20 // Отступ вниз от мыши

				if (left + balloonWidth > screenWidth) {
					left = pageX - balloonWidth - 20 // Сместить влево
				}

				if (top + balloonHeight > screenHeight) {
					top = pageY - balloonHeight - 20 // Сместить вверх
				}

				customBalloon.style.left = `${left}px`
				customBalloon.style.top = `${top}px`
			}
		}
	})

	// Скрытие балуна при уходе мыши
	objectManager.objects.events.add('mouseleave', function() {
		const customBalloon = document.getElementById('customBalloon')
		if (customBalloon) customBalloon.style.display = 'none'
	})

	// Обновление позиции балуна при движении мыши
	myMap.events.add('mousemove', function(e) {
		const customBalloon = document.getElementById('customBalloon')
		if (customBalloon && customBalloon.style.display === 'block') {
			const pageX = e.get('pagePixels')[0]
			const pageY = e.get('pagePixels')[1]

			const balloonWidth = customBalloon.offsetWidth
			const balloonHeight = customBalloon.offsetHeight
			const screenWidth = window.innerWidth
			const screenHeight = window.innerHeight

			let left = pageX + 20
			let top = pageY + 20

			if (left + balloonWidth > screenWidth) {
				left = pageX - balloonWidth - 20
			}

			if (top + balloonHeight > screenHeight) {
				top = pageY - balloonHeight - 20
			}

			customBalloon.style.left = `${left}px`
			customBalloon.style.top = `${top}px`
		}
	})
})

function loadAppeals(url = '/get-appeals') {
	fetch(url)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP Error: ${response.status}`)
			}
			return response.json()
		})
		.then(data => {
			console.log('Ответ от сервера:', data) // Для отладки

			if (!data.success) {
				throw new Error(data.message || 'Неизвестная ошибка')
			}

			if (!data.appeals || !Array.isArray(data.appeals)) {
				throw new Error('Неверный формат данных: отсутствует массив appeals')
			}

			const features = data.appeals.map((appeal) => {
				const coordinates = parseCoordinates(appeal.coordinates)

				if (!coordinates) {
					console.warn(`Пропущен объект с некорректными координатами: ${appeal.id}`)
					return null
				}

				return {
					type: 'Feature',
					id: appeal.id,
					geometry: { type: 'Point', coordinates },
					properties: {
						number: appeal.num,
						date: appeal.date,
						card_number: appeal.card_number,
						settlement: appeal.settlement,
						address: appeal.address,
						coordinates: appeal.coordinates,
						topic: appeal.topic,
						measures: appeal.measures,
						status: appeal.status,
						source: appeal.source,
						employee: appeal.employee,
						color: getColorByStatus(appeal.status),
						balloonContent: createBalloonContent(appeal),
						hintContent: appeal.num
					}
				}
			}).filter(Boolean)

			objectManager.removeAll()

			objectManager.add({
				type: 'FeatureCollection',
				features: features
			})

			const bounds = objectManager.getBounds()
			if (bounds) {
				myMap.setBounds(bounds, { checkZoomRange: true })
			}
		})
		.catch(error => console.error('Ошибка загрузки данных:', error))
}


// Парсер координат
function parseCoordinates(coordString) {
	try {
		if (/^[-\d.]+,[-\d.]+$/.test(coordString)) {
			return coordString.split(',').map(Number)
		} else if (/^\[.*\]$/.test(coordString)) {
			return JSON.parse(coordString)
		}
	} catch {
		console.error('Некорректные координаты:', coordString)
	}
	return null
}

// Функция для определения цвета на основе статуса
function getColorByStatus(status) {
	switch (status) {
		case 'Опубликован':
			return '#84c042'
		case 'Перенаправлен Арбитру':
			return '#ce31ff'
		case 'Отработано':
			return '#e4cf00'
		default:
			return '#0078ff'
	}
}

// Функция создания содержимого балуна
function createBalloonContent(appeal) {
	let content = ''
	if (appeal.date) content += `<strong>Дата:</strong> ${appeal.date}<br>`
	if (appeal.card_number) content += `<strong>Номер обращения:</strong> ${appeal.card_number}<br>`
	if (appeal.topic) content += `<strong>Тема:</strong> ${appeal.topic}<br>`
	if (appeal.address) content += `<strong>Адрес:</strong> ${appeal.address}<br>`
	if (appeal.status) content += `<strong>Статус:</strong> ${appeal.status}<br>`
	if (appeal.source) content += `<strong>Источник:</strong> ${appeal.source}<br>`
	if (appeal.employee) content += `<strong>Ответственный:</strong> ${appeal.employee}<br>`
	return content
}

// Открытие модального окна редактирования
document.getElementById('edit-button').addEventListener('click', function() {
	const detailsModal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'))
	if (detailsModal) {
		detailsModal.hide() // Закрываем окно с деталями
	}

	const modalNum = document.getElementById('modal-num').textContent

	// Заполняем поля редактирования из данных текущего обращения
	document.getElementById('edit-num').value = modalNum
	document.getElementById('edit-date').value = document.getElementById('modal-date').textContent || ''
	document.getElementById('edit-card-number').value = document.getElementById('modal-card-number').textContent || ''
	document.getElementById('edit-settlement').value = document.getElementById('modal-settlement').textContent || ''
	document.getElementById('edit-address').value = document.getElementById('modal-address').textContent || ''
	document.getElementById('edit-coordinates').value = document.getElementById('modal-coordinates').textContent || ''
	document.getElementById('edit-topic').value = document.getElementById('modal-topic').textContent || ''
	document.getElementById('edit-measures').value = document.getElementById('modal-measures').textContent || ''
	document.getElementById('edit-status').value = document.getElementById('modal-status').textContent || ''
	document.getElementById('edit-source').value = document.getElementById('modal-source').textContent || ''
	document.getElementById('edit-employee').value = document.getElementById('modal-employee').textContent || ''

	// Открываем модальное окно редактирования
	const editModal = new bootstrap.Modal(document.getElementById('editModal'))
	editModal.show()
})

// Открытие модального окна подтверждения удаления
document.getElementById('delete-button').addEventListener('click', function() {
	const detailsModal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'))
	if (detailsModal) {
		detailsModal.hide() // Закрываем окно с деталями
	}

	// Открываем модальное окно подтверждения удаления
	const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'))
	confirmDeleteModal.show()

	// Добавляем обработчик для подтверждения удаления
	document.getElementById('confirmDeleteButton').onclick = function() {
		const modalNum = document.getElementById('modal-num').textContent

		fetch('/delete-appeal', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ num: modalNum })
		})
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					toastr.success('Обращение успешно удалено!')
					location.reload()
				} else {
					toastr.error('Ошибка при удалении обращения: ' + data.message)
				}
			})
			.catch(error => {
				console.error('Ошибка при удалении обращения:', error)
				toastr.error('Произошла ошибка при удалении.')
			})
	}
})

// Обработчик для сохранения изменений
document.getElementById('save-edit-button').addEventListener('click', function() {
	const editedData = {
		num: document.getElementById('edit-num').value,
		date: document.getElementById('edit-date').value,
		card_number: document.getElementById('edit-card-number').value,
		settlement: document.getElementById('edit-settlement').value,
		address: document.getElementById('edit-address').value,
		coordinates: document.getElementById('edit-coordinates').value,
		topic: document.getElementById('edit-topic').value,
		measures: document.getElementById('edit-measures').value,
		status: document.getElementById('edit-status').value,
		source: document.getElementById('edit-source').value,
		employee: document.getElementById('edit-employee').value
	}

	// Отправляем данные на сервер
	fetch('/update-appeal', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(editedData)
	})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				toastr.success('Изменения успешно сохранены!')
				location.reload()
			} else {
				toastr.error('Ошибка при сохранении изменений: ' + data.message)
			}
		})
		.catch(error => {
			console.error('Ошибка при обновлении данных:', error)
			toastr.error('Произошла ошибка при сохранении изменений.')
		})
})

function filterAppeals(startDate, endDate, status, districts) {
	const url = new URL('/filter-appeals', window.location.origin);

	// Добавляем параметры только если они указаны
	if (startDate) url.searchParams.append('startDate', startDate);
	if (endDate) url.searchParams.append('endDate', endDate);
	if (status) url.searchParams.append('status', status);
	if (districts && districts.length > 0) {
		url.searchParams.append('districts', districts.join(','));
	}

	console.log('URL для фильтрации:', url.toString()); // Лог для отладки

	// Вызываем функцию загрузки данных
	loadAppeals(url.toString());
}

document.getElementById('applyDateFilter').addEventListener('click', function() {
	// Получаем значения фильтров
	const startDate = document.getElementById('startDate').value;
	const endDate = document.getElementById('endDate').value;

	// Собираем выбранные районы
	const selectedDistricts = Array.from(
		document.querySelectorAll('#districtCheckboxes input[type="checkbox"]:checked')
	).map(checkbox => checkbox.value);

	const status = document.getElementById('statusFilter').value; // Значение фильтра по статусу

	// Проверяем, что хотя бы один фильтр активен
	if (!startDate && !endDate && !status && selectedDistricts.length === 0) {
		toastr.warning('Пожалуйста, выберите хотя бы один критерий фильтрации.');
		return;
	}

	console.log('Параметры фильтрации:', { startDate, endDate, status, selectedDistricts }); // Лог для отладки

	// Отправляем параметры на сервер
	filterAppeals(startDate, endDate, status, selectedDistricts);
});