import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import db from './db.js';
import { translatePromptToSQL } from './ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS and JSON parsing middleware
app.use(cors());
app.use(express.json());

// API Endpoint for querying the database
app.post('/api/query', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid text prompt.'
    });
  }

  console.log(`\n--- Incoming Prompt Request ---`);
  console.log(`Prompt: "${prompt}"`);

  try {
    /**
     * =========================================================================
     * MCP-STYLE WORKFLOW: STEP 1 - AI INTERPRETS THE PROMPT (AI INTENT TRANSLATION)
     * The system parses natural language, references database schemas, and decides 
     * on the specific tool or query formulation required.
     * =========================================================================
     */
    const sqlQuery = await translatePromptToSQL(prompt);
    console.log(`MCP Step 1 (AI Translation) -> Generated SQL:\n  ${sqlQuery}`);

    /**
     * =========================================================================
     * MCP-STYLE WORKFLOW: STEP 2 - TOOL/DATABASE OPERATION EXECUTED
     * Once the AI formats the tool arguments (in this case, the SQL statement), 
     * the system invokes the tool (in this case, running the query against MySQL).
     * =========================================================================
     */
    console.log(`MCP Step 2 (Tool Execution) -> Running query in MySQL...`);
    const [dbResult] = await db.query(sqlQuery);

    /**
     * =========================================================================
     * MCP-STYLE WORKFLOW: STEP 3 - RESPONSE RETURNED
     * The raw tool outputs are formatted into user-friendly responses and 
     * returned to the client application.
     * =========================================================================
     */
    console.log(`MCP Step 3 (Response Returned) -> Query succeeded. Returning results.`);

    // If query is an INSERT, UPDATE, or DELETE, structure the return message nicely
    let message = 'Query executed successfully.';
    let isSelect = true;

    if (dbResult && !Array.isArray(dbResult)) {
      isSelect = false;
      message = `Success. Affected rows: ${dbResult.affectedRows || 0}. Inserted ID: ${dbResult.insertId || 'N/A'}`;
    }

    return res.json({
      success: true,
      sql: sqlQuery,
      isSelect: isSelect,
      results: isSelect ? dbResult : [],
      message: message
    });

  } catch (error) {
    console.error(`MCP Error during workflow:`, error.message);
    
    // Provide user-friendly feedback even if the query fails
    return res.status(500).json({
      success: false,
      message: `Failed to execute query: ${error.message}`,
      sql: error.sql || 'Unknown query'
    });
  }
});

// Basic check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AI-MySQL Database Assistant API is running.' });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
