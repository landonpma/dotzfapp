document.addEventListener('DOMContentLoaded', function() {
	// Измененный код для получения данных о погоде с WeatherAPI
	const apiKey = 'c3b8e4b28c55454da3e113557240410'; // Вставьте сюда ваш API ключ WeatherAPI
	const city = 'Moscow'; // Можно заменить на любой другой город
	const weatherUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&lang=ru`;

	// Функция для получения данных о погоде
	fetch(weatherUrl)
		.then(response => {
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			return response.json();
		})
		.then(data => {
			// Проверяем, что все необходимые данные присутствуют в ответе
			if (data.current) {
				const temperature = document.getElementById('temperature');
				const weatherIcon = document.getElementById('weather-icon');
				const windSpeed = document.getElementById('wind-speed');
				const humidity = document.getElementById('humidity');

				temperature.textContent = `${Math.round(data.current.temp_c)}°C`;
				weatherIcon.src = data.current.condition.icon;
				windSpeed.textContent = `${(data.current.wind_kph / 3.6).toFixed(0)} м/с`; // Преобразование км/ч в м/с и округление до сотых
				humidity.textContent = `${data.current.humidity}%`;
			} else {
				console.error('Incomplete weather data received:', data);
			}
		})
		.catch(error => console.error('Error fetching weather data:', error));

	// Новый код для загрузки данных текущих событий
	const eventsUrl = 'api/current-events'; // URL нашего нового API
	const eventsTableBody = document.getElementById('events-table-body');
	const prevPageButton = document.querySelector('.pagination .prev-page');
	const nextPageButton = document.querySelector('.pagination .next-page');
	const pageInfo = document.querySelector('.pagination .page-info');

	let currentPage = 1;
	const itemsPerPage = 5; // Количество элементов на страницу

	function fetchEvents(page) {
		fetch(`${eventsUrl}?page=${page}&limit=${itemsPerPage}`)
			.then(response => {
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				return response.json();
			})
			.then(data => {
				displayEvents(data.events);
				updatePagination(data.totalPages);
			})
			.catch(error => console.error('Error fetching current events data:', error));
	}

	function displayEvents(events) {
		eventsTableBody.innerHTML = '';
		events.forEach(event => {
			const eventRow = document.createElement('tr');
			eventRow.innerHTML = `
                <td>${event.username}</td>
                <td>${event.work_type}</td>
                <td>${event.comment}</td>
                <td>${event.work_volume}</td>
                <td>${event.created_at}</td>
            `;
			eventsTableBody.appendChild(eventRow);
		});
	}

	function updatePagination(totalPages) {
		pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
		prevPageButton.disabled = currentPage === 1;
		nextPageButton.disabled = currentPage === totalPages;
	}

	prevPageButton.addEventListener('click', () => {
		if (currentPage > 1) {
			currentPage--;
			fetchEvents(currentPage);
		}
	});

	nextPageButton.addEventListener('click', () => {
		currentPage++;
		fetchEvents(currentPage);
	});

	// Изначальная загрузка данных
	fetchEvents(currentPage);

	// Новый код для загрузки динамических новостей
	const newsApiKey = '782f8d56c0d442f2982fdd4f9ca3c14e'; // Вставьте сюда ваш API ключ для NewsAPI
	const newsUrl = `https://newsapi.org/v2/top-headlines?country=ru&category=general&apiKey=${newsApiKey}`;
	let newsData = [];
	let currentNewsIndex = 0;

	fetchNews();
	setInterval(showNextNews, 6000); // Обновление новостей каждые 6 секунд
	setInterval(fetchNews, 300000); // Обновление данных с API каждые 5 минут

	function fetchNews() {
		fetch(newsUrl)
			.then(response => response.json())
			.then(data => {
				if (data.articles && Array.isArray(data.articles)) {
					newsData = data.articles;
					currentNewsIndex = 0;
					showNextNews();
				} else {
					console.error('No articles found in the response');
				}
			})
			.catch(error => {
				console.error('Error fetching news:', error);
			});
	}

	function showNextNews() {
		if (newsData.length === 0) return;

		const eventsContainer = document.getElementById('events-container');
		const oldEventItem = eventsContainer.querySelector('.event-item');

		if (oldEventItem) {
			oldEventItem.classList.remove('active');
			oldEventItem.classList.add('fade-out');
			setTimeout(() => {
				eventsContainer.removeChild(oldEventItem);
				displayNewsItem();
			}, 1000); // Синхронизация с CSS transition
		} else {
			displayNewsItem();
		}
	}

	function displayNewsItem() {
		const article = newsData[currentNewsIndex];
		const eventItem = document.createElement('div');
		eventItem.className = 'event-item active';

		const eventImage = document.createElement('img');
		eventImage.src = getNewsIcon(article); // Используйте функцию для получения иконки
		eventImage.alt = article.title;

		const eventDescription = document.createElement('p');
		eventDescription.textContent = article.description || article.title; // Используйте описание или заголовок статьи

		const arrowLink = document.createElement('a');
		arrowLink.href = article.url;
		arrowLink.target = '_blank'; // Открывать в новой вкладке
		arrowLink.className = 'arrow-link';

		eventItem.appendChild(eventImage);
		eventItem.appendChild(eventDescription);
		eventItem.appendChild(arrowLink);
		document.getElementById('events-container').appendChild(eventItem);

		currentNewsIndex = (currentNewsIndex + 1) % newsData.length; // Переход к следующей новости, зацикливание
	}

	function getNewsIcon(article) {
		if (article.urlToImage) {
			return article.urlToImage;
		} else {
			// Пример иконок в зависимости от типа новости
			const description = article.description || '';
			const title = article.title || '';

			if (description.includes('спорт') || title.includes('спорт')) {
				return 'icons/sport.png';
			} else if (description.includes('политика', 'Politico') || title.includes('политика')) {
				return 'icons/politics.png';
			} else if (description.includes('погода') || title.includes('погода')) {
				return 'icons/cloud_moon_rain.svg';
			} else if (description.includes('бизнес') || title.includes('бизнес')) {
				return 'icons/business.png';
			} else if (description.includes('технологии') || title.includes('технологии')) {
				return 'icons/technology.png';
			} else if (description.includes('развлечения') || title.includes('развлечения')) {
				return 'icons/entertainment.png';
			} else if (description.includes('здоровье') || title.includes('здоровье')) {
				return 'icons/health.png';
			} else {
				return 'icons/news.webp';
			}
		}
	}
});
