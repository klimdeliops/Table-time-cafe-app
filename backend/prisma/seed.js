"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma = new client_1.PrismaClient();
// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------
const RESTAURANT = {
    name: 'Table & Time',
    address: 'Main Street 1',
    description: 'Time-themed café experience',
};
const TABLES = [
    { capacity: 2, x: 12, y: 18 },
    { capacity: 2, x: 12, y: 42 },
    { capacity: 4, x: 12, y: 66 },
    { capacity: 2, x: 12, y: 84 },
    { capacity: 4, x: 38, y: 22 },
    { capacity: 6, x: 38, y: 50 },
    { capacity: 4, x: 38, y: 78 },
    { capacity: 2, x: 62, y: 18 },
    { capacity: 4, x: 62, y: 44 },
    { capacity: 6, x: 62, y: 72 },
    { capacity: 2, x: 86, y: 28 },
    { capacity: 4, x: 86, y: 62 },
];
const DISHES = [
    // hot_drinks
    { name: 'Эспрессо «Начало отсчёта»', price: 3.50, category: 'hot_drinks' },
    { name: 'Американо «Петля времени»', price: 4.00, category: 'hot_drinks' },
    { name: 'Капучино «Утро, которое не спешит»', price: 5.00, category: 'hot_drinks' },
    { name: 'Латте «Линия горизонта времени»', price: 5.50, category: 'hot_drinks' },
    { name: 'Раф «Тёплая непрерывность»', price: 6.00, category: 'hot_drinks' },
    { name: 'Мокка «Сладкий парадокс времени»', price: 6.00, category: 'hot_drinks' },
    { name: 'Флэт уайт «Тонкая секунда»', price: 5.50, category: 'hot_drinks' },
    { name: 'Кофе «Секрет доктора Манхэттена»', price: 7.00, category: 'hot_drinks' },
    { name: 'Кофе «Обратный ход»', price: 6.50, category: 'hot_drinks' },
    { name: 'Какао «Ностальгия по вчера»', price: 5.50, category: 'hot_drinks' },
    { name: 'Чай чёрный «Письма из будущего»', price: 4.00, category: 'hot_drinks' },
    { name: 'Чай зелёный «Спокойствие хроноса»', price: 4.00, category: 'hot_drinks' },
    { name: 'Чай с мятой «Замедленное дыхание времени»', price: 4.50, category: 'hot_drinks' },
    // cold_drinks
    { name: 'Айс-латте «Лето вне времени»', price: 6.00, category: 'cold_drinks' },
    { name: 'Холодный кофе «13-й час»', price: 6.50, category: 'cold_drinks' },
    { name: 'Лимонад «Солнечная пауза»', price: 5.00, category: 'cold_drinks' },
    { name: 'Лимонад «Разрыв временной линии»', price: 5.50, category: 'cold_drinks' },
    { name: 'Смузи «Эффект дежавю»', price: 7.00, category: 'cold_drinks' },
    { name: 'Сок апельсиновый «Утро после полуночи»', price: 4.50, category: 'cold_drinks' },
    { name: 'Смузи ягодный «Хроника мгновения»', price: 7.50, category: 'cold_drinks' },
    { name: 'Айс-чай «Тихий хронос»', price: 5.00, category: 'cold_drinks' },
    { name: 'Вода «Нулевой момент»', price: 2.50, category: 'cold_drinks' },
    // breakfast
    { name: 'Круассан «Париж, 07:00»', price: 4.50, category: 'breakfast' },
    { name: 'Круассан «Утро Миядзаки»', price: 5.00, category: 'breakfast' },
    { name: 'Тост с авокадо «Первый кадр дня»', price: 9.00, category: 'breakfast' },
    { name: 'Омлет «До начала сюжета»', price: 8.50, category: 'breakfast' },
    { name: 'Сырники «Домашняя петля времени»', price: 9.50, category: 'breakfast' },
    { name: 'Овсянка «Медленный цикл»', price: 7.00, category: 'breakfast' },
    { name: 'Йогурт «Лёгкая реальность»', price: 6.00, category: 'breakfast' },
    { name: 'Завтрак «Before Sunrise»', price: 12.00, category: 'breakfast' },
    // sandwiches
    { name: 'Сэндвич с курицей «Обеденный интервал»', price: 10.00, category: 'sandwiches' },
    { name: 'Клаб-сэндвич «Город в ускорении»', price: 12.00, category: 'sandwiches' },
    { name: 'Панини «Тепловой момент»', price: 9.50, category: 'sandwiches' },
    { name: 'Багет с ветчиной «Случайная остановка»', price: 9.00, category: 'sandwiches' },
    { name: 'Сэндвич с тунцом «Океан времени»', price: 11.00, category: 'sandwiches' },
    { name: 'Сэндвич «Потерянная минута»', price: 10.50, category: 'sandwiches' },
    { name: 'Ролл «Перемотка вперёд»', price: 11.50, category: 'sandwiches' },
    { name: 'Сэндвич «Бегущий по минутам»', price: 10.00, category: 'sandwiches' },
    // main
    { name: 'Паста карбонара «Римская полночь»', price: 15.00, category: 'main' },
    { name: 'Паста «Эффект бабочки»', price: 14.50, category: 'main' },
    { name: 'Лазанья «Семейная хроника»', price: 16.00, category: 'main' },
    { name: 'Боул с курицей «Баланс событий»', price: 14.00, category: 'main' },
    { name: 'Боул с говядиной «Остановка времени»', price: 16.50, category: 'main' },
    { name: 'Рис с овощами «Медленный мир»', price: 12.00, category: 'main' },
    { name: 'Курица с рисом «Дневной сценарий»', price: 13.50, category: 'main' },
    { name: 'Стейк «Последний дубль»', price: 24.00, category: 'main' },
    { name: 'Том ям «Острая реальность»', price: 15.50, category: 'main' },
    { name: 'Суп куриный «Дом, где время мягкое»', price: 11.00, category: 'main' },
    { name: 'Паста «Интерстеллар»', price: 15.00, category: 'main' },
    // salads
    { name: 'Цезарь «Классика вне времени»', price: 12.00, category: 'salads' },
    { name: 'Салат с курицей «Стабильная линия»', price: 13.00, category: 'salads' },
    { name: 'Греческий салат «Средиземное настоящее»', price: 11.00, category: 'salads' },
    { name: 'Салат с тунцом «Морская память»', price: 14.00, category: 'salads' },
    { name: 'Овощной салат «Чистый момент»', price: 9.50, category: 'salads' },
    { name: 'Салат «Хроника свежести»', price: 11.50, category: 'salads' },
    { name: 'Салат «Тихий день»', price: 10.00, category: 'salads' },
    // desserts
    { name: 'Чизкейк «Последние 10 минут дня»', price: 7.50, category: 'desserts' },
    { name: 'Тирамису «Итальянская ночь»', price: 8.00, category: 'desserts' },
    { name: 'Шоколадный фондан «21:31 — момент таяния»', price: 8.50, category: 'desserts' },
    { name: 'Брауни «Тёмная материя сладости»', price: 7.00, category: 'desserts' },
    { name: 'Яблочный пирог «Воспоминание о доме»', price: 7.50, category: 'desserts' },
    { name: 'Панна-котта «Белая тишина времени»', price: 8.00, category: 'desserts' },
    { name: 'Эклер «Мгновение радости»', price: 6.50, category: 'desserts' },
    { name: 'Медовик «Советская вечность»', price: 9.00, category: 'desserts' },
    { name: 'Десерт «In Time»', price: 9.50, category: 'desserts' },
    // signature
    { name: 'Бургер «Вечер пятницы»', price: 16.00, category: 'signature' },
    { name: 'Бургер «20:31 — момент выбора»', price: 17.00, category: 'signature' },
    { name: 'Пицца «Ночная прогулка»', price: 16.50, category: 'signature' },
    { name: 'Пицца «Последний сеанс»', price: 17.50, category: 'signature' },
    { name: 'Хот-дог «Город без пауз»', price: 12.00, category: 'signature' },
    { name: 'Наггетсы «Быстрый эпизод»', price: 11.00, category: 'signature' },
    { name: 'Бургер «Доктор Кто»', price: 18.00, category: 'signature' },
    { name: 'Бургер «Назад в будущее»', price: 18.50, category: 'signature' },
];
const USERS = [
    {
        email: 'admin@tabletime.com',
        password: 'Admin1234!',
        role: client_1.Role.ADMIN,
    },
    {
        email: 'user1@tabletime.com',
        password: 'User1234!',
        role: client_1.Role.USER,
    },
    {
        email: 'user2@tabletime.com',
        password: 'User1234!',
        role: client_1.Role.USER,
    },
];
// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------
async function seedRestaurantAndTables() {
    console.log('\n🏠 Seeding restaurant...');
    let restaurant = await prisma.restaurant.findFirst({
        where: { name: RESTAURANT.name },
    });
    if (!restaurant) {
        restaurant = await prisma.restaurant.create({ data: RESTAURANT });
        console.log(`  ✔ Created restaurant: ${restaurant.name}`);
    }
    else {
        console.log(`  ↩ Restaurant already exists: ${restaurant.name}`);
    }
    console.log('\n🪑 Seeding tables...');
    const existingCount = await prisma.table.count({
        where: { restaurantId: restaurant.id },
    });
    if (existingCount === 0) {
        await prisma.table.createMany({
            data: TABLES.map((t) => ({
                restaurantId: restaurant.id,
                capacity: t.capacity,
                x: t.x,
                y: t.y,
                status: client_1.TableStatus.FREE,
            })),
        });
        console.log(`  ✔ Created ${TABLES.length} tables`);
    }
    else {
        console.log(`  ↩ Tables already exist (${existingCount} found), skipping`);
    }
}
async function seedDishes() {
    console.log('\n🍽️  Seeding dishes...');
    let created = 0;
    let skipped = 0;
    for (const dish of DISHES) {
        await prisma.dish.upsert({
            where: { name: dish.name },
            update: {},
            create: {
                name: dish.name,
                price: dish.price,
                category: dish.category,
                image: null,
                isAvailable: true,
            },
        });
        const isNew = !(await prisma.dish.findUnique({ where: { name: dish.name } }));
        isNew ? created++ : skipped++;
    }
    const total = await prisma.dish.count();
    console.log(`  ✔ Dishes in DB: ${total} (${DISHES.length} processed)`);
}
async function seedUsers() {
    console.log('\n👤 Seeding users...');
    for (const user of USERS) {
        const existing = await prisma.user.findUnique({ where: { email: user.email } });
        if (existing) {
            console.log(`  ↩ User already exists: ${user.email}`);
            continue;
        }
        const passwordHash = await argon2.hash(user.password);
        await prisma.user.create({
            data: {
                email: user.email,
                password: passwordHash,
                role: user.role,
            },
        });
        console.log(`  ✔ Created ${user.role}: ${user.email}`);
    }
}
// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('🌱 Starting seed...');
    await seedRestaurantAndTables();
    await seedDishes();
    await seedUsers();
    console.log('\n✅ Seed complete.\n');
}
main()
    .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
