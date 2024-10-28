document.addEventListener('DOMContentLoaded', () => {
    // Add password toggle
    const togglePassword = document.getElementById('togglePassword')
    const password = document.getElementById('password')
    if (togglePassword && password) {
        togglePassword.addEventListener('click', function (e) {
            // Toggle the type attribute
            const type = password.getAttribute('type') === 'password' ? 'text' : 'password'
            password.setAttribute('type', type)

            // Toggle the text of the button
            this.textContent = this.textContent === 'Показать' ? 'Скрыть' : 'Показать'
        })
    }
})

document.getElementById('startTutorial').addEventListener('click', function() {
    const intro = introJs();
    intro.setOptions({
        steps: [
            {
                element: '#map-container',
                intro: 'Удерживайте левую кнопку мыши, чтобы начать рисовать. Вы можете создать полигон или линию, в зависимости от выбранного режима.',
                position: 'top'
            },
            {
                element: '#toggleMode',
                intro: 'Здесь вы можете переключать режим рисования между линией и полигоном. Выберите нужный режим перед началом работы.',
                position: 'bottom'
            },
            {
                element: '#clearDrawing',
                intro: 'Если вы хотите очистить текущий рисунок и начать заново, нажмите эту кнопку.',
                position: 'bottom'
            },
            {
                element: '#saveDrawing',
                intro: 'После завершения рисования нажмите эту кнопку, чтобы сохранить объект. Вам будет предложено заполнить информацию о работе.',
                position: 'bottom'
            },
            {
                element: '#stopDrawing',
                intro: 'Нажмите эту кнопку, чтобы остановить режим рисования без сохранения текущих объектов.',
                position: 'bottom'
            }
        ],
        showStepNumbers: true,
        exitOnOverlayClick: true,
        showBullets: false,
        disableInteraction: true,
        nextLabel: 'Далее',
        prevLabel: 'Назад',
        doneLabel: 'Готово'
    });

    intro.start();
});