// frontend/js/api.js - API система с админ-функциями

const API_BASE_URL = 'https://api.linguaai.webtm.ru';
const isGitHubPages = false; // или true, если вы на GitHub Pages
// ==================== STATE MANAGEMENT ====================
let currentUser = JSON.parse(localStorage.getItem('current_user') || 'null');

function saveUserData(userData) {
    currentUser = userData;
    localStorage.setItem('current_user', JSON.stringify(userData));
    updateNavigation();
}

function clearUserData() {
    currentUser = null;
    localStorage.removeItem('current_user');
    updateNavigation();
}

function updateNavigation() {
    const authButtons = document.getElementById('auth-buttons');
    if (!authButtons) return;

    if (currentUser) {
        authButtons.innerHTML = `
            <span class="welcome">👤 ${currentUser.username || 'Пользователь'}</span>
            <button class="btn btn-secondary" onclick="logout()">Выход</button>
        `;

        // Показать кнопку админа если пользователь - админ
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn && currentUser.role === 'admin') {
            adminBtn.style.display = 'inline-flex';
        }
    } else {
        authButtons.innerHTML = `
            <button class="btn btn-secondary" onclick="showPage('login'); return false;">Вход</button>
            <button class="btn btn-primary" onclick="showPage('register'); return false;">Регистрация</button>
        `;

        // Скрыть кнопку админа
        const adminBtn = document.getElementById('admin-btn');
        if (adminBtn) {
            adminBtn.style.display = 'none';
        }
    }
}

// ==================== API FUNCTIONS ====================
const apiFetch = async (endpoint, options = {}) => {
    try {
        console.log('🌐 API Request:', endpoint, options.method || 'GET');

        // Упрощаем базовый URL - используем относительный путь
        const API_BASE_URL = ''; // или '/api' если есть прокси

        // Если нужен абсолютный URL (для продакшена)
        // const API_BASE_URL = process.env.NODE_ENV === 'production'
        //   ? 'https://api.linguaai.webtm.ru'
        //   : 'http://localhost:3000';

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        console.log('📄 Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ API Response:', data);

        return data;
    } catch (error) {
        console.error('❌ API Error:', error);
        throw new Error(`Network error: ${error.message}`);
    }
};

// ==================== AUTH FUNCTIONS ====================
async function login(email, password) {
    try {
        const user = await apiFetch('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        saveUserData(user);
        showSuccess('Вход выполнен успешно!');
        showPage('library');
        return user;

    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}

async function register(username, email, password) {
    try {
        const user = await apiFetch('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });

        saveUserData(user);
        showSuccess('Регистрация успешна!');
        showPage('library');
        return user;

    } catch (error) {
        console.error('Registration failed:', error);
        throw error;
    }
}

async function logout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        clearUserData();
        showSuccess('Вы успешно вышли');
        showPage('home');
    }
}

async function getCurrentUser() {
    try {
        const user = await apiFetch('/auth/me');
        saveUserData(user);
        return user;
    } catch (error) {
        console.error('Failed to get user:', error);
        return null;
    }
}

// ==================== TEXT FUNCTIONS ====================
async function loadTexts() {
    return await apiFetch('/texts');
}

async function loadText(textId) {
    return await apiFetch(`/texts/${textId}`);
}

// ==================== ANALYSIS FUNCTION ====================
async function analyzeAudio(textId, audioBlob) {
    console.log('📤 Отправка WAV аудио для анализа...', {
        textId: textId,
        blobSize: audioBlob.size,
        blobType: audioBlob.type
    });

    // Проверяем файл перед отправкой
    if (!audioBlob || audioBlob.size === 0) {
        showError('Нет данных записи');
        throw new Error('No audio data');
    }

    if (audioBlob.type !== 'audio/wav') {
        console.warn(`Тип файла: ${audioBlob.type}, ожидается audio/wav`);
    }

    // Проверяем размер файла
    if (audioBlob.size < 10000) { // Меньше 10KB
        showError('Запись слишком короткая. Пожалуйста, запишите не менее 2 секунд.');
        throw new Error('Audio too short');
    }

    if (audioBlob.size > 50 * 1024 * 1024) { // Больше 50MB
        showError('Запись слишком большая. Максимальный размер: 50MB');
        throw new Error('Audio too large');
    }

    try {
        // Создаем FormData
        const formData = new FormData();
        formData.append('text_id', textId.toString());
        formData.append('audio', audioBlob, 'recording.wav');
        formData.append('language', 'en');
        formData.append('sample_rate', '16000');
        formData.append('format', 'wav');

        // Добавляем информацию о пользователе
        if (currentUser && currentUser.id) {
            formData.append('user_id', currentUser.id.toString());
        }

        // Показываем статус отправки
        const statusElement = document.getElementById('recording-status');
        if (statusElement) {
            statusElement.className = 'recording-status status-processing';
            statusElement.textContent = '📤 Отправка на анализ...';
        }

        console.log('Отправка запроса на /api/analyze...');

        // Отправляем WAV файл
        const response = await fetch(`${API_BASE_URL}/analyze`, {
            method: 'POST',
            credentials: 'include',
            body: formData
            // Не устанавливаем Content-Type, FormData сделает это автоматически
        });

        console.log('Ответ сервера:', response.status, response.statusText);

        if (!response.ok) {
            let errorText = 'Неизвестная ошибка сервера';
            try {
                errorText = await response.text();
                console.error('Текст ошибки сервера:', errorText);

                // Пытаемся парсить как JSON
                try {
                    const errorJson = JSON.parse(errorText);
                    errorText = errorJson.message || errorJson.detail || errorText;
                } catch {
                    // Оставляем как есть
                }
            } catch {
                // Не удалось прочитать текст ошибки
            }

            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Анализ успешен:', result);

        return result;

    } catch (error) {
        console.error('❌ Ошибка анализа:', error);

        let userMessage = 'Ошибка анализа: ';
        if (error.message.includes('network') || error.message.includes('Network')) {
            userMessage += 'Проблемы с сетью. Проверьте подключение к интернету.';
        } else if (error.message.includes('timeout')) {
            userMessage += 'Таймаут запроса. Сервер долго не отвечает.';
        } else {
            userMessage += error.message;
        }

        showError(userMessage);
        throw error;
    }
}

// ==================== WORD FUNCTIONS ====================
async function saveProblemWords(textId, words) {
    try {
        const response = await apiFetch('/words/save', {
            method: 'POST',
            body: JSON.stringify({
                text_id: textId,
                words: words,
                timestamp: new Date().toISOString()
            })
        });

        console.log('API response from /words/save:', response);

        // Гарантируем, что всегда возвращаем объект с полем success
        if (response && typeof response.success !== 'undefined') {
            return response; // Бэкенд уже возвращает правильный формат
        } else {
            // Если бэкенд не возвращает success, создаем его
            return {
                success: true,
                message: response.message || "Слова сохранены успешно",
                saved_words: response.saved_words || words
            };
        }

    } catch (error) {
        console.error('Error saving words:', error);
        // Всегда возвращаем объект с success
        return {
            success: false,
            message: "Не удалось сохранить слова",
            error: error.message
        };
    }
}

async function getMyWords() {
    try {
        return await apiFetch('/words/my');
    } catch (error) {
        console.error('Error getting words:', error);
        return [];
    }
}

async function deleteWord(wordId) {
    try {
        return await apiFetch(`/words/${wordId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Error deleting word:', error);
        throw error;
    }
}

async function markWordPracticed(wordId) {
    try {
        return await apiFetch(`/words/${wordId}/practice`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error marking word:', error);
        throw error;
    }
}

async function getWordStats() {
    try {
        return await apiFetch('/words/stats');
    } catch (error) {
        console.error('Error getting stats:', error);
        return {
            total: 0,
            practiced: 0,
            mastered: 0,
            today: 0
        };
    }
}

// ==================== ADMIN FUNCTIONS ====================
async function createText(textData) {
    try {
        return await apiFetch('/admin/texts', {
            method: 'POST',
            body: JSON.stringify(textData)
        });
    } catch (error) {
        console.error('Error creating text:', error);
        throw error;
    }
}

async function deleteText(textId) {
    try {
        return await apiFetch(`/admin/texts/${textId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('Error deleting text:', error);
        throw error;
    }
}

async function updateText(textId, textData) {
    console.log('🔄 Updating text:', { textId, textData });

    // Убедимся, что textId - число
    const numericId = parseInt(textId);
    if (isNaN(numericId)) {
        throw new Error(`Invalid text ID: ${textId}`);
    }

    try {
        return await apiFetch(`/admin/texts/${numericId}`, {
            method: 'PUT',
            body: JSON.stringify(textData)
        });
    } catch (error) {
        console.error('Error updating text:', error);
        throw error;
    }
}

async function getAllTextsForAdmin() {
    try {
        return await apiFetch('/admin/texts');
    } catch (error) {
        console.error('Error getting admin texts:', error);
        return [];
    }
}

async function getAdminStats() {
    try {
        return await apiFetch('/admin/stats');
    } catch (error) {
        console.error('Error getting admin stats:', error);
        return {
            total_texts: 0,
            total_users: 0,
            total_practices: 0
        };
    }
}

// ==================== TTS FUNCTION ====================
async function speakWord(word) {
    try {
        const response = await fetch('/api/tts/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text: word, language: 'en' })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.audio_data) {
            const audioData = `data:audio/wav;base64,${result.audio_data}`;
            const audio = new Audio(audioData);
            await audio.play();
        }

    } catch (error) {
        console.error('TTS error:', error);
        // Fallback to Web Speech API
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            speechSynthesis.speak(utterance);
        }
    }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    if (currentUser) {
        getCurrentUser().catch(console.error);
    }
});

// ==================== EXPORTS ====================
window.login = login;
window.register = register;
window.logout = logout;
window.loadTexts = loadTexts;
window.loadText = loadText;
window.analyzeAudio = analyzeAudio;
window.saveProblemWords = saveProblemWords;
window.getMyWords = getMyWords;
window.deleteWord = deleteWord;
window.markWordPracticed = markWordPracticed;
window.getWordStats = getWordStats;
window.speakWord = speakWord;
window.createText = createText;
window.deleteText = deleteText;
window.updateText = updateText;
window.getAllTextsForAdmin = getAllTextsForAdmin;
window.getAdminStats = getAdminStats;
window.currentUser = currentUser;
window.saveUserData = saveUserData;
window.clearUserData = clearUserData;
window.updateNavigation = updateNavigation;
