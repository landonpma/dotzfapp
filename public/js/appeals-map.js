let myMap
let isHybrid = false;

ymaps.ready(function () {
    myMap = new ymaps.Map('map', {
        center: [55.390000, 37.330000],
        zoom: 10,
        controls: []
    }, {
        suppressMapOpenBlock: true
    });

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

    // Определите стили карты, проверяя их доступность
    const availableMapStyles = {
        standard: 'yandex#map',
        hybrid: 'yandex#hybrid'
    };


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


}).catch(console.error)