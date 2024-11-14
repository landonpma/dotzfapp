ymaps.modules.define('ext.mapStyleManager', [], function(provide) {
	'use strict'

	function initMapStyleManager(map) {
		const availableMapStyles = {
			standard: 'yandex#map',
			hybrid: 'yandex#hybrid'
		}

		const mapStyles = Object.fromEntries(Object.entries(availableMapStyles).filter(([, value]) => value))

		const styleSelector = document.getElementById('mapStyleSelector')
		const mapStyleButton = document.getElementById('mapStyleSelector')

		let isHybrid = false

		styleSelector.addEventListener('change', function() {
			const selectedStyle = styleSelector.value
			if (map && mapStyles[selectedStyle]) {
				try {
					map.setType(mapStyles[selectedStyle])
				} catch (error) {
					console.error('Ошибка при установке типа карты:', error)
					alert('Этот тип карты не поддерживается.')
					styleSelector.value = 'standard' // Вернуть на стандартный тип в случае ошибки
					map.setType(mapStyles['standard'])
				}
			} else {
				console.error('Карта не инициализирована или выбранный тип карты недопустим')
			}
		})

		mapStyleButton.addEventListener('click', function() {
			isHybrid = !isHybrid
			const selectedStyle = isHybrid ? availableMapStyles.hybrid : availableMapStyles.standard

			try {
				map.setType(selectedStyle)
				mapStyleButton.innerText = isHybrid ? 'Гибрид' : 'Стандарт'
			} catch (error) {
				console.error('Ошибка при установке стиля карты:', error)
				alert('Этот стиль карты не поддерживается.')
				isHybrid = false
				map.setType(availableMapStyles.standard)
				mapStyleButton.innerText = 'Стандарт'
			}
		})
	}

	provide(initMapStyleManager)
})


