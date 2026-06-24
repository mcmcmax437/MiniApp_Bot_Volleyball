import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed a demo host user so the API has at least one user record to attribute games to.
  const demoHost = await prisma.user.upsert({
    where: { telegramId: BigInt(0) },
    update: {},
    create: {
      telegramId: BigInt(0),
      firstName: 'Demo',
      lastName: 'Host',
      username: 'demo_host',
      age: 25,
      skillLevel: 'INTERMEDIATE',
      city: 'Kyiv',
      lat: 50.4501,
      lng: 30.5234,
      reminderOffsets: [1440, 120, 30],
    },
  });

  const venues = [
    {
      name: 'Beach Volleyball Arena Olimpiyskiy',
      address: 'Velyka Vasylkivska 55, Kyiv',
      lat: 50.4359,
      lng: 30.5207,
      indoor: false,
      surface: 'Sand',
      hourlyPrice: 80000,
      capacity: 12,
    },
    {
      name: 'Sport Club Volleyball Hall',
      address: 'Holosiivskyi Ave 100, Kyiv',
      lat: 50.3980,
      lng: 30.5050,
      indoor: true,
      surface: 'Parquet',
      hourlyPrice: 60000,
      capacity: 10,
    },
    {
      name: 'Riverbank Sand Courts',
      address: 'Obolonska Naberezhna 20, Kyiv',
      lat: 50.5080,
      lng: 30.4980,
      indoor: false,
      surface: 'Sand',
      hourlyPrice: 50000,
      capacity: 8,
    },
    {
      name: 'Left Bank Indoor Arena',
      address: 'Mykoly Bazhana 14, Kyiv',
      lat: 50.4100,
      lng: 30.6300,
      indoor: true,
      surface: 'Sport PVC',
      hourlyPrice: 70000,
      capacity: 12,
    },
    {
      name: 'Trukhaniv Island Beach',
      address: 'Trukhaniv Island, Kyiv',
      lat: 50.4660,
      lng: 30.5400,
      indoor: false,
      surface: 'Sand',
      hourlyPrice: 40000,
      capacity: 10,
    },
  ];

  for (const v of venues) {
    await prisma.venue.upsert({
      where: { id: `seed-${v.name.replace(/\s+/g, '-').toLowerCase()}` },
      update: {},
      create: {
        id: `seed-${v.name.replace(/\s+/g, '-').toLowerCase()}`,
        ...v,
        city: 'Kyiv',
        submittedById: demoHost.id,
      },
    });
  }

  console.log(`Seeded ${venues.length} venues and 1 demo host.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
