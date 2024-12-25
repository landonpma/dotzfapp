ymaps.modules.define('ext.filterByDistricts', [], function(provide) {
	'use strict'

	let districtLayer = null

	function filterByDistricts(selectedDistricts) {

		if (districtLayer) {
			myMap.geoObjects.remove(districtLayer)
		}

		$.getJSON('/geojson/new_moscow2024.geojson')
			.done(function(geoJson) {
				const filteredFeatures = geoJson.features.filter(feature =>
					selectedDistricts.includes(feature.properties.name)
				)

				districtLayer = new ymaps.ObjectManager({
					clusterize: false
				})

				filteredFeatures.forEach(feature => {
					feature.options = {
						strokeColor: '#007bff',
						strokeWidth: 2,
						fillOpacity: 0.1,
						fillColor: '#0000FF'
					}
					districtLayer.add(feature)
				})

				myMap.geoObjects.add(districtLayer)


			})
			.fail(() => console.error('Ошибка загрузки GeoJSON.'))
	}


	// Привязка к чекбоксам
	document.getElementById('toggleFilterMenu').addEventListener('click', function(event) {
		const filterContent = document.getElementById('filterContent')
		filterContent.style.display = filterContent.style.display === 'none' ? 'block' : 'none'

		// Остановить всплытие события, чтобы клик на кнопку не закрывал фильтр
		event.stopPropagation()
	})

	document.getElementById('districtCheckboxes').addEventListener('change', function() {
		const selectedDistricts = Array.from(document.querySelectorAll('#districtCheckboxes input:checked'))
			.map(checkbox => checkbox.value)
		filterByDistricts(selectedDistricts)
	})

	document.getElementById('resetCheckboxes').addEventListener('click', function() {
		document.querySelectorAll('#districtCheckboxes input[type="checkbox"]').forEach(checkbox => {
			checkbox.checked = false
		})
		filterByDistricts([]) // Очистить фильтрацию
	})

	// Скрытие фильтра при клике вне его
	document.addEventListener('click', function(event) {
		const filterContent = document.getElementById('filterContent')
		const toggleButton = document.getElementById('toggleFilterMenu')

		// Проверка, был ли клик вне области фильтра и кнопки
		if (filterContent.style.display === 'block' && !filterContent.contains(event.target) && event.target !== toggleButton) {
			filterContent.style.display = 'none'
		}
	})

	provide(filterByDistricts)
})


