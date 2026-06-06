import { PrismaClient, DishCategory, Role, TableStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const RESTAURANT = {
  name: 'Table & Time',
  address: 'Main Street 1',
  description: 'Time-themed café experience',
};

const TABLES = [
  { number: 1, capacity: 3, x: 15.4,  y: 45.71 },
  { number: 2, capacity: 2, x: 16.41, y: 80.41 },
  { number: 3, capacity: 2, x: 32.03, y: 80.22 },
  { number: 4, capacity: 2, x: 47.66, y: 80.41 },
  { number: 5, capacity: 2, x: 62.72, y: 80.41 },
  { number: 6, capacity: 4, x: 29.8,  y: 54.83 },
  { number: 7, capacity: 3, x: 43.97, y: 50.47 },
  { number: 8, capacity: 3, x: 55.13, y: 50.47 },
  { number: 9, capacity: 4, x: 66.52, y: 50.07 },
];

const DISHES: { name: string; nameEn: string; price: number; category: DishCategory }[] = [
  // hot_drinks
  { name: 'Эспрессо «Начало отсчёта»',              nameEn: 'Espresso "The Countdown"',               price: 3.50,  category: 'hot_drinks' },
  { name: 'Американо «Петля времени»',               nameEn: 'Americano "Time Loop"',                  price: 4.00,  category: 'hot_drinks' },
  { name: 'Капучино «Утро, которое не спешит»',      nameEn: 'Cappuccino "The Unhurried Morning"',      price: 5.00,  category: 'hot_drinks' },
  { name: 'Латте «Линия горизонта времени»',         nameEn: 'Latte "Time Horizon"',                   price: 5.50,  category: 'hot_drinks' },
  { name: 'Раф «Тёплая непрерывность»',             nameEn: 'Raf Coffee "Warm Continuity"',            price: 6.00,  category: 'hot_drinks' },
  { name: 'Мокка «Сладкий парадокс времени»',       nameEn: 'Mocha "Sweet Time Paradox"',              price: 6.00,  category: 'hot_drinks' },
  { name: 'Флэт уайт «Тонкая секунда»',             nameEn: 'Flat White "A Thin Second"',              price: 5.50,  category: 'hot_drinks' },
  { name: 'Кофе «Секрет доктора Манхэттена»',       nameEn: 'Coffee "Dr. Manhattan\'s Secret"',        price: 7.00,  category: 'hot_drinks' },
  { name: 'Кофе «Обратный ход»',                    nameEn: 'Coffee "Reverse Flow"',                   price: 6.50,  category: 'hot_drinks' },
  { name: 'Какао «Ностальгия по вчера»',             nameEn: 'Hot Cocoa "Nostalgia for Yesterday"',     price: 5.50,  category: 'hot_drinks' },
  { name: 'Чай чёрный «Письма из будущего»',        nameEn: 'Black Tea "Letters from the Future"',     price: 4.00,  category: 'hot_drinks' },
  { name: 'Чай зелёный «Спокойствие хроноса»',      nameEn: 'Green Tea "Chronos Calm"',                price: 4.00,  category: 'hot_drinks' },
  { name: 'Чай с мятой «Замедленное дыхание времени»', nameEn: 'Mint Tea "Time\'s Slow Breath"',       price: 4.50,  category: 'hot_drinks' },

  // cold_drinks
  { name: 'Айс-латте «Лето вне времени»',           nameEn: 'Iced Latte "Timeless Summer"',            price: 6.00,  category: 'cold_drinks' },
  { name: 'Холодный кофе «13-й час»',               nameEn: 'Cold Coffee "The 13th Hour"',             price: 6.50,  category: 'cold_drinks' },
  { name: 'Лимонад «Солнечная пауза»',              nameEn: 'Lemonade "Sunny Pause"',                  price: 5.00,  category: 'cold_drinks' },
  { name: 'Лимонад «Разрыв временной линии»',       nameEn: 'Lemonade "Timeline Break"',               price: 5.50,  category: 'cold_drinks' },
  { name: 'Смузи «Эффект дежавю»',                  nameEn: 'Smoothie "Déjà Vu Effect"',               price: 7.00,  category: 'cold_drinks' },
  { name: 'Сок апельсиновый «Утро после полуночи»', nameEn: 'Orange Juice "Morning After Midnight"',   price: 4.50,  category: 'cold_drinks' },
  { name: 'Смузи ягодный «Хроника мгновения»',      nameEn: 'Berry Smoothie "Chronicle of a Moment"',  price: 7.50,  category: 'cold_drinks' },
  { name: 'Айс-чай «Тихий хронос»',                 nameEn: 'Iced Tea "Silent Chronos"',               price: 5.00,  category: 'cold_drinks' },
  { name: 'Вода «Нулевой момент»',                  nameEn: 'Water "Zero Moment"',                     price: 2.50,  category: 'cold_drinks' },

  // breakfast
  { name: 'Круассан «Париж, 07:00»',                nameEn: 'Croissant "Paris, 07:00"',                price: 4.50,  category: 'breakfast' },
  { name: 'Круассан «Утро Миядзаки»',               nameEn: 'Croissant "Miyazaki Morning"',            price: 5.00,  category: 'breakfast' },
  { name: 'Тост с авокадо «Первый кадр дня»',       nameEn: 'Avocado Toast "First Frame of the Day"',  price: 9.00,  category: 'breakfast' },
  { name: 'Омлет «До начала сюжета»',               nameEn: 'Omelette "Before the Plot Begins"',       price: 8.50,  category: 'breakfast' },
  { name: 'Сырники «Домашняя петля времени»',       nameEn: 'Cottage Cheese Pancakes "Home Time Loop"',price: 9.50,  category: 'breakfast' },
  { name: 'Овсянка «Медленный цикл»',               nameEn: 'Oatmeal "Slow Cycle"',                    price: 7.00,  category: 'breakfast' },
  { name: 'Йогурт «Лёгкая реальность»',             nameEn: 'Yogurt "Light Reality"',                  price: 6.00,  category: 'breakfast' },
  { name: 'Завтрак «Before Sunrise»',               nameEn: 'Breakfast "Before Sunrise"',              price: 12.00, category: 'breakfast' },

  // sandwiches
  { name: 'Сэндвич с курицей «Обеденный интервал»', nameEn: 'Chicken Sandwich "Lunch Interval"',       price: 10.00, category: 'sandwiches' },
  { name: 'Клаб-сэндвич «Город в ускорении»',       nameEn: 'Club Sandwich "City in Fast Forward"',    price: 12.00, category: 'sandwiches' },
  { name: 'Панини «Тепловой момент»',               nameEn: 'Panini "Heat of the Moment"',             price: 9.50,  category: 'sandwiches' },
  { name: 'Багет с ветчиной «Случайная остановка»', nameEn: 'Ham Baguette "Random Stop"',              price: 9.00,  category: 'sandwiches' },
  { name: 'Сэндвич с тунцом «Океан времени»',       nameEn: 'Tuna Sandwich "Ocean of Time"',           price: 11.00, category: 'sandwiches' },
  { name: 'Сэндвич «Потерянная минута»',            nameEn: 'Sandwich "Lost Minute"',                  price: 10.50, category: 'sandwiches' },
  { name: 'Ролл «Перемотка вперёд»',                nameEn: 'Roll "Fast Forward"',                     price: 11.50, category: 'sandwiches' },
  { name: 'Сэндвич «Бегущий по минутам»',           nameEn: 'Sandwich "Running on Minutes"',           price: 10.00, category: 'sandwiches' },

  // main
  { name: 'Паста карбонара «Римская полночь»',      nameEn: 'Carbonara Pasta "Roman Midnight"',        price: 15.00, category: 'main' },
  { name: 'Паста «Эффект бабочки»',                 nameEn: 'Pasta "Butterfly Effect"',                price: 14.50, category: 'main' },
  { name: 'Лазанья «Семейная хроника»',             nameEn: 'Lasagna "Family Chronicle"',              price: 16.00, category: 'main' },
  { name: 'Боул с курицей «Баланс событий»',        nameEn: 'Chicken Bowl "Balance of Events"',        price: 14.00, category: 'main' },
  { name: 'Боул с говядиной «Остановка времени»',   nameEn: 'Beef Bowl "Time Standstill"',             price: 16.50, category: 'main' },
  { name: 'Рис с овощами «Медленный мир»',          nameEn: 'Vegetable Rice "Slow World"',             price: 12.00, category: 'main' },
  { name: 'Курица с рисом «Дневной сценарий»',      nameEn: 'Chicken with Rice "Daytime Scenario"',    price: 13.50, category: 'main' },
  { name: 'Стейк «Последний дубль»',                nameEn: 'Steak "The Final Take"',                  price: 24.00, category: 'main' },
  { name: 'Том ям «Острая реальность»',             nameEn: 'Tom Yum "Spicy Reality"',                 price: 15.50, category: 'main' },
  { name: 'Суп куриный «Дом, где время мягкое»',    nameEn: 'Chicken Soup "Where Time Is Soft"',       price: 11.00, category: 'main' },
  { name: 'Паста «Интерстеллар»',                   nameEn: 'Pasta "Interstellar"',                    price: 15.00, category: 'main' },

  // salads
  { name: 'Цезарь «Классика вне времени»',          nameEn: 'Caesar "Timeless Classic"',               price: 12.00, category: 'salads' },
  { name: 'Салат с курицей «Стабильная линия»',     nameEn: 'Chicken Salad "Stable Timeline"',         price: 13.00, category: 'salads' },
  { name: 'Греческий салат «Средиземное настоящее»', nameEn: 'Greek Salad "Mediterranean Present"',    price: 11.00, category: 'salads' },
  { name: 'Салат с тунцом «Морская память»',        nameEn: 'Tuna Salad "Sea Memory"',                 price: 14.00, category: 'salads' },
  { name: 'Овощной салат «Чистый момент»',          nameEn: 'Vegetable Salad "Pure Moment"',           price: 9.50,  category: 'salads' },
  { name: 'Салат «Хроника свежести»',               nameEn: 'Salad "Chronicle of Freshness"',          price: 11.50, category: 'salads' },
  { name: 'Салат «Тихий день»',                     nameEn: 'Salad "Quiet Day"',                       price: 10.00, category: 'salads' },

  // desserts
  { name: 'Чизкейк «Последние 10 минут дня»',       nameEn: 'Cheesecake "Last 10 Minutes of the Day"', price: 7.50,  category: 'desserts' },
  { name: 'Тирамису «Итальянская ночь»',            nameEn: 'Tiramisu "Italian Night"',                price: 8.00,  category: 'desserts' },
  { name: 'Шоколадный фондан «21:31 — момент таяния»', nameEn: 'Chocolate Fondant "21:31 — Melting Moment"', price: 8.50, category: 'desserts' },
  { name: 'Брауни «Тёмная материя сладости»',       nameEn: 'Brownie "Dark Matter of Sweetness"',      price: 7.00,  category: 'desserts' },
  { name: 'Яблочный пирог «Воспоминание о доме»',   nameEn: 'Apple Pie "Memory of Home"',              price: 7.50,  category: 'desserts' },
  { name: 'Панна-котта «Белая тишина времени»',     nameEn: 'Panna Cotta "White Silence of Time"',     price: 8.00,  category: 'desserts' },
  { name: 'Эклер «Мгновение радости»',              nameEn: 'Éclair "Moment of Joy"',                  price: 6.50,  category: 'desserts' },
  { name: 'Медовик «Советская вечность»',           nameEn: 'Honey Cake "Soviet Eternity"',            price: 9.00,  category: 'desserts' },
  { name: 'Десерт «In Time»',                       nameEn: 'Dessert "In Time"',                       price: 9.50,  category: 'desserts' },

  // signature
  { name: 'Бургер «Вечер пятницы»',                 nameEn: 'Burger "Friday Evening"',                 price: 16.00, category: 'signature' },
  { name: 'Бургер «20:31 — момент выбора»',         nameEn: 'Burger "20:31 — Moment of Choice"',       price: 17.00, category: 'signature' },
  { name: 'Пицца «Ночная прогулка»',                nameEn: 'Pizza "Night Walk"',                      price: 16.50, category: 'signature' },
  { name: 'Пицца «Последний сеанс»',                nameEn: 'Pizza "The Last Showing"',                price: 17.50, category: 'signature' },
  { name: 'Хот-дог «Город без пауз»',               nameEn: 'Hot Dog "City Without Pause"',            price: 12.00, category: 'signature' },
  { name: 'Наггетсы «Быстрый эпизод»',              nameEn: 'Nuggets "Quick Episode"',                 price: 11.00, category: 'signature' },
  { name: 'Бургер «Доктор Кто»',                    nameEn: 'Burger "Doctor Who"',                     price: 18.00, category: 'signature' },
  { name: 'Бургер «Назад в будущее»',               nameEn: 'Burger "Back to the Future"',             price: 18.50, category: 'signature' },
];

const USERS = [
  {
    email: 'admin@tabletime.com',
    password: 'Admin1234!',
    role: Role.ADMIN,
  },
  {
    email: 'user1@tabletime.com',
    password: 'User1234!',
    role: Role.USER,
  },
  {
    email: 'user2@tabletime.com',
    password: 'User1234!',
    role: Role.USER,
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
  } else {
    console.log(`  ↩ Restaurant already exists: ${restaurant.name}`);
  }

  console.log('\n🪑 Seeding tables (replacing all existing)...');

  // Remove FK dependants before deleting tables
  const existingTables = await prisma.table.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true },
  });
  const tableIds = existingTables.map((t) => t.id);

  if (tableIds.length > 0) {
    await prisma.reservation.deleteMany({ where: { tableId: { in: tableIds } } });
    await prisma.order.updateMany({
      where: { tableId: { in: tableIds } },
      data: { tableId: null },
    });
    await prisma.table.deleteMany({ where: { restaurantId: restaurant.id } });
    console.log(`  ✖ Removed ${tableIds.length} old tables (and their reservations)`);
  }

  await prisma.table.createMany({
    data: TABLES.map((t) => ({
      restaurantId: restaurant.id,
      number: t.number,
      capacity: t.capacity,
      x: t.x,
      y: t.y,
      status: TableStatus.FREE,
    })),
  });
  console.log(`  ✔ Created ${TABLES.length} tables`);
}

async function seedDishes() {
  console.log('\n🍽️  Seeding dishes...');

  let created = 0;
  let skipped = 0;

  for (const dish of DISHES) {
    const existing = await prisma.dish.findUnique({ where: { name: dish.name } });

    await prisma.dish.upsert({
      where: { name: dish.name },
      update: { nameEn: dish.nameEn },
      create: {
        name: dish.name,
        nameEn: dish.nameEn,
        price: dish.price,
        category: dish.category,
        image: null,
        isAvailable: true,
      },
    });

    existing ? skipped++ : created++;
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
