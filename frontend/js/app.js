// frontend/js/app.js - Основная логика приложения

// ==================== GLOBAL STATE ====================
let currentPage = 'home';
let currentText = null;
let analysisResult = null;
let audioBlob = null;
let practiceWords = [];
let currentPracticeIndex = 0;

// ==================== PAGE MANAGEMENT ====================
function showPage(pageId) {
    console.log(`📱 Showing page: ${pageId}`);

    // Проверка авторизации для защищенных страниц
    const protectedPages = ['library', 'recording', 'results', 'practice', 'practice-session', 'profile', 'admin'];
    if (protectedPages.includes(pageId) && !currentUser) {
        showError('Для доступа войдите в систему');
        showPage('login');
        return;
    }

    // Проверка прав для админ-панели
    if (pageId === 'admin' && (!currentUser || currentUser.role !== 'admin')) {
        showError('Требуются права администратора');
        showPage('library');
        return;
    }

    // Останавливаем запись если переходим на другую страницу
    if (window.recordingState && window.recordingState.isRecording) {
        console.log('🛑 Останавливаем запись при переходе на другую страницу');
        window.stopRecording();
    }

    // Скрыть все страницы
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Показать выбранную страницу
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageId;

        // Обновить активную ссылку в навигации
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('onclick')?.includes(`'${pageId}'`)) {
                link.classList.add('active');
            }
        });

        // Загрузить данные для страницы
        loadPageData(pageId);
    }

    // Прокрутить наверх
    window.scrollTo(0, 0);
}


function goBack() {
    const backMap = {
        'recording': 'library',
        'results': 'recording',
        'practice-session': 'practice',
        'login': 'home',
        'register': 'login',
        'admin': 'library'
    };

    const prevPage = backMap[currentPage] || 'home';
    showPage(prevPage);
}

// ==================== PAGE LOADERS ====================
function loadPageData(pageId) {
    console.log(`📦 Loading data for page: ${pageId}`);

    switch(pageId) {
        case 'library':
            loadLibraryPage();
            break;
        case 'recording':
            if (currentText) {
                loadRecordingPage();
            } else {
                showPage('library');
            }
            break;
        case 'results':
            if (analysisResult) {
                loadResultsPage();
            } else {
                showPage('library');
            }
            break;
        case 'practice':
            loadPracticePage();
            break;
        case 'practice-session':
            loadPracticeSession();
            break;
        case 'admin':
            if (typeof showAdminTab === 'function') {
                showAdminTab('create-text');
            }
            break;
    }
}

// ==================== LIBRARY PAGE ====================
async function loadLibraryPage() {
    console.log('📚 Loading library...');
    const container = document.getElementById('texts-container');
    if (!container) return;

    container.innerHTML = '<div class="loading">Загрузка текстов...</div>';

    try {
        const texts = await loadTexts();

        if (texts.length === 0) {
            container.innerHTML = '<div class="no-texts">Текстов нет</div>';
            return;
        }

        // Обновить фильтр тем
        updateTopicFilter(texts);

        container.innerHTML = texts.map(text => `
            <div class="text-card" onclick="selectText(${text.id})">
                <div class="text-card-header">
                    <span class="level-badge ${text.level.toLowerCase()}">${text.level}</span>
                    <span class="topic-tag">${text.topic}</span>
                </div>
                <h3>${text.title}</h3>
                <p>${text.content.substring(0, 100)}...</p>
                <div class="text-card-footer">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); selectText(${text.id})">
                        🎤 Практиковать
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('❌ Error loading library:', error);
        container.innerHTML = `<div class="error">Ошибка загрузки</div>`;
    }
}

function updateTopicFilter(texts) {
    const topicSelect = document.getElementById('topic');
    if (!topicSelect) return;

    const topics = [...new Set(texts.map(text => text.topic))].sort();
    topicSelect.innerHTML = '<option value="">Все темы</option>' +
    topics.map(topic => `<option value="${topic}">${topic}</option>`).join('');
}

function filterTexts() {
    const levelFilter = document.getElementById('level')?.value || '';
    const topicFilter = document.getElementById('topic')?.value || '';
    const searchFilter = document.getElementById('search')?.value.toLowerCase() || '';

    document.querySelectorAll('.text-card').forEach(card => {
        const level = card.querySelector('.level-badge')?.textContent || '';
        const topic = card.querySelector('.topic-tag')?.textContent || '';
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const content = card.querySelector('p')?.textContent.toLowerCase() || '';

        const levelMatch = !levelFilter || level === levelFilter;
        const topicMatch = !topicFilter || topic === topicFilter;
        const searchMatch = !searchFilter || title.includes(searchFilter) || content.includes(searchFilter);

        card.style.display = (levelMatch && topicMatch && searchMatch) ? 'block' : 'none';
    });
}

async function selectText(textId) {
    console.log(`🎯 Selecting text ${textId}...`);

    try {
        currentText = await loadText(textId);
        console.log('✅ Text loaded:', currentText.title);
        showPage('recording');
    } catch (error) {
        console.error('❌ Error loading text:', error);
        showError('Не удалось загрузить текст');
    }
}

// ==================== RECORDING PAGE ====================
function loadRecordingPage() {
    if (!currentText) {
        showError('Текст не выбран');
        showPage('library');
        return;
    }

    // Сбросить состояние записи
    if (window.resetRecording) {
        window.resetRecording();
    }

    audioBlob = null;
    if (window.audioPlayer) {
        window.audioPlayer.pause();
        window.audioPlayer = null;
    }

    document.getElementById('recording-title').textContent = currentText.title;
    document.getElementById('text-display').innerHTML = `
        <div class="text-full">
            <h3><span class="level-badge ${currentText.level.toLowerCase()}">${currentText.level}</span> ${currentText.topic}</h3>
            <div class="text-content">${formatText(currentText.content)}</div>
            <div class="text-tips">
                <strong>💡 Советы:</strong>
                <ul>
                    <li>Говорите четко и не спеша</li>
                    <li>Постарайтесь произнести весь текст</li>
                    <li>Делайте паузы между предложениями</li>
                    <li>Нажмите "Начать запись" для старта</li>
                    <li>Нажмите "Остановить запись" для завершения</li>
                </ul>
            </div>
        </div>
    `;

    // Убедиться, что UI в правильном состоянии
    const statusElement = document.getElementById('recording-status');
    const startBtn = document.getElementById('start-record-btn');
    const stopBtn = document.getElementById('stop-record-btn');
    const resultElement = document.getElementById('recording-result');

    if (statusElement) {
        statusElement.className = 'recording-status status-idle';
        statusElement.textContent = 'Готов к записи';
    }

    if (startBtn) startBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
    if (resultElement) resultElement.style.display = 'none';

    // Сбросить таймер
    const timerElement = document.getElementById('timer');
    if (timerElement) timerElement.textContent = '00:00';
}

function formatText(text) {
    return text.split('\n').map(p => `<p>${p}</p>`).join('');
}

// ==================== RESULTS PAGE ====================
function loadResultsPage() {
    if (!analysisResult) {
        showError('Нет данных');
        showPage('library');
        return;
    }

    console.log('Loading results with data:', analysisResult);

    const accuracy = analysisResult.accuracy || 0;

    // Обновить счет точности
    document.getElementById('accuracy-score').textContent = `${accuracy.toFixed(1)}%`;
    document.getElementById('progress-fill').style.width = `${accuracy}%`;

    // Подробности счета
    const details = document.getElementById('score-details');
    if (details) {
        if (accuracy >= 90) details.innerHTML = '🎉 Отлично!';
        else if (accuracy >= 70) details.innerHTML = '👍 Хорошо!';
        else if (accuracy >= 50) details.innerHTML = '📈 Нормально';
        else details.innerHTML = '💪 Практикуйтесь больше';
    }

    // Оригинальный текст
    const originalText = document.getElementById('original-text');
    if (originalText && analysisResult.reference_text) {
        const text = analysisResult.reference_text;

        // Добавляем легенду перед текстом
        originalText.innerHTML = createErrorLegend();

        // Добавляем подсвеченный текст
        const errors = analysisResult.feedback?.error_words || [];
        originalText.innerHTML += highlightErrorsInText(text, errors);
    }

    // Распознанный текст
    const recognizedText = document.getElementById('recognized-text');
    if (recognizedText && analysisResult.recognized_text) {
        recognizedText.textContent = analysisResult.recognized_text;
    }

    // Отображаем детализированные ошибки
    const errorDetails = document.getElementById('error-details');
    if (errorDetails && analysisResult.feedback && analysisResult.feedback.error_words) {
        const errorList = analysisResult.feedback.error_words;
        if (errorList.length > 0) {
            errorDetails.innerHTML = `
                <h4>Детали ошибок:</h4>
                <div class="error-list">
                    ${errorList.map((error, index) => `
                        <div class="error-item ${error.error_type}">
                            <div class="error-header">
                                <strong>#${index + 1}</strong>
                                <span class="error-type">${getErrorTypeLabel(error.error_type)}</span>
                            </div>
                            ${error.reference_word ? `
                                <div class="error-content">
                                    <div>Ожидалось: <strong>${escapeHtml(error.reference_word)}</strong></div>
                                    ${error.word ? `<div>Распознано: <span class="error-word">${escapeHtml(error.word)}</span></div>` : ''}
                                    ${error.confidence ? `<div>Уверенность: ${(error.confidence * 100).toFixed(1)}%</div>` : ''}
                                </div>
                            ` : ''}
                            ${error.pronunciation_url ? `
                                <div class="error-actions">
                                    <button class="btn btn-sm btn-secondary" onclick="playPronunciation('${escapeHtml(error.reference_word || error.word)}')">
                                        🔊 Прослушать
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            errorDetails.innerHTML = '<div class="no-errors">✅ Ошибок не найдено!</div>';
        }
    }

    // Проблемные слова
    const problemWordsList = document.getElementById('problem-words-list');
    if (problemWordsList) {
        const problemWords = extractProblemWords(analysisResult);

        if (problemWords.length === 0) {
            problemWordsList.innerHTML = '<div class="no-words">✅ Ошибок не найдено!</div>';
        } else {
            problemWordsList.innerHTML = `
                <h4>Слова для практики (${problemWords.length}):</h4>
                <div class="problem-words-grid">
                    ${problemWords.map(word => `
                        <div class="problem-word-item">
                            <span class="word-text">${escapeHtml(word)}</span>
                            <div class="word-actions">
                                <button class="btn btn-sm btn-secondary" onclick="speakWord('${escapeHtml(word)}')">
                                    🔊 Произношение
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    // Показываем доступность TTS
    const ttsStatus = document.getElementById('tts-status');
    if (ttsStatus) {
        ttsStatus.innerHTML = analysisResult.tts_available
        ? '<span class="text-success">✓ TTS доступен</span>'
        : '<span class="text-warning">⚠ TTS недоступен</span>';
    }
}

function extractProblemWords(analysisResult) {
    const words = [];

    if (!analysisResult || !analysisResult.feedback) {
        return words;
    }

    console.log('Extracting problem words from:', analysisResult.feedback);

    // Способ 1: Из error_words (основной способ)
    if (analysisResult.feedback.error_words && Array.isArray(analysisResult.feedback.error_words)) {
        analysisResult.feedback.error_words.forEach(error => {
            if (error.reference_word && error.reference_word.trim() !== '') {
                words.push(error.reference_word);
            }
        });
        console.log('From error_words:', words);
    }

    // Способ 2: Из problem_words (резервный)
    if (analysisResult.feedback.problem_words && Array.isArray(analysisResult.feedback.problem_words)) {
        analysisResult.feedback.problem_words.forEach(word => {
            if (word && word.trim() !== '' && !words.includes(word)) {
                words.push(word);
            }
        });
        console.log('From problem_words:', analysisResult.feedback.problem_words);
    }

    // Способ 3: Из errors (для обратной совместимости)
    if (analysisResult.feedback.errors && Array.isArray(analysisResult.feedback.errors)) {
        analysisResult.feedback.errors.forEach(error => {
            if (error.words && Array.isArray(error.words)) {
                error.words.forEach(word => {
                    if (word && word.trim() !== '' && !words.includes(word)) {
                        words.push(word);
                    }
                });
            }
        });
        console.log('From errors:', analysisResult.feedback.errors);
    }

    // Убираем дубликаты
    const uniqueWords = [...new Set(words.map(word => word.trim()))].filter(word => word.length > 0);
    console.log('Unique problem words:', uniqueWords);

    return uniqueWords.slice(0, 15); // Ограничиваем 15 словами
}

// Вспомогательная функция для получения русских меток ошибок
function getErrorTypeLabel(errorType) {
    const labels = {
        'mispronounced': 'Неправильное произношение',
        'missing': 'Пропущенное слово',
        'extra': 'Лишнее слово',
        'mispronounced_count': 'Неправильно произнесено',
        'missing_count': 'Пропущено',
        'extra_count': 'Лишних слов'
    };
    return labels[errorType] || errorType;
}

// Функция для проигрывания произношения слова
function playPronunciation(word) {
    if (!word) return;

    // Используем TTS если доступен
    if (analysisResult && analysisResult.tts_available) {
        speakWord(word);
    } else {
        // Fallback на Web Speech API
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            speechSynthesis.speak(utterance);
        } else {
            showInfo('Функция произношения недоступна');
        }
    }
}

// Обновим функцию saveProblemWords в app.js
async function saveProblemWords() {
    if (!analysisResult || !currentText) {
        showError('Нет данных для сохранения');
        return;
    }

    const problemWords = extractProblemWords(analysisResult);

    if (problemWords.length === 0) {
        showInfo('Нет слов для сохранения');
        return;
    }

    console.log('Saving problem words:', {
        textId: currentText.id,
        words: problemWords,
        textTitle: currentText.title
    });

    try {
        const result = await saveProblemWords(currentText.id, problemWords);
        console.log('Save result:', result);

        // Проверяем разные форматы ответа
        if (result && result.success === true) {
            const message = result.message || `Сохранено ${problemWords.length} слов для практики!`;
            showSuccess(message);

            // Обновить кнопку
            const saveBtn = document.querySelector('button[onclick="saveProblemWords()"]');
            if (saveBtn) {
                saveBtn.innerHTML = '✅ Сохранено';
                saveBtn.disabled = true;
                saveBtn.className = 'btn btn-success';
                saveBtn.onclick = null; // Отключаем повторный клик
            }

            // Обновляем статистику на странице практики
            if (window.refreshWords) {
                setTimeout(() => window.refreshWords(), 1000);
            }
        } else {
            // Если success явно false или не определено
            const errorMsg = result?.message || result?.detail || 'Не удалось сохранить слова';
            showError(errorMsg);

            // Если ошибка временная, оставляем кнопку активной
            const saveBtn = document.querySelector('button[onclick="saveProblemWords()"]');
            if (saveBtn && saveBtn.disabled) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '💾 Сохранить слова';
                saveBtn.className = 'btn btn-primary';
            }
        }

    } catch (error) {
        console.error('Unexpected error in saveProblemWords:', error);
        showError('Ошибка при сохранении: ' + (error.message || 'неизвестная ошибка'));
    }
}

// ==================== PRACTICE PAGE ====================
async function loadPracticePage() {
    try {
        const words = await getMyWords();
        practiceWords = words;

        const wordsContainer = document.getElementById('words-container'); // Переименовываем переменную

        if (!wordsContainer) {
            console.error('words-container not found');
            return;
        }

        if (words.length === 0) {
            wordsContainer.style.display = 'none';
            document.getElementById('no-words').style.display = 'block';
            updateStats({ total: 0, practiced: 0, mastered: 0, today: 0 });
            return;
        }

        wordsContainer.style.display = 'grid';
        document.getElementById('no-words').style.display = 'none';

        // Обновить статистику
        const stats = await getWordStats();
        updateStats(stats);

        // Отобразить слова - ИСПРАВЛЕННАЯ ВЕРСИЯ
        wordsContainer.innerHTML = words.map((word, index) => `
            <div class="word-card" data-word-id="${word.id}">
                <div class="word-text">${escapeHtml(word.word)}</div>
                <div class="word-actions">
                    <button class="btn btn-sm btn-secondary" onclick="speakWord('${escapeHtml(word.word)}')" title="Прослушать произношение">
                        🔊
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="practiceSingleWord('${word.id}', '${escapeHtml(word.word)}')" title="Практиковать слово">
                        🎤 Практика
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading practice page:', error);
        showError('Ошибка загрузки слов');
    }
}
function updateStats(stats) {
    document.getElementById('total-words').textContent = stats.total || 0;
    document.getElementById('practiced-words').textContent = stats.practiced || 0;
    document.getElementById('mastered-words').textContent = stats.mastered || 0;
    document.getElementById('today-practiced').textContent = stats.today || 0;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

async function deleteWordHandler(wordId, event) {
    event.stopPropagation();

    if (!confirm('Удалить это слово?')) return;

    try {
        await deleteWord(wordId);
        showSuccess('Слово удалено');
        loadPracticePage();
    } catch (error) {
        console.error('Error deleting word:', error);
        showError('Не удалось удалить слово');
    }
}

function practiceSingleWord(wordId, wordText) {
    speakWord(wordText);

    // Через 2 секунды предлагаем отметить как отработанное
    setTimeout(async () => {
        if (confirm(`Вы потренировали слово "${wordText}"?`)) {
            try {
                await markWordPracticed(wordId);
                showSuccess('Слово отмечено как отработанное!');
                loadPracticePage();
            } catch (error) {
                console.error('Error marking word:', error);
                showError('Не удалось отметить слово');
            }
        }
    }, 2000);
}

function refreshWords() {
    loadPracticePage();
    showInfo('Список обновлен');
}

// ==================== PRACTICE SESSION ====================
async function startPracticeSession() {
    const words = await getMyWords();

    if (words.length === 0) {
        showError('Нет слов для практики. Сначала проанализируйте текст и сохраните проблемные слова.');
        return;
    }

    // Берем слова, которые практиковались меньше 3 раз
    const practiceWords = words.filter(w => (w.practice_count || 0) < 3);

    if (practiceWords.length === 0) {
        showInfo('Все слова уже хорошо отработаны!');
        return;
    }

    // Сохраняем в глобальные переменные
    window.practiceWords = practiceWords;
    window.currentPracticeIndex = 0;

    showPage('practice-session');
}

function loadPracticeSession() {
    // Используем глобальные переменные
    const practiceWords = window.practiceWords || [];
    const currentPracticeIndex = window.currentPracticeIndex || 0;

    console.log('Loading practice session with:', {
        practiceWords: practiceWords,
        currentPracticeIndex: currentPracticeIndex
    });

    if (practiceWords.length === 0) {
        showError('Нет слов для практики');
        showPage('practice');
        return;
    }

    const currentWord = practiceWords[currentPracticeIndex];
    if (!currentWord) {
        showError('Слово не найдено');
        showPage('practice');
        return;
    }

    console.log('Loading practice session:', {
        currentWord,
        index: currentPracticeIndex,
        total: practiceWords.length
    });

    // Обновить UI
    document.getElementById('current-word-index').textContent = currentPracticeIndex + 1;
    document.getElementById('total-words-count').textContent = practiceWords.length;
    document.getElementById('current-word-display').innerHTML = `
        <div class="word-large">${escapeHtml(currentWord.word)}</div>
        <div class="word-info">
            <span>Практиковано: ${currentWord.practice_count || 0} раз</span>
        </div>
    `;

    // Обновить прогресс
    const progress = (currentPracticeIndex / practiceWords.length) * 100;
    document.getElementById('session-progress').textContent = `${Math.round(progress)}%`;
    document.getElementById('session-progress-fill').style.width = `${progress}%`;

    // Сбросить UI записи - ВАЖНО: правильные ID элементов
    const recordingSection = document.getElementById('practice-recording');
    const recordBtn = document.getElementById('practice-record-btn');
    const saveBtn = document.getElementById('save-practice-btn');
    const nextBtn = document.getElementById('next-word-btn'); // Теперь этот элемент существует
    const status = document.getElementById('practice-status');

    if (recordingSection) recordingSection.style.display = 'block';
    if (recordBtn) {
        recordBtn.style.display = 'block';
        recordBtn.innerHTML = '<span>🎤</span> Записать произношение';
        recordBtn.className = 'btn btn-primary';
        recordBtn.disabled = false;
        // Устанавливаем правильный обработчик
        recordBtn.onclick = () => {
            console.log('Practice record button clicked, calling startPracticeRecording');
            window.startPracticeRecording();
        };
    }

    // ВСЕГДА скрываем эти кнопки при загрузке нового слова
    if (saveBtn) {
        saveBtn.style.display = 'none';
        saveBtn.disabled = false;
    }
    if (nextBtn) {
        nextBtn.style.display = 'none';
        nextBtn.disabled = false;
    }

    // Сбросить статус и таймер
    if (status) {
        status.className = 'recording-status status-idle';
        status.textContent = 'Готов к записи';
    }

    const timer = document.getElementById('practice-timer');
    if (timer) timer.textContent = '00:00';

    // Очистить визуализатор
    const visualizer = document.getElementById('practice-visualizer');
    if (visualizer) {
        visualizer.innerHTML = '';
    }
}

function speakCurrentWord() {
    if (!practiceWords || !practiceWords[currentPracticeIndex]) {
        showError('Слово не выбрано');
        return;
    }

    const currentWord = practiceWords[currentPracticeIndex];
    speakWord(currentWord.word);
}

function nextWord() {
    // Используем глобальные переменные
    const practiceWords = window.practiceWords || [];
    let currentPracticeIndex = window.currentPracticeIndex || 0;

    currentPracticeIndex++;
    window.currentPracticeIndex = currentPracticeIndex;

    if (currentPracticeIndex >= practiceWords.length) {
        showSuccess('🎉 Практика завершена!');
        showPage('practice');

        // Очищаем глобальные переменные
        window.practiceWords = [];
        window.currentPracticeIndex = 0;
        window.currentPracticeAudio = null;
    } else {
        loadPracticeSession();
    }
}

function skipWord() {
    // Пропускаем текущее слово и переходим к следующему
    nextWord();
}

// ==================== FORM HANDLERS ====================
function initializeForms() {
    // Форма логина
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            if (!email || !password) {
                showError('Заполните все поля');
                return;
            }

            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Вход...';

            try {
                await login(email, password);
            } catch (error) {
                showError('Ошибка входа: проверьте email и пароль');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    // Форма регистрации
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const username = document.getElementById('register-username').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const passwordConfirm = document.getElementById('register-password-confirm').value;

            // Валидация
            if (!username || !email || !password) {
                showError('Заполните все поля');
                return;
            }

            if (password !== passwordConfirm) {
                showError('Пароли не совпадают');
                return;
            }

            if (password.length < 6) {
                showError('Пароль должен быть не менее 6 символов');
                return;
            }

            const btn = this.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Регистрация...';

            try {
                await register(username, email, password);
            } catch (error) {
                showError('Ошибка регистрации');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    // Форма профиля
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showSuccess('Настройки сохранены');
        });
    }
}

// ==================== ANALYSIS HANDLER ====================
async function analyzeAndShowResults() {
    console.log('🔍 Анализ и показ результатов');

    // Используем window.audioBlob который установлен recording.js
    const audioBlobToUse = window.audioBlob || recordingState?.currentBlob;

    console.log('Проверка данных для анализа:', {
        hasAudioBlob: !!audioBlobToUse,
        blobSize: audioBlobToUse?.size,
        blobType: audioBlobToUse?.type,
        hasCurrentText: !!currentText,
        textId: currentText?.id,
        textTitle: currentText?.title
    });

    if (!audioBlobToUse) {
        showError('Нет записи для анализа. Сначала запишите аудио.');
        console.error('Нет audioBlob');
        return;
    }

    if (!currentText) {
        showError('Текст не выбран');
        console.error('Нет currentText');
        return;
    }

    // Проверяем размер файла
    if (audioBlobToUse.size < 1000) { // Меньше 1KB
        showError('Запись слишком короткая или повреждена. Попробуйте записать снова.');
        return;
    }

    // Обновляем статус
    const status = document.getElementById('recording-status');
    if (status) {
        status.className = 'recording-status status-processing';
        status.textContent = '🔍 Анализ произношения...';
    }

    // Блокируем кнопку чтобы избежать повторных нажатий
    const analyzeBtn = document.querySelector('button[onclick*="analyzeAndShowResults"]');
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = '<span>⏳</span> Анализ...';
    }

    try {
        console.log('Вызов analyzeAudio с textId:', currentText.id);
        const result = await analyzeAudio(currentText.id, audioBlobToUse);
        console.log('Результат анализа получен:', result);

        if (result) {
            // Сохраняем результат для отображения
            analysisResult = result;

            // Показываем страницу результатов
            showPage('results');
        } else {
            showError('Не удалось получить результат анализа');
        }
    } catch (error) {
        console.error('❌ Ошибка в analyzeAndShowResults:', error);
        showError('Ошибка анализа: ' + error.message);

        // Возвращаем на страницу записи
        showPage('recording');
    } finally {
        // Разблокируем кнопку
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<span>🔍</span> Проанализировать';
        }

        // Восстанавливаем статус
        if (status && !analysisResult) {
            status.className = 'recording-status status-success';
            status.textContent = 'Запись готова';
        }
    }
}


// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 App initialized');

    initializeForms();
    showPage('home');

    if (currentUser) {
        console.log('👤 User:', currentUser.username);
    }
});
function highlightErrorsInText(originalText, errors) {
    if (!errors || !Array.isArray(errors) || errors.length === 0) {
        return `<div class="annotated-text">${escapeHtml(originalText)}</div>`;
    }

    let highlightedText = originalText;
    const errorMap = new Map();

    // Сортируем ошибки по позиции для правильного выделения
    errors.forEach((error, index) => {
        if (error.reference_word) {
            const word = error.reference_word;
            const type = error.error_type || 'mispronounced';

            // Находим все вхождения слова в тексте
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(originalText)) !== null) {
                errorMap.set(match.index, {
                    word: word,
                    type: type,
                    length: word.length,
                    details: error
                });
            }
        }
    });

    // Создаем массив из Map для сортировки
    const sortedErrors = Array.from(errorMap.entries())
        .sort((a, b) => b[0] - a[0]); // Сортируем с конца

    // Подсвечиваем ошибки (начиная с конца, чтобы индексы не сбивались)
    sortedErrors.forEach(([index, error]) => {
        const before = highlightedText.substring(0, index);
        const word = highlightedText.substring(index, index + error.length);
        const after = highlightedText.substring(index + error.length);

        const tooltip = getErrorTooltip(error.type, error.details);
        const colorClass = getErrorColorClass(error.type);

        highlightedText = before +
        `<span class="error-highlight ${colorClass}" title="${escapeHtml(tooltip)}">${word}</span>` +
        after;
    });

    return `<div class="annotated-text">${highlightedText}</div>`;
}

// Функция для получения подсказки по ошибке
function getErrorTooltip(errorType, details) {
    const labels = {
        'mispronounced': 'Неправильное произношение',
        'missing': 'Пропущенное слово',
        'extra': 'Лишнее слово'
    };

    let tooltip = labels[errorType] || errorType;

    if (details && details.word) {
        tooltip += `: ${details.word}`;
    }

    if (details && details.confidence) {
        tooltip += ` (уверенность: ${(details.confidence * 100).toFixed(1)}%)`;
    }

    return tooltip;
}

// Функция для получения класса цвета ошибки
function getErrorColorClass(errorType) {
    const classMap = {
        'mispronounced': 'error-mispronounced',
        'missing': 'error-missing',
        'extra': 'error-extra'
    };
    return classMap[errorType] || 'error-mispronounced';
}

// Функция для создания легенды ошибок
function createErrorLegend() {
    return `
        <div class="error-legend">
            <div class="legend-item">
                <div class="legend-color legend-mispronounced"></div>
                <span>Неправильное произношение</span>
            </div>
            <div class="legend-item">
                <div class="legend-color legend-missing"></div>
                <span>Пропущенное слово</span>
            </div>
            <div class="legend-item">
                <div class="legend-color legend-extra"></div>
                <span>Лишнее слово</span>
            </div>
        </div>
    `;
}


// ==================== EXPORTS ====================
window.showPage = showPage;
window.goBack = goBack;
window.filterTexts = filterTexts;
window.selectText = selectText;
window.saveProblemWords = saveProblemWords;
window.refreshWords = refreshWords;
window.startPracticeSession = startPracticeSession;
window.speakCurrentWord = speakCurrentWord;
window.nextWord = nextWord;
window.skipWord = skipWord;
window.practiceSingleWord = practiceSingleWord;
window.deleteWordHandler = deleteWordHandler;
window.analyzeAndShowResults = analyzeAndShowResults;
window.initializeForms = initializeForms;
window.loadPracticeSession = loadPracticeSession;
window.loadPracticePage = loadPracticePage; // Добавляем экспорт
window.markWordPracticed = markWordPracticed; // Добавляем экспорт
