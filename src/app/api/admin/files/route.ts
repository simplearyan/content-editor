// src/app/api/admin/files/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedOctokitWithPAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_CONTENT_PATH, GitHubFile } from '@/lib/github-admin';

export async function GET(request: Request) {
  try {
    const  octokit  = await getAuthenticatedOctokitWithPAT();

    // Get contents of the GITHUB_CONTENT_PATH directory
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_REPO_OWNER,
      repo: GITHUB_REPO_NAME,
      path: GITHUB_CONTENT_PATH,
    });

    if (Array.isArray(data)) {
      const files: GitHubFile[] = data
        .filter((item: any) => item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.mdx')))
        .map((item: any) => ({
          name: item.name,
          path: item.path, // This is the full path from repo root
          sha: item.sha,
          url: item.url,
          type: item.type,
          size: item.size,
          download_url: item.download_url,
        }));
      return NextResponse.json(files);
    }

    return NextResponse.json([], { status: 200 });
  } catch (error: any) {
    console.error("Error listing files:", error);
    if (error.message.includes("not authenticated") || error.message.includes("access token is missing")) {
      return NextResponse.json({ error: "Authentication required to list files." }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to list files." }, { status: 500 });
  }
}