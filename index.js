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
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.CLIENT_URL || '*'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// MongoDB Connection URI
const uri = process.env.MONGODB_URI || "mongodb+srv://booknookUser:BookNook2026Pass@cluster0.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let booksCollection;
let borrowsCollection;

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

async function run() {
  try {
    // Connect client
    await client.connect();
    db = client.db('booknookDB');
    booksCollection = db.collection('books');
    borrowsCollection = db.collection('borrows');

    console.log('✅ Successfully connected to MongoDB for BookNook Server!');

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
    // Supports: ?sort=desc&limit=6 for New Arrivals, ?category=Fiction, ?search=query
    // ----------------------------------------------------
    app.get('/books', async (req, res) => {
      try {
        const { limit, sort, category, search } = req.query;
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
        res.send(books);
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
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: true, message: 'Invalid Book ID format' });
        }
        const book = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!book) {
          return res.status(404).send({ error: true, message: 'Book not found' });
        }
        res.send(book);
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
        if (isNaN(copiesCount) || copiesCount < 0) {
          return res.status(400).send({ error: true, message: 'Total copies must be a non-negative number.' });
        }

        const newBook = {
          title: title.trim(),
          author: author.trim(),
          category: category.trim(),
          image: image.trim(),
          copies: copiesCount,
          description: description.trim(),
          userName: userName || req.user.name || 'Anonymous Reader',
          userEmail: userEmail || req.user.email,
          createdAt: new Date()
        };

        const result = await booksCollection.insertOne(newBook);
        res.status(201).send({
          success: true,
          message: 'Book added successfully!',
          insertedId: result.insertedId,
          book: { ...newBook, _id: result.insertedId }
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
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: true, message: 'Invalid Book ID format' });
        }

        // Verify book existence and ownership
        const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!existingBook) {
          return res.status(404).send({ error: true, message: 'Book not found' });
        }

        // Optional ownership check (allow owner or admin)
        if (existingBook.userEmail && req.user.email && existingBook.userEmail !== req.user.email) {
          return res.status(403).send({ error: true, message: 'Forbidden: You can only update your own books' });
        }

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

        const result = await booksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ error: true, message: 'Book not found' });
        }

        const updatedBook = await booksCollection.findOne({ _id: new ObjectId(id) });
        res.send({
          success: true,
          message: 'Book updated successfully!',
          modifiedCount: result.modifiedCount,
          book: updatedBook
        });
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
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: true, message: 'Invalid Book ID format' });
        }

        const existingBook = await booksCollection.findOne({ _id: new ObjectId(id) });
        if (!existingBook) {
          return res.status(404).send({ error: true, message: 'Book not found' });
        }

        // Ownership check
        if (existingBook.userEmail && req.user.email && existingBook.userEmail !== req.user.email) {
          return res.status(403).send({ error: true, message: 'Forbidden: You can only delete your own books' });
        }

        const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
        res.send({
          success: true,
          message: 'Book deleted successfully!',
          deletedCount: result.deletedCount
        });
      } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).send({ error: true, message: 'Failed to delete book' });
      }
    });

    // ----------------------------------------------------
    // 6. POST /borrows — borrow a book (protected with JWT)
    // Challenge 1: Total copies check and $inc: { copies: -1 }
    // Challenge 2: No double borrow (same user cannot borrow same book twice active)
    // ----------------------------------------------------
    app.post('/borrows', verifyJWT, async (req, res) => {
      try {
        const { bookId, bookTitle, bookImage, userEmail, userName, returnDate } = req.body;
        const borrowerEmail = req.user.email || userEmail;
        const borrowerName = req.user.name || userName || 'Reader';

        if (!bookId) {
          return res.status(400).send({ error: true, message: 'Book ID is required to borrow.' });
        }

        if (!ObjectId.isValid(bookId)) {
          return res.status(400).send({ error: true, message: 'Invalid Book ID format.' });
        }

        // 1. Check if the book exists
        const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
        if (!book) {
          return res.status(404).send({ error: true, message: 'Book not found.' });
        }

        // 2. Challenge: Check Available Copies
        if (book.copies === undefined || book.copies <= 0) {
          return res.status(400).send({
            error: true,
            message: 'Sorry! No copies available right now for this book.'
          });
        }

        // 3. Challenge: No Double Borrow
        const existingBorrow = await borrowsCollection.findOne({
          bookId: bookId,
          userEmail: borrowerEmail,
          status: 'borrowed'
        });

        if (existingBorrow) {
          return res.status(400).send({
            error: true,
            message: 'You have already borrowed this book and have not returned it yet!'
          });
        }

        // Calculate borrowDate and returnDate (default 7 days if omitted)
        const borrowDate = new Date();
        const dueDate = returnDate ? new Date(returnDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const newBorrow = {
          bookId: bookId,
          bookTitle: bookTitle || book.title,
          bookImage: bookImage || book.image,
          userEmail: borrowerEmail,
          userName: borrowerName,
          borrowDate: borrowDate.toISOString().split('T')[0],
          returnDate: dueDate.toISOString().split('T')[0],
          status: 'borrowed',
          createdAt: new Date()
        };

        // Insert borrow record
        const borrowResult = await borrowsCollection.insertOne(newBorrow);

        // Challenge: Decrease copies by 1 with $inc
        await booksCollection.updateOne(
          { _id: new ObjectId(bookId) },
          { $inc: { copies: -1 } }
        );

        res.status(201).send({
          success: true,
          message: 'Book borrowed successfully! Enjoy reading.',
          borrowId: borrowResult.insertedId,
          borrow: { ...newBorrow, _id: borrowResult.insertedId }
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

        // Ensure user can only request their own borrows
        if (req.user.email && req.user.email !== email) {
          return res.status(403).send({ error: true, message: 'Forbidden: Cannot access other users borrows' });
        }

        const query = { userEmail: email };
        const borrows = await borrowsCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(borrows);
      } catch (error) {
        console.error('Error fetching borrows:', error);
        res.status(500).send({ error: true, message: 'Failed to fetch borrow records' });
      }
    });

    // ----------------------------------------------------
    // 8. DELETE /borrows/:id — return a book (protected with JWT)
    // Challenge: When the user returns it, increase it by 1 with $inc
    // ----------------------------------------------------
    app.delete('/borrows/:id', verifyJWT, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ error: true, message: 'Invalid Borrow ID format' });
        }

        const borrow = await borrowsCollection.findOne({ _id: new ObjectId(id) });
        if (!borrow) {
          return res.status(404).send({ error: true, message: 'Borrow record not found' });
        }

        // Verify that the user returning the book is the one who borrowed it
        if (borrow.userEmail && req.user.email && borrow.userEmail !== req.user.email) {
          return res.status(403).send({ error: true, message: 'Forbidden: You cannot return another users borrow' });
        }

        // Increase copies on the corresponding book with $inc
        if (borrow.bookId && ObjectId.isValid(borrow.bookId)) {
          await booksCollection.updateOne(
            { _id: new ObjectId(borrow.bookId) },
            { $inc: { copies: 1 } }
          );
        }

        // Delete the borrow record
        const result = await borrowsCollection.deleteOne({ _id: new ObjectId(id) });

        res.send({
          success: true,
          message: 'Book returned successfully! Thank you.',
          deletedCount: result.deletedCount
        });
      } catch (error) {
        console.error('Error returning book:', error);
        res.status(500).send({ error: true, message: 'Failed to return book' });
      }
    });

  } catch (err) {
    console.error('⚠️ MongoDB connection error:', err.message);
  }
}

run().catch(console.dir);

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
              This is the <strong>Backend REST API</strong>. To experience the full interactive library with book catalog, login, borrow system, and themes, visit the <strong>Frontend Client Application</strong>.
            </p>
          </div>

          <div class="space-y-2">
            <h3 class="text-xs font-bold uppercase tracking-wider text-stone-400">Available API Endpoints:</h3>
            <div class="grid grid-cols-2 gap-2 text-xs font-mono">
              <div class="p-2 rounded-xl bg-stone-900 border border-stone-800 text-emerald-400">GET /books</div>
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
