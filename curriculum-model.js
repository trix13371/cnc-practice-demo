"use strict";

const route = require("./learning-path-model.js");

// Editorial metadata for the main route, not a grading or access-control engine.
const competencies = [
  ["machine-parts", "Устройство токарного станка", []],
  ["safe-state", "Безопасное состояние перед действием", ["machine-parts"]],
  ["dimensions", "Диаметр и длина", []],
  ["lathe-coordinates", "Диаметральная X и продольная Z", ["dimensions"]],
  ["drawing", "Чтение размеров чертежа", ["dimensions"]],
  ["metrology", "Выбор прибора и места измерения", ["drawing", "safe-state"]],
  ["tolerances", "Вывод о годности по интервалу допуска", ["metrology"]],
  ["tools", "Назначение режущего инструмента", ["machine-parts"]],
  [
    "setup",
    "Подготовка инструмента и рабочего нуля",
    ["tools", "lathe-coordinates", "safe-state"],
  ],
  ["allowance", "Припуск и распределение проходов", ["dimensions"]],
  ["feeds", "Подача и частота вращения", ["tools"]],
  [
    "lathe-profile",
    "Наружная продольная обработка",
    ["setup", "allowance", "feeds"],
  ],
  [
    "gcode",
    "Чтение и составление линейной программы",
    ["lathe-coordinates", "safe-state"],
  ],
  ["planning", "Маршрут обработки и контроль", ["lathe-profile", "tolerances"]],
  ["facing", "Обработка торца", ["setup", "allowance", "gcode"]],
  ["lathe-hole", "Сверление и расточка на токарном станке", ["setup", "lathe-coordinates", "tools"]],
  ["groove", "Наружная канавка и отвод пластины", ["setup", "gcode"]],
  ["taper", "Наружный конический участок", ["lathe-profile", "gcode"]],
  ["mill-coordinates", "Линейные координаты XYZ", ["dimensions"]],
  [
    "mill-setup",
    "Фрезерная установка и крепление",
    ["mill-coordinates", "safe-state"],
  ],
  ["mill-removal", "Открытый паз и послойное снятие", ["mill-setup", "feeds"]],
  ["collision", "Проверка пути инструмента и сборки", ["safe-state"]],
  [
    "diagnosis",
    "Первая причина остановки и проверка исправления",
    ["gcode", "collision"],
  ],
  [
    "independent-project",
    "Полный маршрут заданной детали в модели",
    ["planning", "gcode"],
  ],
].map(([id, title, prerequisites]) => ({ id, title, prerequisites }));

const families = [
  [
    "drawing",
    "Чертёж и измерение",
    ["Поверхности и разрезы", "Выбор прибора", "Пограничный размер"],
  ],
  [
    "setup",
    "Заготовка, инструмент и наладка",
    ["Состояния станка", "Закрепление и вылет", "Рабочий ноль"],
  ],
  [
    "external-turning",
    "Наружное точение",
    [
      "Сохранение соседней поверхности",
      "Припуск и режим",
      "Альтернативный маршрут",
    ],
  ],
  [
    "faces-grooves",
    "Торцы, канавки и отрезка",
    ["Торец", "Канавка", "Отрезка с сохранением детали"],
  ],
  [
    "holes",
    "Отверстия на токарном станке",
    ["Сверление", "Растачивание", "Внутренний контроль"],
  ],
  ["threads", "Резьба", ["Профиль и шаг", "Проходы", "Контроль резьбы"]],
  [
    "milling-setup",
    "Фрезерные оси и установка",
    ["Рабочая система координат", "Длина инструмента", "Крепление и сборка"],
  ],
  [
    "milling-basic",
    "Плоскость и открытый паз",
    ["Покрытие плоскости", "Послойный паз", "Свежий контроль дна"],
  ],
  [
    "milling-2-5d",
    "Фрезерование 2,5D",
    ["Замкнутый карман", "Наружный контур", "Группа отверстий"],
  ],
  [
    "projects",
    "Самостоятельные проекты",
    ["План и контроль", "Несколько установок", "Повторяемость серии"],
  ],
].map(([id, title, plannedObjectives]) => ({ id, title, plannedObjectives }));

const evidence = {
  orientation:
    "Действия вводного сценария; самостоятельная работа на реальном станке не проверяется.",
  concept:
    "Ответ в учебном объяснении; выполнение операции этим ответом не подтверждается.",
  "guided-practice":
    "Действия и результат учебной модели; использование помощи учитывается существующим журналом.",
  programming:
    "Программа и проверка в учебном интерпретаторе; перенос на другую стойку не проверяется.",
  diagnosis:
    "Разбор ошибки и проверка исправления в заданном сценарии; поиск любой неисправности не подтверждается.",
  project:
    "Маршрут, результат и контроль заданной детали в модели; это ещё не произвольный производственный проект.",
  transfer:
    "Другое условие в том же учебном профиле; устойчивость навыка спустя время не проверяется.",
};

// Each row is reviewed explicitly: id, family, format, target skills, prior skills,
// learning objective, optional shared condition (dimension-only variants).
const mappings = [
  [
    "metrology-outer-control",
    "drawing",
    "guided-practice",
    ["drawing", "metrology"],
    ["dimensions", "safe-state"],
    "Связать размер с выбранной поверхностью, проверить установку виртуального прибора и записать два измерения с пределами размера.",
  ],
  [
    "metrology-section-hole",
    "drawing",
    "guided-practice",
    ["drawing", "metrology"],
    ["drawing", "metrology"],
    "По продольному разрезу отличить глухое отверстие от сквозного и выбрать внутренний прибор для контроля двух сечений.",
  ],
  [
    "metrology-two-sections",
    "drawing",
    "diagnosis",
    ["metrology", "tolerances"],
    ["metrology"],
    "Сопоставить два сечения со своими пределами и обнаружить несоответствие, которое не показывает один благополучный замер.",
  ],
  [
    "metrology-refine-border",
    "drawing",
    "guided-practice",
    ["metrology", "tolerances"],
    ["metrology", "tolerances"],
    "Зафиксировать неопределённость пограничного замера и уточнить оба сечения другим прибором с отдельной проверкой установки.",
  ],
  [
    "metrology-fresh-revision",
    "drawing",
    "diagnosis",
    ["metrology", "tolerances"],
    ["metrology", "tolerances"],
    "Различить редакции детали, сохранить старые записи как устаревшие и выполнить свежий контроль после доработки.",
  ],
  [
    "metrology-bushing-transfer",
    "drawing",
    "transfer",
    ["drawing", "metrology", "tolerances"],
    ["drawing", "metrology", "tolerances"],
    "Самостоятельно проверить наружную и внутреннюю поверхности втулки и обосновать общий вывод отдельными интервалами каждого сечения.",
  ],
  [
    "practice-firstSession",
    "setup",
    "orientation",
    ["machine-parts", "safe-state"],
    [],
    "Найти заготовку, патрон и резец, различить вращение и остановку и выполнить первые действия в модели.",
  ],
  [
    "machine",
    "setup",
    "concept",
    ["machine-parts"],
    [],
    "Объяснить, что вращается при точении и за счёт какого движения инструмент изменяет заготовку.",
  ],
  [
    "safety",
    "setup",
    "concept",
    ["safe-state"],
    ["machine-parts"],
    "Выбрать допустимый момент измерения после полной остановки и отличить его от выбега шпинделя.",
  ],
  [
    "tool",
    "setup",
    "concept",
    ["tools"],
    ["machine-parts"],
    "Связать назначение резца с наружной обработкой детали и различить его с измерительным прибором.",
  ],
  [
    "diameter",
    "drawing",
    "concept",
    ["dimensions"],
    [],
    "Различить диаметр и радиус круглой заготовки и правильно прочитать обозначение диаметра на схеме.",
  ],
  [
    "axes",
    "drawing",
    "concept",
    ["lathe-coordinates"],
    ["dimensions"],
    "Связать диаметральную координату X и направление Z с диаметром и длиной обрабатываемого участка.",
  ],
  [
    "practice-firstProcess",
    "external-turning",
    "guided-practice",
    ["lathe-coordinates", "lathe-profile", "metrology"],
    ["safe-state", "tools", "lathe-coordinates"],
    "Задать координаты первого прохода, выполнить учебную обработку, остановить станок и проверить полученный размер.",
  ],
  [
    "first-cut",
    "external-turning",
    "guided-practice",
    ["lathe-profile"],
    ["lathe-coordinates", "tools", "safe-state"],
    "Выполнить наружный проход до указанного диаметра и проследить изменение размера в учебной модели.",
  ],
  [
    "practice-drawingSession",
    "drawing",
    "guided-practice",
    ["drawing", "metrology", "tolerances"],
    ["dimensions", "safe-state"],
    "Найти требуемый размер детали, выбрать пригодный прибор и сопоставить результат измерения с требованием.",
  ],
  [
    "control",
    "drawing",
    "concept",
    ["metrology"],
    ["dimensions", "safe-state"],
    "Объяснить, зачем проверять фактический размер после прохода и почему заданной координаты недостаточно.",
  ],
  [
    "tolerance",
    "drawing",
    "concept",
    ["tolerances"],
    ["metrology"],
    "Сопоставить измеренное значение с нижней и верхней границей допуска и сделать вывод о годности размера.",
  ],
  [
    "first-control",
    "drawing",
    "guided-practice",
    ["metrology", "tolerances"],
    ["safe-state", "tolerances"],
    "Остановить обработку, получить измерение и подтвердить размер учебной детали по допустимому интервалу.",
  ],
  [
    "setup",
    "setup",
    "concept",
    ["setup"],
    ["tools", "lathe-coordinates", "safe-state"],
    "Разобрать подготовку станка, инструмента и рабочего нуля до начала учебной обработки детали.",
  ],
  [
    "rough-finish",
    "external-turning",
    "concept",
    ["allowance", "lathe-profile"],
    ["dimensions", "tools"],
    "Различить назначение чернового и чистового проходов и объяснить, зачем оставлять припуск на завершение.",
  ],
  [
    "feed",
    "external-turning",
    "concept",
    ["feeds"],
    ["tools"],
    "Различить подачу и обороты шпинделя и связать их изменение с поведением учебной обработки.",
  ],
  [
    "pass-count",
    "external-turning",
    "concept",
    ["allowance"],
    ["dimensions"],
    "Распределить снимаемый припуск между проходами с учётом радиальной глубины резания в учебном профиле.",
  ],
  [
    "full-cycle",
    "external-turning",
    "guided-practice",
    ["planning", "lathe-profile", "metrology"],
    ["setup", "allowance", "feeds", "tolerances"],
    "Пройти подготовку, черновую и чистовую обработку и контроль одной детали с доступным разбором действий.",
  ],
  [
    "self-cycle",
    "external-turning",
    "transfer",
    ["planning", "lathe-profile", "tolerances"],
    ["planning"],
    "Повторить полный цикл для другого чертежа в том же учебном профиле и проверить полученный размер.",
  ],
  [
    "code-coordinates",
    "external-turning",
    "programming",
    ["gcode", "lathe-coordinates"],
    ["lathe-coordinates", "safe-state"],
    "Прочитать координаты X и Z в строке программы и связать их с положением резца относительно детали.",
  ],
  [
    "code-motion",
    "external-turning",
    "programming",
    ["gcode", "collision"],
    ["lathe-coordinates", "safe-state"],
    "Различить быстрый подвод и рабочее перемещение и выбрать движение для подхода к материалу.",
  ],
  [
    "code-modal",
    "external-turning",
    "programming",
    ["gcode"],
    ["gcode"],
    "Проследить сохраняющиеся команды между строками и определить действующий режим последующего движения.",
  ],
  [
    "code-feed",
    "external-turning",
    "programming",
    ["gcode", "feeds"],
    ["gcode", "feeds"],
    "Связать заданную подачу с рабочим ходом программы и проверить её смысл в выбранном учебном режиме.",
  ],
  [
    "code-spindle",
    "setup",
    "programming",
    ["gcode", "safe-state"],
    ["gcode", "safe-state"],
    "Прочитать команды запуска и остановки шпинделя и определить состояние перед измерением детали.",
  ],
  [
    "code-retract",
    "external-turning",
    "programming",
    ["gcode", "collision"],
    ["gcode", "lathe-coordinates"],
    "Составить последовательность отвода по X и Z, чтобы инструмент вышел из материала перед возвратом.",
  ],
  [
    "practice-programSetup",
    "setup",
    "guided-practice",
    ["setup", "gcode", "metrology"],
    ["setup", "gcode", "tolerances"],
    "Согласовать учебную программу с инструментом и рабочим нулём, выполнить обработку и контроль результата.",
  ],
  [
    "self-code",
    "external-turning",
    "transfer",
    ["gcode", "planning"],
    ["gcode", "planning"],
    "Составить программу под другой чертёж в поддерживаемом диалекте и проверить её траекторию и результат.",
  ],
  [
    "operation-face-first",
    "faces-grooves",
    "guided-practice",
    ["facing"],
    ["setup", "gcode", "allowance"],
    "В учебной модели выбрать торцевой инструмент, обработать первый торец и проверить изменение положения торцевой поверхности.",
  ],
  [
    "operation-face-two",
    "faces-grooves",
    "guided-practice",
    ["facing", "allowance"],
    ["facing", "allowance"],
    "Распределить торцевой припуск на два допустимых прохода вместо одного чрезмерно глубокого снятия.",
  ],
  [
    "operation-groove-first",
    "faces-grooves",
    "guided-practice",
    ["groove"],
    ["setup", "gcode"],
    "В учебной модели выполнить наружную кольцевую канавку подходящим инструментом и вывести пластину перед продольным движением.",
  ],
  [
    "operation-taper",
    "external-turning",
    "guided-practice",
    ["taper"],
    ["lathe-profile", "gcode"],
    "В учебной модели согласовать изменение X и Z при линейном рабочем ходе, чтобы получить конический участок вместо цилиндра.",
  ],
  [
    "operation-grooves-project",
    "faces-grooves",
    "project",
    ["groove", "planning"],
    ["groove", "planning"],
    "Спланировать последовательность двух канавок, выполнить безопасные отводы и проверить требуемый профиль.",
  ],
  [
    "operation-shoulder-control",
    "external-turning",
    "guided-practice",
    ["lathe-profile", "planning", "metrology"],
    ["gcode", "lathe-profile", "metrology"],
    "В учебной модели выбрать сохраняемую базу, изготовить шейку до уступа и подтвердить оба сечения шейки и нетронутую поверхность.",
  ],
  [
    "operation-allowance-plan",
    "external-turning",
    "guided-practice",
    ["allowance", "planning", "lathe-profile"],
    ["gcode", "allowance", "lathe-profile"],
    "В учебной модели распределить большой припуск на допустимые проходы и проверить весь обработанный участок и сохранённую базу.",
  ],
  [
    "operation-relief-band",
    "faces-grooves",
    "guided-practice",
    ["groove", "planning", "metrology"],
    ["gcode", "groove", "metrology"],
    "В учебной модели обработать широкую проточку несколькими положениями пластины, сохранить два буртика и измерить все участки дна.",
  ],
  [
    "operation-finish-limit",
    "external-turning",
    "guided-practice",
    ["tools", "allowance", "lathe-profile"],
    ["gcode", "tools", "allowance"],
    "В учебной модели спланировать проходы чистового резца по его собственному пределу глубины, выполнить обработку и свежий контроль.",
  ],
  [
    "operation-taper-land",
    "external-turning",
    "guided-practice",
    ["taper", "planning", "metrology"],
    ["gcode", "taper", "metrology"],
    "В учебной модели спрогнозировать диаметр промежуточного сечения конуса, изготовить переход к цилиндру и проверить обе поверхности и базу.",
  ],
  [
    "operation-transfer-two-lands",
    "external-turning",
    "transfer",
    ["planning", "lathe-profile", "metrology"],
    ["gcode", "planning", "metrology"],
    "В учебной модели самостоятельно выбрать порядок обработки двух шеек, сохранить базу и подтвердить каждую поверхность свежими измерениями.",
  ],
  [
    "project-RF5-SHAFT-01",
    "projects",
    "project",
    ["independent-project", "planning"],
    ["planning", "gcode", "tolerances"],
    "В учебной модели составить маршрут ступенчатого валика, обработать заданные участки и подтвердить их размеры измерениями.",
    "shaft-standard",
  ],
  [
    "project-RF5-SHAFT-02",
    "projects",
    "project",
    ["independent-project", "planning"],
    ["planning", "gcode", "tolerances"],
    "В учебной модели адаптировать тот же маршрут ступенчатого валика к более короткой детали и повторить контроль размеров.",
    "shaft-standard",
  ],
  [
    "project-RF5-SHAFT-03",
    "projects",
    "project",
    ["independent-project", "planning"],
    ["planning", "gcode", "tolerances"],
    "В учебной модели адаптировать маршрут ступенчатого валика к длинной шейке, сохранив размеры соседних участков и контроль.",
    "shaft-standard",
  ],
  [
    "project-RF5-SHAFT-04",
    "projects",
    "project",
    ["independent-project", "allowance"],
    ["planning", "gcode", "allowance"],
    "В учебной модели перепланировать распределение проходов валика при другом припуске, затем обработать и проверить участки.",
  ],
  [
    "project-RF5-SHAFT-05",
    "projects",
    "transfer",
    ["independent-project", "planning", "allowance"],
    ["planning", "gcode", "tolerances", "diagnosis"],
    "В учебной модели самостоятельно составить программу с пустого редактора, распределить увеличенный припуск, изготовить изделие и подтвердить все размеры свежим контролем.",
  ],
  [
    "milling-setup-datums","milling-setup","guided-practice",["mill-setup","mill-coordinates"],["mill-coordinates","safe-state"],"Численно задать G54 и длину фрезы, проверить рабочие и машинные координаты, повторить проверку после смены установки."
  ],
  ["milling-face-coverage","milling-basic","guided-practice",["mill-removal"],["mill-setup","mill-coordinates"],"Покрыть открытую полосу перекрывающимися проходами, сохранить соседний материал и измерить фактическую плоскость."],
  ["milling-slot-open","milling-basic","guided-practice",["mill-removal"],["mill-setup","mill-coordinates"],"Изготовить открытый паз с учётом радиуса фрезы и проверить фактическое дно в трёх сечениях."],
  ["milling-slot-wide-layers","milling-basic","guided-practice",["mill-removal","allowance"],["mill-removal","mill-setup"],"Выполнить широкий паз в два слоя, проверить перекрытие, остаток материала и свежесть контроля."],
  ["hole-read","holes","orientation",["metrology"],["drawing"],"Выбрать прибор и измерить внутренний диаметр в указанном сечении."],
  ["hole-depth","holes","concept",["lathe-hole","metrology"],["dimensions"],"Предсказать длину цилиндрического участка и проверить две глубины."],
  ["hole-drill","holes","guided-practice",["lathe-hole","metrology"],["lathe-coordinates"],"Просверлить глухое отверстие и измерить диаметр и рабочую глубину."],
  ["hole-bore","holes","transfer",["lathe-hole","allowance"],["metrology"],"Увеличить часть сквозного отверстия, сохранить остальной канал и измерить оба участка."],
  ["hole-diagnosis","holes","diagnosis",["lathe-hole","diagnosis"],["lathe-coordinates"],"Обнаружить, почему державка задевает дно, исправить ход и измерить ступень."],
  ["hole-sleeve","holes","project",["lathe-hole","planning","metrology"],["allowance","drawing"],"Расточить две ступени втулки и подтвердить размеры и стенку свежим контролем."],
  ["mounting-plate","milling-2-5d","project",["mill-removal","planning","metrology"],["mill-removal","mill-setup"],"По отдельному чертежу написать программы кармана, наружной полосы и двух отверстий. Подтвердить обработку и сохранение рамы замерами."],
  ["milling-plate-two-depths","milling-basic","project",["mill-removal","metrology"],["mill-removal","mill-setup"],"Самостоятельно обработать две полосы на разной глубине, сохранить перемычку и подтвердить результат в четырёх точках."],
  [
    "milling-xyz-air",
    "milling-setup",
    "guided-practice",
    ["mill-coordinates"],
    ["dimensions", "safe-state"],
    "Проследить линейные перемещения XYZ без резания и отличить координату инструмента от диаметральной X токарного станка.",
  ],
  [
    "milling-clamp-crossing",
    "milling-setup",
    "diagnosis",
    ["mill-setup", "collision"],
    ["mill-coordinates", "safe-state"],
    "Найти пересечение пути с креплением и проверить траекторию обхода, а не только её конечные точки.",
  ],
  [
    "milling-rapid-stock",
    "milling-basic",
    "guided-practice",
    ["mill-removal", "gcode"],
    ["mill-coordinates", "gcode", "feeds"],
    "Устранить быстрый ход через материал и выполнить первый открытый паз рабочими перемещениями в модели.",
  ],
  [
    "milling-depth-layers",
    "milling-basic",
    "diagnosis",
    ["mill-removal", "allowance"],
    ["mill-removal", "allowance"],
    "Найти чрезмерную глубину первого слоя, разделить обработку паза на допустимые слои и проверить исправление.",
  ],
  [
    "milling-holder-clearance",
    "milling-setup",
    "diagnosis",
    ["collision", "mill-setup"],
    ["mill-coordinates", "collision"],
    "Отличить свободную траекторию фрезы от пересечения державки с креплением и проверить обход всей сборки.",
  ],
  [
    "milling-machine-column",
    "milling-setup",
    "diagnosis",
    ["collision", "mill-setup"],
    ["mill-coordinates", "collision"],
    "Обнаружить пересечение с корпусом станка при допустимых координатах и проверить исправленный путь сборки.",
  ],
  [
    "diagnostic-diag-rapid",
    "external-turning",
    "diagnosis",
    ["diagnosis", "collision"],
    ["gcode", "collision"],
    "Найти быстрый ход в материал как первую причину остановки, исправить программу и повторно проверить её.",
  ],
  [
    "diagnostic-diag-tool",
    "setup",
    "diagnosis",
    ["diagnosis", "tools"],
    ["gcode", "tools", "collision"],
    "Сопоставить операцию с установленным резцом, исправить выбор инструмента и проверить программу повторно.",
  ],
  [
    "diagnostic-diag-blade",
    "faces-grooves",
    "diagnosis",
    ["diagnosis", "groove"],
    ["gcode", "groove", "collision"],
    "Найти перемещение канавочной пластины вдоль материала без отвода и проверить безопасное исправление.",
  ],
  [
    "diagnostic-diag-face-depth",
    "faces-grooves",
    "diagnosis",
    ["diagnosis", "facing", "allowance"],
    ["gcode", "facing", "allowance", "collision"],
    "Определить превышение глубины торцевого прохода, перераспределить припуск и проверить исправленный маршрут.",
  ],
  [
    "diagnostic-diag-zero",
    "setup",
    "diagnosis",
    ["diagnosis", "setup"],
    ["setup", "gcode", "collision"],
    "Найти неверный рабочий ноль за сообщением об ошибке и исправить наладку вместо подмены координат программы.",
  ],
  [
    "diagnostic-diag-fixture",
    "milling-setup",
    "diagnosis",
    ["diagnosis", "collision"],
    ["mill-setup", "gcode", "collision"],
    "Найти столкновение с креплением в середине пути между свободными конечными точками и проверить обход.",
  ],
  [
    "diagnostic-diag-holder",
    "milling-setup",
    "diagnosis",
    ["diagnosis", "collision"],
    ["mill-setup", "gcode", "collision"],
    "Определить столкновение державки при свободной фрезе и подтвердить отсутствие пересечения после исправления.",
  ],
  [
    "diagnostic-diag-body",
    "milling-setup",
    "diagnosis",
    ["diagnosis", "collision"],
    ["mill-setup", "gcode", "collision"],
    "Отличить пределы перемещений от геометрии корпуса станка и исправить пересечение с его препятствием.",
  ],
  [
    "diagnostic-diag-travel",
    "milling-setup",
    "diagnosis",
    ["diagnosis", "mill-coordinates"],
    ["mill-coordinates", "gcode", "collision"],
    "Найти опечатку конечной координаты, вызывающую выход за ход оси, и повторно проверить исправленную программу.",
  ],
  [
    "diagnostic-diag-spindle",
    "setup",
    "diagnosis",
    ["diagnosis", "safe-state"],
    ["gcode", "safe-state", "collision"],
    "Найти рабочий ход без вращения шпинделя, восстановить нужное состояние и повторно проверить выполнение.",
  ],
];

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const steps = mappings.map(
  ([id, family, format, skills, prerequisites, objective, conditionId]) => {
    const existing = route.get(id);
    if (!existing)
      throw new Error("Curriculum references missing route step: " + id);
    return {
      id,
      title: existing.title,
      family,
      format,
      competencies: skills,
      prerequisites,
      objective,
      conditionId: conditionId || id,
      evidenceScope: evidence[format],
    };
  },
);
const catalogue = freeze({
  version: 1,
  scope: "learning-path",
  prerequisitePolicy: {
    competency:
      "Связи понятий для полного изучения умения, а не условия допуска к первому знакомству с ним.",
    step: "Ожидаемое предварительное знакомство. На следующем шаге та же тема может углубляться; сложное действие может вводиться с сопровождением до полного изучения его составляющих. Это не подтверждение освоения и не автоматический допуск.",
  },
  families,
  competencies,
  steps,
});
const byId = new Map(steps.map((step) => [step.id, step]));

function manifest() {
  return JSON.parse(JSON.stringify(catalogue));
}

function coverage() {
  const conditions = new Set(steps.map((step) => step.conditionId)).size;
  return {
    scope: catalogue.scope,
    routeSteps: steps.length,
    conditions,
    parameterVariants: steps.length - conditions,
    families: families.map((family) => {
      const mapped = steps.filter((step) => step.family === family.id);
      return {
        id: family.id,
        title: family.title,
        routeSteps: mapped.length,
        status: mapped.length ? "partial" : "planned",
      };
    }),
  };
}

module.exports = { get: (id) => byId.get(id) || null, manifest, coverage };
