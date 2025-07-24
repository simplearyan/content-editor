// app/api/admin/save/route.ts
import { NextResponse } from 'next/server';
import { saveMarkdownFile } from '@/lib/github-admin';
import { GITHUB_CONTENT_PATH } from '@/lib/github-admin'; // Ensure GITHUB_CONTENT_PATH is exported from github-admin

export async function POST(request: Request) {
  try {
    const { filename, content, sha } = await request.json(); // sha is for updates

    if (!filename || !content) {
      return NextResponse.json({ error: "Filename and content are required." }, { status: 400 });
    }

    const filePath = `${GITHUB_CONTENT_PATH}/${filename}`;
    const commitMessage = sha ? `Update ${filename}` : `Create ${filename}`;

    const result = await saveMarkdownFile(filePath, content, commitMessage, sha);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("API Error (POST /api/admin/save):", error);
    return NextResponse.json({ error: "Failed to save file." }, { status: 500 });
  }
}