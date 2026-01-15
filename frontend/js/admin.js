// frontend/js/admin.js - Функции админ-панели

// Показать админ-вкладку - ОБНОВЛЕННАЯ
function showAdminTab(tabName) {
    console.log(`📊 Переключение на вкладку: ${tabName}`);

    // Скрыть все вкладки
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Убрать активность со всех кнопок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Показать выбранную вкладку
    const tab = document.getElementById(`${tabName}-tab`);
    const btn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);

    if (tab) {
        tab.classList.add('active');
        console.log(`✅ Вкладка ${tabName} активирована`);
    }

    if (btn) {
        btn.classList.add('active');
    }

    // Загрузить данные для вкладки
    switch(tabName) {
        case 'create-text':
            // Если это не редактирование, сбрасываем форму
            const submitBtn = document.querySelector('#create-text-form button[type="submit"]');
            if (!submitBtn || submitBtn.dataset.editMode !== 'true') {
                resetCreateTextForm();
            }
            break;
        case 'manage-texts':
            loadManageTexts();
            break;
        case 'statistics':
            loadAdminStatistics();
            break;
    }
}


// Сбросить форму создания текста
function resetCreateTextForm() {
    const form = document.getElementById('create-text-form');
    if (form) {
        form.reset();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Создать текст';
            submitBtn.onclick = null;
        }
    }
}

// Загрузить тексты для управления
async function loadManageTexts() {
    const container = document.getElementById('admin-texts-list');
    if (!container) return;

    container.innerHTML = '<div class="loading">Загрузка текстов...</div>';

    try {
        const texts = await getAllTextsForAdmin();

        if (texts.length === 0) {
            container.innerHTML = '<p class="text-center">Нет текстов</p>';
            return;
        }

        container.innerHTML = texts.map(text => `
            <div class="admin-text-item" data-text-id="${text.id}">
                <div class="admin-text-info">
                    <h4 class="font-bold">${escapeHtml(text.title)}</h4>
                    <div class="admin-text-meta">
                        <span>Уровень: ${text.level}</span>
                        <span>Тема: ${text.topic}</span>
                        <span>Добавлен: ${formatDate(text.created_at)}</span>
                    </div>
                    <div class="admin-text-content">
                        ${escapeHtml(text.content.substring(0, 100))}...
                    </div>
                </div>
                <div class="admin-text-actions">
                    <button class="btn btn-sm btn-primary" onclick="editText(${text.id})">
                        ✏️ Редактировать
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTextConfirm(${text.id})">
                        🗑️ Удалить
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading admin texts:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU');
}

// Подтверждение удаления текста
async function deleteTextConfirm(textId) {
    if (!confirm('Вы уверены, что хотите удалить этот текст?')) return;

    try {
        const result = await deleteText(textId);

        if (result.success) {
            showSuccess('Текст удален');
            loadManageTexts();
        } else {
            showError('Не удалось удалить текст');
        }

    } catch (error) {
        console.error('Error deleting text:', error);
        showError('Ошибка удаления');
    }
}

// Исправленная функция editText
async function editText(textId) {
    console.log(`📝 Редактирование текста ID: ${textId} (тип: ${typeof textId})`);

    try {
        // Убедимся, что textId - это число
        const numericTextId = parseInt(textId);
        if (isNaN(numericTextId)) {
            showError('Некорректный ID текста');
            return;
        }

        console.log(`🔍 Загрузка текста ID: ${numericTextId}`);
        const text = await loadText(numericTextId);

        if (!text) {
            showError('Текст не найден');
            return;
        }

        console.log('✅ Текст загружен:', text);

        // Переключаемся на вкладку
        showAdminTab('create-text');

        // Даем время для переключения
        setTimeout(() => {
            // Заполняем форму
            document.getElementById('text-title').value = text.title || '';
            document.getElementById('text-content').value = text.content || '';
            document.getElementById('text-level').value = text.level || '';
            document.getElementById('text-topic').value = text.topic || '';

            // Обновляем заголовок
            document.querySelector('#create-text-tab h2').textContent = 'Редактировать текст';

            // Обновляем кнопку
            const submitBtn = document.querySelector('#create-text-form button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Сохранить изменения';
                submitBtn.dataset.editMode = 'true';
                submitBtn.dataset.editId = numericTextId; // Используем числовой ID
            }

            // Фокус на поле
            document.getElementById('text-title').focus();

            showInfo(`Редактирование текста: "${text.title}"`);

        }, 100);

    } catch (error) {
        console.error('❌ Ошибка редактирования:', error);
        showError('Ошибка загрузки текста: ' + error.message);
    }
}

// Сбросить форму создания текста - ОБНОВЛЕННАЯ
function resetCreateTextForm() {
    // Очищаем поля
    document.getElementById('text-title').value = '';
    document.getElementById('text-content').value = '';
    document.getElementById('text-level').value = '';
    document.getElementById('text-topic').value = '';

    // Восстанавливаем заголовок
    const formTitle = document.querySelector('#create-text-tab h2');
    if (formTitle) {
        formTitle.textContent = 'Добавить новый текст';
    }

    // Восстанавливаем кнопку
    const submitBtn = document.querySelector('#create-text-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.textContent = 'Создать текст';
        submitBtn.dataset.editMode = 'false';
        delete submitBtn.dataset.editId;
    }

    // Фокус на первом поле
    setTimeout(() => {
        document.getElementById('text-title').focus();
    }, 50);
}


async function loadManageTexts() {
    const container = document.getElementById('admin-texts-list');
    if (!container) return;

    container.innerHTML = '<div class="loading">Загрузка текстов...</div>';

    try {
        const texts = await getAllTextsForAdmin();

        if (texts.length === 0) {
            container.innerHTML = `
                <div class="no-texts">
                    <p class="text-center">Нет текстов</p>
                    <button class="btn btn-primary mt-2" onclick="showAdminTab('create-text')">
                        ➕ Добавить первый текст
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = texts.map(text => {
            // Убедимся, что ID - число
            const textId = parseInt(text.id);
            return `
                <div class="admin-text-item" data-text-id="${textId}">
                    <div class="admin-text-info">
                        <h4 class="font-bold">${escapeHtml(text.title || 'Без названия')}</h4>
                        <div class="admin-text-meta">
                            <span>Уровень: ${text.level || 'Не указан'}</span>
                            <span>Тема: ${text.topic || 'Не указана'}</span>
                            <span>Добавлен: ${formatDate(text.created_at)}</span>
                        </div>
                        <div class="admin-text-content">
                            ${escapeHtml((text.content || '').substring(0, 100))}...
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading admin texts:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

// Обновляем обработчик формы в DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('👑 Admin module loaded');

    // Обработчик формы создания/редактирования текста
    const createTextForm = document.getElementById('create-text-form');
    if (createTextForm) {
        createTextForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();

            console.log('📝 Обработка формы текста');

            const textData = {
                title: document.getElementById('text-title').value.trim(),
                content: document.getElementById('text-content').value.trim(),
                level: document.getElementById('text-level').value,
                topic: document.getElementById('text-topic').value.trim()
            };

            // Проверка заполнения
            if (!textData.title) {
                showError('Введите название текста');
                return;
            }

            if (!textData.content) {
                showError('Введите содержимое текста');
                return;
            }

            if (!textData.level) {
                showError('Выберите уровень сложности');
                return;
            }

            if (!textData.topic) {
                showError('Введите тематику текста');
                return;
            }

            const submitBtn = this.querySelector('button[type="submit"]');
            const isEditMode = submitBtn.dataset.editMode === 'true';
            const textId = submitBtn.dataset.editId;

            console.log(`Режим: ${isEditMode ? 'Редактирование' : 'Создание'}, ID: ${textId}`);

            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = isEditMode ? 'Сохранение...' : 'Создание...';

            try {
                let result;
                if (isEditMode && textId) {
                    console.log(`Обновление текста ID: ${textId}`, textData);
                    result = await updateText(textId, textData);
                } else {
                    console.log('Создание нового текста', textData);
                    result = await createText(textData);
                }

                console.log('Результат операции:', result);

                if (result.success) {
                    const message = isEditMode ? 'Текст успешно обновлен!' : 'Текст успешно создан!';
                    showSuccess(message);

                    // Сбрасываем режим редактирования
                    submitBtn.dataset.editMode = 'false';
                    delete submitBtn.dataset.editId;
                    submitBtn.textContent = 'Создать текст';

                    // Очищаем форму
                    this.reset();

                    // Возвращаемся к списку текстов
                    showAdminTab('manage-texts');

                } else {
                    showError(result.message || (isEditMode ? 'Не удалось обновить текст' : 'Не удалось создать текст'));
                }
            } catch (error) {
                console.error('Ошибка сохранения текста:', error);
                showError('Ошибка: ' + (error.message || 'неизвестная ошибка'));
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});


// Загрузить статистику для админа
async function loadAdminStatistics() {
    const container = document.getElementById('admin-stats');
    if (!container) return;

    container.innerHTML = '<div class="loading">Загрузка статистики...</div>';

    try {
        const stats = await getAdminStats();
        const texts = await getAllTextsForAdmin();

        // Распределение по уровням
        const levelCounts = {};
        texts.forEach(text => {
            levelCounts[text.level] = (levelCounts[text.level] || 0) + 1;
        });

        const levelChart = Object.keys(levelCounts).map(level => {
            const count = levelCounts[level];
            const percent = (count / texts.length * 100).toFixed(1);
            return { level, count, percent };
        });

        container.innerHTML = `
            <div class="admin-stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.total_texts || 0}</div>
                    <p>Текстов</p>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_users || 0}</div>
                    <p>Пользователей</p>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.total_practices || 0}</div>
                    <p>Практик</p>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${texts.length}</div>
                    <p>Всего текстов</p>
                </div>
            </div>

            <div class="card mt-4">
                <h3 class="font-bold mb-3">Распределение текстов по уровням</h3>
                ${levelChart.length > 0 ? `
                    <div class="level-chart">
                        ${levelChart.map(item => `
                            <div class="level-chart-item">
                                <div class="level-chart-label">
                                    <span>${item.level}</span>
                                    <span>${item.count} (${item.percent}%)</span>
                                </div>
                                <div class="level-chart-bar">
                                    <div class="level-chart-fill" style="width: ${item.percent}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-center text-gray-500">Нет данных</p>'}
            </div>

            <div class="card mt-4">
                <h3 class="font-bold mb-3">Действия</h3>
                <div class="flex gap-2">
                    <button class="btn btn-primary" onclick="exportTexts()">
                        📁 Экспорт текстов
                    </button>
                    <button class="btn btn-secondary" onclick="refreshAdminStats()">
                        🔄 Обновить
                    </button>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading admin stats:', error);
        container.innerHTML = '<div class="error">Ошибка загрузки статистики</div>';
    }
}

// Обновить админ-статистику
function refreshAdminStats() {
    loadAdminStatistics();
    showInfo('Статистика обновлена');
}

// Экспорт текстов
function exportTexts() {
    showInfo('Функция экспорта в разработке');
    // Здесь можно реализовать экспорт текстов в CSV или JSON
}

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', function() {
    console.log('👑 Admin module loaded');

    // Обработчик формы создания текста
    const createTextForm = document.getElementById('create-text-form');
    if (createTextForm) {
        createTextForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const textData = {
                title: document.getElementById('text-title').value,
                content: document.getElementById('text-content').value,
                level: document.getElementById('text-level').value,
                topic: document.getElementById('text-topic').value
            };

            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Сохранение...';

            try {
                const result = await createText(textData);

                if (result.success) {
                    showSuccess('Текст создан!');
                    this.reset();
                    showAdminTab('manage-texts');
                } else {
                    showError('Не удалось создать текст');
                }
            } catch (error) {
                console.error('Error creating text:', error);
                showError('Ошибка создания текста');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
});

// ==================== EXPORTS ====================
window.showAdminTab = showAdminTab;
window.deleteTextConfirm = deleteTextConfirm;
window.editText = editText;
window.refreshAdminStats = refreshAdminStats;
window.exportTexts = exportTexts;