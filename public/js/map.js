ymaps.modules.define('ext.paintOnMap', ['meta', 'util.extend', 'pane.EventsPane', 'Event'], function (provide, meta, extend, EventsPane, Event) {
    'use strict'

    var EVENTS_PANE_ZINDEX = 500
    var DEFAULT_UNWANTED_BEHAVIORS = ['drag', 'scrollZoom']
    var DEFAULT_STYLE = {strokeColor: '#000000', strokeWidth: 1, strokeOpacity: 1}
    var DEFAULT_TOLERANCE = 16

    var badFinishPaintingCall = function () {
        throw new Error('(ymaps.ext.paintOnMap) некорректный вызов PaintingProcess#finishPaintingAt. Рисование уже завершено.')
    }

    function paintOnMap(map, positionOrEvent, config) {
        config = config || {}
        var style = extend(DEFAULT_STYLE, config.style || {})

        var unwantedBehaviors = config.unwantedBehaviors === undefined ? DEFAULT_UNWANTED_BEHAVIORS : config.unwantedBehaviors

        var pane = new EventsPane(map, {
            css: {position: 'absolute', width: '100%', height: '100%'},
            zIndex: EVENTS_PANE_ZINDEX + 50,
            transparent: true
        })

        map.panes.append('ext-paint-on-map', pane)

        if (unwantedBehaviors) {
            map.behaviors.disable(unwantedBehaviors)
        }

        var canvas = document.createElement('canvas')
        var ctx2d = canvas.getContext('2d')
        var rect = map.container.getParentElement().getBoundingClientRect()
        canvas.width = rect.width
        canvas.height = rect.height

        ctx2d.globalAlpha = style.strokeOpacity
        ctx2d.strokeStyle = style.strokeColor
        ctx2d.lineWidth = style.strokeWidth

        canvas.style.width = '100%'
        canvas.style.height = '100%'

        pane.getElement().appendChild(canvas)

        var firstPosition = positionOrEvent ? toPosition(positionOrEvent) : null
        var coordinates = firstPosition ? [firstPosition] : []

        var bounds = map.getBounds()
        var latDiff = bounds[1][0] - bounds[0][0]
        var lonDiff = bounds[1][1] - bounds[0][1]

        canvas.onmousemove = function (e) {
            coordinates.push([e.offsetX, e.offsetY])

            ctx2d.clearRect(0, 0, canvas.width, canvas.height)
            ctx2d.beginPath()

            ctx2d.moveTo(coordinates[0][0], coordinates[0][1])
            for (var i = 1; i < coordinates.length; i++) {
                ctx2d.lineTo(coordinates[i][0], coordinates[i][1])
            }

            ctx2d.stroke()
        }.bind(this)

        var paintingProcess = {
            finishPaintingAt: function (positionOrEvent) {
                paintingProcess.finishPaintingAt = badFinishPaintingCall

                if (positionOrEvent) {
                    coordinates.push(toPosition(positionOrEvent))
                }

                map.panes.remove(pane)
                if (unwantedBehaviors) {
                    map.behaviors.enable(unwantedBehaviors)
                }

                var tolerance = config.tolerance === undefined ? DEFAULT_TOLERANCE : Number(config.tolerance)
                if (tolerance) {
                    coordinates = simplify(coordinates, tolerance)
                }

                return coordinates.map(function (x) {
                    var lon = bounds[0][1] + (x[0] / canvas.width) * lonDiff
                    var lat = bounds[0][0] + (1 - x[1] / canvas.height) * latDiff

                    return meta.coordinatesOrder === 'latlong' ? [lat, lon] : [lon, lat]
                })
            }
        }

        return paintingProcess
    }

    function toPosition(positionOrEvent) {
        return positionOrEvent instanceof Event ? [positionOrEvent.get('offsetX'), positionOrEvent.get('offsetY')] : positionOrEvent
    }

    function simplify(coordinates, tolerance) {
        var toleranceSquared = tolerance * tolerance
        var simplified = [coordinates[0]]

        var prev = coordinates[0]
        for (var i = 1; i < coordinates.length; i++) {
            var curr = coordinates[i]
            if (Math.pow(prev[0] - curr[0], 2) + Math.pow(prev[1] - curr[1], 2) > toleranceSquared) {
                simplified.push(curr)
                prev = curr
            }
        }

        return simplified
    }

    provide(paintOnMap)
})

let myMap
let selectedGeoObject = null


ymaps.ready(['ext.paintOnMap']).then(function () {
    myMap = new ymaps.Map('map', {
        center: [55.39, 37.33], zoom: 10, controls: []
    }, {
        suppressMapOpenBlock: true
    })

    var paintProcess
    var drawing = false
    var drawingMode = 'Polygon'
    var objects = []
    var userDrawnObjects = []

    var styles = {
        strokeColor: '#000000', strokeOpacity: 0.7, strokeWidth: 3, fillColor: '#000000', fillOpacity: 0.4
    }

    const toggleModeButton = document.getElementById('toggleMode')
    const startDrawingButton = document.getElementById('startDrawing')
    const stopDrawingButton = document.getElementById('stopDrawing')
    const saveDrawingButton = document.getElementById('saveDrawing')
    const clearDrawingButton = document.getElementById('clearDrawing')
    const startTutorialButton = document.getElementById('startTutorial')
    const filterWorkTypeSelect = document.getElementById('filterWorkType')
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
    const completedCheckbox = document.getElementById('completedCheckbox');
    const startDateInput = document.getElementById('editStartDate');
    const endDateInput = document.getElementById('editEndDate');
    const equipmentInput = document.getElementById('editEquipment');
    const equipmentCountInput = document.getElementById('editEquipmentCount');
    const additionalFields = document.getElementById('additionalFields');


    let currentEditObject = null

    toggleModeButton.onclick = function () {
        if (drawingMode === 'Polygon') {
            drawingMode = 'Polyline'
            toggleModeButton.innerText = 'Линия'
        } else {
            drawingMode = 'Polygon'
            toggleModeButton.innerText = 'Полигон'
        }
    }

    startDrawingButton.onclick = function () {
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

    stopDrawingButton.onclick = function () {
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

    clearDrawingButton.onclick = function () {
        userDrawnObjects.forEach(obj => myMap.geoObjects.remove(obj))
        userDrawnObjects = []
        objects = []
    }

    saveDrawingButton.onclick = function () {
        var workModal = new bootstrap.Modal(workModalElement)
        workModal.show()
    }

    myMap.events.add('mousedown', function (e) {
        if (drawing) {
            paintProcess = ymaps.ext.paintOnMap(myMap, e, {style: styles})
        }
    })

    myMap.events.add('mouseup', function (e) {
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
            objects.push({type: drawingMode, coordinates: coordinates, styles: styles})
            userDrawnObjects.push(geoObject)
        }
    })

    saveWorkButton.onclick = function () {
        const workType = document.getElementById('workTypeSelect').value;
        const comment = document.getElementById('commentInput').value;
        const workAddress = document.getElementById('workAddressInput').value; // Новое поле
        const workVolume = document.getElementById('workVolumeInput').value; // Новое поле

        if (workType && comment && workAddress && workVolume) {
            const workModal = bootstrap.Modal.getInstance(workModalElement);
            workModal.hide();

            // Сохранение всех объектов в одну запись
            fetch('/save-line', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    objects: objects, // Содержит все нарисованные объекты в одном цикле
                    workType: workType,
                    comment: comment,
                    workAddress: workAddress,
                    workVolume: workVolume
                })
            }).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessageModal('Линии/Области успешно сохранены.');
                        loadLines('');
                        startDrawingButton.style.display = 'inline';
                        stopDrawingButton.style.display = 'none';
                        saveDrawingButton.style.display = 'none';
                        clearDrawingButton.style.display = 'none';
                        toggleModeButton.style.display = 'none';
                        drawing = false;
                    } else {
                        showMessageModal('Ошибка при сохранении линий/областей: ' + data.message);
                    }
                });
        } else {
            showMessageModal('Пожалуйста, заполните все поля.');
        }
    };

    closeEditDialogButton.onclick = function () {
        // Закрытие диалогового окна редактирования
        editDialog.classList.remove('open');
        currentEditObject = null;
        document.querySelector('.toolbar-right').style.right = '10px';

        // Сброс выделения геообъекта
        if (selectedGeoObject) {
            selectedGeoObject.selected = false;
            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
            selectedGeoObject.options.set('strokeWidth', 3);
            selectedGeoObject = null;
        }

        // Скрываем customBalloon
        customBalloon.style.display = 'none';

        // Сбрасываем поля редактирования
        resetEditDialog();
    };

    completedCheckbox.addEventListener('change', function () {
        const isChecked = completedCheckbox.checked;
        additionalFields.style.display = isChecked ? 'block' : 'none';
    });

    saveEditButton.onclick = function () {
        if (currentEditObject) {
            // Проверка состояния чекбокса и необходимости обязательных данных
            if (completedCheckbox.checked) {
                // Проверка на заполнение всех обязательных полей
                if (!startDateInput.value || !endDateInput.value || !equipmentInput.value || !equipmentCountInput.value) {
                    showMessageModal('Пожалуйста, заполните все обязательные поля перед сохранением завершенного объекта.');
                    return; // Останавливаем выполнение, если поля не заполнены
                }

                // Обновляем значения из дополнительных полей
                currentEditObject.startDate = startDateInput.value;
                currentEditObject.endDate = endDateInput.value;
                currentEditObject.equipment = equipmentInput.value;
                currentEditObject.equipmentCount = parseInt(equipmentCountInput.value, 10);
                currentEditObject.lineColor = '#00FF00'; // Зеленый цвет, если выполнено
            } else {
                // Если чекбокс не установлен, сбрасываем дополнительные поля
                currentEditObject.startDate = null;
                currentEditObject.endDate = null;
                currentEditObject.equipment = null;
                currentEditObject.equipmentCount = null;
                currentEditObject.lineColor = getLineColor(currentEditObject.workType); // Определяем цвет в зависимости от типа работы
            }

            // Обновление значений из остальных полей
            currentEditObject.comment = editCommentInput.value;
            currentEditObject.completed = completedCheckbox.checked ? 1 : 0; // Установка completed в 1 или 0

            // Отправка данных на сервер для обновления объекта
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
                    startDate: currentEditObject.startDate,
                    endDate: currentEditObject.endDate,
                    equipment: currentEditObject.equipment,
                    equipmentCount: currentEditObject.equipmentCount
                })
            }).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessageModal('Объект успешно обновлен.');
                        loadLines('');
                        editDialog.classList.remove('open');
                        document.querySelector('.toolbar-right').style.right = '10px';

                        // Снятие выделения с объекта
                        if (selectedGeoObject) {
                            selectedGeoObject.selected = false;
                            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
                            selectedGeoObject.options.set('strokeWidth', 3);
                            selectedGeoObject = null;
                        }

                        // Сбрасываем поля редактирования
                        resetEditDialog();
                    } else {
                        showMessageModal('Ошибка при обновлении объекта: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Ошибка при отправке данных на сервер:', error);
                    showMessageModal('Ошибка при отправке данных на сервер.');
                });
        }
    };

    deleteButton.onclick = function () {
        if (currentEditObject) {
            confirmDeleteModal.show()
        }
    }

    confirmDeleteButton.onclick = function () {
        if (currentEditObject) {
            fetch('/delete-line', {
                method: 'POST', headers: {
                    'Content-Type': 'application/json'
                }, body: JSON.stringify({id: currentEditObject.id})
            }).then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessageModal('Объект успешно удален.')
                        loadLines('')
                        editDialog.classList.remove('open')
                        document.querySelector('.toolbar-right').style.right = '10px'
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
    }

    function loadLines(filterWorkTypes) {
        fetch(`/get-lines?workTypes=${filterWorkTypes}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    myMap.geoObjects.removeAll();
                    data.lines.forEach(line => {
                        var coordinates = JSON.parse(line.coordinates);
                        var geoObject;

                        // Используем цвет, сохраненный в базе данных
                        var strokeColor = line.line_color;

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
                                strokeColor: strokeColor, strokeOpacity: 0.6, strokeWidth: 2
                            });
                        }

                        geoObject.events.add('mouseenter', function (e) {
                            customBalloon.style.display = 'block';

                            let content = '';

                            if (line.work_type) {
                                content += `<strong>Категория:</strong> ${line.work_type}<br>`;
                            }
                            if (line.work_address) {
                                content += `<strong>Адрес работы:</strong> ${line.work_address}<br>`;
                            }
                            if (line.work_volume) {
                                content += `<strong>Объем работы:</strong> ${line.work_volume}<br>`;
                            }
                            if (line.start_date) {
                                content += `<strong>Дата начала:</strong> ${line.start_date}<br>`;
                            }
                            if (line.end_date) {
                                content += `<strong>Дата окончания:</strong> ${line.end_date}<br>`;
                            }
                            if (line.equipment) {
                                content += `<strong>Техника:</strong> ${line.equipment}<br>`;
                            }
                            if (line.equipment_count) {
                                content += `<strong>Кол-во техники:</strong> ${line.equipment_count}<br>`;
                            }
                            if (line.comment) {
                                content += `<strong>Комментарий:</strong> ${line.comment}<br>`;
                            }

                            customBalloon.innerHTML = content;

                            geoObject.options.set('strokeColor', '#0078ff');
                            geoObject.options.set('strokeWidth', 5);
                        });

                        geoObject.events.add('mouseleave', function (e) {
                            if (!geoObject.selected) {
                                customBalloon.style.display = 'none';
                                geoObject.options.set('strokeColor', strokeColor);
                                geoObject.options.set('strokeWidth', 3);
                            }
                        });

                        geoObject.events.add('click', function (e) {
                            currentEditObject = {
                                id: line.id,
                                workType: line.work_type,
                                comment: line.comment,
                                coordinates: line.coordinates,
                                lineColor: strokeColor,
                                type: line.type,
                                completed: line.completed // Новый атрибут
                            };

                            // Устанавливаем значения в поля редактирования
                            editCommentInput.value = line.comment;
                            completedCheckbox.checked = currentEditObject.completed === 1;

                            // Если объект завершен (completed = 1), показываем дополнительные поля
                            if (currentEditObject.completed === 1) {
                                additionalFields.style.display = 'block';
                                startDateInput.value = line.start_date;
                                endDateInput.value = line.end_date;
                                equipmentInput.value = line.equipment;
                                equipmentCountInput.value = line.equipment_count;
                            } else {
                                additionalFields.style.display = 'none';
                            }

                            editDialog.classList.add('open');
                            document.querySelector('.toolbar-right').style.right = '320px';

                            const bounds = geoObject.geometry.getBounds()
                            myMap.setBounds(bounds, {
                                checkZoomRange: true,
                                duration: 500
                            })

                            // Устанавливаем выделение объекта на карте
                            if (selectedGeoObject) {
                                selectedGeoObject.selected = false
                                selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
                                selectedGeoObject.options.set('strokeWidth', 3)
                            }
                            selectedGeoObject = geoObject
                            geoObject.selected = true
                            geoObject.originalStrokeColor = line.line_color || '#000000'
                            geoObject.options.set('strokeColor', '#0078ff')
                            geoObject.options.set('strokeWidth', 5)
                        })

                        myMap.geoObjects.add(geoObject)
                    })
                } else {
                    showMessageModal('Ошибка при загрузке сохраненных линий: ' + data.message)
                }
            })
    }

    function showMessageModal(message) {
        messageContentElement.innerText = message
        var messageModal = new bootstrap.Modal(messageModalElement)
        messageModal.show()
    }

    loadLines('')

    filterWorkTypeSelect.addEventListener('change', function () {
        const selectedValues = Array.from(document.querySelectorAll('.custom-option input:checked'))
            .map(checkbox => checkbox.value)

        loadLines(selectedValues.length ? selectedValues.join(',') : '')
    })

    function getLineColor(workType) {
        switch (workType) {
            case 'Гос. задание':
                return '#FF0000' // Красный
            case 'Коммерция':
                return '#CE31FF' // Фиолетовый
            default:
                return '#000000' // Черный по умолчанию
        }
    }

    function resetEditDialog() {
        // Сбрасываем все поля редактирования
        editCommentInput.value = '';
        completedCheckbox.checked = false;
        additionalFields.style.display = 'none';
        startDateInput.value = '';
        endDateInput.value = '';
        equipmentInput.value = '';
        equipmentCountInput.value = '';
    }


}).catch(console.error)
