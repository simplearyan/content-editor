// src/app/api/admin/save/route.ts
import { NextResponse } from 'next/server';
import { saveGitHubFile, getGitHubFileContent } from '@/lib/github-admin';

export async function POST(request: Request) {
  try {
    const { filePath, content, commitMessage } = await request.json();

    if (!filePath || !content || !commitMessage) {
      return NextResponse.json({ error: "File path, content, and commit message are required." }, { status: 400 });
    }

    let existingSha: string | undefined = undefined;
    try {
      // Try to get the SHA of the existing file for updates
      const existingFile = await getGitHubFileContent(filePath);
      existingSha = existingFile.sha;
    } catch (error: any) {
      // If file not found (404), it's a new file, so no SHA needed.
      if (!error.message.includes("not found")) {
        console.warn(`Could not get SHA for ${filePath} (likely new file), but encountered other error:`, error);
      }
    }

    const result = await saveGitHubFile(filePath, content, commitMessage, existingSha);

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error(`Error saving file via API:`, error);
    if (error.message.includes("not authenticated") || error.message.includes("access token is missing")) {
      return NextResponse.json({ error: "Authentication required to save files." }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Failed to save file." }, { status: 500 });
  }
}