require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Загрузка sharp для обработки изображений
let sharp = null;
let sharpAvailable = false;
try {
  sharp = require('sharp');
  sharpAvailable = true;
  console.log('✓ Sharp загружен для обработки изображений');
} catch (error) {
  console.warn('⚠ Sharp не установлен. Изображения не будут оптимизированы.');
  console.warn('  Для установки: npm install sharp');
}

// Загрузка Jimp для создания placeholder изображений
let Jimp = null;
let jimpAvailable = false;
try {
  Jimp = require('jimp');
  jimpAvailable = true;
  console.log('✓ Jimp загружен для обработки изображений');
} catch (error) {
  console.warn('⚠ Jimp не установлен.');
  console.warn('  Для установки: npm install jimp');
}

// Загрузка Puppeteer для качественного рендеринга формул
let puppeteer = null;
let puppeteerAvailable = false;
try {
  puppeteer = require('puppeteer');
  puppeteerAvailable = true;
  console.log('✓ Puppeteer загружен для рендеринга формул');
} catch (error) {
  console.warn('⚠ Puppeteer не установлен. Формулы будут отображаться как текст.');
  console.warn('  Для установки: npm install puppeteer');
}

// MathJax отключен - используем Puppeteer для формул
const mathjaxAvailable = false;
const mjAPI = null;

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
const upload = multer({ storage });

// MongoDB Schemas
const SubjectSchema = new mongoose.Schema({
  name: { type: String, required: true },
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
  createdAt: { type: Date, default: Date.now }
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Group = mongoose.model('Group', GroupSchema);
const Student = mongoose.model('Student', StudentSchema);
const Question = mongoose.model('Question', QuestionSchema);

// Инициализация MathJax (если доступен)
if (mathjaxAvailable && mjAPI) {
  try {
    mjAPI.config({
      MathJax: {
        SVG: {
          font: "STIX-Web"
        }
      }
    });
    mjAPI.start();
    console.log('MathJax инициализирован');
  } catch (error) {
    console.warn('Ошибка инициализации MathJax:', error.message);
    mathjaxAvailable = false;
  }
}

// === ФУНКЦИИ ДЛЯ РАБОТЫ С ФОРМУЛАМИ ===

// Определение наличия сложных формул в тексте
function hasComplexFormula(text) {
  if (!text) return false;
  
  // Математические символы и паттерны
  const mathPatterns = [
    /∫|∑|∏|√|∛|∜/, // Интегралы, суммы, произведения, корни
    /[α-ωΑ-Ω]/, // Греческие буквы
    /[∞±×÷≤≥≠≈]/, // Математические операторы
    /[₀-₉₊₋₌₍₎]/, // Нижние индексы
    /[⁰-⁹⁺⁻⁼⁽⁾]/, // Верхние индексы
    /[∂∇∆]/, // Дифференциальные операторы
    /M\([^)]+\)\s*=\s*∫/, // Паттерн M(X) = ∫
    /∫\s*[₋-]?∞/, // Интегралы с бесконечностью
    /[a-zA-Z]\([^)]+\)\s*=\s*∫/, // Функции с интегралами
    /[a-zA-Z]\s*[·×]\s*[a-zA-Z]/, // Умножение переменных
    /[a-zA-Z]\s*\/\s*[a-zA-Z]/, // Дроби
    /[a-zA-Z]\s*\^\s*[0-9]/, // Степени
    /[a-zA-Z]\s*_\s*[0-9]/, // Индексы
    // Дополнительные паттерны для формул
    /\bM\([^)]+\)\s*=\s*∫/, // M(X) = ∫ (с границами слова)
    /∫\s*[₋-]?∞\s*до\s*[₋-]?∞/i, // Интеграл от -∞ до ∞
    /∫\s*[₋-]?∞\s*до\s*[Xx]/i, // Интеграл от -∞ до X
    /∫\s*0\s*до\s*[Xx]/i, // Интеграл от 0 до X
    /[a-zA-Z]\s*[·×*]\s*[a-zA-Z]\([^)]+\)/, // x * f(x)
    /[a-zA-Z]\s*[·×*]\s*[a-zA-Z]\s*dx/, // x * f(x) dx
    /\bdx\b/, // Дифференциал dx
    /\bdy\b/, // Дифференциал dy
  ];
  
  // Проверяем наличие хотя бы одного паттерна
  const hasPattern = mathPatterns.some(pattern => pattern.test(text));
  
  // Дополнительная проверка: если текст содержит интеграл и математические символы
  if (text.includes('∫') && (text.includes('=') || text.includes('dx') || text.includes('∞'))) {
    return true;
  }
  
  return hasPattern;
}

// Конвертация формулы в PNG изображение с помощью Puppeteer и MathJax
let browserInstance = null;

async function getBrowser() {
  if (!puppeteerAvailable || !puppeteer) {
    return null;
  }
  
  if (!browserInstance) {
    try {
      browserInstance = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✓ Puppeteer браузер запущен');
    } catch (error) {
      console.error('✗ Ошибка запуска Puppeteer:', error.message);
      return null;
    }
  }
  
  return browserInstance;
}

async function convertFormulaToImage(formulaText) {
  if (!puppeteerAvailable || !puppeteer) {
    return null;
  }
  
  try {
    const browser = await getBrowser();
    if (!browser) {
      return null;
    }
    
    const page = await browser.newPage();
    
    // Подготовка формулы для MathJax
    let cleanFormula = formulaText.trim();
    
    // Заменяем математические символы на LaTeX
    cleanFormula = cleanFormula
      .replace(/∫/g, '\\int')
      .replace(/∞/g, '\\infty')
      .replace(/±/g, '\\pm')
      .replace(/×/g, '\\times')
      .replace(/÷/g, '\\div')
      .replace(/≤/g, '\\leq')
      .replace(/≥/g, '\\geq')
      .replace(/≠/g, '\\neq')
      .replace(/≈/g, '\\approx')
      .replace(/√/g, '\\sqrt')
      .replace(/∑/g, '\\sum')
      .replace(/∏/g, '\\prod')
      .replace(/∂/g, '\\partial')
      .replace(/∇/g, '\\nabla')
      .replace(/∆/g, '\\Delta');
    
    // Обработка интегралов
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?[₋-]?∞\s*до\s*[₋-]?∞/gi, '\\int_{-\\infty}^{\\infty}');
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?[₋-]?∞\s*до\s*([Xx])/gi, '\\int_{-\\infty}^{$1}');
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?0\s*до\s*([Xx])/gi, '\\int_{0}^{$1}');
    
    // Обработка умножения
    cleanFormula = cleanFormula.replace(/([a-zA-Z0-9])\s*[·*×]\s*([a-zA-Z]\([^)]+\))/g, '$1 \\cdot $2');
    cleanFormula = cleanFormula.replace(/([a-zA-Z0-9])\s*[·*]\s*([a-zA-Z0-9(])/g, '$1 \\cdot $2');
    
    // Оборачиваем в LaTeX
    if (!cleanFormula.includes('\\')) {
      cleanFormula = `$${cleanFormula}$`;
    } else {
      cleanFormula = `$$${cleanFormula}$$`;
    }
    
    // HTML страница с MathJax
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
        <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        <script>
          window.MathJax = {
            tex: {
              inlineMath: [['$', '$'], ['\\(', '\\)']],
              displayMath: [['$$', '$$'], ['\\[', '\\]']]
            },
            svg: {
              fontCache: 'global'
            }
          };
        </script>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: white;
            font-family: Arial, sans-serif;
          }
          #formula {
            font-size: 18px;
            color: black;
          }
        </style>
      </head>
      <body>
        <div id="formula">${cleanFormula}</div>
        <script>
          MathJax.typesetPromise().then(() => {
            window.formulaReady = true;
          });
        </script>
      </body>
      </html>
    `;
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Ждем пока MathJax отрендерит формулу
    await page.waitForFunction(() => window.formulaReady === true, { timeout: 10000 });
    await page.waitForTimeout(1000); // Дополнительная задержка для полного рендеринга
    
    // Получаем элемент с формулой
    const formulaElement = await page.$('#formula');
    if (!formulaElement) {
      throw new Error('Элемент формулы не найден');
    }
    
    // Делаем скриншот элемента
    const imageName = `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
    const imagePath = path.join(__dirname, 'uploads', imageName);
    
    await formulaElement.screenshot({
      path: imagePath,
      type: 'png',
      omitBackground: true
    });
    
    await page.close();
    
    // Оптимизируем изображение с помощью sharp
    if (sharpAvailable && sharp && fs.existsSync(imagePath)) {
      try {
        await sharp(imagePath)
          .trim({ threshold: 20 })
          .png({ compressionLevel: 9 })
          .toFile(imagePath + '.tmp');
        
        // Заменяем оригинал оптимизированной версией
        fs.renameSync(imagePath + '.tmp', imagePath);
      } catch (optimizeError) {
        console.log(`⚠ Не удалось оптимизировать формулу: ${optimizeError.message}`);
      }
    }
    
    console.log(`✓ Формула конвертирована в PNG: ${imageName}`);
    return `/uploads/${imageName}`;
    
  } catch (error) {
    console.error('✗ Ошибка конвертации формулы:', error.message);
    console.error('  Исходная формула:', formulaText.substring(0, 100));
    return null;
  }
}

// === ФУНКЦИЯ КОНВЕРТАЦИИ ИЗОБРАЖЕНИЙ В PNG ===
async function convertImageToPng(buffer, contentType) {
  const isWmfOrEmf = contentType.includes('wmf') || 
                      contentType.includes('emf') || 
                      contentType.includes('x-wmf') || 
                      contentType.includes('x-emf') ||
                      contentType.includes('ms-wmf');
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9);
  
  console.log(`📷 Обработка изображения: ${contentType}`);
  
  try {
    // Для WMF/EMF - конвертируем в PNG используя системные инструменты
    if (isWmfOrEmf) {
      console.log(`🔄 WMF/EMF формат - конвертирую в PNG...`);
      
      // Сохраняем временный WMF файл
      const tempWmfPath = path.join(__dirname, 'uploads', `temp-${timestamp}-${randomStr}.wmf`);
      fs.writeFileSync(tempWmfPath, buffer);
      
      const pngName = `${timestamp}-${randomStr}.png`;
      const pngPath = path.join(__dirname, 'uploads', pngName);
      
      // Пробуем конвертировать через ImageMagick
      try {
        await execAsync(`convert "${tempWmfPath}" -trim -background white -alpha remove "${pngPath}"`);
        fs.unlinkSync(tempWmfPath); // Удаляем временный файл
        
        // Оптимизируем с помощью sharp
        if (sharpAvailable && sharp && fs.existsSync(pngPath)) {
          try {
            await sharp(pngPath)
              .trim({ threshold: 20 })
              .resize(800, null, { fit: 'inside', withoutEnlargement: true })
              .png({ compressionLevel: 9 })
              .toFile(pngPath + '.tmp');
            
            fs.renameSync(pngPath + '.tmp', pngPath);
            console.log(`✓ WMF конвертирован в PNG: ${pngName}`);
            return { name: pngName, path: pngPath };
          } catch (optimizeError) {
            console.log(`⚠ Не удалось оптимизировать: ${optimizeError.message}`);
            // Возвращаем то что есть
            return { name: pngName, path: pngPath };
          }
        }
        
        console.log(`✓ WMF конвертирован в PNG: ${pngName}`);
        return { name: pngName, path: pngPath };
        
      } catch (convertError) {
        console.log(`⚠ ImageMagick не доступен, пробую GraphicsMagick...`);
        
        // Пробуем GraphicsMagick
        try {
          await execAsync(`gm convert "${tempWmfPath}" -trim "${pngPath}"`);
          fs.unlinkSync(tempWmfPath);
          
          if (sharpAvailable && sharp && fs.existsSync(pngPath)) {
            await sharp(pngPath)
              .trim({ threshold: 20 })
              .resize(800, null, { fit: 'inside' })
              .png({ compressionLevel: 9 })
              .toFile(pngPath + '.tmp');
            
            fs.renameSync(pngPath + '.tmp', pngPath);
          }
          
          console.log(`✓ WMF конвертирован через GraphicsMagick: ${pngName}`);
          return { name: pngName, path: pngPath };
          
        } catch (gmError) {
          console.log(`⚠ GraphicsMagick не доступен, пробую LibreOffice...`);
          
          // Пробуем LibreOffice
          try {
            const tempDir = path.join(__dirname, 'uploads', `temp-${timestamp}`);
            fs.mkdirSync(tempDir, { recursive: true });
            
            await execAsync(`libreoffice --headless --convert-to png --outdir "${tempDir}" "${tempWmfPath}"`);
            fs.unlinkSync(tempWmfPath);
            
            // LibreOffice создает файл с другим именем
            const convertedFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.png'));
            if (convertedFiles.length > 0) {
              const convertedPath = path.join(tempDir, convertedFiles[0]);
              fs.renameSync(convertedPath, pngPath);
              fs.rmdirSync(tempDir);
              
              if (sharpAvailable && sharp) {
                await sharp(pngPath)
                  .trim({ threshold: 20 })
                  .resize(800, null, { fit: 'inside' })
                  .png({ compressionLevel: 9 })
                  .toFile(pngPath + '.tmp');
                
                fs.renameSync(pngPath + '.tmp', pngPath);
              }
              
              console.log(`✓ WMF конвертирован через LibreOffice: ${pngName}`);
              return { name: pngName, path: pngPath };
            }
            
            fs.rmdirSync(tempDir);
          } catch (loError) {
            console.log(`⚠ LibreOffice не доступен: ${loError.message}`);
          }
          
          // Если ничего не сработало - удаляем временный файл и создаем простой PNG
          if (fs.existsSync(tempWmfPath)) {
            fs.unlinkSync(tempWmfPath);
          }
          
          // Создаем простой белый PNG (без текста placeholder)
          if (sharpAvailable && sharp) {
            const whitePng = await sharp({
              create: {
                width: 200,
                height: 60,
                channels: 3,
                background: { r: 255, g: 255, b: 255 }
              }
            })
            .png()
            .toFile(pngPath);
            
            console.log(`⚠ Создан пустой PNG (WMF не удалось конвертировать): ${pngName}`);
            return { name: pngName, path: pngPath };
          }
        }
      }
    }
    
    // Для обычных изображений (PNG, JPG, GIF и т.д.)
    if (sharpAvailable && sharp) {
      const pngName = `${timestamp}-${randomStr}.png`;
      const pngPath = path.join(__dirname, 'uploads', pngName);
      
      try {
        let sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();
        
        console.log(`   Размер: ${metadata.width}x${metadata.height}, формат: ${metadata.format}`);
        
        // Уменьшаем если больше 600px по ширине
        if (metadata.width && metadata.width > 600) {
          sharpInstance = sharpInstance.resize(600, null, { 
            fit: 'inside',
            withoutEnlargement: true 
          });
          console.log(`   Изменен размер до 600px по ширине`);
        }
        
        // Пробуем обрезать края, но с обработкой ошибок
        try {
          sharpInstance = sharpInstance.trim({ threshold: 20 });
        } catch (trimError) {
          console.log(`   ⚠ Trim не удался, пропускаем: ${trimError.message}`);
          // Создаем новый instance без trim
          sharpInstance = sharp(buffer);
          if (metadata.width && metadata.width > 600) {
            sharpInstance = sharpInstance.resize(600, null, { fit: 'inside' });
          }
        }
        
        // Конвертируем в PNG
        await sharpInstance
          .png({ compressionLevel: 6 })
          .toFile(pngPath);
        
        // Проверяем что файл создан
        if (fs.existsSync(pngPath)) {
          const stats = fs.statSync(pngPath);
          console.log(`✓ PNG создан: ${pngName} (${Math.round(stats.size / 1024)}KB)`);
          return { name: pngName, path: pngPath };
        } else {
          throw new Error('Файл не был создан');
        }
        
      } catch (sharpError) {
        console.log(`⚠ Sharp ошибка: ${sharpError.message}`);
        
        // Fallback: сохраняем оригинал
        const ext = contentType.split('/')[1] || 'png';
        const originalName = `${timestamp}-${randomStr}.${ext}`;
        const originalPath = path.join(__dirname, 'uploads', originalName);
        fs.writeFileSync(originalPath, buffer);
        console.log(`⚠ Сохранен оригинал: ${originalName}`);
        return { name: originalName, path: originalPath };
      }
    }
    
    // Без sharp - просто сохраняем оригинал
    const ext = contentType.split('/')[1] || 'png';
    const originalName = `${timestamp}-${randomStr}.${ext}`;
    const originalPath = path.join(__dirname, 'uploads', originalName);
    fs.writeFileSync(originalPath, buffer);
    console.log(`⚠ Sharp недоступен, сохранен оригинал: ${originalName}`);
    return { name: originalName, path: originalPath };
    
  } catch (error) {
    console.error(`✗ Критическая ошибка обработки изображения: ${error.message}`);
    
    // Последний fallback - сохраняем как есть
    const ext = contentType.split('/')[1] || 'bin';
    const fallbackName = `${timestamp}-${randomStr}-fallback.${ext}`;
    const fallbackPath = path.join(__dirname, 'uploads', fallbackName);
    
    try {
      fs.writeFileSync(fallbackPath, buffer);
      console.log(`⚠ Fallback: сохранен оригинальный буфер: ${fallbackName}`);
      return { name: fallbackName, path: fallbackPath };
    } catch (writeError) {
      console.error(`✗ Не удалось сохранить файл: ${writeError.message}`);
      // Возвращаем пустое имя - изображение будет пропущено
      return { name: 'error.png', path: '' };
    }
  }
}

// === ПАРСЕР DOCX ===
async function parseDocxFile(filePath, subjectId) {
  try {
    const result = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const contentType = image.contentType || 'image/png';
        
        // Конвертируем изображение в PNG
        const converted = await convertImageToPng(buffer, contentType);
        return { src: `/uploads/${converted.name}` };
      })
    });

    const html = result.value;
    const questions = [];
    
    // Разбить на вопросы по <question> (учитываем разные варианты написания)
    const questionBlocks = html.split(/&lt;question&gt;|&lt;question\s*&gt;|<question\s*>|<question>/gi).filter(block => block.trim());
    
    console.log(`Найдено блоков: ${questionBlocks.length}`);
    
    for (let i = 0; i < questionBlocks.length; i++) {
      const block = questionBlocks[i];
      
      // Разбить на варианты по <variant> (учитываем разные варианты написания)
      const parts = block.split(/&lt;variant&gt;|&lt;variant\s*&gt;|<variant\s*>|<variant>/gi);
      
      if (parts.length < 2) {
        console.log(`Блок ${i + 1}: пропущен (нет вариантов)`);
        continue;
      }
      
      // Первая часть - текст вопроса
      let questionHtml = parts[0].trim();
      // Убираем лишние теги, но сохраняем структуру для изображений
      questionHtml = questionHtml.replace(/<p[^>]*>/gi, '<p>').replace(/<\/p>/gi, '</p>');
      questionHtml = questionHtml.replace(/<br\s*\/?>/gi, '<br>');
      
      // Текст вопроса без HTML тегов для поиска
      const questionText = questionHtml.replace(/<img[^>]*>/gi, '[изображение]')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (!questionText || questionText.length < 3) {
        console.log(`Блок ${i + 1}: пропущен (пустой текст вопроса)`);
        continue;
      }
      
      const variants = [];
      for (let j = 1; j < parts.length; j++) {
        let variantHtml = parts[j].trim();
        
        // Проверяем наличие изображений в варианте
        const hasImage = /<img[^>]*>/i.test(variantHtml);
        
        // Текст варианта без HTML тегов (для проверки формул и сохранения)
        let variantText = variantHtml
          .replace(/<img[^>]*>/gi, '[изображение]') // Временно заменяем картинки
          .replace(/<[^>]*>/g, '') // Убираем остальные теги
          .replace(/\s+/g, ' ')
          .trim();
        
        // Убираем точки в конце
        variantText = variantText.replace(/\.+$/, '').trim();
        
        // Если есть изображение в варианте, сохраняем HTML с изображением
        if (hasImage) {
          // Извлекаем src изображения
          const imgMatch = variantHtml.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);
          if (imgMatch) {
            const imgSrc = imgMatch[1];
            // Получаем текст без изображения
            const textWithoutImage = variantText.replace('[изображение]', '').trim();
            
            // Формируем финальный HTML: текст + изображение (или только изображение)
            const finalHtml = textWithoutImage && textWithoutImage.length > 0
              ? `${textWithoutImage} <img src="${imgSrc}" style="max-height: 200px; width: auto; vertical-align: middle;" />`
              : `<img src="${imgSrc}" style="max-height: 200px; width: auto;" />`;
            
            variants.push({
              text: finalHtml,
              isCorrect: j === 1 // Первый вариант - правильный
            });
            continue;
          }
        }
        
        // Пропускаем только полностью пустые варианты (без текста и без изображений)
        if (!variantText || variantText.length === 0) {
          continue;
        }
        
        // Сохраняем вариант как есть (формулы уже должны быть как изображения в документе)
        variants.push({
          text: variantText,
          isCorrect: j === 1 // Первый вариант - правильный
        });
      }
      
      // Проверяем что получили минимум 2 варианта (но лучше 5)
      if (variants.length < 2) {
        console.log(`Блок ${i + 1}: пропущен (мало вариантов: ${variants.length}, ожидается минимум 2)`);
        continue;
      }
      
      // Логируем количество вариантов для диагностики
      if (variants.length < 5) {
        console.log(`⚠ Блок ${i + 1}: только ${variants.length} вариантов (ожидается 5)`);
      }
      
      if (variants.length < 2) {
        console.log(`Блок ${i + 1}: пропущен (мало вариантов: ${variants.length})`);
        continue;
      }
      
      questions.push({
        subjectId,
        questionText,
        questionHtml,
        variants,
        orderIndex: i
      });
    }
    
    console.log(`Успешно распарсено вопросов: ${questions.length}`);
    return questions;
  } catch (error) {
    console.error('Ошибка парсинга DOCX:', error);
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
    const subjects = await Subject.find().sort({ createdAt: -1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
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

// Загрузка DOCX файла с вопросами
app.post('/api/questions/upload', upload.single('file'), async (req, res) => {
  try {
    const { subjectId } = req.body;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }
    
    const questions = await parseDocxFile(req.file.path, subjectId);
    
    if (questions.length === 0) {
      return res.status(400).json({ error: 'Не удалось распарсить вопросы из файла' });
    }
    
    let created = 0;
    let updated = 0;
    
    // Для каждого вопроса проверяем, существует ли он
    for (const questionData of questions) {
      // Ищем вопрос по тексту и предмету
      const existingQuestion = await Question.findOne({
        subjectId: questionData.subjectId,
        questionText: questionData.questionText
      });
      
      if (existingQuestion) {
        // Обновляем существующий вопрос
        existingQuestion.questionHtml = questionData.questionHtml;
        existingQuestion.variants = questionData.variants;
        existingQuestion.orderIndex = questionData.orderIndex;
        await existingQuestion.save();
        updated++;
      } else {
        // Создаем новый вопрос
        const newQuestion = new Question(questionData);
        await newQuestion.save();
        created++;
      }
    }
    
    // Удалить загруженный файл
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      count: questions.length,
      created,
      updated,
      message: `Обработано ${questions.length} вопросов: создано ${created}, обновлено ${updated}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
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

// Закрытие браузера при завершении сервера
process.on('SIGINT', async () => {
  console.log('\n⚠ Получен сигнал SIGINT, закрываю браузер...');
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('✓ Браузер закрыт');
    } catch (error) {
      console.error('✗ Ошибка закрытия браузера:', error.message);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠ Получен сигнал SIGTERM, закрываю браузер...');
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('✓ Браузер закрыт');
    } catch (error) {
      console.error('✗ Ошибка закрытия браузера:', error.message);
    }
  }
  process.exit(0);
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });

