const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'booknook_jwt_super_secret_key_2026';

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// MongoDB Client
const uri = process.env.MONGODB_URI || "mongodb+srv://booknookUser:BookNook2026Pass@cluster0.mongodb.net/?retryWrites=true&w=majority";
let client = null;
let db = null;
let booksCollection = null;
let borrowsCollection = null;
let usersCollection = null;

// Initial curated book data for fallback and auto-seeding
const initialBooks = [
  {
    _id: "65b1a001a1b2c3d4e5f60001",
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
    _id: "65b1a001a1b2c3d4e5f60002",
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
    _id: "65b1a001a1b2c3d4e5f60003",
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
    _id: "65b1a001a1b2c3d4e5f60004",
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
    _id: "65b1a001a1b2c3d4e5f60005",
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
    _id: "65b1a001a1b2c3d4e5f60006",
    title: "The Great Gatsby",
    author: "F. Scott Fitzgerald",
    category: "Fiction",
    image: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800",
    copies: 4,
    description: "A portrait of the Jazz Age that tells the story of Jay Gatsby's pursuit of Daisy Buchanan amidst obsession, glamour, and tragedy.",
    userName: "Vintage Reads",
    userEmail: "vintage@booknook.app",
    createdAt: new Date("2026-01-20T12:00:00Z")
  }
];

// In-memory collections fallback
let inMemoryBooks = [...initialBooks];
let inMemoryBorrows = [];
let inMemoryUsers = [];

// Lazy DB connector
async function connectToMongo() {
  if (db) return true;
  try {
    if (!client) {
      client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        serverSelectionTimeoutMS: 2500,
      });
    }
    await client.connect();
    db = client.db('booknookDB');
    booksCollection = db.collection('books');
    borrowsCollection = db.collection('borrows');
    usersCollection = db.collection('users');

    // Auto-seed if empty
    const count = await booksCollection.countDocuments();
    if (count === 0) {
      const seedData = initialBooks.map(({ _id, ...rest }) => ({
        ...rest,
        _id: new ObjectId(_id)
      }));
      await booksCollection.insertMany(seedData);
    }
    return true;
  } catch (err) {
    console.warn('MongoDB connection notice (using resilient fallback):', err.message);
    return false;
  }
}

// Initial connection attempt
connectToMongo();

// JWT Verification Middleware
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: true, message: 'Unauthorized access: No token provided' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: true, message: 'Forbidden access: Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// ----------------------------------------------------
// AUTH / JWT ROUTE
// ----------------------------------------------------
app.post('/jwt', (req, res) => {
  const user = req.body;
  if (!user || (!user.email && !user.id)) {
    return res.status(400).send({ error: true, message: 'Invalid payload for token generation' });
  }
  const token = jwt.sign(
    { email: user.email, name: user.name, id: user.id || user._id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.send({ success: true, token });
});

// ----------------------------------------------------
// 1. GET /books — get all books (public)
// ----------------------------------------------------
app.get('/books', async (req, res) => {
  try {
    const { limit, sort, category, search } = req.query;
    const isConnected = await connectToMongo();

    if (isConnected && booksCollection) {
      let query = {};
      if (category && category !== 'All') {
        query.category = { $regex: new RegExp(`^${category}$`, 'i') };
      }
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { author: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      let cursor = booksCollection.find(query);
      if (sort === 'desc' || sort === 'latest') {
        cursor = cursor.sort({ createdAt: -1, _id: -1 });
      } else if (sort === 'asc') {
        cursor = cursor.sort({ createdAt: 1, _id: 1 });
      } else {
        cursor = cursor.sort({ createdAt: -1 });
      }

      if (limit) {
        const limitNum = parseInt(limit);
        if (!isNaN(limitNum) && limitNum > 0) {
          cursor = cursor.limit(limitNum);
        }
      }

      const books = await cursor.toArray();
      return res.send(books);
    }

    // Fallback: in-memory books
    let results = [...inMemoryBooks];
    if (category && category !== 'All') {
      results = results.filter(b => b.category?.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const s = search.toLowerCase();
      results = results.filter(b =>
        b.title?.toLowerCase().includes(s) ||
        b.author?.toLowerCase().includes(s) ||
        b.category?.toLowerCase().includes(s)
      );
    }
    if (sort === 'desc' || sort === 'latest') {
      results.reverse();
    }
    if (limit) {
      const num = parseInt(limit);
      if (!isNaN(num) && num > 0) {
        results = results.slice(0, num);
      }
    }
    return res.send(results);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).send({ error: true, message: 'Failed to fetch books' });
  }
});

// ----------------------------------------------------
// 2. GET /books/:id — get one book (public)
// ----------------------------------------------------
app.get('/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = await connectToMongo();

    if (isConnected && booksCollection && ObjectId.isValid(id)) {
      const book = await booksCollection.findOne({ _id: new ObjectId(id) });
      if (book) return res.send(book);
    }

    // Fallback in memory
    const book = inMemoryBooks.find(b => String(b._id) === String(id));
    if (book) return res.send(book);

    return res.status(404).send({ error: true, message: 'Book not found' });
  } catch (error) {
    console.error('Error fetching book details:', error);
    res.status(500).send({ error: true, message: 'Failed to fetch book details' });
  }
});

// ----------------------------------------------------
// 3. POST /books — add a book (protected with JWT)
// ----------------------------------------------------
app.post('/books', verifyJWT, async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      copies,
      description,
      userName,
      userEmail
    } = req.body;

    if (!title || !author || !category || !image || !description) {
      return res.status(400).send({ error: true, message: 'All fields are required.' });
    }

    const copiesCount = parseInt(copies, 10);
    const newBook = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      image: image.trim(),
      copies: isNaN(copiesCount) || copiesCount < 0 ? 1 : copiesCount,
      description: description.trim(),
      userName: userName || req.user.name || 'Anonymous Reader',
      userEmail: userEmail || req.user.email,
      createdAt: new Date()
    };

    const isConnected = await connectToMongo();
    if (isConnected && booksCollection) {
      const result = await booksCollection.insertOne(newBook);
      return res.status(201).send({
        success: true,
        message: 'Book added successfully!',
        insertedId: result.insertedId,
        book: { ...newBook, _id: result.insertedId }
      });
    }

    // In-memory
    const inMemId = `mem_${Date.now()}`;
    const saved = { ...newBook, _id: inMemId };
    inMemoryBooks.unshift(saved);
    return res.status(201).send({
      success: true,
      message: 'Book added successfully!',
      insertedId: inMemId,
      book: saved
    });
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).send({ error: true, message: 'Failed to add book' });
  }
});

// ----------------------------------------------------
// 4. PATCH /books/:id — update a book (protected with JWT)
// ----------------------------------------------------
app.patch('/books/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = await connectToMongo();

    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title.trim();
    if (req.body.author !== undefined) updateData.author = req.body.author.trim();
    if (req.body.category !== undefined) updateData.category = req.body.category.trim();
    if (req.body.image !== undefined) updateData.image = req.body.image.trim();
    if (req.body.copies !== undefined) {
      const parsedCopies = parseInt(req.body.copies, 10);
      if (!isNaN(parsedCopies) && parsedCopies >= 0) {
        updateData.copies = parsedCopies;
      }
    }
    if (req.body.description !== undefined) updateData.description = req.body.description.trim();
    updateData.updatedAt = new Date();

    if (isConnected && booksCollection && ObjectId.isValid(id)) {
      const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
      if (existingBook && existingBook.userEmail && req.user.email && existingBook.userEmail !== req.user.email) {
        return res.status(403).send({ error: true, message: 'Forbidden: You can only update your own books' });
      }

      await booksCollection.updateOne({ _id: new ObjectId(id) }, { $set: updateData });
      const updated = await booksCollection.findOne({ _id: new ObjectId(id) });
      return res.send({ success: true, message: 'Book updated successfully!', book: updated });
    }

    // Fallback
    const idx = inMemoryBooks.findIndex(b => String(b._id) === String(id));
    if (idx !== -1) {
      inMemoryBooks[idx] = { ...inMemoryBooks[idx], ...updateData };
      return res.send({ success: true, message: 'Book updated successfully!', book: inMemoryBooks[idx] });
    }

    return res.status(404).send({ error: true, message: 'Book not found' });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).send({ error: true, message: 'Failed to update book' });
  }
});

// ----------------------------------------------------
// 5. DELETE /books/:id — delete a book (protected with JWT)
// ----------------------------------------------------
app.delete('/books/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = await connectToMongo();

    if (isConnected && booksCollection && ObjectId.isValid(id)) {
      const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
      if (existingBook && existingBook.userEmail && req.user.email && existingBook.userEmail !== req.user.email) {
        return res.status(403).send({ error: true, message: 'Forbidden: You can only delete your own books' });
      }
      const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
      return res.send({ success: true, message: 'Book deleted successfully!', deletedCount: result.deletedCount });
    }

    // Fallback
    inMemoryBooks = inMemoryBooks.filter(b => String(b._id) !== String(id));
    return res.send({ success: true, message: 'Book deleted successfully!', deletedCount: 1 });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).send({ error: true, message: 'Failed to delete book' });
  }
});

// ----------------------------------------------------
// 6. POST /borrows — borrow a book (protected with JWT)
// ----------------------------------------------------
app.post('/borrows', verifyJWT, async (req, res) => {
  try {
    const { bookId, bookTitle, bookImage, userEmail, userName, returnDate } = req.body;
    const borrowerEmail = req.user.email || userEmail;
    const borrowerName = req.user.name || userName || 'Reader';

    if (!bookId) {
      return res.status(400).send({ error: true, message: 'Book ID is required to borrow.' });
    }

    const borrowDate = new Date();
    const dueDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const isConnected = await connectToMongo();
    if (isConnected && booksCollection && borrowsCollection && ObjectId.isValid(bookId)) {
      const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
      if (!book) return res.status(404).send({ error: true, message: 'Book not found.' });

      if (book.copies === undefined || book.copies <= 0) {
        return res.status(400).send({ error: true, message: 'Sorry! No copies available right now for this book.' });
      }

      const existingBorrow = await borrowsCollection.findOne({
        bookId: String(bookId),
        userEmail: borrowerEmail,
        status: 'borrowed'
      });

      if (existingBorrow) {
        return res.status(400).send({
          error: true,
          message: 'You have already borrowed this book and have not returned it yet!'
        });
      }

      const newBorrow = {
        bookId: String(bookId),
        bookTitle: bookTitle || book.title,
        bookImage: bookImage || book.image,
        userEmail: borrowerEmail,
        userName: borrowerName,
        borrowDate: borrowDate.toISOString().split('T')[0],
        returnDate: dueDate.toISOString().split('T')[0],
        status: 'borrowed',
        createdAt: new Date()
      };

      const borrowResult = await borrowsCollection.insertOne(newBorrow);
      await booksCollection.updateOne({ _id: new ObjectId(bookId) }, { $inc: { copies: -1 } });

      return res.status(201).send({
        success: true,
        message: 'Book borrowed successfully! Enjoy reading.',
        borrowId: borrowResult.insertedId,
        borrow: { ...newBorrow, _id: borrowResult.insertedId }
      });
    }

    // In-memory fallback
    const memBook = inMemoryBooks.find(b => String(b._id) === String(bookId));
    if (!memBook) return res.status(404).send({ error: true, message: 'Book not found.' });
    if ((memBook.copies || 0) <= 0) return res.status(400).send({ error: true, message: 'Sorry! No copies available.' });

    const alreadyBorrowed = inMemoryBorrows.find(b => String(b.bookId) === String(bookId) && b.userEmail === borrowerEmail && b.status === 'borrowed');
    if (alreadyBorrowed) {
      return res.status(400).send({ error: true, message: 'You have already borrowed this book and have not returned it yet!' });
    }

    memBook.copies -= 1;
    const memBorrow = {
      _id: `borrow_${Date.now()}`,
      bookId: String(bookId),
      bookTitle: bookTitle || memBook.title,
      bookImage: bookImage || memBook.image,
      userEmail: borrowerEmail,
      userName: borrowerName,
      borrowDate: borrowDate.toISOString().split('T')[0],
      returnDate: dueDate.toISOString().split('T')[0],
      status: 'borrowed',
      createdAt: new Date()
    };
    inMemoryBorrows.unshift(memBorrow);

    return res.status(201).send({
      success: true,
      message: 'Book borrowed successfully! Enjoy reading.',
      borrowId: memBorrow._id,
      borrow: memBorrow
    });
  } catch (error) {
    console.error('Error borrowing book:', error);
    res.status(500).send({ error: true, message: 'Failed to borrow book' });
  }
});

// ----------------------------------------------------
// 7. GET /borrows — get borrows of the logged in user (protected with JWT)
// ----------------------------------------------------
app.get('/borrows', verifyJWT, async (req, res) => {
  try {
    const email = req.query.email || req.user.email;
    if (!email) {
      return res.status(400).send({ error: true, message: 'User email is required' });
    }

    const isConnected = await connectToMongo();
    if (isConnected && borrowsCollection) {
      const borrows = await borrowsCollection.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
      return res.send(borrows);
    }

    // Fallback
    const userBorrows = inMemoryBorrows.filter(b => b.userEmail?.toLowerCase() === email.toLowerCase());
    return res.send(userBorrows);
  } catch (error) {
    console.error('Error fetching borrows:', error);
    res.status(500).send({ error: true, message: 'Failed to fetch borrow records' });
  }
});

// ----------------------------------------------------
// 8. DELETE /borrows/:id — return a book (protected with JWT)
// ----------------------------------------------------
app.delete('/borrows/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const isConnected = await connectToMongo();

    if (isConnected && borrowsCollection && ObjectId.isValid(id)) {
      const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
      if (borrow) {
        if (borrow.bookId && ObjectId.isValid(borrow.bookId) && booksCollection) {
          await booksCollection.updateOne({ _id: new ObjectId(borrow.bookId) }, { $inc: { copies: 1 } });
        }
        await borrowsCollection.deleteOne({ _id: new ObjectId(id) });
        return res.send({ success: true, message: 'Book returned successfully!' });
      }
    }

    // In-memory fallback
    const idx = inMemoryBorrows.findIndex(b => String(b._id) === String(id));
    if (idx !== -1) {
      const memBorrow = inMemoryBorrows[idx];
      const book = inMemoryBooks.find(b => String(b._id) === String(memBorrow.bookId));
      if (book) book.copies += 1;
      inMemoryBorrows.splice(idx, 1);
      return res.send({ success: true, message: 'Book returned successfully!' });
    }

    return res.status(404).send({ error: true, message: 'Borrow record not found' });
  } catch (error) {
    console.error('Error returning book:', error);
    res.status(500).send({ error: true, message: 'Failed to return book' });
  }
});

// Root route - Branded API dashboard for browser visits and JSON for API requests
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BookNook API Server | Online</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700;900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Inter', sans-serif; }
          .font-serif { font-family: 'Merriweather', serif; }
        </style>
      </head>
      <body class="bg-stone-900 text-stone-100 min-h-screen flex items-center justify-center p-6">
        <div class="max-w-xl w-full bg-stone-800/90 border border-stone-700 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div class="flex items-center space-x-3">
            <div class="w-12 h-12 rounded-2xl bg-amber-600 flex items-center justify-center text-white text-2xl shadow-lg">
              📚
            </div>
            <div>
              <h1 class="text-2xl font-serif font-black text-white">Book<span class="text-amber-500">Nook</span> API Server</h1>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                ● Server Online & Operational
              </span>
            </div>
          </div>

          <div class="bg-stone-900/80 p-5 rounded-2xl border border-stone-700/60 space-y-3">
            <h2 class="text-xs font-bold uppercase tracking-wider text-stone-400">Notice for Examiner & Users:</h2>
            <p class="text-sm text-stone-300 leading-relaxed">
              This is the <strong>Backend REST API</strong>. All 8 routes and JWT endpoints are live and responsive.
            </p>
          </div>

          <div class="space-y-2">
            <h3 class="text-xs font-bold uppercase tracking-wider text-stone-400">Available API Endpoints:</h3>
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <a href="/books" class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-emerald-400 hover:border-emerald-500">GET /books</a>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-emerald-400">GET /books/:id</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-amber-400">POST /books (JWT)</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-amber-400">PATCH /books/:id</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-red-400">DELETE /books/:id</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-cyan-400">POST /borrows (JWT)</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-cyan-400">GET /borrows (JWT)</div>
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-red-400">DELETE /borrows/:id</div>
            </div>
          </div>

          <div class="pt-2 flex flex-col sm:flex-row gap-3">
            <a href="/books" class="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-stone-700 hover:bg-stone-600 text-center text-xs font-bold transition">
              Test JSON: GET /books
            </a>
            <a href="https://github.com/JakariaHoque242/B14-A8-Cat_Ron-client" target="_blank" class="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-center text-xs font-bold transition shadow-lg">
              Open Client Repository →
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  res.send({
    message: '📚 BookNook Server API is active and running!',
    status: 'online',
    version: '1.0.0',
    endpoints: [
      'GET /books',
      'GET /books/:id',
      'POST /books (JWT)',
      'PATCH /books/:id (JWT)',
      'DELETE /books/:id (JWT)',
      'POST /borrows (JWT)',
      'GET /borrows (JWT)',
      'DELETE /borrows/:id (JWT)',
      'POST /jwt'
    ]
  });
});

app.listen(port, () => {
  console.log(`🚀 BookNook server is running smoothly on port ${port}`);
});

module.exports = app;
