import express from 'express'
import bodyParser from 'body-parser'
import bcrypt from 'bcryptjs'
import sqlite3 from 'sqlite3'
import path from 'path'
import session from 'express-session'
import moment from 'moment'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const db = new sqlite3.Database('./sqlite.db')

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(cors())
app.use(bodyParser.json({ limit: '50mb' })) // Увеличение лимита до 50MB для JSON
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })) // Увеличение лимита до 50MB для URL-encoded данных
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/src', express.static(path.join(__dirname, 'src')))
app.use('/geojson', express.static(path.join(__dirname, 'geojson')))
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
	secret: 'your_secret_key', resave: false, saveUninitialized: true, cookie: { secure: false }
}))


db.serialize(() => {
	db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          email TEXT UNIQUE,
          password TEXT
        )
    `)

	db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          username TEXT,
          session_id TEXT,
          created_at TEXT,
          expires_at TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id)
        )
    `)

	db.run(`
        CREATE TABLE IF NOT EXISTS lines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT,
          coordinates TEXT,
          work_type TEXT,
          comment TEXT,
          line_color TEXT,
          type TEXT,
          created_at TEXT,
          completed BOOLEAN DEFAULT 0,
          work_address TEXT,
          work_volume TEXT,
          start_date TEXT,
          end_date TEXT,
          equipment TEXT,
          equipment_count INTEGER,
          distance TEXT,
          in_progress BOOLEAN DEFAULT 0,
          photo TEXT,
          FOREIGN KEY(username) REFERENCES users(username)
        )
    `)
	db.run(`
        CREATE TABLE IF NOT EXISTS appeals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            num INTEGER,
            date DATE,
            card_number TEXT,
            settlement TEXT,
            address TEXT,
            coordinates TEXT,
            topic TEXT,
            measures TEXT,
            status TEXT,
            source TEXT,
            employee TEXT,
            deadline DATE
        )
    `)
})

function getLineColor(workType) {
	switch (workType) {
		case 'Гос. задание':
			return '#FF0000'
		case 'Коммерция':
			return '#ce31ff'
		default:
			return '#000000'
	}
}

app.use((req, res, next) => {
	res.locals.message = req.session.message
	delete req.session.message
	next()
})

// Маршрут страницы логина
app.get('/login', (req, res) => {
	res.render('login')
})

// Маршрут страницы регистрации
app.get('/register', (req, res) => {
	res.render('register')
})

function checkAuth(req, res, next) {
	if (req.session.user) {
		const sessionId = req.sessionID
		db.get('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?', [sessionId, moment().format('YYYY-MM-DD HH:mm:ss')], (err, row) => {
			if (err) {
				console.error('Ошибка проверки сессии:', err)
				req.session.message = { type: 'danger', text: 'Ошибка проверки сессии: ' + err.message }
				res.redirect('/login')
			} else if (!row) {
				req.session.message = { type: 'danger', text: 'Сессия истекла, пожалуйста, войдите снова.' }
				res.redirect('/login')
			} else {
				next()
			}
		})
	} else {
		req.session.message = { type: 'danger', text: 'Необходимо авторизоваться для доступа к этой странице' }
		res.redirect('/login')
	}
}

// Проверка доступа для всех маршрутов, кроме страниц авторизации
app.use((req, res, next) => {
	const publicPaths = ['/login', '/register', '/']
	if (!publicPaths.includes(req.path)) {
		checkAuth(req, res, next)
	} else {
		next()
	}
})

// Рендеринг различных страниц
app.get('/', (req, res) => {
	if (req.session.user) {
		res.redirect('/dashboard')
	} else {
		res.redirect('/login')
	}
})

app.get('/dashboard', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('dashboard', { username })
})

app.get('/opashka-map', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('opashka-map', { username })
})

app.get('/appeals-map', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('appeals-map', { username })
})

app.get('/appeals-journal', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('appeals-journal', { username })
})

app.get('/profile', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('profile', { username })
})

app.get('/settings', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('settings', { username })
})

app.get('/documents', (req, res) => {
	const username = req.session.user ? req.session.user.username : ''
	res.render('documents', { username })
})

// Логаут пользователя
app.get('/logout', (req, res) => {
	const sessionId = req.sessionID
	db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
		if (err) {
			console.error('Ошибка удаления сессии:', err)
		}
		req.session.destroy()
		res.redirect('/login')
	})
})

// Регистрация пользователя
app.post('/register', (req, res) => {
	const { username, email, password } = req.body
	const hashedPassword = bcrypt.hashSync(password, 8)

	db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
		if (row) {
			req.session.message = { type: 'danger', text: 'Пользователь с таким email уже существует.' }
			return res.redirect('/register')
		}

		db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err) => {
			if (err) {
				console.error('Ошибка регистрации:', err)
				req.session.message = { type: 'danger', text: 'Ошибка регистрации: ' + err.message }
				return res.redirect('/register')
			}
			req.session.message = { type: 'success', text: 'Регистрация успешна. Теперь вы можете войти.' }
			res.redirect('/login')
		})
	})
})

// Авторизация пользователя
app.post('/login', (req, res) => {
	const { identifier, password } = req.body

	db.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier], (err, row) => {
		if (err) {
			console.error('Ошибка авторизации:', err)
			req.session.message = { type: 'danger', text: 'Ошибка авторизации: ' + err.message }
			return res.redirect('/login')
		}
		if (!row) {
			req.session.message = { type: 'danger', text: 'Неверный email/логин или пароль' }
			return res.redirect('/login')
		}
		if (!bcrypt.compareSync(password, row.password)) {
			req.session.message = { type: 'danger', text: 'Неверный email/логин или пароль' }
			return res.redirect('/login')
		}

		const sessionId = req.sessionID
		const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
		const expiresAt = moment().add(3, 'hours').format('YYYY-MM-DD HH:mm:ss')

		db.run('INSERT INTO sessions (user_id, username, session_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [row.id, row.username, sessionId, createdAt, expiresAt], (err) => {
			if (err) {
				console.error('Ошибка создания сессии:', err)
				req.session.message = { type: 'danger', text: 'Ошибка создания сессии: ' + err.message }
				return res.redirect('/login')
			}

			req.session.user = { id: row.id, username: row.username }
			req.session.message = { type: 'success', text: 'Вход выполнен успешно.' }
			res.redirect('/dashboard')
		})
	})
})

// Сохранение линии
app.post('/save-line', (req, res) => {
	const {
		objects,
		workType,
		comment,
		workAddress,
		workVolume,
		startDate,
		endDate,
		equipment,
		equipmentCount,
		distance
	} = req.body
	const username = req.session.user.username
	const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
	const lineColor = getLineColor(workType)

	const stmt = db.prepare('INSERT INTO lines (username, coordinates, work_type, comment, line_color, type, created_at, work_address, work_volume, start_date, end_date, equipment, equipment_count, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')

	objects.forEach(obj => {
		stmt.run(username, JSON.stringify(obj.coordinates), workType, comment, lineColor, obj.type, createdAt, workAddress, workVolume, startDate, endDate, equipment, equipmentCount, distance)
	})

	stmt.finalize((err) => {
		if (err) {
			console.error('Ошибка сохранения объектов:', err)
			return res.json({ success: false, message: 'Ошибка сохранения объектов: ' + err.message })
		}
		res.json({ success: true, message: 'Объекты успешно сохранены.' })
	})
})

// Получение линий
app.get('/get-lines', (req, res) => {
	const { workTypes, district } = req.query

	let query = 'SELECT * FROM lines'
	let params = []

	if (workTypes && workTypes !== 'all') {
		const typesArray = workTypes.split(',')
		const placeholders = typesArray.map(() => '?').join(',')
		query += ` WHERE work_type IN (${placeholders})`
		params = typesArray
	}

	if (district) {
		query += params.length ? ' AND' : ' WHERE'
		query += ' LOWER(work_address) = LOWER(?)'
		params.push(district)
	}

	db.all(query, params, (err, rows) => {
		if (err) {
			console.error('Ошибка получения линий:', err)
			return res.json({ success: false, message: 'Ошибка получения линий: ' + err.message })
		}
		res.json({ success: true, lines: rows })
	})
})

app.post('/update-line', (req, res) => {
	const {
		id,
		workType,
		comment,
		coordinates,
		lineColor,
		type,
		completed,
		inProgress,
		startDate, // Дата начала работы из запроса
		endDate,
		equipment,
		equipmentCount
	} = req.body

	// Получаем текущую дату начала из базы данных, если она уже есть
	db.get(`SELECT start_date FROM lines WHERE id = ?`, [id], (err, row) => {
		if (err) {
			console.error('Ошибка получения текущей даты начала:', err)
			return res.json({ success: false, message: 'Ошибка получения текущей даты начала: ' + err.message })
		}

		// Если дата начала уже существует, сохраняем её, иначе используем новую дату
		const finalStartDate = row && row.start_date ? row.start_date : startDate

		// Обновляем объект, включая неизменную дату начала, если она уже была сохранена
		const query = `
            UPDATE lines
            SET work_type = ?, comment = ?, coordinates = ?, line_color = ?, type = ?, completed = ?, in_progress = ?, start_date = ?, end_date = ?, equipment = ?, equipment_count = ?
            WHERE id = ?
        `
		const params = [workType, comment, coordinates, lineColor, type, completed, inProgress, finalStartDate, endDate, equipment, equipmentCount, id]

		db.run(query, params, function(err) {
			if (err) {
				console.error('Ошибка обновления объекта:', err)
				return res.json({ success: false, message: 'Ошибка обновления объекта: ' + err.message })
			}
			res.json({ success: true, message: 'Объект успешно обновлен.' })
		})
	})
})

// Удаление линии
app.post('/delete-line', (req, res) => {
	const { id } = req.body

	const query = 'DELETE FROM lines WHERE id = ?'
	const params = [id]

	db.run(query, params, function(err) {
		if (err) {
			console.error('Ошибка удаления объекта:', err)
			return res.json({ success: false, message: 'Ошибка удаления объекта: ' + err.message })
		}
		res.json({ success: true, message: 'Объект успешно удален.' })
	})
})

// Создаем директорию для хранения фотографий, если она не существует
if (!fs.existsSync('./uploads')) {
	fs.mkdirSync('./uploads')
}

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, './uploads')
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
		cb(null, `${req.body.objectId}-${uniqueSuffix}-${file.originalname}`)
	}
})

const upload = multer({ storage: storage })

// Маршрут для загрузки фотографий
app.post('/upload-photo', upload.single('photo'), (req, res) => {
	const { objectId } = req.body

	if (!objectId || !req.file) {
		return res.json({ success: false, message: 'Объект не найден или файл не загружен.' })
	}

	const photoPath = `/uploads/${req.file.filename}`  // путь к файлу

	db.run('UPDATE lines SET photo = ? WHERE id = ?', [photoPath, objectId], (err) => {
		if (err) {
			console.error('Ошибка при обновлении фото для объекта:', err)
			return res.json({ success: false, message: 'Ошибка при обновлении фото: ' + err.message })
		}
		res.json({ success: true, message: 'Фото успешно загружено и привязано к объекту.', photoPath })
	})
})

app.post('/delete-photo', (req, res) => {
	const { objectId } = req.body

	if (!objectId) {
		return res.json({ success: false, message: 'Объект не найден.' })
	}

	// Получаем текущий путь к фото из базы данных
	db.get('SELECT photo FROM lines WHERE id = ?', [objectId], (err, row) => {
		if (err) {
			console.error('Ошибка при получении пути к фото:', err)
			return res.json({ success: false, message: 'Ошибка при получении пути к фото.' })
		}

		if (row && row.photo) {
			const photoPath = path.join(__dirname, row.photo)

			// Удаляем фото файл, если он существует
			fs.unlink(photoPath, (err) => {
				if (err) {
					console.error('Ошибка при удалении файла фото:', err)
					return res.json({ success: false, message: 'Ошибка при удалении файла фото.' })
				}

				// Обновляем базу данных, удаляя путь к фото
				db.run('UPDATE lines SET photo = NULL WHERE id = ?', [objectId], (err) => {
					if (err) {
						console.error('Ошибка при обновлении записи в базе данных:', err)
						return res.json({ success: false, message: 'Ошибка при обновлении записи в базе данных.' })
					}
					res.json({ success: true, message: 'Фото успешно удалено.' })
				})
			})
		} else {
			res.json({ success: false, message: 'Фото для удаления не найдено.' })
		}
	})
})

app.get('/lines-statistics', (req, res) => {
	const statsQuery = `
        SELECT 
            SUM(in_progress = 1) AS inProgressCount,
            SUM(completed = 1) AS completedCount,
            SUM(in_progress = 0 AND completed = 0) AS remainingCount
        FROM lines;
    `

	db.get(statsQuery, [], (err, row) => {
		if (err) {
			console.error('Ошибка подсчета объектов:', err)
			return res.json({ success: false, message: 'Ошибка подсчета объектов' })
		}
		res.json({
			success: true,
			inProgress: row.inProgressCount,
			completed: row.completedCount,
			remaining: row.remainingCount
		})
	})
})

// Маршрут для фильтрации по району
app.get('/filter-district', (req, res) => {
	const { district } = req.query

	if (!district) {
		return res.status(400).json({ success: false, message: 'Не указан район для фильтрации' })
	}

	// Фильтрация данных по work_address без учета регистра
	const query = `SELECT * FROM lines WHERE LOWER(work_address) = LOWER(?)`

	db.all(query, [district], (err, rows) => {
		if (err) {
			console.error('Ошибка фильтрации данных:', err)
			return res.status(500).json({ success: false, message: 'Ошибка при выполнении запроса' })
		}

		res.json({ success: true, data: rows })
	})
})

// Исправлен маршрут для сохранения данных с проверкой дат и добавлением сортировки
app.post('/save-table-data', (req, res) => {
	const { data } = req.body

	const stmt = db.prepare(`
        INSERT INTO appeals 
        (num, date, card_number, settlement, address, coordinates, topic, measures, status, source, employee, deadline) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

	data.forEach(row => {
		const excelDateToJSDate = (excelDate) => {
			const date = new Date(0)
			date.setUTCDate(excelDate - 25567)
			return date.toISOString().split('T')[0]
		}

		const formattedDate = !isNaN(row[1]) && typeof row[1] === 'number'
			? excelDateToJSDate(row[1])
			: row[1]

		if (formattedDate && row.every(cell => cell !== null && cell !== undefined && cell !== '')) {
			stmt.run(row[0], formattedDate, row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11])
		}
	})

	stmt.finalize((err) => {
		if (err) {
			console.error('Ошибка сохранения данных:', err)
			return res.status(500).json({ success: false, message: 'Ошибка сохранения данных' })
		}
		res.json({ success: true, message: 'Данные успешно сохранены.' })
	})
})

app.get('/get-appeals-part', (req, res) => {
	const offset = parseInt(req.query.offset) || 0
	const limit = parseInt(req.query.limit) || 20

	const sqlQuery = `
        SELECT * FROM appeals
        ORDER BY CAST(num AS INTEGER) DESC
        LIMIT ? OFFSET ?
    `

	db.all(sqlQuery, [limit, offset], (err, rows) => {
		if (err) {
			console.error('Ошибка загрузки данных:', err)
			return res.status(500).json({ success: false, message: 'Ошибка загрузки данных' })
		}

		res.json({ success: true, data: rows })
	})
})


app.post('/update-appeal', (req, res) => {
	const {
		num,
		date,
		card_number,
		settlement,
		address,
		coordinates,
		topic,
		measures,
		status,
		source,
		employee,
		deadline
	} = req.body

	const query = `
        UPDATE appeals
        SET date = ?, card_number = ?, settlement = ?, address = ?, coordinates = ?, topic = ?, measures = ?, status = ?, source = ?, employee = ?, deadline = ?
        WHERE num = ?
    `

	db.run(
		query,
		[date, card_number, settlement, address, coordinates, topic, measures, status, source, employee, deadline, num],
		function(err) {
			if (err) {
				console.error('Ошибка обновления данных:', err)
				return res.json({ success: false, message: 'Ошибка обновления данных' })
			}
			res.json({ success: true, message: 'Данные успешно обновлены' })
		}
	)
})

app.get('/get-next-appeal-number', (req, res) => {
	const query = `SELECT MAX(num) AS maxNum FROM appeals`

	db.get(query, [], (err, row) => {
		if (err) {
			console.error('Ошибка получения последнего номера обращения:', err)
			return res.json({ success: false, message: 'Ошибка получения последнего номера обращения' })
		}

		const nextNum = row && row.maxNum ? row.maxNum + 1 : 1
		res.json({ success: true, nextNum })
	})
})


app.post('/add-appeal', (req, res) => {
	const {
		num,
		date,
		card_number,
		settlement,
		address,
		coordinates,
		topic,
		measures,
		status,
		source,
		employee,
		deadline
	} = req.body

	const query = `
        INSERT INTO appeals (num, date, card_number, settlement, address, coordinates, topic, measures, status, source, employee, deadline)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `

	db.run(query, [num, date, card_number, settlement, address, coordinates, topic, measures, status, source, employee], function(err) {
		if (err) {
			console.error('Ошибка добавления нового обращения:', err)
			return res.json({ success: false, message: 'Ошибка добавления нового обращения' })
		}

		res.json({ success: true, message: 'Новое обращение успешно добавлено' })
	})
})

app.post('/delete-appeal', (req, res) => {
	const { num } = req.body

	if (!num) {
		return res.status(400).json({ success: false, message: 'Номер обращения отсутствует.' })
	}

	const query = `DELETE FROM appeals WHERE num = ?`

	db.run(query, [num], function(err) {
		if (err) {
			console.error('Ошибка удаления обращения:', err)
			return res.status(500).json({ success: false, message: 'Ошибка удаления обращения' })
		}

		if (this.changes === 0) {
			return res.status(404).json({ success: false, message: 'Обращение не найдено.' })
		}

		res.json({ success: true, message: 'Обращение успешно удалено' })
	})
})

app.get('/search-appeals', (req, res) => {
	const query = req.query.query || '';
	const column = req.query.column || 'num';
	const offset = parseInt(req.query.offset, 10) || 0;
	const limit = parseInt(req.query.limit, 10) || 20;

	// Разрешенные столбцы для поиска
	const validColumns = ['num', 'date', 'card_number', 'settlement', 'address', 'coordinates', 'topic', 'measures', 'status', 'source', 'employee', 'deadline'];
	if (!validColumns.includes(column)) {
		return res.status(400).json({ success: false, message: 'Неверный столбец для поиска' });
	}

	let sqlQuery;
	let params;

	if (column === 'num') {
		// Если поиск по столбцу num, выполняем точный поиск
		sqlQuery = `
            SELECT * FROM appeals
            WHERE ${column} = ?
            ORDER BY num DESC
            LIMIT ? OFFSET ?`;
		params = [query, limit, offset];
	} else {
		// Поиск с использованием LIKE для других столбцов
		sqlQuery = `
            SELECT * FROM appeals
            WHERE LOWER(${column}) LIKE LOWER(?)
            ORDER BY num DESC
            LIMIT ? OFFSET ?`;
		params = [`%${query}%`, limit, offset];
	}

	db.all(sqlQuery, params, (err, rows) => {
		if (err) {
			console.error('Ошибка поиска:', err);
			return res.status(500).json({ success: false, message: 'Ошибка поиска данных' });
		}

		// Подсчет общего количества строк
		let countQuery;
		let countParams;

		if (column === 'num') {
			countQuery = `
                SELECT COUNT(*) as total FROM appeals
                WHERE ${column} = ?`;
			countParams = [query];
		} else {
			countQuery = `
                SELECT COUNT(*) as total FROM appeals
                WHERE LOWER(${column}) LIKE LOWER(?)`;
			countParams = [`%${query}%`];
		}

		db.get(countQuery, countParams, (countErr, countResult) => {
			if (countErr) {
				console.error('Ошибка подсчета:', countErr);
				return res.status(500).json({ success: false, message: 'Ошибка подсчета данных' });
			}

			res.json({ success: true, data: rows, total: countResult.total });
		});
	});
});


app.get('/get-appeals', (req, res) => {
	const query = 'SELECT * FROM appeals'
	const countQuery = 'SELECT COUNT(*) as total FROM appeals'
	const completedQuery = 'SELECT COUNT(*) as completed FROM appeals WHERE status IN (\'Опубликован\', \'Перенаправлен Арбитру\', \'На утверждении\')';
	const inProgressQuery = 'SELECT COUNT(*) as inProgress FROM appeals WHERE status NOT IN (\'Опубликован\', \'Перенаправлен Арбитру\', \'На утверждении\')';

	db.all(query, [], (err, rows) => {
		if (err) {
			console.error('Ошибка получения обращений:', err)
			return res.json({ success: false, message: 'Ошибка получения обращений' })
		}

		db.get(countQuery, [], (err, countResult) => {
			if (err) {
				console.error('Ошибка подсчета всех обращений:', err)
				return res.json({ success: false, message: 'Ошибка подсчета всех обращений' })
			}

			db.get(completedQuery, [], (err, completedResult) => {
				if (err) {
					console.error('Ошибка подсчета выполненных обращений:', err)
					return res.json({ success: false, message: 'Ошибка подсчета выполненных обращений' })
				}

				db.get(inProgressQuery, [], (err, inProgressResult) => {
					if (err) {
						console.error('Ошибка подсчета обращений в работе:', err)
						return res.json({ success: false, message: 'Ошибка подсчета обращений в работе' })
					}

					// Проверяем, есть ли данные
					if (!rows || rows.length === 0) {
						return res.json({
							success: true,
							appeals: [],
							total: 0,
							completed: 0,
							inProgress: 0
						})
					}

					const appeals = rows.map(row => ({
						id: row.id,
						num: row.num,
						date: row.date,
						card_number: row.card_number,
						settlement: row.settlement,
						address: row.address,
						coordinates: row.coordinates,
						topic: row.topic,
						measures: row.measures,
						status: row.status,
						source: row.source,
						employee: row.employee,
						deadline: row.deadline
					}))

					res.json({
						success: true,
						appeals,
						total: countResult.total,
						completed: completedResult.completed,
						inProgress: inProgressResult.inProgress
					})
				})
			})
		})
	})
})

app.get('/filter-appeals', (req, res) => {
	const { startDate, endDate, status, districts } = req.query;

	// Базовый запрос
	let query = 'SELECT * FROM appeals WHERE 1=1';
	const params = [];

	if (startDate && endDate) {
		query += ' AND date BETWEEN ? AND ?';
		params.push(startDate, endDate);
	}

	if (status) {
		query += ' AND status = ?';
		params.push(status);
	}

	if (districts) {
		const districtsArray = districts.split(',');
		query += ` AND district IN (${districtsArray.map(() => '?').join(',')})`;
		params.push(...districtsArray);
	}

	db.all(query, params, (err, rows) => {
		if (err) {
			console.error('Ошибка фильтрации данных:', err);
			return res.status(500).json({ success: false, message: 'Ошибка при выполнении запроса' });
		}

		res.json({ success: true, appeals: rows }); // Возвращаем поле `appeals`, как ожидает клиент
	});
});

app.get('/latest-appeals', (req, res) => {
	const limit = 5 // Количество записей для возврата
	const query = `
        SELECT num, date, card_number, settlement, coordinates, topic, address, status, source, employee, deadline 
        FROM appeals 
        ORDER BY CAST(num AS INTEGER) DESC 
        LIMIT ?
    `

	db.all(query, [limit], (err, rows) => {
		if (err) {
			console.error('Ошибка получения последних обращений:', err)
			return res.json({ success: false, message: 'Ошибка получения обращений' })
		}

		res.json({ success: true, appeals: rows })
	})
})

app.get('/chart-data', (req, res) => {
	const startDate = '2024-10-01'
	const endDate = '2024-12-31'

	const monthlyQuery = `
        SELECT date, COUNT(*) AS count
        FROM appeals
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date ASC
    `

	const settlementsQuery = `
        SELECT settlement, COUNT(*) AS count
        FROM appeals
        GROUP BY settlement
        ORDER BY count DESC
    `

	db.all(monthlyQuery, [startDate, endDate], (err, rows) => {
		if (err) {
			console.error('Ошибка получения данных по датам:', err)
			return res.status(500).json({ success: false, message: 'Ошибка получения данных по датам' })
		}

		db.all(settlementsQuery, [], (errSettlements, settlementRows) => {
			if (errSettlements) {
				console.error('Ошибка получения данных по поселениям:', errSettlements)
				return res.status(500).json({ success: false, message: 'Ошибка получения данных по поселениям' })
			}

			// Разделение данных по месяцам
			const splitByMonth = (rows, month) => {
				return rows.filter(row => new Date(row.date).getMonth() + 1 === month)
			}

			const formatData = (rows) => {
				return {
					labels: rows.map(row => `${new Date(row.date).getDate()}`), // Только дни
					counts: rows.map(row => row.count)
				}
			}

			const octoberData = formatData(splitByMonth(rows, 10))
			const novemberData = formatData(splitByMonth(rows, 11))
			const decemberData = formatData(splitByMonth(rows, 12))

			res.json({
				success: true,
				october: octoberData,
				november: novemberData,
				december: decemberData,
				settlements: {
					labels: settlementRows.map(row => row.settlement),
					counts: settlementRows.map(row => row.count)
				}
			})
		})
	})
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`)
})
