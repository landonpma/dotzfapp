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
		filterByDistricts(myMap)
	})

	const objectManager = new ymaps.ObjectManager()

	$.getJSON('geojson/new_moscow2024.geojson')
		.done(function(geoJson) {
			// Устанавливаем стили для полигонов и линий
			geoJson.features.forEach(function(feature) {
				if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
					feature.options = {
						fillColor: '#00000000', // Прозрачный фон
						strokeColor: '#007BFF', // Черный контур
						strokeWidth: 0.5         // Тонкий контур
					}
				}
			})

			objectManager.add(geoJson)
			myMap.geoObjects.add(objectManager)

			// Отключаем события для ObjectManager и меняем курсор
			objectManager.objects.options.set({
				hasBalloon: false,  // Отключает всплывающие балуны
				hasHint: false,     // Отключает подсказки
				interactiveZIndex: false, // Предотвращает поднятие Z-индекса
				zIndex: 0,           // Устанавливает базовый Z-индекс
				cursor: 'default'    // Убирает курсор pointer
			})

			const bounds = objectManager.getBounds()
			if (bounds) {
				myMap.setBounds(bounds, { checkZoomRange: true })
			} else {
				console.warn('Bounds не определены. Проверьте корректность данных.')
			}
		})
		.fail(function(jqxhr, textStatus, error) {
			console.error('Ошибка загрузки GeoJSON:', textStatus, error)
		})


}).catch(console.error)