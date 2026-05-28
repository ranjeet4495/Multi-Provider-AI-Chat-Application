import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Helper function to extract text from Atlassian Document Format (ADF)
function extractTextFromADF(node) {
  if (!node) return '';
  if (node.type === 'text') {
    return node.text || '';
  }
  let text = '';
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromADF(child);
    }
  }
  // Add spacing/newlines for structural nodes
  if (['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'].includes(node.type)) {
    text += '\n';
  }
  return text;
}

// Route A: Fetch Jira Ticket
app.get('/api/jira/:ticketId', async (req, res) => {
  const { ticketId } = req.params;

  // Retrieve credentials from headers or fallback to environment variables
  const jiraDomain = req.headers['x-jira-domain'] || process.env.JIRA_DOMAIN;
  const jiraEmail = req.headers['x-jira-email'] || process.env.JIRA_EMAIL;
  const jiraToken = req.headers['x-jira-token'] || process.env.JIRA_API_TOKEN;
  const customFieldId = req.headers['x-jira-custom-field']; // User-defined Acceptance Criteria field ID

  if (!jiraDomain || !jiraEmail || !jiraToken) {
    return res.status(400).json({
      error: 'Missing Jira configuration. Please provide Jira Domain, Email, and API Token in settings or backend environment variables.',
    });
  }

  // Clean domain name
  const formattedDomain = jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${formattedDomain}/rest/api/3/issue/${ticketId}`;

  try {
    const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`;
    const response = await axios.get(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    const issue = response.data;
    const fields = issue.fields || {};

    // 1. Title/Summary
    const title = fields.summary || '';

    // 2. Parse Description (ADF format in v3 API)
    let description = '';
    if (fields.description) {
      if (typeof fields.description === 'string') {
        description = fields.description;
      } else if (typeof fields.description === 'object') {
        description = extractTextFromADF(fields.description).trim();
      }
    }

    // 3. Acceptance Criteria
    let acceptanceCriteria = '';

    // Check specific custom field first if provided
    if (customFieldId && fields[customFieldId]) {
      const customValue = fields[customFieldId];
      acceptanceCriteria = typeof customValue === 'object' ? extractTextFromADF(customValue).trim() : String(customValue);
    } else {
      // Look for a custom field in fields that contains "acceptance criteria"
      // Or check if there's a field containing "criteria"
      const fieldsKeys = Object.keys(fields);
      for (const key of fieldsKeys) {
        if (key.startsWith('customfield_') && fields[key]) {
          // Unfortunately we don't have the field names directly without another API call,
          // but we can look for specific popular custom field properties or ADF contents
          // Let's do a soft check: if the value is ADF, check if it contains the word "acceptance" inside
          const val = fields[key];
          if (val && typeof val === 'object') {
            const parsedText = extractTextFromADF(val);
            if (parsedText.toLowerCase().includes('acceptance criteria')) {
              acceptanceCriteria = parsedText.trim();
              break;
            }
          }
        }
      }

      // Fallback: If no custom field matched, check if acceptance criteria is written in the description
      if (!acceptanceCriteria && description.toLowerCase().includes('acceptance criteria')) {
        // Try to extract it from description
        const lines = description.split('\n');
        const index = lines.findIndex(line => line.toLowerCase().includes('acceptance criteria'));
        if (index !== -1) {
          acceptanceCriteria = lines.slice(index).join('\n').trim();
        }
      }
    }

    res.json({
      title,
      description,
      acceptanceCriteria,
    });
  } catch (error) {
    console.error('Error fetching from Jira:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.errorMessages?.join(', ') || error.message;
    res.status(error.response?.status || 500).json({
      error: `Failed to fetch Jira ticket: ${errorMessage}`,
    });
  }
});

// Route B: Generate Test Cases
app.post('/api/generate', async (req, res) => {
  const { jiraContent, selectedModel, apiKeys = {}, modelName } = req.body;

  if (!jiraContent || !jiraContent.trim()) {
    return res.status(400).json({ error: 'Jira content cannot be empty.' });
  }

  // Prepend prompt handling instructions as requested:
  // 1. Prepend QA role: "Act as QA Engineer. Keep answer clear and short."
  // 2. Add full prompt instruction:
  // "Act as QA Engineer. Generate test cases from below Jira story.
  //  Include functional, negative, and boundary cases.
  //  Keep output clear and structured."
  const systemContext = "Act as QA Engineer. Keep answer clear and short.";
  const instructions = "Act as QA Engineer. Generate test cases from below Jira story.\nInclude functional, negative, and boundary cases.\nKeep output clear and structured.";
  
  const finalPrompt = `${systemContext}\n\n${instructions}\n\nJira Story Details:\n${jiraContent}\n\nGenerated Test Cases:`;

  try {
    let resultText = '';

    switch (selectedModel) {
      case 'openai': {
        const apiKey = apiKeys.openaiKey || process.env.OPENAI_API_KEY;
        const selectedModelName = modelName || 'gpt-4';

        if (!apiKey) {
          return res.status(400).json({ error: 'OpenAI API key is missing. Please configure it in settings.' });
        }

        const openAiResponse = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: selectedModelName,
            messages: [{ role: 'user', content: finalPrompt }],
            temperature: 0.7,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );
        resultText = openAiResponse.data.choices[0].message.content;
        break;
      }

      case 'gemini': {
        const apiKey = apiKeys.geminiKey || process.env.GEMINI_API_KEY;
        const selectedModelName = modelName || 'gemini-1.5-flash';

        if (!apiKey) {
          return res.status(400).json({ error: 'Gemini API key is missing. Please configure it in settings.' });
        }

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModelName}:generateContent?key=${apiKey}`;
        const geminiResponse = await axios.post(
          geminiUrl,
          {
            contents: [{ parts: [{ text: finalPrompt }] }],
          },
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (geminiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = geminiResponse.data.candidates[0].content.parts[0].text;
        } else {
          throw new Error('Invalid response structure received from Gemini API');
        }
        break;
      }

      case 'grok': {
        const apiKey = apiKeys.grokKey || process.env.GROK_API_KEY;
        const selectedModelName = modelName || 'grok-beta';

        if (!apiKey) {
          return res.status(400).json({ error: 'Grok API key is missing. Please configure it in settings.' });
        }

        const grokResponse = await axios.post(
          'https://api.x.ai/v1/chat/completions',
          {
            model: selectedModelName,
            messages: [{ role: 'user', content: finalPrompt }],
            temperature: 0.7,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );
        resultText = grokResponse.data.choices[0].message.content;
        break;
      }

      case 'groq': {
        const apiKey = apiKeys.groqKey || process.env.GROQ_API_KEY;
        const selectedModelName = modelName || 'llama3-8b-8192';

        if (!apiKey) {
          return res.status(400).json({ error: 'Groq API key is missing. Please configure it in settings.' });
        }

        const groqResponse = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: selectedModelName,
            messages: [{ role: 'user', content: finalPrompt }],
            temperature: 0.7,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );
        resultText = groqResponse.data.choices[0].message.content;
        break;
      }

      case 'ollama': {
        const selectedModelName = modelName || 'phi3';
        
        const ollamaResponse = await axios.post(
          'http://localhost:11434/api/generate',
          {
            model: selectedModelName,
            prompt: finalPrompt,
            stream: false,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 300000, // 5 min timeout for slow local running models
          }
        );
        resultText = ollamaResponse.data.response;
        break;
      }

      default:
        return res.status(400).json({ error: `Unsupported model: ${selectedModel}` });
    }

    res.json({ testCases: resultText });
  } catch (error) {
    console.error('Error generating test cases:', error.response?.data || error.message);
    const apiError = error.response?.data?.error?.message || error.response?.data?.error || error.message;
    res.status(error.response?.status || 500).json({
      error: `Failed to generate test cases: ${apiError}`,
    });
  }
});

// Route C: Raise a Bug in Jira
app.post('/api/jira/bug', async (req, res) => {
  const { projectKey, summary, description, priority = 'Medium' } = req.body;

  // Retrieve credentials from headers or fallback to environment variables
  const jiraDomain = req.headers['x-jira-domain'] || process.env.JIRA_DOMAIN;
  const jiraEmail = req.headers['x-jira-email'] || process.env.JIRA_EMAIL;
  const jiraToken = req.headers['x-jira-token'] || process.env.JIRA_API_TOKEN;

  if (!jiraDomain || !jiraEmail || !jiraToken) {
    return res.status(400).json({
      error: 'Missing Jira configuration. Please provide Jira Domain, Email, and API Token in settings or backend environment variables.',
    });
  }

  if (!projectKey || !summary || !description) {
    return res.status(400).json({
      error: 'Project Key, Summary, and Description are required to raise a bug.',
    });
  }

  const formattedDomain = jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${formattedDomain}/rest/api/3/issue`;

  // Parse multi-line description into ADF paragraphs to preserve formatting
  const paragraphs = description.split('\n').map(line => {
    return {
      type: 'paragraph',
      content: line.trim() ? [
        {
          type: 'text',
          text: line,
        }
      ] : [],
    };
  });

  const jiraPayload = {
    fields: {
      project: {
        key: projectKey.toUpperCase(),
      },
      summary: summary,
      description: {
        type: 'doc',
        version: 1,
        content: paragraphs,
      },
      issuetype: {
        name: 'Bug',
      },
      priority: {
        name: priority,
      },
    },
  };

  try {
    const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`;
    const response = await axios.post(url, jiraPayload, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    res.json({
      success: true,
      key: response.data.key,
      id: response.data.id,
      self: response.data.self,
    });
  } catch (error) {
    console.error('Error raising Jira bug:', error.response?.data || error.message);
    
    // Extract precise error messages from Atlassian response
    const errorsMap = error.response?.data?.errors;
    let details = '';
    if (errorsMap) {
      details = Object.entries(errorsMap).map(([key, val]) => `${key}: ${val}`).join(', ');
    }
    const errorMessage = details || error.response?.data?.errorMessages?.join(', ') || error.message;

    res.status(error.response?.status || 500).json({
      error: `Failed to raise bug in Jira: ${errorMessage}`,
    });
  }
});

// Helper: fetch valid issue type names for a project from Jira create metadata
async function getValidIssueTypes(formattedDomain, authHeader, projectKey) {
  try {
    const createMetaUrl = `https://${formattedDomain}/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(projectKey)}&expand=projects.issuetypes`;
    const metadataResponse = await axios.get(createMetaUrl, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
      },
    });

    const projects = metadataResponse.data.projects || [];
    if (!projects.length) return null;

    const issuetypes = projects[0].issuetypes || [];
    if (!issuetypes.length) return null;

    // Map to { id, name }
    const mapped = issuetypes.map((t) => ({ id: t.id, name: t.name }));
    return mapped;
  } catch (metaError) {
    console.error('Error fetching Jira issue type metadata:', metaError.response?.data || metaError.message);
    return null;
  }
}

// Route D: Create a Defect in Jira
app.post('/api/jira/defect', async (req, res) => {
  const {
    projectKey,
    summary,
    description = '',
    steps = '',
    expectedResult = '',
    actualResult = '',
    severity = 'Medium',
    priority = 'Medium',
    issueType = 'Bug'
  } = req.body;

  // Retrieve credentials from headers or fallback to environment variables
  const jiraDomain = req.headers['x-jira-domain'] || process.env.JIRA_DOMAIN;
  const jiraEmail = req.headers['x-jira-email'] || process.env.JIRA_EMAIL;
  const jiraToken = req.headers['x-jira-token'] || process.env.JIRA_API_TOKEN;

  if (!jiraDomain || !jiraEmail || !jiraToken) {
    return res.status(400).json({
      error: 'Missing Jira configuration. Please provide Jira Domain, Email, and API Token in settings or backend environment variables.',
    });
  }

  if (!projectKey || !summary) {
    return res.status(400).json({
      error: 'Project Key and Summary are required to raise a defect.',
    });
  }

  const formattedDomain = jiraDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const url = `https://${formattedDomain}/rest/api/3/issue`;
  const authHeader = `Basic ${Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64')}`;

  // Combine fields into a Jira-friendly description string
  const combinedDescriptionParts = [];
  if (description.trim()) {
    combinedDescriptionParts.push(description.trim());
  }
  if (steps.trim()) {
    combinedDescriptionParts.push(`Steps:\n${steps.trim()}`);
  }
  if (expectedResult.trim()) {
    combinedDescriptionParts.push(`Expected Result:\n${expectedResult.trim()}`);
  }
  if (actualResult.trim()) {
    combinedDescriptionParts.push(`Actual Result:\n${actualResult.trim()}`);
  }
  combinedDescriptionParts.push(`Severity: ${severity}`);

  const combinedDescription = combinedDescriptionParts.join('\n\n');

  const buildPayload = (issueType) => {
    const issuetypeField = (issueType && typeof issueType === 'object' && issueType.id)
      ? { id: issueType.id }
      : { name: String(issueType) };

    return {
      fields: {
        project: { key: projectKey.toUpperCase() },
        summary,
        description: combinedDescription,
        issuetype: issuetypeField,
        priority: { name: priority },
      },
    };
  };

  const sendIssueCreate = async (payload) => {
    return axios.post(url, payload, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  };

  try {
    let response;
    try {
      response = await sendIssueCreate(buildPayload(issueType));
    } catch (createError) {
      const responseData = createError.response?.data;
      const invalidIssueType =
        Array.isArray(responseData?.errorMessages) && responseData.errorMessages.some((msg) => typeof msg === 'string' && msg.toLowerCase().includes('issue type')) ||
        Boolean(responseData?.errors?.issuetype) ||
        (typeof responseData === 'object' && Object.keys(responseData.errors || {}).length && Object.keys(responseData.errors).includes('issuetype'));

      if (invalidIssueType) {
        // Fetch available issue types and try by id (more reliable)
        const validTypes = await getValidIssueTypes(formattedDomain, authHeader, projectKey.toUpperCase());
        if (validTypes && validTypes.length) {
          // Prefer Bug if present
          const bug = validTypes.find((t) => t.name.toLowerCase() === 'bug');
          const toTry = bug || validTypes[0];
          try {
            response = await sendIssueCreate(buildPayload(toTry));
          } catch (secondErr) {
            // If second attempt fails, attach available types to the thrown error for diagnostics
            secondErr.availableIssueTypes = validTypes;
            throw secondErr;
          }
        } else {
          throw createError;
        }
      } else {
        throw createError;
      }
    }

    res.json({
      success: true,
      key: response.data.key,
      id: response.data.id,
      self: response.data.self,
    });
  } catch (error) {
    let errorMessage = error.message;
    if (error.response?.data) {
      const responseData = error.response.data;
      if (responseData.errorMessages && Array.isArray(responseData.errorMessages) && responseData.errorMessages.length > 0) {
        errorMessage = responseData.errorMessages.join(', ');
      } else if (responseData.errors && typeof responseData.errors === 'object' && Object.keys(responseData.errors).length > 0) {
        errorMessage = Object.entries(responseData.errors)
          .map(([key, val]) => {
            const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
            return `${key}: ${valStr}`;
          })
          .join(', ');
      } else if (typeof responseData === 'string') {
        errorMessage = responseData;
      } else {
        errorMessage = JSON.stringify(responseData);
      }
    }

    res.status(error.response?.status || 500).json({
      error: `Failed to raise defect in Jira: ${errorMessage}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

