require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');
const fs = require('fs');

// Опциональная загрузка mathjax-node (если установлен)
let mjAPI = null;
let mathjaxAvailable = false;
try {
  mjAPI = require('mathjax-node');
  mathjaxAvailable = true;
} catch (error) {
  console.warn('mathjax-node не установлен. Формулы будут сохраняться как текст.');
  console.warn('Для конвертации формул в изображения установите: npm install mathjax-node');
}

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

// Конвертация формулы в изображение
async function convertFormulaToImage(formulaText) {
  if (!mathjaxAvailable) {
    return null;
  }
  
  try {
    // Очистка формулы от лишних символов
    let cleanFormula = formulaText.trim();
    
    // Подготовка формулы для MathJax - конвертация в LaTeX формат
    // Заменяем математические символы на LaTeX команды
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
    
    // Обработка интегралов с пределами: ∫ от -∞ до ∞ (казахский: "до")
    // Паттерны: "∫ от -∞ до ∞", "∫ -∞ до ∞", "∫ от -∞ до X"
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?[₋-]?∞\s*до\s*[₋-]?∞/gi, '\\int_{-\\infty}^{\\infty}');
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?[₋-]?∞\s*до\s*([Xx])/gi, '\\int_{-\\infty}^{$1}');
    cleanFormula = cleanFormula.replace(/∫\s*(от\s*)?0\s*до\s*([Xx])/gi, '\\int_{0}^{$1}');
    
    // Обработка паттерна M(X) = ∫ ... x * f(x) dx
    // Заменяем "x * f(x)" на "x \\cdot f(x)"
    cleanFormula = cleanFormula.replace(/([a-zA-Z0-9])\s*[·*×]\s*([a-zA-Z]\([^)]+\))/g, '$1 \\cdot $2');
    
    // Обработка "x f(x)" (без знака умножения) -> "x \\cdot f(x)"
    cleanFormula = cleanFormula.replace(/([a-zA-Z0-9])\s+([a-zA-Z]\([^)]+\))/g, (match, p1, p2) => {
      // Проверяем, что это не часть другого выражения
      if (match.includes('=') || match.includes('∫')) {
        return `${p1} \\cdot ${p2}`;
      }
      return match;
    });
    
    // Обработка умножения: x * f(x) -> x \\cdot f(x)
    cleanFormula = cleanFormula.replace(/([a-zA-Z0-9])\s*[·*]\s*([a-zA-Z0-9(])/g, '$1 \\cdot $2');
    
    // Если формула уже содержит LaTeX синтаксис, используем как есть
    // Иначе оборачиваем в математический режим
    if (!cleanFormula.includes('\\')) {
      // Если нет LaTeX команд, возможно это простая формула
      cleanFormula = `$${cleanFormula}$`;
    } else {
      // Если есть LaTeX команды, оборачиваем в display math
      cleanFormula = `$$${cleanFormula}$$`;
    }
    
    const result = await mjAPI.typeset({
      math: cleanFormula,
      format: "TeX",
      svg: true,
      width: 100,
      ex: 6,
      em: 12,
      linebreaks: false
    });
    
    if (result.errors && result.errors.length > 0) {
      console.error('MathJax ошибка при рендеринге формулы:', result.errors);
      console.error('Исходная формула:', formulaText);
      console.error('Обработанная формула:', cleanFormula);
      return null;
    }
    
    if (!result.svg) {
      console.error('MathJax не вернул SVG для формулы:', formulaText);
      return null;
    }
    
    // Сохраняем SVG как файл
    const imageName = `formula-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.svg`;
    const imagePath = path.join(__dirname, 'uploads', imageName);
    fs.writeFileSync(imagePath, result.svg);
    
    console.log(`Формула конвертирована в изображение: ${imageName}`);
    return `/uploads/${imageName}`;
  } catch (error) {
    console.error('Ошибка конвертации формулы в изображение:', error);
    console.error('Исходная формула:', formulaText);
    return null;
  }
}

// === ПАРСЕР DOCX ===
async function parseDocxFile(filePath, subjectId) {
  try {
    const result = await mammoth.convertToHtml({ path: filePath }, {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read();
        const extension = image.contentType.split('/')[1] || 'png';
        const imageName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
        const imagePath = path.join(__dirname, 'uploads', imageName);
        fs.writeFileSync(imagePath, buffer);
        return { src: `/uploads/${imageName}` };
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
        let variantText = parts[j].trim();
        // Убираем HTML теги из варианта
        variantText = variantText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        
        // Убираем точки в конце, если есть
        variantText = variantText.replace(/\.+$/, '');
        
        if (variantText && variantText.length > 0) {
          // Проверяем наличие сложных формул
          if (hasComplexFormula(variantText) && mathjaxAvailable) {
            console.log(`Вариант ${j} содержит формулу, конвертируем в изображение: ${variantText.substring(0, 50)}...`);
            try {
              const formulaImagePath = await convertFormulaToImage(variantText);
              if (formulaImagePath) {
                // Сохраняем как HTML с изображением
                variants.push({
                  text: `<img src="${formulaImagePath}" alt="${variantText.replace(/"/g, '&quot;')}" style="max-width: 100%; height: auto;" />`,
                  isCorrect: j === 1 // Первый вариант - правильный
                });
              } else {
                // Если не удалось конвертировать, сохраняем как текст
                console.log(`Не удалось конвертировать формулу в варианте ${j}, сохраняем как текст`);
                variants.push({
                  text: variantText,
                  isCorrect: j === 1
                });
              }
            } catch (error) {
              console.error(`Ошибка при конвертации формулы в варианте ${j}:`, error);
              // В случае ошибки сохраняем как обычный текст
              variants.push({
                text: variantText,
                isCorrect: j === 1
              });
            }
          } else {
            // Обычный текст без формул (или MathJax недоступен)
            if (hasComplexFormula(variantText) && !mathjaxAvailable) {
              console.log(`Вариант ${j} содержит формулу, но MathJax недоступен. Сохраняем как текст.`);
            }
            variants.push({
              text: variantText,
              isCorrect: j === 1 // Первый вариант - правильный
            });
          }
        }
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

