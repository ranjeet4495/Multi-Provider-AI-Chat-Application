# AI-Powered MySQL Database Assistant

A simple full-stack application that converts natural language prompts (English) into standard MySQL queries, runs them against a database, and displays the structured query outputs using React, Node.js, and Express.

---

## Features
- **MCP-Style Workflow**: Logs the translation step, the tool execution step, and the client response presentation.
- **AI SQL Generation**: Utilizes the Google Gemini API (`@google/generative-ai`) to translate English text into precise MySQL statements.
- **Smart Fallback Engine**: If no API key is provided, the application runs a rule-based parser that handles standard SELECT, JOIN, INSERT, and UPDATE prompts out-of-the-box.
- **Premium Glassmorphic UI**: Featuring quick-query example chips, loading status indicators, and clean tabular database renders.

---

## Project Structure
```
AI_MySQL_MCP_Application 2/
├── backend/
│   ├── package.json
│   ├── server.js            # Express API server
│   ├── db.js                # Database connection pool helper
│   ├── ai.js                # AI SQL generation & Fallback NLP
│   ├── schema.sql           # Database schema & Seed data script
│   └── .env                 # Database & Gemini Credentials
└── frontend/
    ├── index.html
    ├── package.json
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx          # React Chat UI & Results Table
    │   └── index.css        # Premium styling
```

---

## Quick Start Setup

### Step 1: Database Setup
1. Ensure your local MySQL server is running.
2. Connect to your MySQL client (e.g. CLI, Workbench, or DBeaver) using your root credentials.
3. Create the database and import the seed tables by executing the script in [schema.sql](file:///d:/API%20Testing%20demo/AI_MySQL_MCP_Application%202/backend/schema.sql):
   ```sql
   -- Run this using your MySQL client or CLI:
   source backend/schema.sql;
   ```
   *This initializes the `ai_mcp_demo` database and seeds it with tables: `RegistrationDetails`, `UserNames`, `Customers`, and `Orders`.*

### Step 2: Configure Environment Variables
Open the [.env](file:///d:/API%20Testing%20demo/AI_MySQL_MCP_Application%202/backend/.env) file in the `backend/` directory:
```env
PORT=5001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=ai_mcp_demo
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```
*Note: If you leave `GEMINI_API_KEY` blank, the app will automatically use the built-in rule-based NLP parser.*

### Step 3: Run the Backend Server
In your terminal, navigate to the `backend/` directory and run:
```bash
cd backend
npm run dev
```
*The server will start on http://localhost:5001.*

### Step 4: Run the React Frontend
In a new terminal window, navigate to the `frontend/` directory and run:
```bash
cd frontend
npm run dev
```
*The React application will launch (usually on http://localhost:5173).*

---

## Test Prompts
Use these examples in the search input to see how it operates:
- `"Show all customers"`
- `"Show all orders for Alice Smith"`
- `"Show users above age 30"`
- `"Add new customer John Doe from New York"`
- `"Update customer Alice Smith city to Boston"`
