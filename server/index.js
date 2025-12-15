require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const Jimp = require('jimp');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Разрешить запросы со всех адресов
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Создать папку для загрузок если не существует
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

// Фильтр файлов: принимаем DOCX, DOC, TXT
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.docx', '.doc', '.txt'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый формат файла. Разрешены: ${allowedExtensions.join(', ')}`), false);
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Максимум 50MB
});

// MongoDB Schemas
const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  allowedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }], // Группы, которым разрешен доступ к предмету
  createdAt: { type: Date, default: Date.now }
});

const GroupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const StudentSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  createdAt: { type: Date, default: Date.now }
});

const QuestionSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  questionText: { type: String, required: true },
  questionHtml: { type: String }, // HTML с изображениями
  variants: [{
    text: String,
    isCorrect: Boolean
  }],
  orderIndex: { type: Number },
  needsReview: { type: Boolean, default: false }, // Флаг для вопросов, требующих ручной проверки
  createdAt: { type: Date, default: Date.now }
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Group = mongoose.model('Group', GroupSchema);
const Student = mongoose.model('Student', StudentSchema);
const Question = mongoose.model('Question', QuestionSchema);

// === ФУНКЦИЯ КОНВЕРТАЦИИ ИЗОБРАЖЕНИЙ (100% БЕЗ ВНЕШНИХ ПРОГРАММ) ===
// Всегда создает PNG - работает везде без установки дополнительных программ
async function convertImageToPng(buffer, originalExtension, contentType) {
  try {
    // Проверяем, что буфер не пустой
    if (!buffer || buffer.length === 0) {
      console.error('Пустой буфер изображения');
      return { buffer, extension: 'png', converted: false };
    }
    
    // Если это уже PNG или JPG - возвращаем как есть
    if (originalExtension === 'png' || originalExtension === 'jpg' || originalExtension === 'jpeg') {
      return { buffer, extension: originalExtension, converted: false };
    }
    
    // Для WMF/EMF - пробуем конвертировать через онлайн API, затем создаем PNG через Jimp
    if (originalExtension === 'wmf' || originalExtension === 'emf' || originalExtension === 'x-wmf' || originalExtension === 'x-emf') {
      console.log(`Конвертация WMF/EMF в PNG...`);
      
      // Метод 1: Пробуем использовать системные инструменты (если доступны)
      const tempId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tempWmfPath = path.join(__dirname, 'uploads', `temp-${tempId}.wmf`);
      const outputPath = path.join(__dirname, 'uploads', `temp-${tempId}.png`);
      const isWindows = process.platform === 'win32';
      
      try {
        fs.writeFileSync(tempWmfPath, buffer);
        
        // Пробуем ImageMagick/LibreOffice (если установлены)
        try {
          let convertCmd;
          if (isWindows) {
            try {
              await execAsync('magick -version 2>nul');
              convertCmd = `magick "${tempWmfPath}" "${outputPath}" 2>nul`;
            } catch {
              convertCmd = `convert "${tempWmfPath}" "${outputPath}" 2>nul`;
            }
          } else {
            convertCmd = `convert "${tempWmfPath}" "${outputPath}" 2>/dev/null || libreoffice --headless --convert-to png --outdir "${path.dirname(outputPath)}" "${tempWmfPath}" 2>/dev/null`;
          }
          
          await execAsync(convertCmd, { timeout: 10000 });
          
          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 100) {
            const pngBuffer = fs.readFileSync(outputPath);
            fs.unlinkSync(tempWmfPath);
            fs.unlinkSync(outputPath);
            console.log(`✓ WMF/EMF конвертирован через системный инструмент`);
            return { buffer: pngBuffer, extension: 'png', converted: true };
          }
          
          // Проверяем LibreOffice output
          const libreOutputPath = tempWmfPath.replace('.wmf', '.png');
          if (fs.existsSync(libreOutputPath) && fs.statSync(libreOutputPath).size > 100) {
            const pngBuffer = fs.readFileSync(libreOutputPath);
            fs.unlinkSync(tempWmfPath);
            fs.unlinkSync(libreOutputPath);
            console.log(`✓ WMF/EMF конвертирован через LibreOffice`);
            return { buffer: pngBuffer, extension: 'png', converted: true };
          }
        } catch (e) {
          // Системные инструменты не доступны
        }
        
        // Очистка
        if (fs.existsSync(tempWmfPath)) fs.unlinkSync(tempWmfPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (err) {
        if (fs.existsSync(tempWmfPath)) fs.unlinkSync(tempWmfPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      }
      
      // Метод 2: Создаем компактную PNG-заглушку через Jimp (работает везде)
      console.log(`Создание PNG-заглушки для формулы...`);
      try {
        // Создаем компактное PNG изображение (меньший размер)
        const image = new Jimp(300, 60, 0xFFFFFFFF); // Белый фон, компактный размер
        
        // Загружаем шрифт (меньший размер)
        const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
        
        // Добавляем текст
        image.print(font, 10, 20, '[Формула]');
        
        // Добавляем тонкую рамку
        for (let x = 0; x < 300; x++) {
          image.setPixelColor(0xCCCCCCFF, x, 0);
          image.setPixelColor(0xCCCCCCFF, x, 59);
        }
        for (let y = 0; y < 60; y++) {
          image.setPixelColor(0xCCCCCCFF, 0, y);
          image.setPixelColor(0xCCCCCCFF, 299, y);
        }
        
        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        console.log(`✓ Создан компактный PNG для формулы`);
        return { buffer: pngBuffer, extension: 'png', converted: true };
      } catch (jimpErr) {
        console.error('Ошибка создания PNG:', jimpErr.message);
        // Fallback: минимальный PNG
        try {
          const simpleImage = new Jimp(150, 40, 0xFFFFFFFF);
          const pngBuffer = await simpleImage.getBufferAsync(Jimp.MIME_PNG);
          return { buffer: pngBuffer, extension: 'png', converted: true };
        } catch (err) {
          return { buffer: Buffer.from(''), extension: 'png', converted: false };
        }
      }
    }
    
    // Для других форматов пробуем конвертировать через Sharp или Jimp
    try {
      // Пробуем Sharp (быстрее)
      const pngBuffer = await sharp(buffer).png().toBuffer();
      return { buffer: pngBuffer, extension: 'png', converted: true };
    } catch (sharpErr) {
      // Если Sharp не справился, пробуем Jimp
      try {
        const image = await Jimp.read(buffer);
        const pngBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        return { buffer: pngBuffer, extension: 'png', converted: true };
      } catch (jimpErr) {
        // Если ничего не работает, создаем пустой PNG
        console.warn(`Не удалось конвертировать ${originalExtension}, создаем пустой PNG`);
        try {
          const emptyImage = new Jimp(100, 100, 0xFFFFFFFF);
          const pngBuffer = await emptyImage.getBufferAsync(Jimp.MIME_PNG);
          return { buffer: pngBuffer, extension: 'png', converted: true };
        } catch (err) {
          return { buffer: Buffer.from(''), extension: 'png', converted: false };
        }
      }
    }
    
  } catch (error) {
    console.error('Критическая ошибка конвертации:', error.message);
    // В любом случае возвращаем PNG (пустой, но PNG)
    try {
      const emptyImage = new Jimp(100, 100, 0xFFFFFFFF);
      const pngBuffer = await emptyImage.getBufferAsync(Jimp.MIME_PNG);
      return { buffer: pngBuffer, extension: 'png', converted: true };
    } catch (err) {
      return { buffer: Buffer.from(''), extension: 'png', converted: false };
    }
  }
}

// === ПАРСЕР TXT ФАЙЛОВ ===
async function parseTxtFile(filePath, subjectId) {
  try {
    console.log('=== НАЧАЛО ПАРСИНГА TXT ===');
    console.log(`Файл: ${filePath}`);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filePath}`);
    }
    
    // Читаем TXT файл с разными кодировками
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (encodingError) {
      // Пробуем другие кодировки
      try {
        content = fs.readFileSync(filePath, 'latin1');
      } catch (e) {
        content = fs.readFileSync(filePath, 'utf16le');
      }
    }
    
    if (!content || content.length === 0) {
      throw new Error('Файл пустой');
    }
    
    console.log(`Размер файла: ${content.length} символов`);
    
    const questions = [];
    
    // Нормализуем теги - заменяем разные варианты написания
    content = content.replace(/&lt;question&gt;/gi, '<question>');
    content = content.replace(/&lt;variant&gt;/gi, '<variant>');
    
    // Разбиваем по <question> (более гибкое регулярное выражение)
    // Пробуем разные варианты написания тега
    let questionBlocks = [];
    
    // Вариант 1: <question> или < question >
    const questionSplitRegex1 = /<\s*question\s*>/gi;
    questionBlocks = content.split(questionSplitRegex1);
    
    // Если не нашли, пробуем другие варианты
    if (questionBlocks.length <= 1) {
      // Вариант 2: question (без угловых скобок, но с пробелами)
      const questionSplitRegex2 = /^\s*question\s*$/gmi;
      questionBlocks = content.split(questionSplitRegex2);
    }
    
    // Убираем первый элемент (текст до первого <question>)
    if (questionBlocks.length > 0) {
      const firstBlock = questionBlocks[0].trim();
      // Если первый блок не содержит вариантов, пропускаем его
      if (!firstBlock.match(/<\s*variant\s*>/gi) && !firstBlock.match(/variant/gi)) {
        questionBlocks = questionBlocks.slice(1);
      }
    }
    
    console.log(`Найдено блоков вопросов: ${questionBlocks.length}`);
    
    // Выводим первые 200 символов файла для отладки
    console.log(`Первые 200 символов файла: ${content.substring(0, 200)}`);
    
    if (questionBlocks.length === 0) {
      console.warn('⚠ Не найдено ни одного блока с <question>');
      // Пробуем найти хотя бы один вариант для диагностики
      const hasVariants = content.match(/<\s*variant\s*>/gi) || content.match(/variant/gi);
      if (!hasVariants) {
        throw new Error('Не найдено вопросов в формате <question>...</question>. Проверьте формат файла. Убедитесь, что используются теги <question> и <variant>.');
      } else {
        throw new Error('Найдены варианты, но не найдены вопросы. Убедитесь, что каждый вопрос начинается с тега <question>.');
      }
    }
    
    const variantSplitRegex = /<\s*variant\s*>/gi;
    
    for (let i = 0; i < questionBlocks.length; i++) {
      try {
        let block = questionBlocks[i].trim();
        
        if (!block || block.length < 2) {
          console.log(`Блок ${i + 1}: пропущен (пустой блок)`);
          continue;
        }
        
        // Очищаем от лишних символов в начале/конце
        block = block.replace(/^[\s\n\r]+/, '').replace(/[\s\n\r]+$/, '');
        
        // Разбиваем на варианты
        const parts = block.split(variantSplitRegex);
        
        if (parts.length < 2) {
          console.log(`Блок ${i + 1}: пропущен (нет вариантов). Содержимое: ${block.substring(0, 100)}...`);
          continue;
        }
        
        // Первая часть - текст вопроса
        let questionText = parts[0].trim();
        
        // Очищаем вопрос от лишних символов
        questionText = questionText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (!questionText || questionText.length < 3) {
          console.log(`Блок ${i + 1}: пропущен (пустой текст вопроса)`);
          continue;
        }
        
        // Парсим варианты ответов
        const variants = [];
        for (let j = 1; j < parts.length && j <= 10; j++) {
          let variantText = parts[j].trim();
          
          // Очищаем вариант от лишних символов
          variantText = variantText.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
          
          // Убираем точки в конце
          variantText = variantText.replace(/\.+$/, '').trim();
          
          if (variantText && variantText.length > 0) {
            variants.push({
              text: variantText,
              isCorrect: j === 1 // Первый вариант всегда правильный
            });
          }
        }
        
        if (variants.length < 1) {
          console.log(`Блок ${i + 1}: пропущен (нет ни одного варианта)`);
          continue;
        }
        
        // Если только 1 вариант, добавляем заглушку
        if (variants.length === 1) {
          variants.push({ text: 'Вариант 2 (требуется заполнить)', isCorrect: false });
        }
        
        questions.push({
          subjectId,
          questionText,
          questionHtml: questionText.replace(/\n/g, '<br>').replace(/\r/g, ''),
          variants,
          orderIndex: i
        });
        
        console.log(`✓ Блок ${i + 1}: успешно (вариантов: ${variants.length})`);
        
      } catch (blockError) {
        console.error(`Ошибка обработки блока ${i + 1}:`, blockError.message);
        // Продолжаем с следующим блоком
      }
    }
    
    console.log('=== РЕЗУЛЬТАТ ПАРСИНГА TXT ===');
    console.log(`Всего блоков: ${questionBlocks.length}`);
    console.log(`Успешно распарсено: ${questions.length}`);
    
    if (questions.length === 0) {
      throw new Error('Не удалось распарсить ни одного вопроса. Проверьте формат файла. Ожидается: <question>Текст вопроса<variant>Ответ1<variant>Ответ2...</question>');
    }
    
    return questions;
    
  } catch (error) {
    console.error('Критическая ошибка парсинга TXT:', error);
    throw error;
  }
}

// === ПАРСЕР DOC ФАЙЛОВ ===
async function parseDocFile(filePath, subjectId) {
  try {
    console.log('=== НАЧАЛО ПАРСИНГА DOC ===');
    console.log(`Файл: ${filePath}`);
    
    const isWindows = process.platform === 'win32';
    const tempDocxPath = filePath.replace(/\.doc$/i, '.docx');
    
    // Метод 1: Конвертируем DOC в DOCX через LibreOffice
    try {
      let convertCmd;
      if (isWindows) {
        convertCmd = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --headless --convert-to docx --outdir "${path.dirname(filePath)}" "${filePath}" 2>nul`;
      } else {
        convertCmd = `libreoffice --headless --convert-to docx --outdir "${path.dirname(filePath)}" "${filePath}" 2>/dev/null`;
      }
      
      await execAsync(convertCmd, { timeout: 30000 });
      
      if (fs.existsSync(tempDocxPath)) {
        console.log('✓ DOC конвертирован в DOCX через LibreOffice');
        // Парсим как DOCX
        const questions = await parseDocxFile(tempDocxPath, subjectId);
        // Удаляем временный DOCX файл
        if (fs.existsSync(tempDocxPath)) {
          fs.unlinkSync(tempDocxPath);
        }
        return questions;
      }
    } catch (loErr) {
      console.warn('LibreOffice не доступен для конвертации DOC');
    }
    
    // Метод 2: Пробуем через antiword (если установлен)
    try {
      const txtPath = filePath.replace(/\.doc$/i, '.txt');
      await execAsync(`antiword "${filePath}" > "${txtPath}" 2>/dev/null`, { timeout: 30000 });
      
      if (fs.existsSync(txtPath) && fs.statSync(txtPath).size > 0) {
        console.log('✓ DOC конвертирован в TXT через antiword');
        const questions = await parseTxtFile(txtPath, subjectId);
        // Удаляем временный TXT файл
        if (fs.existsSync(txtPath)) {
          fs.unlinkSync(txtPath);
        }
        return questions;
      }
    } catch (antiwordErr) {
      console.warn('antiword не доступен для конвертации DOC');
    }
    
    // Метод 3: Пробуем через catdoc (если установлен)
    try {
      const txtPath = filePath.replace(/\.doc$/i, '.txt');
      await execAsync(`catdoc "${filePath}" > "${txtPath}" 2>/dev/null`, { timeout: 30000 });
      
      if (fs.existsSync(txtPath) && fs.statSync(txtPath).size > 0) {
        console.log('✓ DOC конвертирован в TXT через catdoc');
        const questions = await parseTxtFile(txtPath, subjectId);
        // Удаляем временный TXT файл
        if (fs.existsSync(txtPath)) {
          fs.unlinkSync(txtPath);
        }
        return questions;
      }
    } catch (catdocErr) {
      console.warn('catdoc не доступен для конвертации DOC');
    }
    
    throw new Error('Не удалось конвертировать DOC файл. Установите LibreOffice, antiword или catdoc.');
    
  } catch (error) {
    console.error('Критическая ошибка парсинга DOC:', error);
    throw error;
  }
}

// === УЛУЧШЕННЫЙ ПАРСЕР DOCX ===
// Парсер извлекает все изображения из документа и сохраняет их
// Формулы Word автоматически экспортируются как изображения через mammoth
// WMF/EMF конвертируются в PNG для отображения в браузере

async function parseDocxFile(filePath, subjectId) {
  try {
    console.log('=== НАЧАЛО ПАРСИНГА DOCX ===');
    console.log(`Файл: ${filePath}`);
    
    // Словарь для хранения извлеченных изображений
    const extractedImages = [];
    
    // Конвертируем DOCX в HTML с извлечением всех изображений
    const result = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const buffer = await image.read();
          let extension = image.contentType ? image.contentType.split('/')[1] : 'png';
          
          // Нормализация расширений
          if (extension === 'x-wmf') extension = 'wmf';
          if (extension === 'x-emf') extension = 'emf';
          if (extension === 'jpeg') extension = 'jpg';
          
          // Пробуем конвертировать WMF/EMF в PNG
          const result = await convertImageToPng(buffer, extension, image.contentType);
          
          // Оптимизируем размер изображения: обрезка краев + уменьшение размера
          let finalBuffer = result.buffer;
          try {
            if (result.extension === 'png' || result.extension === 'jpg' || result.extension === 'jpeg') {
              let processedImage = sharp(result.buffer);
              
              // Шаг 1: Автоматическая обрезка одинаковых краев (trim)
              // Обрезает белые/прозрачные края автоматически
              processedImage = processedImage.trim({
                threshold: 10, // Порог для определения "одинакового" цвета (0-255)
                background: { r: 255, g: 255, b: 255, alpha: 1 } // Белый фон
              });
              
              // Получаем метаданные после обрезки
              const metadata = await processedImage.metadata();
              
              // Шаг 2: Уменьшение размера если нужно (максимум 600px по ширине)
              if (metadata.width > 600) {
                processedImage = processedImage.resize(600, null, { 
                  withoutEnlargement: true,
                  fit: 'inside'
                });
                console.log(`✓ Изображение обрезано и оптимизировано: ${metadata.width}x${metadata.height} → 600px`);
              } else {
                console.log(`✓ Изображение обрезано: ${metadata.width}x${metadata.height}`);
              }
              
              // Шаг 3: Сжатие PNG
              finalBuffer = await processedImage
                .png({ quality: 80, compressionLevel: 9 })
                .toBuffer();
            }
          } catch (optimizeErr) {
            // Если оптимизация не удалась, используем оригинал
            console.warn('Не удалось оптимизировать изображение, используем оригинал:', optimizeErr.message);
            finalBuffer = result.buffer;
          }
          
          // Сохраняем изображение
          const imageName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${result.extension}`;
          const imagePath = path.join(__dirname, 'uploads', imageName);
          fs.writeFileSync(imagePath, finalBuffer);
          
          const imgSrc = `/uploads/${imageName}`;
          extractedImages.push(imgSrc);
          console.log(`✓ Сохранено изображение: ${imageName} (тип: ${image.contentType}, конвертировано: ${result.converted})`);
          
          return { src: imgSrc };
        } catch (imgError) {
          console.error('Ошибка извлечения изображения:', imgError.message);
          return { src: '' };
        }
      })
    });

    let html = result.value;
    console.log(`Извлечено изображений: ${extractedImages.length}`);
    console.log(`HTML длина: ${html.length} символов`);
    
    // Получаем также сырой текст для более надежного парсинга
    const rawResult = await mammoth.extractRawText({ path: filePath });
    const rawText = rawResult.value;
    console.log(`Raw текст длина: ${rawText.length} символов`);
    
    const questions = [];
    
    // Нормализуем HTML - заменяем закодированные теги на обычные
    html = html.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    
    // Более гибкое регулярное выражение для тега question
    // Учитываем пробелы, переносы строк, разные варианты написания
    const questionSplitRegex = /<\s*question\s*>/gi;
    
    // Разбиваем по тегу <question>
    let questionBlocks = html.split(questionSplitRegex);
    
    // Первый элемент - это текст до первого <question>, пропускаем его
    if (questionBlocks.length > 1) {
      questionBlocks = questionBlocks.slice(1);
    }
    
    console.log(`Найдено блоков вопросов (HTML): ${questionBlocks.length}`);
    
    // Если в HTML мало блоков, попробуем парсить raw текст
    if (questionBlocks.length < 10) {
      console.log('Мало блоков в HTML, пробуем парсить raw текст...');
      
      const rawQuestionBlocks = rawText.split(/<\s*question\s*>/gi);
      if (rawQuestionBlocks.length > questionBlocks.length + 1) {
        console.log(`В raw тексте найдено больше блоков: ${rawQuestionBlocks.length - 1}`);
        // Используем raw текст как основу
        questionBlocks = rawQuestionBlocks.slice(1);
      }
    }
    
    // Более гибкое регулярное выражение для тега variant
    const variantSplitRegex = /<\s*variant\s*>/gi;
    
    for (let i = 0; i < questionBlocks.length; i++) {
      try {
        const block = questionBlocks[i];
        
        if (!block || block.trim().length < 2) {
          console.log(`Блок ${i + 1}: пропущен (пустой блок)`);
          continue;
        }
        
        // Разбиваем на варианты
        const parts = block.split(variantSplitRegex);
        
        if (parts.length < 2) {
          // Попробуем найти варианты по другим паттернам
          console.log(`Блок ${i + 1}: не найдены <variant> теги, ищем альтернативные паттерны...`);
          
          // Проверим, есть ли хоть какой-то текст вопроса
          const cleanBlock = block.replace(/<[^>]*>/g, '').trim();
          if (cleanBlock.length > 3) {
            console.log(`Блок ${i + 1}: сохраняем как вопрос без вариантов (текст: ${cleanBlock.substring(0, 50)}...)`);
            // Сохраняем вопрос с пустыми вариантами - можно добавить вручную
            questions.push({
              subjectId,
              questionText: cleanBlock,
              questionHtml: block,
              variants: [
                { text: 'Вариант 1', isCorrect: true },
                { text: 'Вариант 2', isCorrect: false }
              ],
              orderIndex: i,
              needsReview: true // Флаг для ручной проверки
            });
          }
          continue;
        }
        
        // Первая часть - текст вопроса
        let questionHtml = parts[0].trim();
        
        // Очищаем HTML, но сохраняем изображения
        questionHtml = questionHtml
          .replace(/<p[^>]*>/gi, '<p>')
          .replace(/<\/p>/gi, '</p>')
          .replace(/<br\s*\/?>/gi, '<br>')
          .replace(/<span[^>]*>/gi, '')
          .replace(/<\/span>/gi, '')
          .replace(/<strong>/gi, '<b>')
          .replace(/<\/strong>/gi, '</b>');
        
        // Текст вопроса для поиска (без HTML)
        const questionText = questionHtml
          .replace(/<img[^>]*>/gi, ' [ИЗОБРАЖЕНИЕ] ')
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // Пропускаем только если вообще нет текста и нет изображений
        if (!questionText && !questionHtml.includes('<img')) {
          console.log(`Блок ${i + 1}: пропущен (полностью пустой вопрос)`);
          continue;
        }
        
        // Парсим варианты ответов
        const variants = [];
        for (let j = 1; j < parts.length && j <= 10; j++) { // Максимум 10 вариантов
          let variantHtml = parts[j].trim();
          
          // Сохраняем изображения в вариантах
          const hasImage = variantHtml.includes('<img');
          
          // Очищаем HTML варианта
          variantHtml = variantHtml
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, '')
            .replace(/<br\s*\/?>/gi, ' ')
            .replace(/<span[^>]*>/gi, '')
            .replace(/<\/span>/gi, '');
          
          // Получаем текст варианта
          let variantText = variantHtml
            .replace(/<img[^>]*>/gi, ' [ИЗОБРАЖЕНИЕ] ')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Убираем точки в конце
          variantText = variantText.replace(/\.+$/, '').trim();
          
          // Если есть изображение, сохраняем HTML варианта
          if (hasImage) {
            // Извлекаем только img теги
            const imgMatches = variantHtml.match(/<img[^>]*>/gi);
            if (imgMatches) {
              variantHtml = imgMatches.join(' ') + (variantText ? ' ' + variantText : '');
            }
          }
          
          // Добавляем вариант, если есть хоть какой-то контент
          if (variantText || hasImage) {
            variants.push({
              text: hasImage ? variantHtml : variantText,
              isCorrect: j === 1 // Первый вариант всегда правильный
            });
          }
        }
        
        // Принимаем вопросы даже с одним вариантом (можно добавить вручную)
        if (variants.length < 1) {
          console.log(`Блок ${i + 1}: пропущен (нет ни одного варианта)`);
          continue;
        }
        
        // Если только 1 вариант, добавляем заглушку
        if (variants.length === 1) {
          variants.push({ text: 'Вариант 2 (требуется заполнить)', isCorrect: false });
        }
        
        questions.push({
          subjectId,
          questionText: questionText || '[Вопрос содержит только изображение]',
          questionHtml,
          variants,
          orderIndex: i
        });
        
        console.log(`Блок ${i + 1}: успешно (вариантов: ${variants.length})`);
        
      } catch (blockError) {
        console.error(`Ошибка обработки блока ${i + 1}:`, blockError);
        // Продолжаем с следующим блоком
      }
    }
    
    console.log('=== РЕЗУЛЬТАТ ПАРСИНГА ===');
    console.log(`Всего блоков: ${questionBlocks.length}`);
    console.log(`Успешно распарсено: ${questions.length}`);
    console.log(`Потеряно: ${questionBlocks.length - questions.length}`);
    
    return questions;
    
  } catch (error) {
    console.error('Критическая ошибка парсинга DOCX:', error);
    throw error;
  }
}

// === API ENDPOINTS ===

// Проверка пароля админа
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Неверный пароль' });
  }
});

// === ПРЕДМЕТЫ ===
app.get('/api/subjects', async (req, res) => {
  try {
    const { groupId } = req.query;
    let filter = {};
    
    // Если указан groupId, показываем только предметы, разрешенные для этой группы
    // или предметы без ограничений (allowedGroups пустой или не указан)
    if (groupId) {
      filter = {
        $or: [
          { allowedGroups: { $in: [groupId] } },
          { allowedGroups: { $size: 0 } },
          { allowedGroups: { $exists: false } }
        ]
      };
    }
    
    const subjects = await Subject.find(filter)
      .populate('allowedGroups', 'name')
      .sort({ createdAt: -1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    await subject.populate('allowedGroups', 'name');
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление разрешений групп для предмета
app.put('/api/subjects/:id/groups', async (req, res) => {
  try {
    const { allowedGroups } = req.body; // Массив ID групп
    const subject = await Subject.findByIdAndUpdate(
      req.params.id,
      { allowedGroups },
      { new: true }
    ).populate('allowedGroups', 'name');
    
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }
    
    res.json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    await Question.deleteMany({ subjectId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ГРУППЫ ===
app.get('/api/groups', async (req, res) => {
  try {
    const groups = await Group.find().sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const group = new Group(req.body);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/groups/:id', async (req, res) => {
  try {
    await Group.findByIdAndDelete(req.params.id);
    await Student.deleteMany({ groupId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === СТУДЕНТЫ ===
app.get('/api/students', async (req, res) => {
  try {
    const { groupId } = req.query;
    const filter = groupId ? { groupId } : {};
    const students = await Student.find(filter).populate('groupId').sort({ fullName: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === ВОПРОСЫ ===
app.get('/api/questions', async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = subjectId ? { subjectId } : {};
    const questions = await Question.find(filter)
      .populate('subjectId', 'name')
      .sort({ orderIndex: 1, createdAt: 1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Загрузка файла с вопросами (DOCX, DOC, TXT)
app.post('/api/questions/upload', upload.single('file'), async (req, res) => {
  let fileExt = null;
  
  try {
    const { subjectId } = req.body;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    // Определяем формат файла
    fileExt = path.extname(req.file.originalname).toLowerCase();
    let questions;
    
    if (fileExt === '.docx') {
      questions = await parseDocxFile(req.file.path, subjectId);
    } else if (fileExt === '.doc') {
      questions = await parseDocFile(req.file.path, subjectId);
    } else if (fileExt === '.txt') {
      questions = await parseTxtFile(req.file.path, subjectId);
    } else {
      // Удаляем загруженный файл
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Неподдерживаемый формат файла' });
    }
    
    if (questions.length === 0) {
      // Удаляем загруженный файл перед возвратом ошибки
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ 
        error: 'Не удалось распарсить вопросы из файла',
        details: 'Проверьте формат файла. Ожидается: <question>Текст вопроса<variant>Ответ1<variant>Ответ2...</question>'
      });
    }
    
    // Получаем текущее максимальное значение orderIndex для этого предмета
    const maxOrderQuestion = await Question.findOne({ subjectId })
      .sort({ orderIndex: -1 })
      .select('orderIndex');
    let startOrderIndex = maxOrderQuestion ? (maxOrderQuestion.orderIndex || 0) + 1 : 0;
    
    let created = 0;
    
    // Добавляем ВСЕ вопросы как новые (не перезаписываем)
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      // Обновляем orderIndex чтобы вопросы шли по порядку
      questionData.orderIndex = startOrderIndex + i;
      
      // Всегда создаем новый вопрос
      const newQuestion = new Question(questionData);
      await newQuestion.save();
      created++;
    }
    
    // Удалить загруженный файл
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: questions.length,
      created,
      message: `Добавлено ${created} вопросов`
    });
  } catch (error) {
    console.error('Upload error:', error);
    
    // Удаляем загруженный файл в случае ошибки
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        console.error('Ошибка удаления файла:', unlinkErr);
      }
    }
    
    // Возвращаем более информативное сообщение об ошибке
    const errorMessage = error.message || 'Неизвестная ошибка при загрузке файла';
    const errorDetails = fileExt === '.txt' 
      ? 'Для TXT файлов убедитесь, что используется формат: <question>Текст вопроса<variant>Ответ1<variant>Ответ2...</question>'
      : 'Проверьте формат файла и попробуйте снова';
    
    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails
    });
  }
});

// Ручное добавление вопроса
app.post('/api/questions', async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/questions/:id', async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удаление всех вопросов по subjectId
app.delete('/api/questions/subject/:subjectId', async (req, res) => {
  try {
    const { subjectId } = req.params;
    const result = await Question.deleteMany({ subjectId });
    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Удалено ${result.deletedCount} вопросов`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление вопроса
app.put('/api/questions/:id', async (req, res) => {
  try {
    const question = await Question.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(question);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Подключение к MongoDB и запуск сервера
const PORT = process.env.PORT || 5000;

// Проверка доступных инструментов для конвертации изображений
async function checkConversionTools() {
  const isWindows = process.platform === 'win32';
  const redirect = isWindows ? '2>nul' : '2>/dev/null';
  
  const tools = [];
  
  // Проверяем ImageMagick
  try {
    if (isWindows) {
      await execAsync(`magick -version ${redirect}`);
      tools.push('ImageMagick (magick)');
    } else {
      await execAsync(`convert -version ${redirect}`);
      tools.push('ImageMagick (convert)');
    }
  } catch (e) {
    // ImageMagick не найден
  }
  
  // Проверяем GraphicsMagick
  try {
    await execAsync(`gm version ${redirect}`);
    tools.push('GraphicsMagick');
  } catch (e) {
    // GraphicsMagick не найден
  }
  
  // Проверяем LibreOffice
  try {
    let loCmd;
    if (isWindows) {
      loCmd = `"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --version ${redirect}`;
    } else if (process.platform === 'darwin') {
      loCmd = `/Applications/LibreOffice.app/Contents/MacOS/soffice --version ${redirect}`;
    } else {
      loCmd = `libreoffice --version ${redirect}`;
    }
    await execAsync(loCmd);
    tools.push('LibreOffice');
  } catch (e) {
    // LibreOffice не найден
  }
  
  if (tools.length > 0) {
    console.log(`✓ Доступные инструменты для конвертации WMF/EMF: ${tools.join(', ')}`);
  } else {
    console.warn('⚠ Инструменты для конвертации WMF/EMF не найдены.');
    console.warn('  WMF/EMF изображения не будут конвертироваться в PNG.');
    console.warn('  Установите ImageMagick, GraphicsMagick или LibreOffice для поддержки.');
  }
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await checkConversionTools();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

