let myMap

ymaps.ready(['ext.paintOnMap']).then(function() {
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

	var paintProcess
	var drawing = false
	var drawingMode = 'Polygon'
	var objects = []
	var userDrawnObjects = []


	var styles = {
		strokeColor: '#000000', strokeOpacity: 0.7, strokeWidth: 3, fillColor: '#00000000', fillOpacity: 0.4
	}

	const toggleModeButton = document.getElementById('toggleMode')
	const startDrawingButton = document.getElementById('startDrawing')
	const stopDrawingButton = document.getElementById('stopDrawing')
	const saveDrawingButton = document.getElementById('saveDrawing')
	const clearDrawingButton = document.getElementById('clearDrawing')
	const startTutorialButton = document.getElementById('startTutorial')
	const workModalElement = document.getElementById('workModal')
	const saveWorkButton = document.getElementById('saveWork')
	const messageContentElement = document.getElementById('messageContent')
	const messageModalElement = document.getElementById('messageModal')
	const customBalloon = document.getElementById('customBalloon')
	const editDialog = document.getElementById('editDialog')
	const closeEditDialogButton = document.getElementById('closeEditDialog')
	const saveEditButton = document.getElementById('saveEdit')
	const deleteButton = document.getElementById('delete')
	const editCommentInput = document.getElementById('editComment')
	const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'))
	const confirmDeleteButton = document.getElementById('confirmDeleteButton')
	const completedCheckbox = document.getElementById('completedCheckbox')
	const endDateInput = document.getElementById('editEndDate')
	const equipmentInput = document.getElementById('editEquipment')
	const equipmentCountInput = document.getElementById('editEquipmentCount')
	const additionalFields = document.getElementById('additionalFields')
	const inProgressCheckbox = document.getElementById('inProgressCheckbox')
	const inProgressStartDate = document.getElementById('inProgressStartDate')
	const deletePhotoButton = document.getElementById('deletePhotoButton')
	const openUploadModalButton = document.getElementById('openUploadModalButton')
	const uploadPhotoButton = document.getElementById('uploadPhotoButton')
	const photoInput = document.getElementById('photoInput')
	let currentEditObject = null
	let objectManager = new ymaps.ObjectManager()
	let previousBounds = null
	let selectedGeoObject = null


	toggleModeButton.onclick = function() {
		if (drawingMode === 'Polygon') {
			drawingMode = 'Polyline'
			toggleModeButton.innerText = 'Линия'
		} else {
			drawingMode = 'Polygon'
			toggleModeButton.innerText = 'Полигон'
		}
	}

	startDrawingButton.onclick = function() {
		drawing = true
		objects = []
		userDrawnObjects = []
		startDrawingButton.style.display = 'none'
		stopDrawingButton.style.display = 'inline'
		saveDrawingButton.style.display = 'inline'
		clearDrawingButton.style.display = 'inline'
		toggleModeButton.style.display = 'inline'
		startTutorialButton.style.display = 'inline'
	}

	stopDrawingButton.onclick = function() {
		userDrawnObjects.forEach(obj => myMap.geoObjects.remove(obj))
		userDrawnObjects = []
		objects = []
		drawing = false
		startDrawingButton.style.display = 'inline'
		stopDrawingButton.style.display = 'none'
		saveDrawingButton.style.display = 'none'
		clearDrawingButton.style.display = 'none'
		toggleModeButton.style.display = 'none'
		startTutorialButton.style.display = 'none'
	}

	clearDrawingButton.onclick = function() {
		userDrawnObjects.forEach(obj => myMap.geoObjects.remove(obj))
		userDrawnObjects = []
		objects = []
	}

	saveDrawingButton.onclick = function() {
		var workModal = new bootstrap.Modal(workModalElement)
		workModal.show()
	}

	myMap.events.add('mousedown', function(e) {
		if (drawing) {
			paintProcess = ymaps.ext.paintOnMap(myMap, e, { style: styles })
		}
	})

	myMap.events.add('mouseup', function(e) {
		if (drawing && paintProcess) {
			var coordinates = paintProcess.finishPaintingAt(e)
			paintProcess = null

			var geoObject
			if (drawingMode === 'Polygon') {
				geoObject = new ymaps.Polygon([coordinates], {}, styles)
			} else {
				geoObject = new ymaps.Polyline(coordinates, {}, styles)
			}

			myMap.geoObjects.add(geoObject)
			objects.push({ type: drawingMode, coordinates: coordinates, styles: styles })
			userDrawnObjects.push(geoObject)
		}
	})

	saveWorkButton.onclick = function() {
		const workType = document.getElementById('workTypeSelect').value
		const comment = document.getElementById('commentInput').value
		const workAddress = document.getElementById('workAddressInput').value
		const workVolume = document.getElementById('workVolumeInput').value
		const distance = document.getElementById('distanceInput').value

		if (workType && workAddress && workVolume && distance) {
			const workModal = bootstrap.Modal.getInstance(workModalElement)
			workModal.hide()

			fetch('/save-line', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					objects: objects,
					workType: workType,
					comment: comment,
					workAddress: workAddress,
					workVolume: workVolume,
					distance: distance
				})
			}).then(response => response.json())
				.then(data => {
					if (data.success) {
						showMessageModal('Объекты успешно сохранены.')
						loadLines('')

						drawing = false
						startDrawingButton.style.display = 'inline'
						stopDrawingButton.style.display = 'none'
						saveDrawingButton.style.display = 'none'
						clearDrawingButton.style.display = 'none'
						toggleModeButton.style.display = 'none'
						startTutorialButton.style.display = 'none'
					} else {
						showMessageModal('Ошибка при сохранении объектов: ' + data.message)
					}
				})
		} else {
			showMessageModal('Пожалуйста, заполните все поля.')
		}
	}

	closeEditDialogButton.onclick = function() {
		editDialog.classList.remove('open')
		currentEditObject = null
		document.querySelector('.toolbar-right').style.right = '10px'

		if (selectedGeoObject) {
			selectedGeoObject.selected = false
			selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
			selectedGeoObject.options.set('strokeWidth', 3)
			selectedGeoObject = null
		}

		customBalloon.style.display = 'none'

		// Возврат к предыдущим границам карты
		if (previousBounds) {
			myMap.setBounds(previousBounds, { checkZoomRange: true, duration: 500 })
		}

		resetEditDialog()
	}

	// Логика для отображения поля inProgressStartDate при включении inProgressCheckbox
	inProgressCheckbox.addEventListener('change', function() {
		const isChecked = inProgressCheckbox.checked
		inProgressStartDate.style.display = isChecked ? 'block' : 'none'
	})

	// Логика для отображения дополнительных полей при включении completedCheckbox
	completedCheckbox.addEventListener('change', function() {
		const isChecked = completedCheckbox.checked
		additionalFields.style.display = isChecked ? 'block' : 'none'
	})

	saveEditButton.onclick = function() {
		if (currentEditObject) {
			if (completedCheckbox.checked) {
				// Проверяем, заполнены ли все необходимые поля для завершенного объекта
				if (!endDateInput.value || !equipmentInput.value || !equipmentCountInput.value) {
					showMessageModal('Пожалуйста, заполните все обязательные поля перед сохранением завершенного объекта.')
					return
				}

				// Устанавливаем данные завершенного объекта
				currentEditObject.endDate = endDateInput.value // Дата завершения работы
				currentEditObject.equipment = equipmentInput.value // Оборудование
				currentEditObject.equipmentCount = parseInt(equipmentCountInput.value, 10) // Количество оборудования
				currentEditObject.lineColor = '#00FF00' // Устанавливаем цвет для завершенного объекта
				currentEditObject.completed = 1 // Отмечаем объект как завершенный
				currentEditObject.inProgress = 0 // Сбрасываем статус выполнения
			} else if (inProgressCheckbox.checked) {
				// Проверяем, заполнено ли поле даты начала для объекта в процессе выполнения
				if (!inProgressStartDate.value) {
					showMessageModal('Пожалуйста, укажите дату начала для объекта в процессе выполнения.')
					return
				}

				// Устанавливаем данные для объекта в процессе выполнения
				currentEditObject.startDate = inProgressStartDate.value // Дата начала работы
				currentEditObject.lineColor = '#0000FF' // Устанавливаем цвет для объектов в процессе выполнения
				currentEditObject.completed = 0 // Сбрасываем статус завершения
				currentEditObject.inProgress = 1 // Отмечаем объект как в процессе выполнения
				currentEditObject.endDate = null // Сбрасываем дату завершения
				currentEditObject.equipment = null
				currentEditObject.equipmentCount = null
			} else {
				// Сбрасываем данные, если оба чекбокса не установлены
				currentEditObject.endDate = null
				currentEditObject.equipment = null
				currentEditObject.equipmentCount = null
				currentEditObject.lineColor = getLineColor(currentEditObject.workType)
				currentEditObject.completed = 0
				currentEditObject.inProgress = 0
				currentEditObject.startDate = null // Сбрасываем дату начала
			}

			currentEditObject.comment = editCommentInput.value

			// Отправляем данные на сервер
			fetch('/update-line', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					id: currentEditObject.id,
					workType: currentEditObject.workType,
					comment: currentEditObject.comment,
					coordinates: currentEditObject.coordinates,
					lineColor: currentEditObject.lineColor,
					type: currentEditObject.type,
					completed: currentEditObject.completed,
					inProgress: currentEditObject.inProgress,
					startDate: currentEditObject.startDate,
					endDate: currentEditObject.endDate, // Отправляем дату завершения
					equipment: currentEditObject.equipment, // Отправляем оборудование
					equipmentCount: currentEditObject.equipmentCount // Отправляем количество оборудования
				})
			}).then(response => response.json())
				.then(data => {
					if (data.success) {
						showMessageModal('Объект успешно обновлен.')
						loadLines('')
						editDialog.classList.remove('open')
						document.querySelector('.toolbar-right').style.right = '10px'

						if (selectedGeoObject) {
							selectedGeoObject.selected = false
							selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
							selectedGeoObject.options.set('strokeWidth', 3)
							selectedGeoObject = null
						}

						resetEditDialog()
					} else {
						showMessageModal('Ошибка при обновлении объекта: ' + data.message)
					}
				})
				.catch(error => {
					console.error('Ошибка при отправке данных на сервер:', error)
					showMessageModal('Ошибка при отправке данных на сервер.')
				})

			customBalloon.style.display = 'none'
		}
	}


	deleteButton.onclick = function() {
		if (currentEditObject) {
			confirmDeleteModal.show()
		}
	}

	confirmDeleteButton.onclick = function() {
		if (currentEditObject) {
			fetch('/delete-line', {
				method: 'POST', headers: {
					'Content-Type': 'application/json'
				}, body: JSON.stringify({ id: currentEditObject.id })
			}).then(response => response.json())
				.then(data => {
					if (data.success) {
						loadLines('')
						editDialog.classList.remove('open')
						document.querySelector('.toolbar-right').style.right = '10px'
						showMessageModal('Объект успешно удален.')
						confirmDeleteModal.hide()
						if (selectedGeoObject) {
							selectedGeoObject.selected = false
							selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
							selectedGeoObject.options.set('strokeWidth', 3)
							selectedGeoObject = null
						}
					} else {
						showMessageModal('Ошибка при удалении объекта: ' + data.message)
					}
				})
		}
		customBalloon.style.display = 'none'
	}

	function loadLines(filterWorkTypes, selectedDistrict = '') {
		objectManager.removeAll();
		myMap.geoObjects.removeAll();

		// Формирование URL для запроса с учетом выбранного района
		const url = `/get-lines?workTypes=${filterWorkTypes}` +
			(selectedDistrict ? `&district=${encodeURIComponent(selectedDistrict)}` : '');

		fetch(url)
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					// Загружаем GeoJSON данные для дополнительной отрисовки
					$.getJSON('/geojson/new_moscow2024.geojson')
						.done(function(geoJson) {
							geoJson.features.forEach(function(feature) {
								if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
									feature.options = {
										fillColor: '#00000000',
										strokeColor: '#007BFF',
										strokeWidth: 0.6
									};
								}
							});

							objectManager.add(geoJson);
							myMap.geoObjects.add(objectManager);

							objectManager.objects.options.set({
								hasBalloon: false,
								hasHint: false,
								interactiveZIndex: false,
								zIndex: 0,
								cursor: 'default'
							})
						})
						.fail(function(jqxhr, textStatus, error) {
							console.error('Ошибка загрузки GeoJSON:', textStatus, error);
						});

					// Отображение линий, полученных с сервера
					data.lines.forEach(line => {
						try {
							const coordinates = JSON.parse(line.coordinates);
							let geoObject;
							const strokeColor = line.line_color;

							if (line.type === 'Polygon') {
								geoObject = new ymaps.Polygon([coordinates], {}, {
									strokeColor: strokeColor,
									strokeOpacity: 0.6,
									strokeWidth: 2,
									fillColor: strokeColor,
									fillOpacity: 0
								});
							} else if (line.type === 'Polyline') {
								geoObject = new ymaps.Polyline(coordinates, {}, {
									strokeColor: strokeColor,
									strokeOpacity: 0.6,
									strokeWidth: 2
								});
							}

							if (line.in_progress) {
								startSmoothBlinking(geoObject);
							}

							geoObject.events.add('mouseenter', function() {
								customBalloon.style.display = 'block';
								customBalloon.innerHTML = createBalloonContent(line);

								geoObject.options.set('strokeColor', '#0078ff');
								geoObject.options.set('strokeWidth', 5);
							});

							geoObject.events.add('mouseleave', function() {
								if (geoObject !== selectedGeoObject) {
									customBalloon.style.display = 'none';
									geoObject.options.set('strokeColor', strokeColor);
									geoObject.options.set('strokeWidth', 2);
								}
							});

							geoObject.events.add('click', function() {
								handleEditDialog(line, geoObject);
								focusOnGeoObject(geoObject);
							});

							myMap.geoObjects.add(geoObject);
						} catch (err) {
							console.error(`Ошибка обработки линии с ID ${line.id}:`, err);
						}
					});
				} else {
					showMessageModal('Ошибка при загрузке сохраненных линий: ' + data.message);
				}
			})
			.catch(error => {
				console.error('Ошибка при загрузке линий:', error);
			});
	}

// Функция для создания содержимого Custom Balloon
	function createBalloonContent(line) {
		let content = ''

		if (line.work_type) content += `<strong>Категория:</strong> ${line.work_type}<br>`
		if (line.work_address) content += `<strong>Адрес работы:</strong> ${line.work_address}<br>`
		if (line.work_volume) content += `<strong>Объем работы:</strong> ${line.work_volume}<br>`
		if (line.distance) content += `<strong>Протяженность:</strong> ${line.distance}<br>`
		if (line.start_date) content += `<strong>Дата начала:</strong> ${line.start_date}<br>`
		if (line.end_date) content += `<strong>Дата окончания:</strong> ${line.end_date}<br>`
		if (line.equipment) content += `<strong>Техника:</strong> ${line.equipment}<br>`
		if (line.equipment_count) content += `<strong>Кол-во техники:</strong> ${line.equipment_count}<br>`
		if (line.comment) content += `<strong>Комментарий:</strong> ${line.comment}<br>`
		if (line.photo) content += `<img src="${line.photo}" alt="Фото объекта" style="max-width: 500px; max-height: 50vh; margin-bottom: 10px; margin-top: 10px; border-radius: 20px;"><br>`

		return content
	}

// Функция для обработки диалога редактирования
	function handleEditDialog(line, geoObject) {
		currentEditObject = {
			id: line.id,
			workType: line.work_type,
			comment: line.comment,
			coordinates: line.coordinates,
			lineColor: line.line_color,
			type: line.type,
			completed: line.completed,
			inProgress: line.in_progress,
			startDate: line.start_date || null
		}

		editCommentInput.value = line.comment
		completedCheckbox.checked = currentEditObject.completed === 1

		if (currentEditObject.completed === 1) {
			additionalFields.style.display = 'block'
			endDateInput.value = line.end_date
			equipmentInput.value = line.equipment
			equipmentCountInput.value = line.equipment_count
		} else {
			additionalFields.style.display = 'none'
		}

		editDialog.classList.add('open')
		document.querySelector('.toolbar-right').style.right = '320px'

		if (selectedGeoObject) {
			selectedGeoObject.selected = false
			selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
			selectedGeoObject.options.set('strokeWidth', 2)
		}

		selectedGeoObject = geoObject
		geoObject.selected = true
		geoObject.originalStrokeColor = line.line_color || '#000000'
		geoObject.options.set('strokeColor', '#0078ff')
		geoObject.options.set('strokeWidth', 5)
		customBalloon.style.display = 'block'
		customBalloon.innerHTML = createBalloonContent(line)
	}

	// Функция для фокусировки на объекте
	function focusOnGeoObject(geoObject) {
		previousBounds = myMap.getBounds() // Сохранение текущих границ карты
		const bounds = geoObject.geometry.getBounds()
		if (bounds) {
			myMap.setBounds(bounds, { checkZoomRange: true, duration: 500 })
		} else {
			console.warn('Не удалось определить границы объекта для фокусировки.')
		}
	}

	// Закрытие диалогового окна и возврат к предыдущему масштабу
	closeEditDialogButton.onclick = function() {
		editDialog.classList.remove('open')
		document.querySelector('.toolbar-right').style.right = '10px'

		if (selectedGeoObject) {
			selectedGeoObject.selected = false
			selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
			selectedGeoObject.options.set('strokeWidth', 2)
			selectedGeoObject = null
		}

		customBalloon.style.display = 'none'

		// Возврат к предыдущим границам карты
		if (previousBounds) {
			myMap.setBounds(previousBounds, { checkZoomRange: true, duration: 500 })
		}
	}


	// Функция плавного мигания
	function startSmoothBlinking(geoObject) {
		let step = 0
		let increasing = true

		setInterval(() => {
			// Линейная интерполяция между синим и светло-синим
			const color = interpolateColor('#0000FF', '#00b6ff', step / 100)
			geoObject.options.set('strokeColor', color)
			geoObject.options.set('strokeWidth', 3 + (step / 30)) // Плавное изменение толщины

			// Увеличиваем или уменьшаем step для плавного перехода
			if (increasing) {
				step += 5
				if (step >= 100) increasing = false
			} else {
				step -= 5
				if (step <= 0) increasing = true
			}
		}, 50) // Плавность анимации увеличивается с частотой обновления
	}

	// Функция интерполяции цвета
	function interpolateColor(color1, color2, factor) {
		var result = '#'
		for (var i = 1; i < 6; i += 2) {
			var hex1 = parseInt(color1.substr(i, 2), 16)
			var hex2 = parseInt(color2.substr(i, 2), 16)
			var hex = Math.round(hex1 + factor * (hex2 - hex1)).toString(16)
			result += ('0' + hex).substr(-2)
		}
		return result
	}

	// Функция отображения модального окна
	function showMessageModal(message) {
		messageContentElement.innerText = message
		var messageModal = new bootstrap.Modal(messageModalElement)
		messageModal.show()
	}

	loadLines('')

	function getLineColor(workType) {
		switch (workType) {
			case 'Гос. задание':
				return '#FF0000'
			case 'Коммерция':
				return '#CE31FF'
			default:
				return '#000000'
		}
	}

	function resetEditDialog() {
		if (editCommentInput) editCommentInput.value = ''
		if (completedCheckbox) completedCheckbox.checked = false
		if (inProgressStartDate) inProgressStartDate.checked = false
		if (additionalFields) additionalFields.style.display = 'none'
		if (endDateInput) endDateInput.value = ''
		if (equipmentInput) equipmentInput.value = ''
		if (equipmentCountInput) equipmentCountInput.value = ''
	}

	// Открытие модального окна для загрузки фото
	openUploadModalButton.onclick = function() {
		const uploadPhotoModal = new bootstrap.Modal(document.getElementById('uploadPhotoModal'))
		uploadPhotoModal.show() // Показ модального окна
	}

	// Обработка загрузки фотографии
	uploadPhotoButton.onclick = function() {
		if (photoInput.files.length > 0) {
			const formData = new FormData()
			formData.append('photo', photoInput.files[0])

			if (currentEditObject && currentEditObject.id) {
				formData.append('objectId', currentEditObject.id)
			} else {
				showMessageModal('Ошибка: не выбран объект для привязки фото.')
				return
			}

			fetch('/upload-photo', {
				method: 'POST',
				body: formData
			})
				.then(response => response.json())
				.then(data => {
					if (data.success) {
						showMessageModal('Фото успешно загружено и привязано к объекту.')

						// Перезагружаем линии, чтобы отобразить все обновления
						loadLines('')

						// Сбрасываем состояние редактирования, как в saveEditButton
						resetEditDialog()
						editDialog.classList.remove('open')
						document.querySelector('.toolbar-right').style.right = '10px'

						if (selectedGeoObject) {
							selectedGeoObject.selected = false
							selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
							selectedGeoObject.options.set('strokeWidth', 3)
							selectedGeoObject = null
						}

						// Закрываем модальное окно загрузки фото
						const uploadPhotoModal = bootstrap.Modal.getInstance(document.getElementById('uploadPhotoModal'))
						uploadPhotoModal.hide()
					} else {
						showMessageModal('Ошибка загрузки фото: ' + data.message)
					}
				})
				.catch(error => {
					console.error('Ошибка загрузки фото:', error)
					showMessageModal('Ошибка при загрузке фото.')
				})
		} else {
			showMessageModal('Пожалуйста, выберите файл перед загрузкой.')
		}
	}

	// Обработка удаления фотографии
	deletePhotoButton.onclick = function() {
		if (currentEditObject && currentEditObject.id) {
			fetch('/delete-photo', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ objectId: currentEditObject.id })
			})
				.then(response => response.json())
				.then(data => {
					if (data.success) {
						showMessageModal('Фото успешно удалено.')

						// Перезагружаем линии и обновляем интерфейс
						loadLines('')
						resetEditDialog()
						editDialog.classList.remove('open')
						document.querySelector('.toolbar-right').style.right = '10px'

						if (selectedGeoObject) {
							selectedGeoObject.selected = false
							selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
							selectedGeoObject.options.set('strokeWidth', 3)
							selectedGeoObject = null
						}
					} else {
						showMessageModal('Ошибка при удалении фото: ' + data.message)
					}
				})
				.catch(error => {
					console.error('Ошибка при удалении фото:', error)
					showMessageModal('Ошибка при удалении фото.')
				})
		} else {
			showMessageModal('Ошибка: объект для удаления фото не выбран.')
		}
		customBalloon.style.display = 'none'
	}


}).catch(console.error)

