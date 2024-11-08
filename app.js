const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const moment = require('moment');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');


const app = express();
const db = new sqlite3.Database('./sqlite.db');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Увеличение лимита до 50MB для JSON
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true })); // Увеличение лимита до 50MB для URL-encoded данных
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/geojson', express.static(path.join(__dirname, 'geojson')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key', resave: false, saveUninitialized: true, cookie: { secure: false }
}));


db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          email TEXT UNIQUE,
          password TEXT
        )
    `);

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
    `);

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
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS appeals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            num TEXT,
            date TEXT,
            card_number TEXT,
            settlement TEXT,
            address TEXT,
            topic TEXT,
            measures TEXT,
            status TEXT
        )
    `);
});

function getLineColor(workType) {
    switch (workType) {
        case 'Гос. задание':
            return '#FF0000';
        case 'Коммерция':
            return '#ce31ff';
        default:
            return '#000000';
    }
}

app.use((req, res, next) => {
    res.locals.message = req.session.message;
    delete req.session.message;
    next();
});

// Маршрут страницы логина
app.get('/login', (req, res) => {
    res.render('login');
});

// Маршрут страницы регистрации
app.get('/register', (req, res) => {
    res.render('register');
});

function checkAuth(req, res, next) {
    if (req.session.user) {
        const sessionId = req.sessionID;
        db.get('SELECT * FROM sessions WHERE session_id = ? AND expires_at > ?', [sessionId, moment().format('YYYY-MM-DD HH:mm:ss')], (err, row) => {
            if (err) {
                console.error('Ошибка проверки сессии:', err);
                req.session.message = { type: 'danger', text: 'Ошибка проверки сессии: ' + err.message };
                res.redirect('/login');
            } else if (!row) {
                req.session.message = { type: 'danger', text: 'Сессия истекла, пожалуйста, войдите снова.' };
                res.redirect('/login');
            } else {
                next();
            }
        });
    } else {
        req.session.message = { type: 'danger', text: 'Необходимо авторизоваться для доступа к этой странице' };
        res.redirect('/login');
    }
}

// Проверка доступа для всех маршрутов, кроме страниц авторизации
app.use((req, res, next) => {
    const publicPaths = ['/login', '/register', '/'];
    if (!publicPaths.includes(req.path)) {
        checkAuth(req, res, next);
    } else {
        next();
    }
});

// Рендеринг различных страниц
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/dashboard', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('dashboard', { username });
});

app.get('/opashka-map', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('opashka-map', { username });
});

app.get('/appeals-map', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('appeals-map', { username });
});

app.get('/appeals-journal', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('appeals-journal', { username });
});

app.get('/profile', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('profile', { username });
});

app.get('/settings', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('settings', { username });
});

app.get('/documents', (req, res) => {
    const username = req.session.user ? req.session.user.username : '';
    res.render('documents', { username });
});

// Логаут пользователя
app.get('/logout', (req, res) => {
    const sessionId = req.sessionID;
    db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
        if (err) {
            console.error('Ошибка удаления сессии:', err);
        }
        req.session.destroy();
        res.redirect('/login');
    });
});

// Регистрация пользователя
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 8);

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (row) {
            req.session.message = { type: 'danger', text: 'Пользователь с таким email уже существует.' };
            return res.redirect('/register');
        }

        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], (err) => {
            if (err) {
                console.error('Ошибка регистрации:', err);
                req.session.message = { type: 'danger', text: 'Ошибка регистрации: ' + err.message };
                return res.redirect('/register');
            }
            req.session.message = { type: 'success', text: 'Регистрация успешна. Теперь вы можете войти.' };
            res.redirect('/login');
        });
    });
});

// Авторизация пользователя
app.post('/login', (req, res) => {
    const { identifier, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier], (err, row) => {
        if (err) {
            console.error('Ошибка авторизации:', err);
            req.session.message = { type: 'danger', text: 'Ошибка авторизации: ' + err.message };
            return res.redirect('/login');
        }
        if (!row) {
            req.session.message = { type: 'danger', text: 'Неверный email/логин или пароль' };
            return res.redirect('/login');
        }
        if (!bcrypt.compareSync(password, row.password)) {
            req.session.message = { type: 'danger', text: 'Неверный email/логин или пароль' };
            return res.redirect('/login');
        }

        const sessionId = req.sessionID;
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
        const expiresAt = moment().add(3, 'hours').format('YYYY-MM-DD HH:mm:ss');

        db.run('INSERT INTO sessions (user_id, username, session_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [row.id, row.username, sessionId, createdAt, expiresAt], (err) => {
            if (err) {
                console.error('Ошибка создания сессии:', err);
                req.session.message = { type: 'danger', text: 'Ошибка создания сессии: ' + err.message };
                return res.redirect('/login');
            }

            req.session.user = { id: row.id, username: row.username };
            req.session.message = { type: 'success', text: 'Вход выполнен успешно.' };
            res.redirect('/dashboard');
        });
    });
});

// Сохранение линии
app.post('/save-line', (req, res) => {
    const { objects, workType, comment, workAddress, workVolume, startDate, endDate, equipment, equipmentCount, distance } = req.body;
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
            return res.json({ success: false, message: 'Ошибка сохранения объектов: ' + err.message });
        }
        res.json({ success: true, message: 'Объекты успешно сохранены.' });
    });
});

// Получение линий
app.get('/get-lines', (req, res) => {
    const { workTypes } = req.query;

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
            return res.json({ success: false, message: 'Ошибка получения линий: ' + err.message });
        }
        res.json({ success: true, lines: rows });
    });
});

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
    } = req.body;

    // Получаем текущую дату начала из базы данных, если она уже есть
    db.get(`SELECT start_date FROM lines WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Ошибка получения текущей даты начала:', err);
            return res.json({ success: false, message: 'Ошибка получения текущей даты начала: ' + err.message });
        }

        // Если дата начала уже существует, сохраняем её, иначе используем новую дату
        const finalStartDate = row && row.start_date ? row.start_date : startDate;

        // Обновляем объект, включая неизменную дату начала, если она уже была сохранена
        const query = `
            UPDATE lines
            SET work_type = ?, comment = ?, coordinates = ?, line_color = ?, type = ?, completed = ?, in_progress = ?, start_date = ?, end_date = ?, equipment = ?, equipment_count = ?
            WHERE id = ?
        `;
        const params = [workType, comment, coordinates, lineColor, type, completed, inProgress, finalStartDate, endDate, equipment, equipmentCount, id];

        db.run(query, params, function (err) {
            if (err) {
                console.error('Ошибка обновления объекта:', err);
                return res.json({ success: false, message: 'Ошибка обновления объекта: ' + err.message });
            }
            res.json({ success: true, message: 'Объект успешно обновлен.' });
        });
    });
});

// Удаление линии
app.post('/delete-line', (req, res) => {
    const { id } = req.body;

    const query = 'DELETE FROM lines WHERE id = ?';
    const params = [id];

    db.run(query, params, function (err) {
        if (err) {
            console.error('Ошибка удаления объекта:', err);
            return res.json({ success: false, message: 'Ошибка удаления объекта: ' + err.message });
        }
        res.json({ success: true, message: 'Объект успешно удален.' });
    });
});

// Создаем директорию для хранения фотографий, если она не существует
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${req.body.objectId}-${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// Маршрут для загрузки фотографий
app.post('/upload-photo', upload.single('photo'), (req, res) => {
    const { objectId } = req.body;

    if (!objectId || !req.file) {
        return res.json({ success: false, message: 'Объект не найден или файл не загружен.' });
    }

    const photoPath = `/uploads/${req.file.filename}`;  // путь к файлу

    db.run('UPDATE lines SET photo = ? WHERE id = ?', [photoPath, objectId], (err) => {
        if (err) {
            console.error('Ошибка при обновлении фото для объекта:', err);
            return res.json({ success: false, message: 'Ошибка при обновлении фото: ' + err.message });
        }
        res.json({ success: true, message: 'Фото успешно загружено и привязано к объекту.', photoPath });
    });
});

app.post('/delete-photo', (req, res) => {
    const { objectId } = req.body;

    if (!objectId) {
        return res.json({ success: false, message: 'Объект не найден.' });
    }

    // Получаем текущий путь к фото из базы данных
    db.get('SELECT photo FROM lines WHERE id = ?', [objectId], (err, row) => {
        if (err) {
            console.error('Ошибка при получении пути к фото:', err);
            return res.json({ success: false, message: 'Ошибка при получении пути к фото.' });
        }

        if (row && row.photo) {
            const photoPath = path.join(__dirname, row.photo);

            // Удаляем фото файл, если он существует
            fs.unlink(photoPath, (err) => {
                if (err) {
                    console.error('Ошибка при удалении файла фото:', err);
                    return res.json({ success: false, message: 'Ошибка при удалении файла фото.' });
                }

                // Обновляем базу данных, удаляя путь к фото
                db.run('UPDATE lines SET photo = NULL WHERE id = ?', [objectId], (err) => {
                    if (err) {
                        console.error('Ошибка при обновлении записи в базе данных:', err);
                        return res.json({ success: false, message: 'Ошибка при обновлении записи в базе данных.' });
                    }
                    res.json({ success: true, message: 'Фото успешно удалено.' });
                });
            });
        } else {
            res.json({ success: false, message: 'Фото для удаления не найдено.' });
        }
    });
});

app.post('/save-table-data', (req, res) => {
    const { data } = req.body;

    const stmt = db.prepare('INSERT INTO appeals (num, date, card_number, settlement, address, topic, measures, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    data.forEach(row => {
        stmt.run(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7]);
    });
    stmt.finalize((err) => {
        if (err) {
            console.error('Ошибка сохранения данных:', err);
            return res.status(500).json({ success: false, message: 'Ошибка сохранения данных' });
        }
        res.json({ success: true, message: 'Данные успешно сохранены.' });
    });
});

// Маршрут для получения данных из базы при загрузке страницы
app.get('/get-appeals', (req, res) => {
    db.all('SELECT * FROM appeals', [], (err, rows) => {
        if (err) {
            console.error('Ошибка получения данных:', err);
            return res.status(500).json({ success: false, message: 'Ошибка получения данных' });
        }
        res.json({ success: true, data: rows });
    });
});


app.get('/search-appeals', (req, res) => {
    const query = req.query.query || '';
    const column = req.query.column || 'num';
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 20;
    const validColumns = ['num', 'date', 'card_number', 'settlement', 'address', 'topic', 'measures', 'status'];

    if (!validColumns.includes(column)) {
        return res.status(400).json({ success: false, message: 'Неверный столбец для поиска' });
    }

    const sqlQuery = `
        SELECT * FROM appeals
        WHERE LOWER(${column}) LIKE LOWER(?) 
        LIMIT ? OFFSET ?
    `;
    const params = [`%${query}%`, limit, offset];

    db.all(sqlQuery, params, (err, rows) => {
        if (err) {
            console.error('Ошибка поиска:', err);
            return res.status(500).json({ success: false, message: 'Ошибка поиска данных' });
        }

        // Подсчет общего количества строк для поискового запроса
        const countQuery = `
            SELECT COUNT(*) as total FROM appeals
            WHERE LOWER(${column}) LIKE LOWER(?)
        `;
        db.get(countQuery, [`%${query}%`], (countErr, countResult) => {
            if (countErr) {
                console.error('Ошибка подсчета:', countErr);
                return res.status(500).json({ success: false, message: 'Ошибка подсчета данных' });
            }

            res.json({ success: true, data: rows, total: countResult.total });
        });
    });
});

app.get('/get-appeals-part', (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 20;

    const sqlQuery = `
        SELECT * FROM appeals
        ORDER BY num DESC
        LIMIT ? OFFSET ?
    `;

    db.all(sqlQuery, [limit, offset], (err, rows) => {
        if (err) {
            console.error('Ошибка загрузки данных:', err);
            return res.status(500).json({ success: false, message: 'Ошибка загрузки данных' });
        }

        res.json({ success: true, data: rows });
    });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
