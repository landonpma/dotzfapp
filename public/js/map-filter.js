document.addEventListener('DOMContentLoaded', () => {
    const customSelect = document.getElementById('filterWorkType')
    const customOptions = document.querySelector('.custom-options')
    const customOptionsItems = document.querySelectorAll('.custom-option input')
    const editDialog = document.querySelector('.edit-dialog')
    const toolbarRight = document.querySelector('.toolbar-right')
    const editCommentInput = document.getElementById('editComment')
    const customBalloon = document.getElementById('customBalloon')
    const closeEditDialogButton = document.getElementById('closeEditDialog') // Добавлено
    let currentEditObject = null
    let selectedGeoObject = null // Переменная для хранения выбранного объекта

    customSelect.addEventListener('click', (e) => {
        e.stopPropagation()
        customSelect.classList.toggle('open')
        customOptions.classList.toggle('open')
    })

    customOptions.addEventListener('click', (e) => {
        e.stopPropagation()
    })

    customOptionsItems.forEach(option => {
        option.addEventListener('change', (e) => {
            e.stopPropagation()
            updateSelectedOptions()
        })
    })

    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            customSelect.classList.remove('open')
            customOptions.classList.remove('open')
        }
    })

    function updateSelectedOptions() {
        const selectedValues = Array.from(customOptionsItems)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value)

        customSelect.querySelector('span').textContent = selectedValues.length
            ? selectedValues.join(', ')
            : 'Категория работ'

        loadLines(selectedValues)
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
                            if (line.distance) {
                                content += `<strong>Протяженность:</strong> ${line.distance}<br>`;
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

    loadLines([]) // Изначальная загрузка всех линий

    function showMessageModal(message) {
        const messageContentElement = document.getElementById('messageContent')
        const messageModalElement = document.getElementById('messageModal')
        messageContentElement.innerText = message
        var messageModal = new bootstrap.Modal(messageModalElement)
        messageModal.show()
    }

    // Добавление обработчика для кнопки закрытия диалогового окна
    closeEditDialogButton.onclick = function () {
        editDialog.classList.remove('open')
        currentEditObject = null
        toolbarRight.style.right = '10px' // Возвращаем кнопку фильтра на место
        if (selectedGeoObject) {
            selectedGeoObject.selected = false
            selectedGeoObject.options.set('strokeColor', selectedGeoObject.originalStrokeColor)
            selectedGeoObject.options.set('strokeWidth', 3)
            selectedGeoObject = null
        }
        customBalloon.style.display = 'none' // Скрываем customBalloon
    }
})

