// lib/github-admin.ts
import { Octokit } from "@octokit/rest";
import { Buffer } from 'buffer'; // Node.js Buffer is available in Next.js API routes

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER as string;
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME as string;
const GITHUB_CONTENT_PATH = process.env.GITHUB_CONTENT_PATH as string;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH as string;
const GITHUB_WRITE_TOKEN = process.env.GITHUB_WRITE_TOKEN as string;

const octokit = new Octokit({
  auth: GITHUB_WRITE_TOKEN,
});

if (!GITHUB_REPO_OWNER || !GITHUB_REPO_NAME || !GITHUB_CONTENT_PATH || !GITHUB_BRANCH || !GITHUB_WRITE_TOKEN) {
  console.error("Missing GitHub environment variables for admin operations.");
  // Consider throwing an error or setting a flag to disable operations
}


// --- Utility functions ---

/**
 * Gets the SHA of the latest commit on the specified branch.
 */
async function getLatestCommitSha(): Promise<string> {
  const { data } = await octokit.repos.getBranch({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    branch: GITHUB_BRANCH,
  });
  return data.commit.sha;
}

/**
 * Gets the SHA of the tree for the latest commit.
 */
async function getLatestTreeSha(commitSha: string): Promise<string> {
  const { data } = await octokit.git.getCommit({
    owner: GITHUB_REPO_OWNER,
    repo: GITHUB_REPO_NAME,
    commit_sha: commitSha,
  });
  return data.tree.sha;
}

// --- Admin operations ---

export async function listMarkdownFiles() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: GITHUB_CONTENT_PATH,
      ref: GITHUB_BRANCH,
    });

    if (Array.isArray(data)) {
      // Filter for markdown files and return relevant info
      return data
        .filter(file => file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.mdx')))
        .map(file => ({
          name: file.name,
          path: file.path,
          sha: file.sha,
          url: file.url,
        }));
    }
    return [];
  } catch (error) {
    console.error("Error listing markdown files:", error);
    throw new Error("Failed to list files from GitHub.");
  }
}

export async function getMarkdownFileContent(filePath: string) {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      ref: GITHUB_BRANCH,
    });

    if ('content' in data && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf8');
    } else {
      throw new Error('File content not found or unsupported encoding.');
    }
  } catch (error) {
    console.error(`Error fetching file content for ${filePath}:`, error);
    if (error instanceof Error && 'status' in error && error.status === 404) {
      throw new Error('File not found', { cause: 404 });
    }
    throw new Error(`Failed to get content for ${filePath}.`);
  }
}

export async function saveMarkdownFile(
  filePath: string,
  content: string,
  message: string,
  currentSha?: string // Optional: provide current SHA for updates to prevent conflicts
) {
  try {
    const fileExists = await getMarkdownFileContent(filePath).then(() => true).catch(err => err.cause !== 404);

    if (fileExists && !currentSha) {
      throw new Error('File exists. Current SHA is required for updates to prevent overwrites.');
    }

    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      message: message,
      content: Buffer.from(content).toString('base64'),
      sha: currentSha, // Required for updating existing files
      branch: GITHUB_BRANCH,
    });
    return data;
  } catch (error) {
    console.error(`Error saving file ${filePath}:`, error);
    throw new Error(`Failed to save file ${filePath}.`);
  }
}

export async function deleteMarkdownFile(filePath: string, message: string, sha: string) {
  try {
    const { data } = await octokit.repos.deleteFile({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      message: message,
      sha: sha, // SHA is required for deleting files
      branch: GITHUB_BRANCH,
    });
    return data;
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
    throw new Error(`Failed to delete file ${filePath}.`);
  }
}