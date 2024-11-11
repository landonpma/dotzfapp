const express = require('express');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const db = require('sqlite.db'); // Подключение к базе данных

const router = express.Router();

// Регистрация пользователя
router.post('/register', (req, res) => {
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
router.post('/login', (req, res) => {
    const { identifier, password } = req.body;

    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [identifier, identifier], (err, row) => {
        if (err || !row || !bcrypt.compareSync(password, row.password)) {
            req.session.message = { type: 'danger', text: 'Неверный email/логин или пароль' };
            return res.redirect('/login');
        }

        const sessionId = req.sessionID;
        const createdAt = moment().format('YYYY-MM-DD HH:mm:ss');
        const expiresAt = moment().add(3, 'hours').format('YYYY-MM-DD HH:mm:ss');

        db.run('INSERT INTO sessions (user_id, username, session_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [row.id, row.username, sessionId, createdAt, expiresAt], (err) => {
            if (err) {
                req.session.message = { type: 'danger', text: 'Ошибка создания сессии: ' + err.message };
                return res.redirect('/login');
            }

            req.session.user = { id: row.id, username: row.username };
            req.session.message = { type: 'success', text: 'Вход выполнен успешно.' };
            res.redirect('/dashboard');
        });
    });
});

// Логаут
router.get('/logout', (req, res) => {
    const sessionId = req.sessionID;
    db.run('DELETE FROM sessions WHERE session_id = ?', [sessionId], (err) => {
        req.session.destroy();
        res.redirect('/login');
    });
});

module.exports = router;
