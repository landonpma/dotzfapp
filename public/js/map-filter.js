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

