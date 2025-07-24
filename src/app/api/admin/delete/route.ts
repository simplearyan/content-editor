// app/api/admin/delete/route.ts
import { NextResponse } from 'next/server';
import { deleteMarkdownFile } from '@/lib/github-admin';
import { GITHUB_CONTENT_PATH } from '@/lib/github-admin'; // Ensure GITHUB_CONTENT_PATH is exported from github-admin

export async function DELETE(request: Request) {
  try {
    const { filename, sha } = await request.json(); // SHA is required for deletes

    if (!filename || !sha) {
      return NextResponse.json({ error: "Filename and SHA are required for deletion." }, { status: 400 });
    }

    const filePath = `${GITHUB_CONTENT_PATH}/${filename}`;
    const commitMessage = `Delete ${filename}`;

    const result = await deleteMarkdownFile(filePath, commitMessage, sha);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("API Error (DELETE /api/admin/delete):", error);
    return NextResponse.json({ error: "Failed to delete file." }, { status: 500 });
  }
}