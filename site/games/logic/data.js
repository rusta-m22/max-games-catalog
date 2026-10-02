'use strict';
window.LOGIC_DATA = (() => {
const rows = [
['sun','Солнце','Sun'],['moon','Луна','Moon'],['cloud-rain','Дождь','Rain'],['snowflake','Снежинка','Snowflake'],['umbrella','Зонт','Umbrella'],['thermometer','Термометр','Thermometer'],
['apple','Яблоко','Apple'],['banana','Банан','Banana'],['cherry','Вишня','Cherry'],['grape','Виноград','Grapes'],['citrus','Лимон','Lemon'],['carrot','Морковь','Carrot'],
['dog','Собака','Dog'],['cat','Кошка','Cat'],['fish','Рыба','Fish'],['bird','Птица','Bird'],['rabbit','Кролик','Rabbit'],['turtle','Черепаха','Turtle'],['snail','Улитка','Snail'],['squirrel','Белка','Squirrel'],['bug','Жук','Beetle'],
['guitar','Гитара','Guitar'],['drum','Барабан','Drum'],['piano','Пианино','Piano'],['music','Ноты','Music notes'],['headphones','Наушники','Headphones'],
['alarm-clock','Будильник','Alarm clock'],['watch','Часы','Watch'],['hourglass','Песочные часы','Hourglass'],
['plane','Самолёт','Airplane'],['helicopter','Вертолёт','Helicopter'],['rocket','Ракета','Rocket'],['car','Автомобиль','Car'],['bus','Автобус','Bus'],['train-front','Поезд','Train'],['bike','Велосипед','Bicycle'],['ship','Корабль','Ship'],
['book-open','Книга','Book'],['pencil','Карандаш','Pencil'],['ruler','Линейка','Ruler'],['scissors','Ножницы','Scissors'],['paperclip','Скрепка','Paperclip'],
['coffee','Кофе','Coffee'],['cup-soda','Газировка','Soda'],['milk','Молоко','Milk'],['ice-cream-cone','Мороженое','Ice cream'],['cake-slice','Торт','Cake'],['candy','Конфета','Candy'],['cookie','Печенье','Cookie'],
['key-round','Ключ','Key'],['lock-keyhole','Замок','Lock'],['door-open','Дверь','Door'],['flower-2','Цветок','Flower'],['tree-pine','Сосна','Pine tree'],['leaf','Лист','Leaf'],['sprout','Росток','Seedling'],
['glasses','Очки','Glasses'],['telescope','Телескоп','Telescope'],['microscope','Микроскоп','Microscope'],['flame','Огонь','Fire'],['lamp','Лампа','Lamp'],['lightbulb','Лампочка','Light bulb'],
['shovel','Лопата','Shovel'],['axe','Топор','Axe'],['hammer','Молоток','Hammer'],['wrench','Гаечный ключ','Wrench'],['camera','Фотоаппарат','Camera'],['smartphone','Телефон','Phone'],['monitor','Монитор','Monitor'],['radio','Радио','Radio'],
['anchor','Якорь','Anchor'],['sailboat','Парусник','Sailboat'],['chef-hat','Поварской колпак','Chef hat'],['cooking-pot','Кастрюля','Cooking pot'],['utensils','Вилка и нож','Cutlery'],
['bed','Кровать','Bed'],['armchair','Кресло','Armchair'],['sofa','Диван','Sofa'],['mountain','Гора','Mountain'],['tent','Палатка','Tent'],['backpack','Рюкзак','Backpack'],
['magnet','Магнит','Magnet'],['compass','Компас','Compass'],['map','Карта','Map'],['snowman','Снеговик','Snowman'],['gift','Подарок','Gift'],['party-popper','Хлопушка','Party popper'],['palette','Палитра','Palette'],['paintbrush','Кисть','Paintbrush'],['clapperboard','Кинохлопушка','Clapperboard'],['popcorn','Попкорн','Popcorn'],['film','Киноплёнка','Film reel'],['crown','Корона','Crown'],['gem','Бриллиант','Diamond'],['heart','Сердце','Heart'],['star','Звезда','Star'],['croissant','Круассан','Croissant'],['ferris-wheel','Колесо обозрения','Ferris wheel'],['disc','Диск','Disc'],['lifebuoy','Спасательный круг','Life buoy'],['battery','Батарейка','Battery'],['plug','Вилка питания','Power plug']
];
const objects=Object.fromEntries(rows.map(([id,ru,en])=>[id,{id,ru,en}]));
// Each answer set is reviewed separately to avoid overlapping category answers.
const raw=[
['apple banana grape','Фрукты|Овощи|Орехи|Грибы','Fruit|Vegetables|Nuts|Mushrooms','Все три — фрукты.','All three are fruits.'],
['guitar drum piano','Музыка|Кулинария|Транспорт|Спорт','Music|Cooking|Transport|Sports','На этих инструментах играют музыку.','These instruments make music.'],
['alarm-clock watch hourglass','Время|Расстояние|Вес|Температура','Time|Distance|Weight|Temperature','Все три помогают измерять или отслеживать время.','All three measure or track time.'],
['car bus bike','Колёса|Крылья|Паруса|Рельсы','Wheels|Wings|Sails|Rails','У каждого из этих видов транспорта есть колёса.','All these vehicles have wheels.'],
['plane helicopter bird','Полёт|Плавание|Садоводство|Выпечка','Flight|Swimming|Gardening|Baking','Все три могут подниматься в воздух.','All three can fly.'],
['ship anchor sailboat','Море|Пустыня|Пекарня|Космос','The sea|The desert|A bakery|Space','Корабли, парусники и якоря связаны с мореплаванием.','Ships, sailboats and anchors belong at sea.'],
['pencil ruler book-open','Учёба|Рыбалка|Театр|Туризм','Studying|Fishing|Theatre|Camping','Эти вещи часто нужны на уроках.','These things are often used in class.'],
['ice-cream-cone cake-slice candy','Сладости|Овощи|Инструменты|Мебель','Sweets|Vegetables|Tools|Furniture','Мороженое, торт и конфета — сладкие угощения.','Ice cream, cake and candy are sweet treats.'],
['coffee cup-soda milk','Напитки|Выпечка|Одежда|Украшения','Drinks|Baked goods|Clothing|Jewellery','Все три можно пить.','All three are drinks.'],
['snowflake snowman ice-cream-cone','Холод|Жара|Шум|Магнетизм','Cold|Heat|Noise|Magnetism','Снег и мороженое сохраняются на холоде.','Snow and ice cream need cold temperatures.'],
['tree-pine flower-2 sprout','Растения|Насекомые|Посуда|Минералы','Plants|Insects|Dishes|Minerals','Сосна, цветок и росток — растения.','A pine tree, a flower and a seedling are plants.'],
['glasses telescope microscope','Линзы|Паруса|Клавиши|Зубья','Lenses|Sails|Keys|Teeth','Линзы помогают рассматривать объекты.','Lenses help us see objects.'],
['sun lamp lightbulb','Свет|Холод|Ветер|Тишина','Light|Cold|Wind|Silence','Каждый из этих объектов даёт свет.','Each of these objects gives light.'],
['axe hammer wrench','Инструменты|Одежда|Сладости|Растения','Tools|Clothing|Sweets|Plants','Это инструменты для работы руками.','These are hand tools.'],
['bed armchair sofa','Мебель|Транспорт|Овощи|Посуда','Furniture|Transport|Vegetables|Dishes','Все три предмета относятся к мебели.','All three are pieces of furniture.'],
['mountain tent backpack','Поход|Концерт|Кино|Кухня','Hiking|A concert|Cinema|Cooking','Горы, палатка и рюкзак напоминают о походе.','Mountains, a tent and a backpack suggest hiking.'],
['chef-hat cooking-pot utensils','Кухня|Библиотека|Вокзал|Обсерватория','Kitchen|Library|Station|Observatory','Это предметы, связанные с приготовлением еды.','These items are related to preparing food.'],
['camera smartphone telescope','Оптика|Садоводство|Вязание|Выпечка','Optics|Gardening|Knitting|Baking','Камерам и телескопам нужны оптические линзы.','Cameras and telescopes use optical lenses.'],
['moon banana croissant','Изогнутая форма|Квадратная форма|Прямоугольная форма|Треугольная форма','Curved shape|Square shape|Rectangular shape|Triangle shape','Полумесяц, банан и круассан имеют изогнутую форму.','A crescent moon, banana and croissant are curved.'],
['disc lifebuoy ferris-wheel','Круг|Квадрат|Треугольник|Спираль','Circle|Square|Triangle|Spiral','У всех трёх круглая форма.','All three have a circular shape.'],
['key-round lock-keyhole door-open','Доступ|Погода|Музыка|Скорость','Access|Weather|Music|Speed','Ключ открывает замок и даёт пройти через дверь.','A key unlocks a lock to open a door.'],
['cloud-rain snowflake sun','Погода|Сладости|Мебель|Кино','Weather|Sweets|Furniture|Cinema','Солнце, дождь и снег — явления погоды.','Sunshine, rain and snow describe weather.'],
['gift cake-slice party-popper','Праздник|Поход|Ремонт|Экзамен','Celebration|Hiking|Repairs|An exam','Подарки, торт и хлопушки часто бывают на празднике.','Gifts, cake and party poppers are used at celebrations.'],
['palette paintbrush pencil','Рисование|Плавание|Кулинария|Астрономия','Drawing|Swimming|Cooking|Astronomy','Это инструменты художника.','These are tools an artist uses.'],
['film clapperboard popcorn','Кино|Почта|Аптека|Вокзал','Cinema|Post office|Pharmacy|Station','Плёнка и хлопушка нужны кино, а попкорн любят зрители.','Film and clapperboards make movies; viewers enjoy popcorn.'],
['compass map telescope','Ориентирование|Кондитерская|Мода|Сантехника','Navigation|Bakery|Fashion|Plumbing','Компас, карта и наблюдения за звёздами помогают найти путь.','A compass, a map and star observations help find a way.'],
['cat dog rabbit','Шерсть|Чешуя|Перья|Панцирь','Fur|Scales|Feathers|Shell','Тела этих животных покрыты шерстью.','These animals have fur.'],
['fish turtle snail','Без шерсти|С перьями|С гривой|С клювом','No fur|Feathers|A mane|A beak','Ни у рыбы, ни у черепахи, ни у улитки нет шерсти.','Fish, turtles and snails do not have fur.'],
['bird plane feather','Крылья|Рельсы|Корни|Рога','Wings|Rails|Roots|Horns','У птицы и самолёта есть крылья, а перо — часть крыла птицы.','Birds and planes have wings; feathers cover bird wings.'],
['radio headphones drum','Звук|Аромат|Вкус|Магнит','Sound|Smell|Taste|Magnet','Радио, наушники и барабан воспроизводят звук.','Radios, headphones and drums produce sound.'],
['battery plug lightbulb','Электричество|Мореплавание|Садоводство|Рыбалка','Electricity|Sailing|Gardening|Fishing','Эти предметы связаны с электричеством.','These objects are connected with electricity.'],
['mountain gem hourglass','Камень и песок|Ткань|Пластилин|Шерсть','Rock and sand|Fabric|Modelling clay|Wool','Горы состоят из горных пород, камни — минералы, в часах — песок.','Mountains are rock, gems are minerals and the hourglass contains sand.'],
['umbrella tent roof','Укрытие|Скорость|Рецепт|Мелодия','Shelter|Speed|Recipe|Melody','Зонт, палатка и крыша укрывают от непогоды.','Umbrellas, tents and roofs shelter us from bad weather.'],
['book-open door-open laptop','Можно открыть|Можно съесть|Можно надеть|Можно посадить','Can be opened|Can be eaten|Can be worn|Can be planted','Можно открыть книгу, дверь и ноутбук.','You can open a book, a door and a laptop.'],
['cherry grape balloon','Гроздь или связка|Треугольник|Рельсы|Перья','A bunch|A triangle|Rails|Feathers','Вишни, виноград и воздушные шары можно собрать в связку.','Cherries, grapes and balloons can form a bunch.'],
['snail turtle hourglass','Не спешат|Летают|Светятся|Звенят','Take their time|Fly|Glow|Ring','Улитка и черепаха медлительны, песок в часах сыплется постепенно.','Snails and turtles are slow, and sand falls gradually in an hourglass.']
];
[['feather','Перо','Feather'],['roof','Крыша','Roof'],['laptop','Ноутбук','Laptop'],['balloon','Воздушный шар','Balloon']].forEach(([id,ru,en])=>objects[id]={id,ru,en});
const common=raw.map((r,i)=>({id:'c'+i,items:r[0].split(' '),answers:{ru:r[1].split('|'),en:r[2].split('|')},explain:{ru:r[3],en:r[4]}}));
const blend=['sun','moon','umbrella','guitar','alarm-clock','plane','rocket','car','bike','ship','book-open','scissors','coffee','ice-cream-cone','key-round','flower-2','tree-pine','glasses','lamp','hammer','camera','anchor','bed','armchair','mountain','tent','magnet','snowman','gift','crown','heart','star'];
return {objects,common,blend};
})();
