// frontend/js/recording.js - Обновленная система записи с раздельными кнопками

// ==================== GLOBAL STATE ====================
let recordingState = {
    isRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audioChunks: [],

    // Таймер
    startTime: 0,
    timerInterval: null,

    // Визуализация
    animationId: null,
    analyser: null,
    audioContext: null,

    // Результат
    currentBlob: null
};

// ==================== CORE RECORDING FUNCTIONS ====================

// Инициализация системы записи
async function initializeRecordingSystem() {
    console.log('🎵 Инициализация системы записи...');

    try {
        // Проверяем поддержку
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Ваш браузер не поддерживает запись аудио');
        }

        // Проверяем поддержку MediaRecorder
        if (!window.MediaRecorder) {
            throw new Error('Ваш браузер не поддерживает MediaRecorder API');
        }

        // Получаем список доступных кодеков
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ];

        let supportedMimeType = null;
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                supportedMimeType = mimeType;
                console.log(`✅ Поддерживаемый формат: ${mimeType}`);
                break;
            }
        }

        if (!supportedMimeType) {
            throw new Error('Ваш браузер не поддерживает запись аудио в доступных форматах');
        }

        // Запрашиваем доступ к микрофону
        console.log('🔐 Запрос доступа к микрофону...');
        recordingState.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,            // Моно
                sampleRate: 16000,          // Для STT
                echoCancellation: true,     // Подавление эха
                noiseSuppression: true,     // Подавление шума
                autoGainControl: false      // Отключаем автоусиление
            },
            video: false
        });

        console.log('✅ Доступ к микрофону получен');

        // Инициализируем AudioContext для визуализации
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        recordingState.audioContext = new AudioContextClass({
            sampleRate: 16000
        });

        // Создаем анализатор для визуализации
        recordingState.analyser = recordingState.audioContext.createAnalyser();
        recordingState.analyser.fftSize = 256;
        recordingState.analyser.smoothingTimeConstant = 0.8;

        // Подключаем микрофон к анализатору
        const source = recordingState.audioContext.createMediaStreamSource(recordingState.mediaStream);
        source.connect(recordingState.analyser);

        console.log('✅ Система записи инициализирована');
        return true;

    } catch (error) {
        console.error('❌ Ошибка инициализации записи:', error);
        cleanupRecordingResources();
        throw error;
    }
}

// Начать запись
async function startRecording() {
    console.log('🔴 НАЧАЛО ЗАПИСИ');

    // Проверяем авторизацию
    if (!currentUser) {
        showError('Для записи необходимо войти в систему');
        showPage('login');
        return;
    }

    // Проверяем наличие текста
    if (!currentText) {
        showError('Сначала выберите текст для практики');
        showPage('library');
        return;
    }

    if (recordingState.isRecording) {
        console.warn('Запись уже идет');
        return;
    }

    // Сбрасываем предыдущий blob
    recordingState.currentBlob = null;
    window.audioBlob = null;
    recordingState.audioChunks = [];

    try {
        // Инициализируем систему записи если нужно
        if (!recordingState.mediaStream || recordingState.mediaStream.active === false) {
            console.log('🔄 Инициализируем систему записи...');
            await initializeRecordingSystem();
        }

        // Определяем поддерживаемый формат
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ];

        let supportedMimeType = 'audio/webm';
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                supportedMimeType = mimeType;
                break;
            }
        }

        console.log(`🎤 Используем формат: ${supportedMimeType}`);

        // Создаем MediaRecorder
        recordingState.mediaRecorder = new MediaRecorder(recordingState.mediaStream, {
            mimeType: supportedMimeType,
            audioBitsPerSecond: 128000
        });

        // Обработчики событий
        recordingState.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordingState.audioChunks.push(event.data);
                console.log(`📊 Получен чанк: ${event.data.size} байт`);
            }
        };

        recordingState.mediaRecorder.onstop = async () => {
            console.log(`🛑 MediaRecorder остановлен. Чанков: ${recordingState.audioChunks.length}`);
            await processRecording();
        };

        recordingState.mediaRecorder.onerror = (event) => {
            console.error('Ошибка MediaRecorder:', event.error);
            showError('Ошибка записи: ' + event.error.message);
            resetRecordingState();
        };

        // Устанавливаем состояние
        recordingState.isRecording = true;
        recordingState.startTime = Date.now();

        // Начинаем запись
        recordingState.mediaRecorder.start(100); // Собираем данные каждые 100мс

        // Обновляем UI
        updateRecordingUI('recording');

        // Запускаем таймер
        startRecordingTimer();

        // Запускаем визуализацию
        startAudioVisualization();

        console.log('✅ Запись начата');

    } catch (error) {
        console.error('❌ Ошибка начала записи:', error);

        let errorMessage = 'Не удалось начать запись. ';

        if (error.name === 'NotAllowedError') {
            errorMessage += 'Разрешите доступ к микрофону в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Микрофон не найден. Подключите микрофон.';
        } else if (error.name === 'NotReadableError') {
            errorMessage += 'Микрофон используется другим приложением.';
        } else {
            errorMessage += error.message;
        }

        showError(errorMessage);
        updateRecordingUI('error');
        cleanupRecordingResources();
    }
}

// Остановить запись
async function stopRecording() {
    console.log('⏹️ ОСТАНОВКА ЗАПИСИ');

    if (!recordingState.isRecording || !recordingState.mediaRecorder) {
        console.warn('Запись не идет');
        return;
    }

    // Меняем состояние
    recordingState.isRecording = false;

    // Останавливаем таймер
    stopRecordingTimer();

    // Останавливаем визуализацию
    stopAudioVisualization();

    // Обновляем UI
    updateRecordingUI('processing');

    try {
        // Проверяем состояние MediaRecorder
        if (recordingState.mediaRecorder.state === 'recording') {
            console.log('🛑 Останавливаем MediaRecorder...');
            recordingState.mediaRecorder.stop();
            console.log('✅ Команда остановки отправлена');
        } else {
            console.log(`⚠️ MediaRecorder уже в состоянии: ${recordingState.mediaRecorder.state}`);
            // Если уже остановлен, вызываем обработчик вручную
            await processRecording();
        }
    } catch (error) {
        console.error('❌ Ошибка при остановке записи:', error);
        showError('Ошибка остановки записи: ' + error.message);
        updateRecordingUI('error');

        // Пытаемся восстановить состояние
        resetRecordingState();
    }
}

// Обработка записи после остановки
async function processRecording() {
    console.log(`🎵 Обработка записи. Чанков: ${recordingState.audioChunks.length}`);

    try {
        if (recordingState.audioChunks.length === 0) {
            throw new Error('Нет аудиоданных');
        }

        // Создаем Blob из чанков
        const audioBlob = new Blob(recordingState.audioChunks, {
            type: recordingState.mediaRecorder.mimeType
        });

        console.log(`📦 Исходный аудиофайл: ${audioBlob.size} байт, тип: ${audioBlob.type}`);

        // Конвертируем в WAV
        const wavBlob = await convertToWAV(audioBlob);

        console.log(`✅ WAV файл создан: ${wavBlob.size} байт`);

        // Сохраняем результат
        recordingState.currentBlob = wavBlob;
        window.audioBlob = wavBlob;

        // Обновляем UI
        updateRecordingUI('success', wavBlob);

    } catch (error) {
        console.error('❌ Ошибка обработки записи:', error);
        showError('Ошибка обработки записи: ' + error.message);
        updateRecordingUI('error');
    } finally {
        // Очищаем MediaRecorder
        recordingState.mediaRecorder = null;
    }
}

// Сбросить состояние записи
function resetRecordingState() {
    recordingState.isRecording = false;
    recordingState.mediaRecorder = null;
    recordingState.audioChunks = [];

    // Обновляем UI
    updateRecordingUI('idle');
}

// Сбросить запись и начать заново
function resetRecording() {
    // Очищаем ресурсы
    cleanupRecordingResources();

    // Сбрасываем состояние
    resetRecordingState();

    // Показываем кнопки записи
    document.getElementById('start-record-btn').style.display = 'block';
    document.getElementById('stop-record-btn').style.display = 'none';
    document.getElementById('recording-result').style.display = 'none';

    // Сбрасываем таймер
    document.getElementById('timer').textContent = '00:00';

    // Сбрасываем статус
    const statusElement = document.getElementById('recording-status');
    if (statusElement) {
        statusElement.className = 'recording-status status-idle';
        statusElement.textContent = 'Готов к записи';
    }

    showInfo('Запись сброшена. Готово к новой записи.');
}

// Конвертация аудио в WAV формат
async function convertToWAV(audioBlob) {
    console.log('🔄 Конвертация в WAV...');

    try {
        // Создаем AudioContext
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });

        // Загружаем аудиофайл
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        console.log(`📊 Аудио данные: ${audioBuffer.length} семплов, ${audioBuffer.sampleRate} Гц`);

        // Создаем WAV файл
        const wavBuffer = audioBufferToWAV(audioBuffer);
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

        // Закрываем AudioContext
        await audioContext.close();

        return wavBlob;

    } catch (error) {
        console.error('❌ Ошибка конвертации в WAV:', error);
        throw error;
    }
}

// Конвертация AudioBuffer в WAV
function audioBufferToWAV(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Получаем данные из всех каналов
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    // Интерливинг каналов
    const interleaved = new Float32Array(length * numChannels);
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            interleaved[i * numChannels + channel] = channels[channel][i];
        }
    }

    return createWAVFromFloat32Array(interleaved, sampleRate, numChannels);
}

// Создание WAV файла из Float32Array
function createWAVFromFloat32Array(float32Array, sampleRate, numChannels = 1) {
    // Параметры WAV файла
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = float32Array.length * bytesPerSample;

    // Создаем буфер для WAV файла
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Записываем заголовок RIFF/WAVE
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);           // Размер fmt chunk
    view.setUint16(20, 1, true);            // Аудио формат (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Записываем PCM данные
    let offset = 44;
    const scale = 32767;

    for (let i = 0; i < float32Array.length; i++) {
        let sample = Math.max(-1, Math.min(1, float32Array[i]));
        sample = sample * scale;
        view.setInt16(offset, sample, true);
        offset += 2;
    }

    return buffer;
}

// Вспомогательная функция для записи строк
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// ==================== TIMER FUNCTIONS ====================

// Запуск таймера
function startRecordingTimer() {
    recordingState.startTime = Date.now();
    recordingState.timerInterval = setInterval(updateRecordingTimer, 100);
    updateRecordingTimer();
}

// Обновление таймера
function updateRecordingTimer() {
    const timerElement = document.getElementById('timer');
    if (!timerElement) return;

    const elapsed = Date.now() - recordingState.startTime;
    const totalSeconds = elapsed / 1000;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((elapsed % 1000) / 10);

    timerElement.textContent =
    `${minutes.toString().padStart(2, '0')}:` +
    `${seconds.toString().padStart(2, '0')}.` +
    `${milliseconds.toString().padStart(2, '0')}`;
}

// Остановка таймера
function stopRecordingTimer() {
    if (recordingState.timerInterval) {
        clearInterval(recordingState.timerInterval);
        recordingState.timerInterval = null;
    }
}

// ==================== VISUALIZATION ====================

// Запуск визуализации аудио
function startAudioVisualization() {
    if (!recordingState.analyser || !recordingState.isRecording) return;

    const visualizer = document.getElementById('audio-visualizer');
    if (!visualizer) return;

    const bufferLength = recordingState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function drawVisualization() {
        if (!recordingState.isRecording || !recordingState.analyser) {
            recordingState.animationId = null;
            return;
        }

        // Получаем данные частот
        recordingState.analyser.getByteFrequencyData(dataArray);

        // Очищаем визуализатор
        visualizer.innerHTML = '';

        // Создаем бары визуализации
        const barCount = 40;
        const maxBarHeight = 80;

        for (let i = 0; i < barCount; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';

            // Вычисляем высоту бара
            const dataIndex = Math.floor(i * dataArray.length / barCount);
            const value = dataArray[dataIndex];
            const height = (value / 255) * maxBarHeight;

            bar.style.height = `${Math.max(height, 2)}px`;

            // Цвет в зависимости от громкости
            if (value > 200) {
                bar.style.backgroundColor = '#ef4444';
            } else if (value > 150) {
                bar.style.backgroundColor = '#f59e0b';
            } else if (value > 100) {
                bar.style.backgroundColor = '#10b981';
            } else {
                bar.style.backgroundColor = '#3b82f6';
            }

            visualizer.appendChild(bar);
        }

        // Запускаем следующий кадр
        recordingState.animationId = requestAnimationFrame(drawVisualization);
    }

    // Запускаем анимацию
    recordingState.animationId = requestAnimationFrame(drawVisualization);
}

// Остановка визуализации
function stopAudioVisualization() {
    if (recordingState.animationId) {
        cancelAnimationFrame(recordingState.animationId);
        recordingState.animationId = null;
    }

    const visualizer = document.getElementById('audio-visualizer');
    if (visualizer) {
        visualizer.innerHTML = '';
    }
}

// ==================== UI UPDATES ====================

// Обновление UI в зависимости от состояния
function updateRecordingUI(state, wavBlob = null) {
    const statusElement = document.getElementById('recording-status');
    const startBtn = document.getElementById('start-record-btn');
    const stopBtn = document.getElementById('stop-record-btn');
    const resultElement = document.getElementById('recording-result');

    switch (state) {
        case 'idle':
            if (statusElement) {
                statusElement.className = 'recording-status status-idle';
                statusElement.textContent = 'Готов к записи';
            }
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (resultElement) resultElement.style.display = 'none';
            break;

        case 'recording':
            if (statusElement) {
                statusElement.className = 'recording-status status-recording';
                statusElement.textContent = '🎤 Идет запись... Говорите четко!';
            }
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'block';
            if (resultElement) resultElement.style.display = 'none';
            break;

        case 'processing':
            if (statusElement) {
                statusElement.className = 'recording-status status-processing';
                statusElement.textContent = '⏳ Обработка записи...';
            }
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
            if (resultElement) resultElement.style.display = 'none';
            break;

        case 'success':
            if (statusElement) {
                statusElement.className = 'recording-status status-success';
                statusElement.textContent = '✅ Запись готова!';
            }
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
            if (resultElement) resultElement.style.display = 'block';

            if (wavBlob) {
                updateFileInfo(wavBlob);
            }
            break;

        case 'error':
            if (statusElement) {
                statusElement.className = 'recording-status status-idle';
                statusElement.textContent = '❌ Ошибка записи';
            }
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            if (resultElement) resultElement.style.display = 'none';
            break;
    }
}

// Обновление информации о файле
function updateFileInfo(wavBlob) {
    if (!wavBlob) return;

    const durationElement = document.getElementById('recording-file-duration');
    const sizeElement = document.getElementById('recording-file-size');

    if (durationElement && sizeElement) {
        // Для WAV файла: dataSize = размер файла - 44 байта заголовка
        const dataSize = wavBlob.size - 44;
        const durationInSeconds = dataSize / (16000 * 2); // 16kHz, 16-bit = 2 байта на сэмпл

        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = Math.floor(durationInSeconds % 60);

        durationElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Размер файла
        const sizeInKB = (wavBlob.size / 1024).toFixed(1);
        sizeElement.textContent = `${sizeInKB} KB`;

        console.log(`📊 Информация о файле: ${minutes}:${seconds}, ${sizeInKB} KB`);

        // Проверка на слишком короткую запись
        if (durationInSeconds < 1) {
            showWarning('Запись слишком короткая. Говорите дольше.');
        } else if (durationInSeconds > 300) {
            showWarning('Запись очень длинная. Для анализа рекомендуется не более 5 минут.');
        }
    }
}

// ==================== CLEANUP FUNCTIONS ====================

// Очистка ресурсов записи
function cleanupRecordingResources() {
    console.log('🧹 Очистка ресурсов записи...');

    // Останавливаем таймер
    stopRecordingTimer();

    // Останавливаем визуализацию
    stopAudioVisualization();

    // Останавливаем MediaRecorder
    if (recordingState.mediaRecorder && recordingState.mediaRecorder.state !== 'inactive') {
        try {
            recordingState.mediaRecorder.stop();
        } catch (e) {
            console.log('⚠️ MediaRecorder уже остановлен');
        }
        recordingState.mediaRecorder = null;
    }

    // Останавливаем поток микрофона
    if (recordingState.mediaStream) {
        recordingState.mediaStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {
                console.log('⚠️ Трек уже остановлен');
            }
        });
        recordingState.mediaStream = null;
    }

    // Закрываем AudioContext
    if (recordingState.audioContext && recordingState.audioContext.state !== 'closed') {
        recordingState.audioContext.close().then(() => {
            console.log('✅ AudioContext закрыт');
        }).catch(error => {
            console.warn('⚠️ Ошибка закрытия AudioContext:', error);
        });
        recordingState.audioContext = null;
    }

    console.log('✅ Очистка завершена');
}

// ==================== PRACTICE RECORDING ====================

// Практика записи (упрощенная версия)
let practiceRecordingState = {
    isRecording: false,
    mediaStream: null,
    mediaRecorder: null,
    audioChunks: []
};

async function startPracticeRecording() {
    console.log('🎯 Начало записи практики...');

    if (practiceRecordingState.isRecording) return;

    try {
        // Запрашиваем микрофон
        practiceRecordingState.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1
            }
        });

        // Определяем поддерживаемый формат
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus'
        ];

        let supportedMimeType = 'audio/webm';
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                supportedMimeType = mimeType;
                break;
            }
        }

        // Создаем MediaRecorder
        practiceRecordingState.mediaRecorder = new MediaRecorder(practiceRecordingState.mediaStream, {
            mimeType: supportedMimeType,
            audioBitsPerSecond: 128000
        });

        // Сбрасываем чанки
        practiceRecordingState.audioChunks = [];

        // Обработчики событий
        practiceRecordingState.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                practiceRecordingState.audioChunks.push(event.data);
            }
        };

        practiceRecordingState.mediaRecorder.onstop = async () => {
            try {
                if (practiceRecordingState.audioChunks.length > 0) {
                    const audioBlob = new Blob(practiceRecordingState.audioChunks, {
                        type: practiceRecordingState.mediaRecorder.mimeType
                    });

                    // Конвертируем в WAV
                    const wavBlob = await convertToWAV(audioBlob);
                    window.practiceAudioBlob = wavBlob;
                    console.log('✅ Практика записана:', wavBlob.size);
                }
            } catch (error) {
                console.error('Ошибка обработки практики:', error);
            }
        };

        practiceRecordingState.isRecording = true;

        // Обновляем UI
        const statusElement = document.getElementById('practice-status');
        const buttonElement = document.getElementById('practice-record-btn');
        const saveButton = document.getElementById('save-practice-btn');

        if (statusElement) {
            statusElement.className = 'recording-status status-recording';
            statusElement.textContent = '🎤 Идет запись...';
        }

        if (buttonElement) {
            buttonElement.innerHTML = '<span>⏹️</span> Остановить';
            buttonElement.className = 'btn btn-danger';
            buttonElement.onclick = stopPracticeRecording;
        }

        if (saveButton) {
            saveButton.style.display = 'none';
        }

        startPracticeTimer();
        practiceRecordingState.mediaRecorder.start(100);

    } catch (error) {
        console.error('Ошибка записи практики:', error);
        showError('Не удалось начать запись');
    }
}

function stopPracticeRecording() {
    if (!practiceRecordingState.isRecording) return;

    practiceRecordingState.isRecording = false;
    stopPracticeTimer();

    // Останавливаем запись
    if (practiceRecordingState.mediaRecorder) {
        practiceRecordingState.mediaRecorder.stop();
    }

    // Очистка ресурсов
    if (practiceRecordingState.mediaStream) {
        practiceRecordingState.mediaStream.getTracks().forEach(track => track.stop());
        practiceRecordingState.mediaStream = null;
    }

    // Обновляем UI
    const statusElement = document.getElementById('practice-status');
    const buttonElement = document.getElementById('practice-record-btn');
    const saveButton = document.getElementById('save-practice-btn');

    if (statusElement) {
        statusElement.className = 'recording-status status-idle';
        statusElement.textContent = 'Запись остановлена';
    }

    if (buttonElement) {
        buttonElement.innerHTML = '<span>🎤</span> Записать снова';
        buttonElement.className = 'btn btn-primary';
        buttonElement.onclick = startPracticeRecording;
    }

    if (saveButton) {
        saveButton.style.display = 'block';
    }
}

// Таймер для практики
let practiceTimerInterval = null;
let practiceStartTime = 0;

function startPracticeTimer() {
    practiceStartTime = Date.now();
    const timerElement = document.getElementById('practice-timer');

    if (!timerElement) return;

    practiceTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - practiceStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timerElement.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopPracticeTimer() {
    if (practiceTimerInterval) {
        clearInterval(practiceTimerInterval);
        practiceTimerInterval = null;
    }

    const timerElement = document.getElementById('practice-timer');
    if (timerElement) {
        timerElement.textContent = '00:00';
    }
}

// Сохранение записи практики
async function savePracticeRecording() {
    const practiceWords = window.practiceWords || [];
    const currentPracticeIndex = window.currentPracticeIndex || 0;

    if (currentPracticeIndex >= practiceWords.length) {
        showError('Слово не найдено');
        return;
    }

    const currentWord = practiceWords[currentPracticeIndex];
    if (!currentWord || !currentWord.id) {
        showError('Слово не найдено');
        return;
    }

    try {
        if (!window.practiceAudioBlob) {
            showError('Нет записи для сохранения. Сначала запишите произношение.');
            return;
        }

        console.log('Practice WAV:', window.practiceAudioBlob.size);

        // Отмечаем слово как отработанное
        const result = await markWordPracticed(currentWord.id);

        if (result && result.success) {
            showSuccess(`Слово "${currentWord.word}" отмечено как отработанное!`);

            // Обновляем UI
            const saveBtn = document.getElementById('save-practice-btn');
            const recordBtn = document.getElementById('practice-record-btn');
            const nextBtn = document.getElementById('next-word-btn');
            const status = document.getElementById('practice-status');

            if (saveBtn) {
                saveBtn.style.display = 'none';
                saveBtn.disabled = true;
            }

            if (recordBtn) {
                recordBtn.style.display = 'none';
                recordBtn.disabled = true;
            }

            if (nextBtn) {
                nextBtn.style.display = 'block';
                nextBtn.disabled = false;
            }

            if (status) {
                status.className = 'recording-status status-success';
                status.textContent = '✓ Запись сохранена! Нажмите "Следующее слово"';
            }

        } else {
            showError('Не удалось отметить слово как отработанное');
        }

    } catch (error) {
        console.error('Error saving practice recording:', error);
        showError('Ошибка при сохранении результата: ' + error.message);
    } finally {
        // Очищаем данные
        window.practiceAudioBlob = null;
    }
}

// ==================== INITIALIZATION ====================

// Проверка поддержки функций
function checkRecordingSupport() {
    const features = {
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        mediaRecorder: !!window.MediaRecorder,
        audioContext: !!(window.AudioContext || window.webkitAudioContext),
        blob: !!window.Blob
    };

    console.log('🔍 Проверка поддержки записи:', features);

    if (!features.getUserMedia) {
        showError('Ваш браузер не поддерживает доступ к микрофону');
        return false;
    }

    if (!features.mediaRecorder) {
        showError('Ваш браузер не поддерживает MediaRecorder API');
        return false;
    }

    return true;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Модуль записи загружен');

    // Проверяем поддержку
    if (!checkRecordingSupport()) {
        const startBtn = document.getElementById('start-record-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Запись не поддерживается';
        }
    }
});

// ==================== EXPORTS ====================
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.resetRecording = resetRecording;
window.startPracticeRecording = startPracticeRecording;
window.stopPracticeRecording = stopPracticeRecording;
window.savePracticeRecording = savePracticeRecording;
window.cleanupRecordingResources = cleanupRecordingResources;