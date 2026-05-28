import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the Google Gen AI client if API key is present
let aiClient = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('Gemini AI Client initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Gemini AI Client:', error.message);
  }
} else {
  console.log('No GEMINI_API_KEY found in .env. Running in rule-based Local NLP Parser mode.');
}

// Database Schema context for the AI
const SCHEMA_PROMPT = `
You are a translation assistant that converts natural language user prompts into clean, standard MySQL queries.
Database Name: ai_mcp_demo

We have the following tables:
1. UserNames (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) UNIQUE)
2. RegistrationDetails (id INT AUTO_INCREMENT PRIMARY KEY, username_id INT, age INT, email VARCHAR(255) UNIQUE, registration_date DATE, FOREIGN KEY (username_id) REFERENCES UserNames(id))
3. Customers (CustomerID INT AUTO_INCREMENT PRIMARY KEY, CustomerName VARCHAR(255), ContactName VARCHAR(255), City VARCHAR(100), Country VARCHAR(100))
4. Orders (OrderID INT AUTO_INCREMENT PRIMARY KEY, CustomerID INT, OrderDate DATE, Amount DECIMAL(10,2), FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID))

Requirements:
- Translate the user prompt into exactly ONE standard MySQL query.
- Output ONLY the raw SQL query text.
- Do NOT wrap the query in markdown code blocks like \`\`\`sql ... \`\`\`.
- Do NOT include any explanations, introduction, or notes.
- Only write SELECT, INSERT, UPDATE, DELETE, or JOIN queries.
- Examples:
  Prompt: "Show all customers" -> SELECT * FROM Customers;
  Prompt: "Show all orders for Alice Smith" -> SELECT Orders.*, Customers.CustomerName FROM Orders JOIN Customers ON Orders.CustomerID = Customers.CustomerID WHERE Customers.CustomerName = 'Alice Smith';
  Prompt: "Show users above age 30" -> SELECT UserNames.username, RegistrationDetails.age, RegistrationDetails.email FROM RegistrationDetails JOIN UserNames ON RegistrationDetails.username_id = UserNames.id WHERE RegistrationDetails.age > 30;
  Prompt: "Add a new customer named John Doe from New York" -> INSERT INTO Customers (CustomerName, ContactName, City, Country) VALUES ('John Doe', 'John Doe', 'New York', 'USA');
`;

/**
 * Robust rule-based local parser to fall back on when no API key is provided.
 * Supports basic SELECT, JOIN, filtering, INSERT, and UPDATE queries.
 */
function localRuleParser(prompt) {
  const cleanPrompt = prompt.trim().toLowerCase();

  // 1. "Show all customers from [City]" or "Show customers in [City]"
  const customersFromCityMatch = cleanPrompt.match(/(?:show|get|list|display) (?:all )?customers (?:from|in|living in) ([a-zA-Z\s]+)/i);
  if (customersFromCityMatch) {
    const city = customersFromCityMatch[1].trim();
    // Capitalize first letter of each word
    const formattedCity = city.replace(/\b\w/g, c => c.toUpperCase());
    return `SELECT * FROM Customers WHERE City = '${formattedCity}';`;
  }

  // 2. "Show all customers"
  if (cleanPrompt.includes('show all customers') || cleanPrompt.includes('get all customers') || cleanPrompt.includes('show customers') || cleanPrompt.includes('list customers')) {
    return 'SELECT * FROM Customers;';
  }

  // 3. "Show all orders for [Customer Name]"
  const ordersForCustomerMatch = cleanPrompt.match(/(?:show|get|list) (?:all )?orders for ([a-zA-Z\s]+)/i);
  if (ordersForCustomerMatch) {
    const name = ordersForCustomerMatch[1].trim();
    const formattedName = name.replace(/\b\w/g, c => c.toUpperCase());
    return `SELECT Orders.OrderID, Orders.OrderDate, Orders.Amount, Customers.CustomerName \nFROM Orders \nJOIN Customers ON Orders.CustomerID = Customers.CustomerID \nWHERE Customers.CustomerName = '${formattedName}';`;
  }

  // 4. "Show all orders"
  if (cleanPrompt.includes('show all orders') || cleanPrompt.includes('get all orders') || cleanPrompt.includes('show orders') || cleanPrompt.includes('list orders')) {
    return 'SELECT * FROM Orders;';
  }

  // 5. "Show users above age [X]" or "Show users older than [X]"
  const ageMatch = cleanPrompt.match(/(?:show|get|list) (?:all )?users (?:above|older than|greater than|over) age (\d+)/i) ||
                   cleanPrompt.match(/(?:show|get|list) (?:all )?users (?:above|older than|greater than|over) (\d+)/i);
  if (ageMatch) {
    const age = ageMatch[1];
    return `SELECT UserNames.username, RegistrationDetails.age, RegistrationDetails.email, RegistrationDetails.registration_date \nFROM RegistrationDetails \nJOIN UserNames ON RegistrationDetails.username_id = UserNames.id \nWHERE RegistrationDetails.age > ${age};`;
  }

  // 6. "Add new customer [Name] from [City]" or similar
  // e.g. "Add new customer named Alice Vance from Paris"
  const addCustomerMatch = cleanPrompt.match(/(?:add|create|insert) (?:new )?customer (?:named )?([a-zA-Z\s]+) (?:from|in) ([a-zA-Z\s]+)/i);
  if (addCustomerMatch) {
    const name = addCustomerMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
    const city = addCustomerMatch[2].trim().replace(/\b\w/g, c => c.toUpperCase());
    return `INSERT INTO Customers (CustomerName, ContactName, City, Country) VALUES ('${name}', '${name.split(' ')[0]}', '${city}', 'USA');`;
  }

  // Simple "Add new customer" with default values
  if (cleanPrompt.includes('add new customer') || cleanPrompt.includes('add customer') || cleanPrompt.includes('insert customer')) {
    return `INSERT INTO Customers (CustomerName, ContactName, City, Country) VALUES ('New Client', 'New Client', 'San Francisco', 'USA');`;
  }

  // 7. "Update customer [Name] city to [City]"
  const updateCustomerCityMatch = cleanPrompt.match(/(?:update) customer ([a-zA-Z\s]+) city to ([a-zA-Z\s]+)/i);
  if (updateCustomerCityMatch) {
    const name = updateCustomerCityMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
    const city = updateCustomerCityMatch[2].trim().replace(/\b\w/g, c => c.toUpperCase());
    return `UPDATE Customers SET City = '${city}' WHERE CustomerName = '${name}';`;
  }

  // Default fallback to show all tables if unknown
  if (cleanPrompt.includes('register') || cleanPrompt.includes('registration') || cleanPrompt.includes('user')) {
    return 'SELECT UserNames.username, RegistrationDetails.age, RegistrationDetails.email FROM RegistrationDetails JOIN UserNames ON RegistrationDetails.username_id = UserNames.id;';
  }

  return 'SELECT * FROM Customers;';
}

/**
 * Translates natural language prompt to a MySQL query string.
 * @param {string} prompt - User natural language prompt
 * @returns {Promise<string>} - Generated SQL Query
 */
export async function translatePromptToSQL(prompt) {
  if (!prompt || prompt.trim() === '') {
    throw new Error('Prompt cannot be empty');
  }

  // If AI client is active, use Gemini API
  if (aiClient) {
    try {
      console.log('Sending request to Gemini API...');
      const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(`${SCHEMA_PROMPT}\nUser Prompt: "${prompt}"\nSQL Output:`);
      const response = await result.response;
      let sql = response.text() || '';
      
      // Strip any accidental markdown formatting
      sql = sql.replace(/```sql/g, '').replace(/```/g, '').trim();
      
      if (sql) {
        return sql;
      }
    } catch (err) {
      console.error('Gemini API call failed, falling back to rules engine:', err.message);
    }
  }

  // Use rule-based parser if AI is unavailable or failed
  console.log('Using Rule-based Local NLP Parser...');
  return localRuleParser(prompt);
}
