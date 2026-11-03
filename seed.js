const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI || "mongodb+srv://booknookUser:BookNook2026Pass@cluster0.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const initialBooks = [
  {
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800",
    copies: 5,
    description: "The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it, exploring compassion and justice.",
    userName: "Harper Lee Estate",
    userEmail: "curator@booknook.app",
    createdAt: new Date("2026-01-10T10:00:00Z")
  },
  {
    title: "Astrophysics for People in a Hurry",
    author: "Neil deGrasse Tyson",
    category: "Science",
    image: "https://images.unsplash.com/photo-1532012164546-f432f2e37b7b?auto=format&fit=crop&q=80&w=800",
    copies: 4,
    description: "A quick, witty, and deeply fascinating guide to the cosmos, black holes, quantum mechanics, and the search for extraterrestrial life.",
    userName: "Cosmos Reader",
    userEmail: "cosmos@booknook.app",
    createdAt: new Date("2026-01-12T11:30:00Z")
  },
  {
    title: "Sapiens: A Brief History of Humankind",
    author: "Yuval Noah Harari",
    category: "History",
    image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=800",
    copies: 6,
    description: "Explore how an insignificant ape became the ruler of planet Earth, bridging evolutionary biology and human cultural developments.",
    userName: "History Enthusiast",
    userEmail: "history@booknook.app",
    createdAt: new Date("2026-01-14T14:20:00Z")
  },
  {
    title: "The Little Prince",
    author: "Antoine de Saint-Exupéry",
    category: "Kids",
    image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=800",
    copies: 3,
    description: "A poetic tale of a young prince who visits various planets in space, addressing themes of loneliness, friendship, love, and loss.",
    userName: "Kids Wonderland",
    userEmail: "kids@booknook.app",
    createdAt: new Date("2026-01-16T09:15:00Z")
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    category: "Others",
    image: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=800",
    copies: 7,
    description: "An easy and proven way to build good habits and break bad ones, offering actionable frameworks for continuous personal improvement.",
    userName: "SelfGrowth Club",
    userEmail: "growth@booknook.app",
    createdAt: new Date("2026-01-18T16:00:00Z")
  },
  {
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800",
    copies: 4,
    description: "A portrait of the Jazz Age that tells the story of Jay Gatsby's pursuit of Daisy Buchanan amidst obsession, glamour, and tragedy.",
    userName: "Vintage Reads",
    userEmail: "vintage@booknook.app",
    createdAt: new Date("2026-01-20T12:00:00Z")
  },
  {
    title: "A Brief History of Time",
    author: "Stephen Hawking",
    category: "Science",
    image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800",
    copies: 2,
    description: "From the Big Bang to black holes, Stephen Hawking's masterpiece introduces non-specialist readers to fundamental physics questions.",
    userName: "Science Lab",
    userEmail: "lab@booknook.app",
    createdAt: new Date("2026-01-22T08:45:00Z")
  },
  {
    title: "Guns, Germs, and Steel",
    author: "Jared Diamond",
    category: "History",
    image: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=800",
    copies: 5,
    description: "An examination of how geography and natural environments shaped the modern world and the fates of distinct human societies.",
    userName: "Anthropology Digest",
    userEmail: "anthro@booknook.app",
    createdAt: new Date("2026-01-24T15:10:00Z")
  },
  {
    title: "Charlotte's Web",
    author: "E.B. White",
    category: "Kids",
    image: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=800",
    copies: 8,
    description: "The heartwarming story of a livestock pig named Wilbur and his friendship with a barn spider named Charlotte.",
    userName: "Storytime Magic",
    userEmail: "storytime@booknook.app",
    createdAt: new Date("2026-01-26T13:40:00Z")
  },
  {
    title: "Deep Work",
    author: "Cal Newport",
    category: "Others",
    image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800",
    copies: 3,
    description: "Rules for focused success in a distracted world, teaching how to master complicated information and produce results quickly.",
    userName: "Productivity Hub",
    userEmail: "focus@booknook.app",
    createdAt: new Date("2026-01-28T17:30:00Z")
  }
];

async function seed() {
  try {
    await client.connect();
    const db = client.db('booknookDB');
    const booksCollection = db.collection('books');

    const count = await booksCollection.countDocuments();
    console.log(`Current book count in database: ${count}`);

    if (count === 0) {
      console.log('Seeding initial curated books...');
      const result = await booksCollection.insertMany(initialBooks);
      console.log(`✅ Inserted ${result.insertedCount} books successfully!`);
    } else {
      console.log('Books already exist in the database. Adding any missing sample books...');
      for (const book of initialBooks) {
        const exists = await booksCollection.findOne({ title: book.title });
        if (!exists) {
          await booksCollection.insertOne(book);
          console.log(`+ Added: ${book.title}`);
        }
      }
      console.log('✅ Seeding check completed.');
    }
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await client.close();
  }
}

seed();
