// frontend/js/utils.js - ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

// ==================== UI UTILITIES ====================

// Показать уведомление об ошибке
function showError(message) {
    // Создаем контейнер если нет
    let errorContainer = document.getElementById('notification-container');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'notification-container';
        errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(errorContainer);
    }

    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <div style="
            background: #fee;
            border: 2px solid #f00;
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
        ">
            <span style="font-size: 20px;">❌</span>
            <div>
                <strong style="display: block; margin-bottom: 4px;">Ошибка</strong>
                <span>${escapeHtml(message)}</span>
            </div>
        </div>
    `;

    errorContainer.appendChild(notification);

    // Автоматически удаляем через 5 секунд
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Показать успешное уведомление
function showSuccess(message) {
    let successContainer = document.getElementById('notification-container');
    if (!successContainer) {
        successContainer = document.createElement('div');
        successContainer.id = 'notification-container';
        successContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(successContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `
        <div style="
            background: #dfd;
            border: 2px solid #0a0;
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
        ">
            <span style="font-size: 20px;">✅</span>
            <div>
                <strong style="display: block; margin-bottom: 4px;">Успех</strong>
                <span>${escapeHtml(message)}</span>
            </div>
        </div>
    `;

    successContainer.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Показать информационное уведомление
function showInfo(message) {
    let infoContainer = document.getElementById('notification-container');
    if (!infoContainer) {
        infoContainer = document.createElement('div');
        infoContainer.id = 'notification-container';
        infoContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
        `;
        document.body.appendChild(infoContainer);
    }

    const notification = document.createElement('div');
    notification.className = 'notification info';
    notification.innerHTML = `
        <div style="
            background: #e3f2fd;
            border: 2px solid #2196f3;
            padding: 12px 16px;
            margin: 8px 0;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 10px;
        ">
            <span style="font-size: 20px;">ℹ️</span>
            <div>
                <strong style="display: block; margin-bottom: 4px;">Информация</strong>
                <span>${escapeHtml(message)}</span>
            </div>
        </div>
    `;

    infoContainer.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== STRING UTILITIES ====================

// Форматирование времени (секунды в MM:SS)
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Сокращение длинного текста
function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Форматирование числа с разделителями
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ==================== VALIDATION UTILITIES ====================

// Валидация email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Валидация пароля
function isValidPassword(password) {
    return password && password.length >= 6;
}

// Валидация имени пользователя
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

// ==================== STORAGE UTILITIES ====================

// Безопасное сохранение в localStorage
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        showError('Не удалось сохранить данные. Проверьте настройки браузера.');
        return false;
    }
}

// Безопасное получение из localStorage
function safeGetItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error reading from localStorage:', error);
        return defaultValue;
    }
}

// Очистка данных пользователя
function clearUserData() {
    const keys = ['auth_token', 'current_user', 'user_settings'];
    keys.forEach(key => localStorage.removeItem(key));
}

// ==================== DOM UTILITIES ====================

// Создание элемента с атрибутами
function createElement(tag, attributes = {}, text = '') {
    const element = document.createElement(tag);

    // Устанавливаем атрибуты
    Object.keys(attributes).forEach(key => {
        if (key === 'className') {
            element.className = attributes[key];
        } else if (key === 'style' && typeof attributes[key] === 'object') {
            Object.assign(element.style, attributes[key]);
        } else {
            element.setAttribute(key, attributes[key]);
        }
    });

    // Устанавливаем текст
    if (text) {
        element.textContent = text;
    }

    return element;
}

// Добавление множества элементов
function appendChildren(parent, children) {
    children.forEach(child => {
        if (child instanceof Node) {
            parent.appendChild(child);
        } else if (typeof child === 'string') {
            parent.appendChild(document.createTextNode(child));
        }
    });
    return parent;
}

// Удаление всех детей элемента
function removeAllChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// ==================== DEBOUNCE & THROTTLE ====================

// Дебаунс функция
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Троттлинг функция
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ==================== URL UTILITIES ====================

// Получение параметров URL
function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Обновление параметров URL без перезагрузки
function updateUrlParams(params) {
    const url = new URL(window.location);
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    window.history.pushState({}, '', url);
}

// ==================== FILE UTILITIES ====================

// Чтение файла как Data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Чтение файла как ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Скачивание файла
function downloadFile(data, filename, type = 'application/octet-stream') {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== OTHER UTILITIES ====================

// Случайное число в диапазоне
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Задержка
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Генерация уникального ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Проверка мобильного устройства
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Проверка поддержки функций
function checkFeatures() {
    const features = {
        localStorage: !!window.localStorage,
        fetch: !!window.fetch,
        webAudio: !!window.AudioContext || !!window.webkitAudioContext,
        mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        webWorker: !!window.Worker
    };

    return features;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('Utils module loaded');

    // Проверяем поддержку необходимых функций
    const features = checkFeatures();
    if (!features.localStorage) {
        showError('Ваш браузер не поддерживает localStorage. Некоторые функции могут не работать.');
    }

    if (!features.fetch) {
        showError('Ваш браузер устарел. Пожалуйста, обновите его.');
    }
});
// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return 'Не указана';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return 'Неизвестно';
    }
}

// Экспортируем функции
window.showError = showError;
window.showSuccess = showSuccess;
window.showInfo = showInfo;
window.formatTime = formatTime;
window.isValidEmail = isValidEmail;
window.isValidPassword = isValidPassword;
window.isValidUsername = isValidUsername;
window.safeSetItem = safeSetItem;
window.safeGetItem = safeGetItem;
window.clearUserData = clearUserData;
window.truncateText = truncateText;
window.formatNumber = formatNumber;
window.escapeHtml = escapeHtml;
window.formatDate = formatDate;