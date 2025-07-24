// lib/github-admin.ts
import { Octokit } from "@octokit/rest";
import { Buffer } from 'buffer'; // Node.js Buffer is available in Next.js API routes

// src/lib/github-admin.ts
// import { Octokit } from "octokit";
// import { auth } from "@/auth"; // Import the auth helper from Auth.js v5

// src/lib/github-admin.ts
// import { Octokit } from "octokit";
import { auth } from "@/auth"; // For getting the current user session (for commit author)

// --- 1. Environment Variables Checks ---
// These are crucial for the application to function correctly.
// Ensure these are set in your .env.local file.
if (!process.env.GITHUB_REPO_OWNER) {
  throw new Error("GITHUB_REPO_OWNER is not defined in environment variables.");
}
if (!process.env.GITHUB_REPO_NAME) {
  throw new Error("GITHUB_REPO_NAME is not defined in environment variables.");
}
if (!process.env.GITHUB_CONTENT_PATH) {
  console.warn("GITHUB_CONTENT_PATH is not defined in environment variables. Defaulting to 'posts'.");
}
if (!process.env.GITHUB_BRANCH_NAME) {
  throw new Error("GITHUB_BRANCH_NAME is not defined in environment variables.");
}

// GitHub Personal Access Token (PAT)
if (!process.env.GITHUB_WRITE_TOKEN) {
  throw new Error("GITHUB_PAT is not defined in environment variables. This is required for GitHub API access.");
}

// --- 2. Exported Constants ---
export const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
export const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;
export const GITHUB_CONTENT_PATH = process.env.GITHUB_CONTENT_PATH || "posts";
export const GITHUB_BRANCH_NAME = process.env.GITHUB_BRANCH_NAME;

/**
 * Gets an authenticated Octokit instance using a GitHub Personal Access Token (PAT).
 * This token is configured directly in your environment variables.
 *
 * @returns An Octokit instance authenticated with the PAT.
 * @throws Error if GITHUB_PAT is missing or invalid.
 */
export async function getAuthenticatedOctokitWithPAT() {
  const pat = process.env.GITHUB_WRITE_TOKEN;

  if (!pat) {
    throw new Error("GitHub Personal Access Token (GITHUB_PAT) is not configured.");
  }

  const octokit = new Octokit({ auth: pat });

  // Optional: Verify the PAT by fetching the user it belongs to
  try {
    const { data: { login } } = await octokit.rest.users.getAuthenticated();
    console.log(`[GitHub Admin] Authenticated Octokit using PAT for user: ${login}`);
  } catch (error: any) {
    console.error("Error verifying GitHub PAT. Please ensure it is correct and has 'repo' scope.", error);
    throw new Error(`Failed to verify GitHub PAT. Please check GITHUB_PAT in your .env.local file and its permissions. Error: ${error.message || error.status}`);
  }

  return octokit;
}

// --- 3. Interfaces for GitHub File Data ---
export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  url: string;
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

export interface GitHubFileContent {
  content: string;
  sha: string;
}

// --- 4. GitHub File Operations (Modified to use getAuthenticatedOctokitWithPAT) ---

/**
 * Fetches the content of a file from a GitHub repository using PAT authentication.
 *
 * @param filePath The full path to the file (e.g., "posts/my-post.mdx").
 * @returns The file content (decoded from base64) and SHA.
 * @throws Error if the file is not found or fetching fails.
 */
export async function getGitHubFileContent(filePath: string): Promise<GitHubFileContent> {
  const octokit = await getAuthenticatedOctokitWithPAT();

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      ref: GITHUB_BRANCH_NAME,
    });

    if ("content" in data && data.content) {
      const content = Buffer.from(data.content, "base64").toString("utf-8");
      return { content, sha: data.sha };
    } else {
      throw new Error(`File content not found or is a directory for path: ${filePath}`);
    }
  } catch (error: any) {
    console.error(`Error fetching GitHub file content for ${filePath} on branch ${GITHUB_BRANCH_NAME}:`, error);
    if (error.status === 404) {
      throw new Error(`File not found: ${filePath} on branch ${GITHUB_BRANCH_NAME}. Please ensure the file and its parent directories exist.`);
    }
    throw new Error(`Failed to fetch file content: ${error.message || error.status}`);
  }
}

/**
 * Saves (creates or updates) a file in a GitHub repository using PAT authentication.
 *
 * @param filePath The full path to the file (e.g., "posts/new-post.mdx").
 * @param content The new content of the file.
 * @param commitMessage The commit message.
 * @param sha (Optional) The SHA of the existing file for updates (optimistic locking).
 * @returns The response data from the GitHub API.
 * @throws Error if saving fails.
 */
export async function saveGitHubFile(filePath: string, content: string, commitMessage: string, sha?: string) {
  const octokit = await getAuthenticatedOctokitWithPAT();
  const session = await auth(); // Get user session for commit author/committer info

  // Use the logged-in user's name/email for commit author, fallback to generic
  const authenticatedUser = session?.user?.name || session?.user?.email || 'Admin Editor';
  const userEmail = session?.user?.email || `${authenticatedUser.replace(/\s/g, '_')}@users.noreply.github.com`;

  const encodedContent = Buffer.from(content, "utf-8").toString("base64");

  try {
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      message: commitMessage,
      content: encodedContent,
      sha: sha,
      branch: GITHUB_BRANCH_NAME,
      committer: {
        name: authenticatedUser,
        email: userEmail,
      },
      author: {
        name: authenticatedUser,
        email: userEmail,
      },
    });
    console.log(`[GitHub Admin] File saved: ${filePath} on branch ${GITHUB_BRANCH_NAME}. Commit SHA: ${response.data.commit.sha}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error saving GitHub file ${filePath} on branch ${GITHUB_BRANCH_NAME}:`, error);
    if (error.status === 404) {
      throw new Error(`Failed to save file: Repository, branch, or content path not found. Please ensure '${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}' exists, branch '${GITHUB_BRANCH_NAME}' exists, and the directory '${GITHUB_CONTENT_PATH}' exists in the repo root. Error: ${error.message}`);
    }
    throw new Error(`Failed to save file: ${error.message || error.status}`);
  }
}

/**
 * Deletes a file from a GitHub repository using PAT authentication.
 *
 * @param filePath The full path to the file (e.g., "posts/old-post.mdx").
 * @param commitMessage The commit message.
 * @param sha The SHA of the file to delete (required for deletion).
 * @returns The response data from the GitHub API.
 * @throws Error if deletion fails.
 */
export async function deleteGitHubFile(filePath: string, commitMessage: string, sha: string) {
  const octokit = await getAuthenticatedOctokitWithPAT();
  const session = await auth(); // Get user session for commit author/committer info

  // Use the logged-in user's name/email for commit author, fallback to generic
  const authenticatedUser = session?.user?.name || session?.user?.email || 'Admin Editor';
  const userEmail = session?.user?.email || `${authenticatedUser.replace(/\s/g, '_')}@users.noreply.github.com`;

  try {
    const response = await octokit.rest.repos.deleteFile({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: filePath,
      message: commitMessage,
      sha: sha,
      branch: GITHUB_BRANCH_NAME,
      committer: {
        name: authenticatedUser,
        email: userEmail,
      },
      author: {
        name: authenticatedUser,
        email: userEmail,
      },
    });
    console.log(`[GitHub Admin] File deleted: ${filePath} on branch ${GITHUB_BRANCH_NAME}. Commit SHA: ${response.data.commit.sha}`);
    return response.data;
  } catch (error: any) {
    console.error(`Error deleting GitHub file ${filePath} on branch ${GITHUB_BRANCH_NAME}:`, error);
    if (error.status === 404) {
      throw new Error(`Failed to delete file: File not found. Please ensure '${filePath}' exists on branch '${GITHUB_BRANCH_NAME}' and the correct SHA is provided.`);
    }
    throw new Error(`Failed to delete file: ${error.message || error.status}`);
  }
}