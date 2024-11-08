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
let isHybrid = false;

ymaps.ready(['ext.paintOnMap']).then(function () {
    myMap = new ymaps.Map('map', {
        center: [55.39, 37.33],
        zoom: 10,
        controls: []
    }, {
        suppressMapOpenBlock: true
    });




    // Определите стили карты, проверяя их доступность
    const availableMapStyles = {
        standard: 'yandex#map',
        hybrid: 'yandex#hybrid'
    };

    // Фильтруем только доступные стили
    const mapStyles = Object.fromEntries(Object.entries(availableMapStyles).filter(([, value]) => value));

    const styleSelector = document.getElementById('mapStyleSelector');
    styleSelector.addEventListener('change', function () {
        const selectedStyle = styleSelector.value;
        if (myMap && mapStyles[selectedStyle]) {
            try {
                myMap.setType(mapStyles[selectedStyle]);
            } catch (error) {
                console.error("Ошибка при установке типа карты:", error);
                alert("Этот тип карты не поддерживается.");
                styleSelector.value = "standard"; // Вернуть на стандартный тип в случае ошибки
                myMap.setType(mapStyles["standard"]);
            }
        } else {
            console.error("Карта не инициализирована или выбранный тип карты недопустим");
        }
    });

    const mapStyleButton = document.getElementById('mapStyleSelector');
    mapStyleButton.innerText = 'Стандарт'; // Начальное состояние кнопки

    // Обработчик для переключения стиля карты
    mapStyleButton.addEventListener('click', function () {
        isHybrid = !isHybrid; // Переключаем состояние
        const selectedStyle = isHybrid ? availableMapStyles.hybrid : availableMapStyles.standard;

        // Меняем стиль карты и текст кнопки
        try {
            myMap.setType(selectedStyle);
            mapStyleButton.innerText = isHybrid ? 'Гибрид' : 'Стандарт';
        } catch (error) {
            console.error("Ошибка при установке стиля карты:", error);
            alert("Этот стиль карты не поддерживается.");
            isHybrid = false;
            myMap.setType(availableMapStyles.standard);
            mapStyleButton.innerText = 'Стандарт';
        }
    });

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
    const endDateInput = document.getElementById('editEndDate');
    const equipmentInput = document.getElementById('editEquipment');
    const equipmentCountInput = document.getElementById('editEquipmentCount');
    const additionalFields = document.getElementById('additionalFields');
    const inProgressCheckbox = document.getElementById('inProgressCheckbox');
    const inProgressStartDate = document.getElementById('inProgressStartDate')
    const deletePhotoButton = document.getElementById('deletePhotoButton');
    const openUploadModalButton = document.getElementById('openUploadModalButton');
    const uploadPhotoButton = document.getElementById('uploadPhotoButton');
    const photoInput = document.getElementById('photoInput');


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
        const workAddress = document.getElementById('workAddressInput').value;
        const workVolume = document.getElementById('workVolumeInput').value;
        const distance = document.getElementById('distanceInput').value;

        if (workType && workAddress && workVolume && distance) {
            const workModal = bootstrap.Modal.getInstance(workModalElement);
            workModal.hide();

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
                        showMessageModal('Объекты успешно сохранены.');
                        loadLines('');

                        drawing = false;
                        startDrawingButton.style.display = 'inline';
                        stopDrawingButton.style.display = 'none';
                        saveDrawingButton.style.display = 'none';
                        clearDrawingButton.style.display = 'none';
                        toggleModeButton.style.display = 'none';
                        startTutorialButton.style.display = 'none';
                    } else {
                        showMessageModal('Ошибка при сохранении объектов: ' + data.message);
                    }
                });
        } else {
            showMessageModal('Пожалуйста, заполните все поля.');
        }
    };

    closeEditDialogButton.onclick = function () {
        editDialog.classList.remove('open');
        currentEditObject = null;
        document.querySelector('.toolbar-right').style.right = '10px';

        if (selectedGeoObject) {
            selectedGeoObject.selected = false;
            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
            selectedGeoObject.options.set('strokeWidth', 3);
            selectedGeoObject = null;
        }

        customBalloon.style.display = 'none';

        resetEditDialog();
    };

    // Логика для отображения поля inProgressStartDate при включении inProgressCheckbox
    inProgressCheckbox.addEventListener('change', function () {
        const isChecked = inProgressCheckbox.checked
        inProgressStartDate.style.display = isChecked ? 'block' : 'none'
    })

    // Логика для отображения дополнительных полей при включении completedCheckbox
    completedCheckbox.addEventListener('change', function () {
        const isChecked = completedCheckbox.checked
        additionalFields.style.display = isChecked ? 'block' : 'none'
    })

    saveEditButton.onclick = function () {
        if (currentEditObject) {
            if (completedCheckbox.checked) {
                // Проверяем, заполнены ли все необходимые поля для завершенного объекта
                if (!endDateInput.value || !equipmentInput.value || !equipmentCountInput.value) {
                    showMessageModal('Пожалуйста, заполните все обязательные поля перед сохранением завершенного объекта.');
                    return;
                }

                // Устанавливаем данные завершенного объекта
                currentEditObject.endDate = endDateInput.value; // Дата завершения работы
                currentEditObject.equipment = equipmentInput.value; // Оборудование
                currentEditObject.equipmentCount = parseInt(equipmentCountInput.value, 10); // Количество оборудования
                currentEditObject.lineColor = '#00FF00'; // Устанавливаем цвет для завершенного объекта
                currentEditObject.completed = 1; // Отмечаем объект как завершенный
                currentEditObject.inProgress = 0; // Сбрасываем статус выполнения
            } else if (inProgressCheckbox.checked) {
                // Проверяем, заполнено ли поле даты начала для объекта в процессе выполнения
                if (!inProgressStartDate.value) {
                    showMessageModal('Пожалуйста, укажите дату начала для объекта в процессе выполнения.');
                    return;
                }

                // Устанавливаем данные для объекта в процессе выполнения
                currentEditObject.startDate = inProgressStartDate.value; // Дата начала работы
                currentEditObject.lineColor = '#0000FF'; // Устанавливаем цвет для объектов в процессе выполнения
                currentEditObject.completed = 0; // Сбрасываем статус завершения
                currentEditObject.inProgress = 1; // Отмечаем объект как в процессе выполнения
                currentEditObject.endDate = null; // Сбрасываем дату завершения
                currentEditObject.equipment = null;
                currentEditObject.equipmentCount = null;
            } else {
                // Сбрасываем данные, если оба чекбокса не установлены
                currentEditObject.endDate = null;
                currentEditObject.equipment = null;
                currentEditObject.equipmentCount = null;
                currentEditObject.lineColor = getLineColor(currentEditObject.workType);
                currentEditObject.completed = 0;
                currentEditObject.inProgress = 0;
                currentEditObject.startDate = null; // Сбрасываем дату начала
            }

            currentEditObject.comment = editCommentInput.value;

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
                        showMessageModal('Объект успешно обновлен.');
                        loadLines('');
                        editDialog.classList.remove('open');
                        document.querySelector('.toolbar-right').style.right = '10px';

                        if (selectedGeoObject) {
                            selectedGeoObject.selected = false;
                            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
                            selectedGeoObject.options.set('strokeWidth', 3);
                            selectedGeoObject = null;
                        }

                        resetEditDialog();
                    } else {
                        showMessageModal('Ошибка при обновлении объекта: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Ошибка при отправке данных на сервер:', error);
                    showMessageModal('Ошибка при отправке данных на сервер.');
                });

            customBalloon.style.display = 'none';
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

        customBalloon.style.display = 'none';
    }

    function loadLines(filterWorkTypes) {
        fetch(`/get-lines?workTypes=${filterWorkTypes}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const objectManager = new ymaps.ObjectManager()

                    $.getJSON('geojson/modified_geojson.geojson')
                        .done(function (geoJson) {
                            // Устанавливаем стили для полигонов и линий
                            geoJson.features.forEach(function (feature) {
                                if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
                                    feature.options = {
                                        fillColor: '#00000000', // Прозрачный фон
                                        strokeColor: '#007BFF', // Черный контур
                                        strokeWidth: 0.5,         // Тонкий контур
                                    };
                                }
                            });

                            objectManager.add(geoJson);
                            myMap.geoObjects.add(objectManager);

                            // Отключаем события для ObjectManager и меняем курсор
                            objectManager.objects.options.set({
                                hasBalloon: false,  // Отключает всплывающие балуны
                                hasHint: false,     // Отключает подсказки
                                interactiveZIndex: false, // Предотвращает поднятие Z-индекса
                                zIndex: 0,           // Устанавливает базовый Z-индекс
                                cursor: 'default'    // Убирает курсор pointer
                            });

                            const bounds = objectManager.getBounds();
                            if (bounds) {
                                myMap.setBounds(bounds, { checkZoomRange: true });
                            } else {
                                console.warn('Bounds не определены. Проверьте корректность данных.');
                            }
                        })
                        .fail(function (jqxhr, textStatus, error) {
                            console.error('Ошибка загрузки GeoJSON:', textStatus, error);
                        });

                    // Добавляем новые линии из базы данных
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
                            } else {
                                console.warn(`Неизвестный тип геометрии: ${line.type}`);
                                return;
                            }

                            if (line.in_progress) {
                                startSmoothBlinking(geoObject);
                            }

                            geoObject.events.add('mouseenter', function () {
                                customBalloon.style.display = 'block';
                                let content = '';

                                if (line.work_type) content += `<strong>Категория:</strong> ${line.work_type}<br>`;
                                if (line.work_address) content += `<strong>Адрес работы:</strong> ${line.work_address}<br>`;
                                if (line.work_volume) content += `<strong>Объем работы:</strong> ${line.work_volume}<br>`;
                                if (line.distance) content += `<strong>Протяженность:</strong> ${line.distance}<br>`;
                                if (line.start_date) content += `<strong>Дата начала:</strong> ${line.start_date}<br>`;
                                if (line.end_date) content += `<strong>Дата окончания:</strong> ${line.end_date}<br>`;
                                if (line.equipment) content += `<strong>Техника:</strong> ${line.equipment}<br>`;
                                if (line.equipment_count) content += `<strong>Кол-во техники:</strong> ${line.equipment_count}<br>`;
                                if (line.comment) content += `<strong>Комментарий:</strong> ${line.comment}<br>`;
                                if (line.photo) content += `<img src="${line.photo}" alt="Фото объекта" style="max-width: 500px; max-height: 50vh; margin-bottom: 10px; margin-top: 10px; border-radius: 20px;"><br>`;

                                customBalloon.innerHTML = content;

                                geoObject.options.set('strokeColor', '#0078ff');
                                geoObject.options.set('strokeWidth', 5);
                            });

                            geoObject.events.add('mouseleave', function () {
                                customBalloon.style.display = 'none';
                                geoObject.options.set('strokeColor', strokeColor);
                                geoObject.options.set('strokeWidth', 2);
                            });

                            geoObject.events.add('click', function () {
                                currentEditObject = {
                                    id: line.id,
                                    workType: line.work_type,
                                    comment: line.comment,
                                    coordinates: line.coordinates,
                                    lineColor: strokeColor,
                                    type: line.type,
                                    completed: line.completed,
                                    inProgress: line.in_progress,
                                    startDate: line.start_date || null
                                };

                                editCommentInput.value = line.comment;
                                completedCheckbox.checked = currentEditObject.completed === 1;

                                if (currentEditObject.completed === 1) {
                                    additionalFields.style.display = 'block';
                                    endDateInput.value = line.end_date;
                                    equipmentInput.value = line.equipment;
                                    equipmentCountInput.value = line.equipment_count;
                                } else {
                                    additionalFields.style.display = 'none';
                                }

                                if (currentEditObject.startDate) {
                                    inProgressContainer.style.display = 'none';
                                } else {
                                    inProgressContainer.style.display = 'block';
                                    inProgressStartDate.style.display = inProgressCheckbox.checked ? 'block' : 'none';
                                    inProgressStartDate.value = '';
                                }

                                editDialog.classList.add('open');
                                document.querySelector('.toolbar-right').style.right = '320px';

                                const bounds = geoObject.geometry.getBounds();
                                myMap.setBounds(bounds, { checkZoomRange: true, duration: 500 });

                                if (selectedGeoObject) {
                                    selectedGeoObject.selected = false;
                                    selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
                                    selectedGeoObject.options.set('strokeWidth', 2);
                                }
                                selectedGeoObject = geoObject;
                                geoObject.selected = true;
                                geoObject.originalStrokeColor = line.line_color || '#000000';
                                geoObject.options.set('strokeColor', '#0078ff');
                                geoObject.options.set('strokeWidth', 5);
                            });

                            myMap.geoObjects.add(geoObject);
                        } catch (err) {
                            console.error(`Ошибка обработки линии с ID ${line.id}:`, err);
                        }
                    });
                } else {
                    showMessageModal('Ошибка при загрузке сохраненных линий: ' + data.message);
                }
            });

    }

    // Функция плавного мигания
    function startSmoothBlinking(geoObject) {
        let step = 0;
        let increasing = true;

        setInterval(() => {
            // Линейная интерполяция между синим и светло-синим
            const color = interpolateColor('#0000FF', '#00b6ff', step / 100);
            geoObject.options.set('strokeColor', color);
            geoObject.options.set('strokeWidth', 3 + (step / 30)); // Плавное изменение толщины

            // Увеличиваем или уменьшаем step для плавного перехода
            if (increasing) {
                step += 5;
                if (step >= 100) increasing = false;
            } else {
                step -= 5;
                if (step <= 0) increasing = true;
            }
        }, 50); // Плавность анимации увеличивается с частотой обновления
    }

    // Функция интерполяции цвета
    function interpolateColor(color1, color2, factor) {
        var result = "#";
        for (var i = 1; i < 6; i += 2) {
            var hex1 = parseInt(color1.substr(i, 2), 16);
            var hex2 = parseInt(color2.substr(i, 2), 16);
            var hex = Math.round(hex1 + factor * (hex2 - hex1)).toString(16);
            result += ("0" + hex).substr(-2);
        }
        return result;
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
                return '#FF0000'
            case 'Коммерция':
                return '#CE31FF'
            default:
                return '#000000'
        }
    }

    function resetEditDialog() {
        if (editCommentInput) editCommentInput.value = '';
        if (completedCheckbox) completedCheckbox.checked = false;
        if (inProgressStartDate) inProgressStartDate.checked = false;
        if (additionalFields) additionalFields.style.display = 'none';
        if (endDateInput) endDateInput.value = '';
        if (equipmentInput) equipmentInput.value = '';
        if (equipmentCountInput) equipmentCountInput.value = '';
    }

    // Открытие модального окна для загрузки фото
    openUploadModalButton.onclick = function () {
        const uploadPhotoModal = new bootstrap.Modal(document.getElementById('uploadPhotoModal'));
        uploadPhotoModal.show(); // Показ модального окна
    };

    // Обработка загрузки фотографии
    uploadPhotoButton.onclick = function () {
        if (photoInput.files.length > 0) {
            const formData = new FormData();
            formData.append('photo', photoInput.files[0]);

            if (currentEditObject && currentEditObject.id) {
                formData.append('objectId', currentEditObject.id);
            } else {
                showMessageModal('Ошибка: не выбран объект для привязки фото.');
                return;
            }

            fetch('/upload-photo', {
                method: 'POST',
                body: formData
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessageModal('Фото успешно загружено и привязано к объекту.');

                        // Перезагружаем линии, чтобы отобразить все обновления
                        loadLines('');

                        // Сбрасываем состояние редактирования, как в saveEditButton
                        resetEditDialog();
                        editDialog.classList.remove('open');
                        document.querySelector('.toolbar-right').style.right = '10px';

                        if (selectedGeoObject) {
                            selectedGeoObject.selected = false;
                            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
                            selectedGeoObject.options.set('strokeWidth', 3);
                            selectedGeoObject = null;
                        }

                        // Закрываем модальное окно загрузки фото
                        const uploadPhotoModal = bootstrap.Modal.getInstance(document.getElementById('uploadPhotoModal'));
                        uploadPhotoModal.hide();
                    } else {
                        showMessageModal('Ошибка загрузки фото: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Ошибка загрузки фото:', error);
                    showMessageModal('Ошибка при загрузке фото.');
                });
        } else {
            showMessageModal('Пожалуйста, выберите файл перед загрузкой.');
        }
    };

    deletePhotoButton.onclick = function () {
        if (currentEditObject && currentEditObject.id) {
            fetch('/delete-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({objectId: currentEditObject.id})
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showMessageModal('Фото успешно удалено.');

                        // Перезагружаем линии и обновляем интерфейс
                        loadLines('');
                        resetEditDialog();
                        editDialog.classList.remove('open');
                        document.querySelector('.toolbar-right').style.right = '10px';

                        if (selectedGeoObject) {
                            selectedGeoObject.selected = false;
                            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor);
                            selectedGeoObject.options.set('strokeWidth', 3);
                            selectedGeoObject = null;
                        }
                    } else {
                        showMessageModal('Ошибка при удалении фото: ' + data.message);
                    }
                })
                .catch(error => {
                    console.error('Ошибка при удалении фото:', error);
                    showMessageModal('Ошибка при удалении фото.');
                });
        } else {
            showMessageModal('Ошибка: объект для удаления фото не выбран.');
        }
        customBalloon.style.display = 'none';
    };
}).catch(console.error)

