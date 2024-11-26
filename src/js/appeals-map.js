let myMap

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
            <h2>Список обрпщений:</h2>
        </div>
        <div class="scrollable-content">
            <ul>
                {% for geoObject in properties.geoObjects %}
                    <li class="balloon-item">
                        <strong>Заявление № {{ geoObject.properties.number }}</strong>
                        <p><strong>Дата:</strong> {{ geoObject.properties.date }}</p>
                        <p><strong>Тема:</strong> {{ geoObject.properties.topic }}</p>
                        <p><strong>Адрес:</strong> {{ geoObject.properties.address }}</p>
                        <p><strong>Статус:</strong> {{ geoObject.properties.status }}</p>
                        <p><strong>Ответственный:</strong> {{ geoObject.properties.employee }}</p>
                    </li>
                {% endfor %}
            </ul>
        </div>
    </div>`
	);

	const objectManager = new ymaps.ObjectManager({
		clusterize: true,
		gridSize: 64,
		clusterDisableClickZoom: true,
		clusterOpenBalloonOnClick: true,
		clusterBalloonContentLayout: customClusterBalloonLayout,
		clusterIconLayout: 'default#imageWithContent',
		clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
			`<div class="custom-cluster">{{ properties.geoObjects.length }}</div>`
		),
		clusterIconImageHref: '',
		clusterIconImageSize: [40, 40],
		clusterIconImageOffset: [-20, -20],

	})

	// Настройка маркеров
	objectManager.objects.options.set({
		hasBalloon: false,
		hasHint: false,
		zIndex: 1,
		iconLayout: 'default#imageWithContent',
		iconContentLayout: ymaps.templateLayoutFactory.createClass(
			`<div class="custom-point">{{ properties.number }}</div>`
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

	// Загрузка данных обращений
	fetch('/get-appeals')
		.then(response => response.json())
		.then(data => {
			if (data.success) {

				// Создаем массив объектов для добавления
				const features = data.appeals.map((appeal, index) => {
					const coordinates = parseCoordinates(appeal.coordinates);

					if (!coordinates) {
						console.warn(`Пропущен объект с некорректными координатами: ${appeal.id}`);
						return null; // Пропускаем объекты с некорректными координатами
					}

					return {
						type: 'Feature',
						id: appeal.id,
						geometry: { type: 'Point', coordinates },
						properties: {
							number: index + 1,
							date: appeal.date,
							topic: appeal.topic,
							address: appeal.address,
							status: appeal.status,
							employee: appeal.employee,
							balloonContent: createBalloonContent(appeal), // Формируем содержимое балуна
							hintContent: appeal.num // Текст для подсказки
						}
					};
				}).filter(Boolean); // Убираем объекты с некорректными координатами

				// Добавляем данные в ObjectManager
				objectManager.add({
					type: 'FeatureCollection',
					features: features
				});

				// Устанавливаем границы карты
				const bounds = objectManager.getBounds();
				if (bounds) {
					myMap.setBounds(bounds, { checkZoomRange: true });
				}
			} else {
				console.error('Ошибка загрузки данных:', data.message);
			}
		})
		.catch(error => console.error('Ошибка загрузки данных:', error));



	// Общая функция для изменения стиля на наведение
	function handleHover(eventType, entityType, entityId) {
		if (entityType === 'object') {
			if (eventType === 'mouseenter') {
				// Увеличиваем точку
				objectManager.objects.setObjectOptions(entityId, {
					iconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-point" style="transform: scale(1.2);">{{ properties.number }}</div>`
					)
				});
			} else if (eventType === 'mouseleave') {
				// Восстанавливаем стиль точки
				objectManager.objects.setObjectOptions(entityId, {
					iconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-point">{{ properties.number }}</div>`
					)
				});
			}
		} else if (entityType === 'cluster') {
			if (eventType === 'mouseenter') {
				// Увеличиваем кластер
				objectManager.clusters.setClusterOptions(entityId, {
					clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-cluster hover" style="transform: scale(1.2);">
                        {{ properties.geoObjects.length }}
                    </div>`
					)
				});
			} else if (eventType === 'mouseleave') {
				// Восстанавливаем стиль кластера
				objectManager.clusters.setClusterOptions(entityId, {
					clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
						`<div class="custom-cluster">
                        {{ properties.geoObjects.length }}
                    </div>`
					)
				});
			}
		}
	}

	// События для точек
	objectManager.objects.events.add(['mouseenter', 'mouseleave'], function (e) {
		const eventType = e.get('type'); // 'mouseenter' или 'mouseleave'
		const objectId = e.get('objectId');
		handleHover(eventType, 'object', objectId);
	});

	// События для кластеров
	objectManager.clusters.events.add(['mouseenter', 'mouseleave'], function (e) {
		const eventType = e.get('type'); // 'mouseenter' или 'mouseleave'
		const clusterId = e.get('objectId');
		handleHover(eventType, 'cluster', clusterId);
	});

	// Логика для отображения балуна
	objectManager.objects.events.add('mouseenter', function (e) {
		const objectId = e.get('objectId');
		const object = objectManager.objects.getById(objectId);

		if (object) {
			const customBalloon = document.getElementById('customBalloon');
			if (customBalloon) {
				customBalloon.style.display = 'block';
				customBalloon.innerHTML = object.properties.balloonContent;
				customBalloon.style.position = 'absolute';

				// Получение позиции мыши
				const pageX = e.get('pagePixels')[0];
				const pageY = e.get('pagePixels')[1];

				// Вычисление позиции с учетом границ экрана
				const balloonWidth = customBalloon.offsetWidth;
				const balloonHeight = customBalloon.offsetHeight;
				const screenWidth = window.innerWidth;
				const screenHeight = window.innerHeight;

				let left = pageX + 20; // Отступ вправо от мыши
				let top = pageY + 20; // Отступ вниз от мыши

				if (left + balloonWidth > screenWidth) {
					left = pageX - balloonWidth - 20; // Сместить влево
				}

				if (top + balloonHeight > screenHeight) {
					top = pageY - balloonHeight - 20; // Сместить вверх
				}

				customBalloon.style.left = `${left}px`;
				customBalloon.style.top = `${top}px`;
			}
		}
	});

	// Скрытие балуна при уходе мыши
	objectManager.objects.events.add('mouseleave', function () {
		const customBalloon = document.getElementById('customBalloon');
		if (customBalloon) customBalloon.style.display = 'none';
	});

	// Обновление позиции балуна при движении мыши
	myMap.events.add('mousemove', function (e) {
		const customBalloon = document.getElementById('customBalloon');
		if (customBalloon && customBalloon.style.display === 'block') {
			const pageX = e.get('pagePixels')[0];
			const pageY = e.get('pagePixels')[1];

			const balloonWidth = customBalloon.offsetWidth;
			const balloonHeight = customBalloon.offsetHeight;
			const screenWidth = window.innerWidth;
			const screenHeight = window.innerHeight;

			let left = pageX + 20;
			let top = pageY + 20;

			if (left + balloonWidth > screenWidth) {
				left = pageX - balloonWidth - 20;
			}

			if (top + balloonHeight > screenHeight) {
				top = pageY - balloonHeight - 20;
			}

			customBalloon.style.left = `${left}px`;
			customBalloon.style.top = `${top}px`;
		}
	});

})

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
