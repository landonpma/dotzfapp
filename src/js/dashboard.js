document.addEventListener('DOMContentLoaded', function() {
	// Измененный код для получения данных о погоде с WeatherAPI
	const apiKey = 'c3b8e4b28c55454da3e113557240410' // Вставьте сюда ваш API ключ WeatherAPI
	const city = 'Moscow' // Можно заменить на любой другой город
	const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&lang=ru`

	// Функция для получения данных о погоде
	fetch(weatherUrl)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`)
			}
			return response.json()
		})
		.then(data => {
			// Проверяем, что все необходимые данные присутствуют в ответе
			if (data.current) {
				const temperature = document.getElementById('temperature')
				const weatherIcon = document.getElementById('weather-icon')
				const windSpeed = document.getElementById('wind-speed')
				const humidity = document.getElementById('humidity')

				temperature.textContent = `${Math.round(data.current.temp_c)}°C`
				weatherIcon.src = data.current.condition.icon
				windSpeed.textContent = `${(data.current.wind_kph / 3.6).toFixed(0)} м/с` // Преобразование км/ч в м/с и округление до сотых
				humidity.textContent = `${data.current.humidity}%`
			} else {
				console.error('Incomplete weather data received:', data)
			}
		})
		.catch(error => console.error('Error fetching weather data:', error))

})

document.addEventListener('DOMContentLoaded', function() {
	const eventsContainer = document.getElementById('events-container')

	// Функция для получения последних обращений
	function fetchLatestAppeals() {
		fetch('/latest-appeals') // Новый маршрут для получения последних 5 обращений
			.then(response => response.json())
			.then(data => {
				if (data.success) {
					renderEvents(data.appeals)
				} else {
					console.error('Ошибка получения данных:', data.message)
				}
			})
			.catch(error => console.error('Ошибка загрузки обращений:', error))
	}

	// Функция для рендера событий
	function renderEvents(appeals) {
		eventsContainer.innerHTML = '' // Очистить контейнер перед обновлением
		appeals.forEach(appeal => {
			const eventElement = document.createElement('div')
			eventElement.classList.add('event')
			eventElement.innerHTML = `
    		<p style="margin: 0;"><strong>Номер заявления:</strong> ${appeal.num}</p>
    		<p style="margin: 0;"><strong>Поселение:</strong> ${appeal.settlement}</p>
    		<p style="margin: 0;"><strong>Ответственный:</strong> ${appeal.employee}</p>
    		<p style="margin: 0;"><strong>Статус:</strong> ${appeal.status}</p>
			`
			eventsContainer.appendChild(eventElement)
		})

		// Запустить цикл ротации событий
		startEventRotation()
	}

	let currentIndex = 0

	// Функция для циклической ротации событий
	function startEventRotation() {
		const events = eventsContainer.children
		if (events.length > 1) {
			Array.from(events).forEach(event => event.style.display = 'none') // Скрыть все события
			events[currentIndex].style.display = 'block' // Показать текущее событие

			setInterval(() => {
				events[currentIndex].style.display = 'none' // Скрыть текущее событие
				currentIndex = (currentIndex + 1) % events.length // Перейти к следующему
				events[currentIndex].style.display = 'block' // Показать следующее событие
			}, 3000) // Интервал смены событий — 3 секунды
		} else if (events.length === 1) {
			events[0].style.display = 'block' // Если одно событие, показать его
		}
	}

	// Загрузить данные при старте
	fetchLatestAppeals()
})

document.addEventListener('DOMContentLoaded', () => {
	let multiMonthChart, settlementsChart

	// Рендеринг наложенного графика для нескольких месяцев
	const renderMultiMonthChart = (january, february, march, april) => {
		const combinedLabels = Array.from(new Set([...january.labels, ...february.labels, ...march.labels, ...april.labels])).sort((a, b) => a - b);

		const syncData = (data, combinedLabels) => {
			return combinedLabels.map(label => {
				const index = data.labels.indexOf(label);
				return index !== -1 ? data.counts[index] : 0;
			});
		};

		const dataJanuary = syncData(january, combinedLabels);
		const dataFebruary = syncData(february, combinedLabels);
		const dataMarch = syncData(march, combinedLabels);
		const dataApril = syncData(april, combinedLabels);

		const ctx = document.getElementById('multiMonthChart').getContext('2d');
		multiMonthChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: combinedLabels,
				datasets: [
					{
						label: 'Январь',
						data: dataJanuary,
						borderColor: '#007bff',
						tension: 0.3,
						hidden: true,
					},
					{
						label: 'Февраль',
						data: dataFebruary,
						borderColor: '#28a745',
						tension: 0.3,
						hidden: true,
					},
					{
						label: 'Март',
						data: dataMarch,
						borderColor: '#ffc107',
						tension: 0.3,
						hidden: false,
					},
					// {
					// 	label: 'Апрель',
					// 	data: dataApril,
					// 	borderColor: '#e607ff',
					// 	tension: 0.3,
					// 	hidden: true,
					// },
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
					},
					tooltip: {
						enabled: true,
						callbacks: {
							title: (tooltipItems) => {
								return `День месяца: ${tooltipItems[0].label}`;
							},
							label: (tooltipItem) => {
								return `Количество обращений: ${tooltipItem.raw}`;
							},
						},
					},
				},
				scales: {
					x: {
						title: {
							display: true,
							text: 'Дни месяца (1 квартал 2025 г.)',
						},
						grid: {
							display: true,
						},

					},
					y: {
						title: {
							display: true,
							text: 'Количество обращений',
						},
						beginAtZero: true,
						grid: {
							color: 'rgba(200, 200, 200, 0.2)', // Добавляем лёгкий фон сетки
						},

					},
				},
			},
		});
	};


	// Рендеринг графика по поселениям
	const renderSettlementsChart = (labels, counts) => {
		const ctx = document.getElementById('settlementsChart').getContext('2d')
		settlementsChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels,
				datasets: [{
					label: 'Обращения по поселениям',
					data: counts,
					backgroundColor: '#28a745',
					borderColor: '#28a745',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top'
					},
					tooltip: {
						enabled: true
					}
				},
				scales: {
					x: {
						title: {
							display: true,
							text: 'Поселение'
						}
					},
					y: {
						title: {
							display: true,
							text: 'Количество обращений'
						},
						beginAtZero: true
					}
				}
			}
		})
	}

	// Запрос данных и рендеринг графиков
	fetch('/chart-data')
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				const january = data.january
				const february = data.february
				const march = data.march
				const april = data.april

				// Рендерим график по месяцам (по умолчанию)
				renderMultiMonthChart(january, february, march, april)

				// Рендерим график по поселениям при переключении вкладки
				document.getElementById('by-settlement-tab').addEventListener('click', () => {
					if (!settlementsChart) {
						renderSettlementsChart(data.settlements.labels, data.settlements.counts)
					}
				})
			} else {
				console.error('Ошибка загрузки данных:', data.message)
			}
		})
		.catch(err => console.error('Ошибка при запросе:', err))
})


document.addEventListener('DOMContentLoaded', () => {
	fetch('/get-appeals')
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				// Устанавливаем значение "Всего"
				const totalElement = document.getElementById('total-appeals')
				totalElement.textContent = data.total

				// Устанавливаем значение "Выполнено"
				const completedElement = document.getElementById('completed-appeals')
				completedElement.textContent = data.completed

				// Устанавливаем значение "В работе"
				const inProgressElement = document.getElementById('in-progress')
				inProgressElement.textContent = data.inProgress
			} else {
				console.error('Ошибка загрузки данных:', data.message)
			}
		})
		.catch(error => {
			console.error('Ошибка:', error)
		})
})

document.addEventListener('DOMContentLoaded', () => {
	fetch('/lines-statistics')
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				// Обновляем значения в блоке статистики
				const inProgressElement = document.querySelector('.statistic-value span:nth-child(2)');
				const completedElement = document.querySelector('.statistic-value:nth-child(2) span:nth-child(2)');
				const remainingElement = document.querySelector('.statistic-value:nth-child(3) span:nth-child(2)');

				if (inProgressElement) inProgressElement.textContent = data.inProgress;
				if (completedElement) completedElement.textContent = data.completed;
				if (remainingElement) remainingElement.textContent = data.remaining;
			} else {
				console.error('Ошибка загрузки статистики:', data.message);
			}
		})
		.catch(error => {
			console.error('Ошибка:', error);
		});
});