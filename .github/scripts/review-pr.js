// .github/scripts/review-pr.js
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Initialize GitHub client
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

// Get environment variables
const owner = process.env.REPO_OWNER;
const repo = process.env.REPO_NAME;
const pull_number = process.env.PR_NUMBER;
const baseUrl = process.env.AI_API_BASEURL || 'http://your-company-api-url';

async function callAIModel(prompt) {
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v2:16b',
        prompt: prompt,
        stream: false
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.output || data.generated_text;
  } catch (error) {
    console.error('Error calling AI model:', error);
    throw error;
  }
}

async function main() {
  console.log(`Starting AI review for PR #${pull_number}`);
  
  // Get the PR diff
  const { data: pullRequest } = await octokit.pulls.get({
    owner,
    repo,
    pull_number
  });
  
  // Get the files changed in this PR
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number
  });
  
  console.log(`Found ${files.length} changed files`);
  
  // Filter to just code files
  const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rb', '.php', '.c', '.cpp', '.cs'];
  const codeFiles = files.filter(file => {
    const ext = path.extname(file.filename).toLowerCase();
    return codeExtensions.includes(ext);
  });
  
  console.log(`Found ${codeFiles.length} code files to review`);
  
  // Initialize review summary
  let overallIssues = [];
  let overallSuggestions = [];
  
  // Review each file
  for (const file of codeFiles) {
    // Skip files that are too large
    if (file.changes > 500) {
      console.log(`Skipping large file: ${file.filename} (${file.changes} changes)`);
      continue;
    }
    
    console.log(`Reviewing: ${file.filename}`);
    
    try {
      // Get the file content at the head commit
      const { data: contentData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.filename,
        ref: pullRequest.head.ref
      });
      
      // Decode the content if it exists
      let content = '';
      if (contentData.content) {
        content = Buffer.from(contentData.content, 'base64').toString();
      }
      
      // Skip empty files
      if (!content.trim()) {
        console.log(`Skipping empty file: ${file.filename}`);
        continue;
      }
      
      // Get the file extension to determine language
      const extension = path.extname(file.filename).substring(1);
      
      // Create prompt for AI
      const prompt = `
You are an expert code reviewer. Review the following ${extension} code:

\`\`\`${extension}
${content}
\`\`\`

Please provide a detailed code review that identifies:
1. Bugs or potential issues
2. Security vulnerabilities
3. Performance problems
4. Style and best practice violations
5. Specific suggestions for improvement

For each issue, provide:
- The line number (if applicable)
- A description of the issue
- A suggested fix

Format your response as JSON:
{
  "issues": [
    {
      "line": <line_number>,
      "issue": "<description>",
      "suggestion": "<suggested_fix>",
      "severity": "<high|medium|low>"
    }
  ],
  "summary": "<overall_assessment>"
}
`;

      // Get AI review from your local model
      const aiResponse = await callAIModel(prompt);
      
      let review;
      try {
        // Try to parse the AI response as JSON
        // If the model doesn't return properly formatted JSON, this will try to find and extract JSON content
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        review = JSON.parse(jsonString);
      } catch (e) {
        console.error("Error parsing AI response:", e);
        console.log("Raw response:", aiResponse.substring(0, 500) + "...");
        
        // Fallback: create a simple review object
        review = {
          issues: [],
          summary: "Unable to parse AI response. Please check the model output format."
        };
      }
      
      // Add file-specific issues to overall list
      if (review.issues && review.issues.length > 0) {
        overallIssues.push(...review.issues.map(issue => ({
          ...issue,
          file: file.filename
        })));
        
        // Comment on specific lines
        for (const issue of review.issues) {
          if (issue.line) {
            await octokit.pulls.createReviewComment({
              owner,
              repo,
              pull_number,
              body: `**${issue.severity.toUpperCase()}**: ${issue.issue}\n\nSuggestion: ${issue.suggestion}`,
              commit_id: pullRequest.head.sha,
              path: file.filename,
              line: issue.line
            });
            console.log(`Posted comment on ${file.filename}:${issue.line}`);
          }
        }
      }
      
      // Post a file-level summary comment
      if (review.summary) {
        overallSuggestions.push(`**${file.filename}**: ${review.summary}`);
      }
      
    } catch (error) {
      console.error(`Error reviewing ${file.filename}:`, error);
    }
  }
  
  // Create a PR review with a summary
  if (overallIssues.length > 0 || overallSuggestions.length > 0) {
    console.log(overallIssues)
    // Create summary comment
    const summaryBody = `# ReviewRanger AI: Code Review Summary

${overallIssues.length > 0 ? `## Issues Found (${overallIssues.length})
${overallIssues.map(issue => `- **${issue.severity}** [${issue.file}${issue.line ? `:${issue.line}` : ''}]: ${issue.issue}`).join('\n')}` : ''}

${overallSuggestions.length > 0 ? `## Summary by File
${overallSuggestions.join('\n\n')}` : ''}

---
*This review was performed automatically by ReviewRanger* 🤠
`;

    // Post the review
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: summaryBody,
      event: 'COMMENT'  // Can be 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'
    });
    
    console.log('Posted PR review summary');
  } else {
    console.log('No issues found, not posting a review');
  }
}

main().catch(error => {
  console.error('Error in review process:', error);
  process.exit(1);
});