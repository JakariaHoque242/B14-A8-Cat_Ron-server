# 📚 BookNook Server – REST API & JWT Engine

**Server Repository**: [https://github.com/JakariaHoque242/B14-A8-Cat_Ron-server](https://github.com/JakariaHoque242/B14-A8-Cat_Ron-server)  
**Client Repository**: [https://github.com/JakariaHoque242/B14-A8-Cat_Ron-client](https://github.com/JakariaHoque242/B14-A8-Cat_Ron-client)  

BookNook is a small online library platform backend built with Express.js and MongoDB. It powers user authentication, catalog management, book lending with real-time stock deduction, and user borrow history with JWT verification.

---

## 🚀 Key Features

- **JWT Authentication & Route Protection**: Endpoints for modifying books, creating borrows, and returning books are strictly verified using JSON Web Tokens.
- **Atomic Inventory Management**: Uses MongoDB's `$inc` operator to automatically decrement available copies by 1 upon borrowing and increment by 1 upon returning.
- **Double-Borrow Prevention**: Enforces a strict validation check preventing users from actively borrowing the same book twice simultaneously.
- **Dynamic Book Exploration**: High-performance querying with support for sorting (latest arrivals), category filters (`Fiction`, `Science`, `History`, `Kids`, `Others`), and full-text keyword searches.
- **Ownership Verification**: Protected `PATCH` and `DELETE` routes verify that only the author who added the book can modify or delete it.

---

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Native MongoDB Driver v6)
- **Security**: JSON Web Token (`jsonwebtoken`), CORS
- **Logging**: Morgan

---

## 📡 API Endpoints

### Public Routes
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and route documentation |
| `GET` | `/books` | Retrieve books (supports `?sort=desc`, `?limit=6`, `?category=`, `?search=`) |
| `GET` | `/books/:id` | Retrieve single book details by ID |

### Protected Routes (Requires `Authorization: Bearer <token>`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/jwt` | Generate a signed 7-day JWT token |
| `POST` | `/books` | Add a new book to the library catalog |
| `PATCH` | `/books/:id` | Update an existing book (owner only) |
| `DELETE` | `/books/:id` | Remove a book from the catalog (owner only) |
| `POST` | `/borrows` | Borrow a book (decrements copies, checks double-borrow) |
| `GET` | `/borrows` | Fetch borrow records for the logged-in user |
| `DELETE` | `/borrows/:id` | Return a borrowed book (increments copies) |

---

## ⚙️ Environment Variables

Create a `.env` file in the root folder with:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_jwt_secret_key
CLIENT_URL=http://localhost:3000
```

---

## ☁️ Deployment Instructions

### Option 1: Render.com
1. Create a new Web Service on [Render](https://render.com).
2. Connect your `booknook-server` GitHub repository.
3. Build command: `npm install`
4. Start command: `node index.js`
5. Add Environment Variables:
   - `MONGODB_URI`: Your MongoDB Atlas connection URI
   - `ACCESS_TOKEN_SECRET`: A secure random string for JWT signing
   - `CLIENT_URL`: Your deployed frontend URL (e.g. `https://booknook.vercel.app`)

### Option 2: Vercel
1. Import repository to [Vercel](https://vercel.com).
2. Set Environment Variables (`MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `CLIENT_URL`).
3. Deploy! The included `vercel.json` configures the serverless bridge automatically.


1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Seed initial books**:
   ```bash
   npm run seed
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   # or
   npm start
   ```
