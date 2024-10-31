const express = require('express')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const sqlite3 = require('sqlite3').verbose()
const path = require('path')
const session = require('express-session')
const moment = require('moment')
const axios = require('axios');
const cors = require('cors');


const app = express()
const db = new sqlite3.Database('./sqlite.db')

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(cors());
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())
app.use('/geojson', express.static(path.join(__dirname, 'geojson')));
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
    secret: 'your_secret_key', resave: false, saveUninitialized: true, cookie: {secure: false}
}))


db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
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
      FOREIGN KEY(username) REFERENCES users(username)
    )
  `)
})

function getLineColor(workType) {
    switch (workType) {
        case 'Гос. задание':
            return '#FF0000' // Красный
        case 'Коммерция':
            return '#ce31ff' // Фиолетовый
        default:
            return '#000000' // Черный по умолчанию
    }
}

app.use((req, res, next) => {
    res.locals.message = req.session.message
    delete req.session.message
    next()
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.get('/register', (req, res) => {
    res.render('register')
})

function checkAuth(req, res, next) {
    if (req.session.user) {
        const sessionId = req.sessionID
        db.get('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?', [sessionId, moment().format('YYYY-MM-DD HH:mm:ss')], (err, row) => {
            if (err) {
                console.error('Ошибка проверки сессии:', err)
                req.session.message = {type: 'danger', text: 'Ошибка проверки сессии: ' + err.message}
                res.redirect('/login')
            } else if (!row) {
                req.session.message = {type: 'danger', text: 'Сессия истекла, пожалуйста, войдите снова.'}
                res.redirect('/login')
            } else {
                next()
            }
        })
    } else {
        req.session.message = {type: 'danger', text: 'Необходимо авторизоваться для доступа к этой странице'}
        res.redirect('/login')
    }
}

app.use((req, res, next) => {
    const publicPaths = ['/login', '/register', '/']
    if (!publicPaths.includes(req.path)) {
        checkAuth(req, res, next)
    } else {
        next()
    }
})

app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard')
    } else {
        res.redirect('/login')
    }
})

app.get('/dashboard', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('dashboard', {username})
})

app.get('/map', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('map', {username})
})

app.get('/requests', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('requests', {username})
})

app.get('/equipment', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('equipment', {username})
})

app.get('/assignments', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('assignments', {username})
})

app.get('/profile', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('profile', {username})
})

app.get('/settings', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('settings', {username})
})

app.get('/documents', (req, res) => {
    const username = req.session.user ? req.session.user.username : ''
    res.render('documents', {username})
})

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

app.post('/register', (req, res) => {
    const {username, email, password} = req.body
    const hashedPassword = bcrypt.hashSync(password, 8)

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (row) {
            req.session.message = {type: 'danger', text: 'Пользователь с таким email уже существует.'}
            return res.redirect('/register')
        }

        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err) => {
            if (err) {
                console.error('Ошибка регистрации:', err)
                req.session.message = {type: 'danger', text: 'Ошибка регистрации: ' + err.message}
                return res.redirect('/register')
            }
            req.session.message = {type: 'success', text: 'Регистрация успешна. Теперь вы можете войти.'}
            res.redirect('/login')
        })
    })
})

app.post('/login', (req, res) => {
    const {identifier, password} = req.body

    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier], (err, row) => {
        if (err) {
            console.error('Ошибка авторизации:', err)
            req.session.message = {type: 'danger', text: 'Ошибка авторизации: ' + err.message}
            return res.redirect('/login')
        }
        if (!row) {
            req.session.message = {type: 'danger', text: 'Неверный email/логин или пароль'}
            return res.redirect('/login')
        }
        if (!bcrypt.compareSync(password, row.password)) {
            req.session.message = {type: 'danger', text: 'Неверный email/логин или пароль'}
            return res.redirect('/login')
        }

        const sessionId = req.sessionID
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss')
        const expiresAt = moment().add(3, 'hours').format('YYYY-MM-DD HH:mm:ss')

        db.run('INSERT INTO sessions (user_id, username, session_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [row.id, row.username, sessionId, createdAt, expiresAt], (err) => {
            if (err) {
                console.error('Ошибка создания сессии:', err)
                req.session.message = {type: 'danger', text: 'Ошибка создания сессии: ' + err.message}
                return res.redirect('/login')
            }

            req.session.user = {id: row.id, username: row.username}
            req.session.message = {type: 'success', text: 'Вход выполнен успешно.'}
            res.redirect('/dashboard')
        })
    })
})


app.post('/save-line', (req, res) => {
    const {objects, workType, comment, workAddress, workVolume, startDate, endDate, equipment, equipmentCount, distance} = req.body;
    const username = req.session.user.username;
    const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
    const lineColor = getLineColor(workType);

    const stmt = db.prepare('INSERT INTO lines (username, coordinates, work_type, comment, line_color, type, created_at, work_address, work_volume, start_date, end_date, equipment, equipment_count, distance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    objects.forEach(obj => {
        stmt.run(username, JSON.stringify(obj.coordinates), workType, comment, lineColor, obj.type, createdAt, workAddress, workVolume, startDate, endDate, equipment, equipmentCount, distance);
    });

    stmt.finalize((err) => {
        if (err) {
            console.error('Ошибка сохранения объектов:', err);
            return res.json({success: false, message: 'Ошибка сохранения объектов: ' + err.message});
        }
        res.json({success: true, message: 'Объекты успешно сохранены.'});
    });
});


app.get('/get-lines', (req, res) => {
    const {workTypes} = req.query;

    let query = 'SELECT * FROM lines';
    let params = [];

    if (workTypes && workTypes !== 'all') {
        const typesArray = workTypes.split(',');
        const placeholders = typesArray.map(() => '?').join(',');
        query += ` WHERE work_type IN (${placeholders})`;
        params = typesArray;
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Ошибка получения линий:', err);
            return res.json({success: false, message: 'Ошибка получения линий: ' + err.message});
        }
        res.json({success: true, lines: rows});
    });
});

app.post('/update-line', (req, res) => {
    const {id, workType, comment, coordinates, lineColor, type, completed, startDate, endDate, equipment, equipmentCount} = req.body;

    const query = `
        UPDATE lines
        SET work_type = ?, comment = ?, coordinates = ?, line_color = ?, type = ?, completed = ?, start_date = ?, end_date = ?, equipment = ?, equipment_count = ?
        WHERE id = ?
    `;
    const params = [workType, comment, coordinates, lineColor, type, completed, startDate, endDate, equipment, equipmentCount, id];

    db.run(query, params, function (err) {
        if (err) {
            console.error('Ошибка обновления объекта:', err);
            return res.json({success: false, message: 'Ошибка обновления объекта: ' + err.message});
        }
        res.json({success: true, message: 'Объект успешно обновлен.'});
    });
});

app.post('/delete-line', (req, res) => {
    const {id} = req.body;

    const query = 'DELETE FROM lines WHERE id = ?';
    const params = [id];

    db.run(query, params, function (err) {
        if (err) {
            console.error('Ошибка удаления объекта:', err);
            return res.json({success: false, message: 'Ошибка удаления объекта: ' + err.message});
        }
        res.json({success: true, message: 'Объект успешно удален.'});
    });
});


app.get('/weather', async (req, res) => {
    try {
        const accessKey = '2f163b37-4ec5-42ea-86fa-f0d424c71329'; // Замените на ваш Yandex API-ключ
        const lat = 55.7558; // Широта Москвы
        const lon = 37.6176; // Долгота Москвы
        const url = `https://api.weather.yandex.ru/v2/forecast?lat=${lat}&lon=${lon}&lang=ru_RU`;


        const response = await axios.get(url, {
            headers: {
                'X-Yandex-Weather-Key': accessKey
            }
        });

        res.json(response.data); // Возвращаем данные клиенту
    } catch (error) {
        if (error.response) {
            console.error('Ошибка получения данных о погоде:', error.response.data); // Логируем тело ответа
        } else {
            console.error('Ошибка получения данных о погоде:', error.message); // Логируем сообщение об ошибке
        }
        res.status(500).send('Внутренняя ошибка сервера');
    }
});

app.get('/api/current-events', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 2;
    const offset = (page - 1) * limit;

    const queryTotal = 'SELECT COUNT(*) AS total FROM lines';
    const queryData = 'SELECT * FROM lines ORDER BY created_at DESC LIMIT ? OFFSET ?';

    db.get(queryTotal, [], (err, row) => {
        if (err) {
            console.error('Ошибка получения общего количества записей:', err);
            return res.status(500).json({success: false, message: 'Ошибка получения данных'});
        }
        const totalPages = Math.ceil(row.total / limit);

        db.all(queryData, [limit, offset], (err, rows) => {
            if (err) {
                console.error('Ошибка получения данных:', err);
                return res.status(500).json({success: false, message: 'Ошибка получения данных'});
            }
            res.json({success: true, events: rows, totalPages});
        });
    });
});


const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
