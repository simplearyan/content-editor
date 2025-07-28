// src/app/admin/editor/page.tsx
'use client'; // This component must be a Client Component

import { useSession, signOut } from 'next-auth/react'; // Import signOut for the logout button
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import matter from 'gray-matter'; // Import gray-matter

// UI Components (assuming shadcn/ui or similar)
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input'; // For title/slug input
import { Label } from '@/components/ui/label'; // For form labels
// --- NEW IMPORTS FOR RADIO GROUP ---
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator'; // Add separator for visual grouping

// Your custom components
import { MarkdownPreview } from '@/components/editor/markdown-preview'; // For rendering markdown preview

// Utility functions (assuming you have these)
import { slugify } from '@/lib/utils'; // For slugifying titles

// Define the interface for a GitHub file object, matching your API response
interface GitHubFile {
  name: string; // e.g., "my-post.mdx"
  path: string; // e.g., "posts/my-post.mdx" (full path in repo)
  sha: string; // SHA hash of the file content
  url: string; // API URL to get the file
  type: 'file' | 'dir';
  size: number;
  download_url: string | null;
}

// --- Main Editor Component ---
export default function AdminEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State for content management
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [markdownContent, setMarkdownContent] = useState<string>(''); // This is now JUST the markdown body
  // New state to hold all parsed front matter as an object
  const [parsedFrontmatterData, setParsedFrontmatterData] = useState<Record<string, any>>({});
  const [frontmatter, setFrontmatter] = useState<string>(''); // For manual frontmatter editing
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null); // To store the path of the file being edited (for updates/deletes)
  const [currentFileSha, setCurrentFileSha] = useState<string | undefined>(undefined); // To send SHA for updates
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [fileList, setFileList] = useState<GitHubFile[]>([]); // To display existing files for selection

    // --- NEW STATES FOR IMAGE, TAGS, CATEGORY ---
  const [image, setImage] = useState<string>(''); // For the cover image URL
  const [tags, setTags] = useState<string>('');   // Comma-separated string for tags
  const [category, setCategory] = useState<string>(''); // For the category string

  // --- NEW STATES FOR CONTENT TYPE AND FOLDER STRUCTURE ---
  const [contentBaseDir, setContentBaseDir] = useState<'posts' | 'courses'>('posts'); // 'posts' or 'courses'
  const [courseFolderName, setCourseFolderName] = useState<string>(''); // For 'courses/{folder_name}/file.mdx'
  // --- END NEW STATES ---

    // --- NEW STATE FOR FILE FORMAT ---
  const [fileFormat, setFileFormat] = useState<'mdx' | 'md'>('mdx'); // Default to MDX

  // --- Authentication and Redirection ---
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin'); // Redirect to login page if not authenticated
    }
  }, [status, router]);

  // --- Fetching Existing Files (Optional, but good for an editor) ---
    // --- Fetching Existing Files ---
  // const fetchFiles = async () => {
  //   try {
  //     const res = await fetch('/api/admin/files');
  //     if (!res.ok) {
  //       throw new Error(`Failed to fetch file list: ${res.statusText}`);
  //     }
  //     const files: GitHubFile[] = await res.json();
  //     setFileList(files.filter(file => file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.mdx'))));
  //   } catch (error) {
  //     console.error("Error fetching file list:", error);
  //     alert("Failed to load existing files. Please check console for details.");
  //   }
  // };
   // --- Fetching Existing Files ---
  const fetchFiles = async () => {
    try {
      const postsRes = await fetch('/api/admin/files?path=posts');
      const coursesRes = await fetch('/api/admin/files?path=courses');

      if (!postsRes.ok || !coursesRes.ok) {
        throw new Error(`Failed to fetch file list: ${postsRes.statusText || coursesRes.statusText}`);
      }

      const postsFiles: GitHubFile[] = await postsRes.json();
      const coursesFolders: GitHubFile[] = await coursesRes.json(); // This will return top-level directories under 'courses'

      let allFiles: GitHubFile[] = [];

      // Add all markdown/mdx files from 'posts/'
      allFiles = allFiles.concat(
        postsFiles.filter(file => file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.mdx')))
      );

      // Recursively fetch files from within course folders
      const courseLessonPromises = coursesFolders
        .filter(folder => folder.type === 'dir')
        .map(async (folder) => {
          const folderFilesRes = await fetch(`/api/admin/files?path=${encodeURIComponent(folder.path)}`);
          if (!folderFilesRes.ok) {
            console.error(`Failed to fetch files from course folder ${folder.path}: ${folderFilesRes.statusText}`);
            return [];
          }
          const folderFiles: GitHubFile[] = await folderFilesRes.json();
          return folderFiles.filter(file => file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.mdx')));
        });

      const courseLessons = (await Promise.all(courseLessonPromises)).flat();
      allFiles = allFiles.concat(courseLessons);

      setFileList(allFiles);
    } catch (error) {
      console.error("Error fetching file list:", error);
      alert("Failed to load existing files. Please check console for details.");
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchFiles();
    }
  }, [status]);

  // --- Handle File Selection for Editing ---
  const handleFileSelect = async (filePath: string) => {
    try {
      // You'll need an API route to fetch a single file's content
      // e.g., `/api/admin/file?path=some/file.md`
      const res = await fetch(`/api/admin/file?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch file content: ${res.statusText}`);
      }
      const data = await res.json();
      // Assuming data contains { content: "---frontmatter---\nmarkdown content", sha: "..." }
      const { content: rawContent, sha } = data;

            // Use gray-matter to parse the content
      const { data: parsedData, content: markdownBody } = matter(rawContent);

            // Determine content type and folder based on filePath
      if (filePath.startsWith('posts/')) {
        setContentBaseDir('posts');
        setCourseFolderName(''); // Clear course folder for posts
      } else if (filePath.startsWith('courses/')) {
        setContentBaseDir('courses');
        // Extract course folder name: e.g., "courses/my-course/lesson.mdx" -> "my-course"
        const pathParts = filePath.split('/');
        if (pathParts.length >= 3) { // Expecting at least "courses", "course-folder", "file.mdx"
          setCourseFolderName(pathParts[1]); // The second part is the course folder name
        } else {
          setCourseFolderName(''); // Fallback
        }
      } else {
        // Default or error handling for unknown paths
        setContentBaseDir('posts');
        setCourseFolderName('');
        console.warn(`Unknown file path structure: ${filePath}. Defaulting to 'posts'.`);
      }

      // Set states based on parsed data
      setParsedFrontmatterData(parsedData); // Store the full parsed frontmatter object
      setTitle(parsedData.title || '');
      setSlug(parsedData.slug || slugify(parsedData.title || '', new Set())); // Use existing slug or generate
      setMarkdownContent(markdownBody); // This is just the markdown content, no frontmatter
      setCurrentFilePath(filePath);

      // --- POPULATE NEW STATES FROM PARSED FRONTMATTER ---
      setImage(parsedData.image || '');
      setCategory(parsedData.category || '');
      // Tags need special handling: array to comma-separated string
      setTags(Array.isArray(parsedData.tags) ? parsedData.tags.join(', ') : '');

      setCurrentFilePath(filePath); // Store the path for updates
      setCurrentFileSha(sha); // Store SHA for updates


      // --- SET FILE FORMAT BASED ON LOADED FILE'S EXTENSION ---
      const extension = filePath.split('.').pop()?.toLowerCase();
      if (extension === 'mdx' || extension === 'md') {
        setFileFormat(extension as 'mdx' | 'md');
      } else {
        // Default to mdx if extension is unknown or missing
        setFileFormat('mdx');
      }


      alert(`Loaded file: ${filePath}`);
    } catch (error) {
      console.error("Error loading file:", error);
      alert(`Failed to load file: ${error || 'Unknown error'}`);
    }
  };

  // --- Handle Title Change (and auto-slugify) ---
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    // ONLY auto-generate slug if it's a NEW file (currentFileSha will be undefined)
    // If currentFileSha exists (an existing file is loaded), do NOT auto-generate.
    // The slug will retain its value from when the file was loaded or from manual edits.
    if (!currentFileSha) {
      setSlug(slugify(newTitle, new Set()));
    }
    // Update title in parsedFrontmatterData as well for consistency
    setParsedFrontmatterData(prev => ({ ...prev, title: newTitle }));
  };

  // --- Handle Slug Change (manual override) ---
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value;
    setSlug(newSlug);
    // Update slug in parsedFrontmatterData
    setParsedFrontmatterData(prev => ({ ...prev, slug: newSlug }));
  };

  // --- Handle Markdown Content Change ---
  const handleMarkdownContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMarkdownContent(e.target.value);
  };

  // --- Handle Image URL Change ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newImage = e.target.value;
    setImage(newImage);
    setParsedFrontmatterData(prev => ({ ...prev, image: newImage }));
  };

  // --- Handle Category Change ---
  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    setParsedFrontmatterData(prev => ({ ...prev, category: newCategory }));
  };

  // --- Handle Tags Change (string to array conversion on save will be done) ---
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTags = e.target.value;
    setTags(newTags);
    // Don't update parsedFrontmatterData directly here for tags, do it on save after splitting
    // This prevents trying to store a string where an array is expected prematurely.
  };

    // --- Handle Course Folder Name Change ---
  const handleCourseFolderNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFolderName = slugify(e.target.value, new Set()); // Slugify folder name too
    setCourseFolderName(newFolderName);
  };

  // --- Handle Save/Update ---
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!title || !markdownContent) {
        alert("Title and content cannot be empty.");                                    
        setIsSaving(false);
        return;
      }

      if (contentBaseDir === 'courses' && !courseFolderName) {
        alert("Course Folder Name cannot be empty for course content.");
        setIsSaving(false);
        return;
      }

      const finalSlug = slug || slugify(title, new Set()); // Ensure slug is present

      // Define the target file path in the GitHub repository
      // If currentFilePath exists, it's an update; otherwise, it's a new file.
      // Use .mdx by default for new files.
      // const filePathToSave = currentFilePath || `posts/${finalSlug}.mdx`;
            let filePathToSave: string;
      if (currentFilePath) {
          // If updating an existing file, use its original path and format
          filePathToSave = currentFilePath;
      } else {
          // For a brand new file, use the selected fileFormat
          // filePathToSave = `posts/${finalSlug}.${fileFormat}`;
                    // For a brand new file, construct path based on contentBaseDir and folderName
          if (contentBaseDir === 'posts') {
              filePathToSave = `posts/${finalSlug}.${fileFormat}`;
          } else { // 'courses'
              filePathToSave = `courses/${courseFolderName}/${finalSlug}.${fileFormat}`;
          }
      }

      // Convert comma-separated tags string to an array for front matter
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);

      // Construct the final front matter object
      const finalFrontmatterData = {
        ...parsedFrontmatterData, // Start with any existing parsed front matter
        title: title,             // Override with current title input
        slug: finalSlug,          // Override with current slug input
        // Ensure date is always present and updated
        date: new Date().toISOString().split('T')[0], // Always set current date
        // --- INCLUDE NEW FIELDS IN FINAL FRONT MATTER ---
        image: image,
        category: category,
        tags: tagsArray, // Assign the processed tags array        
      };

      // Use gray-matter's stringify to combine front matter and content
      const fullContent = matter.stringify(markdownContent, finalFrontmatterData);

      // Log for debugging
      console.log("--- Final Content to be Saved ---");
      console.log(fullContent);
      console.log("---------------------------------");

      // Call your API route to save/update the file
      const res = await fetch('/api/admin/save', {
        method: 'POST', // Or 'PUT' if you prefer for updates
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: filePathToSave,
          // filePath: filePathToSave, // Use the path to save
          content: fullContent,
          commitMessage: currentFilePath ? `Update: ${title}` : `Create: ${title} (${contentBaseDir === 'posts' ? 'post' : 'course lesson'})`,
          // You might need to pass the SHA for updates if your save API requires it for concurrency control
          sha: currentFileSha,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to save content: ${res.statusText}`);
      }

      alert(`Content saved successfully! File: ${filePathToSave} (${currentFilePath ? 'updated' : 'created'})`);
      // Optionally clear form or refresh file list
      // setTitle('');
      // setSlug('');
      // setMarkdownContent('');
      // setFrontmatter('');
      // setCurrentFilePath(null);
      fetchFiles(); // Refresh list after save
    } catch (error: any) {
      console.error("Error saving content:", error);
      alert(`Failed to save content: ${error || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handle Delete (Optional) ---
  const handleDelete = async () => {
    if (!currentFilePath || !currentFileSha || !confirm(`Are you sure you want to delete "${currentFilePath}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: currentFilePath, sha: currentFileSha }), // Pass SHA for delete
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to delete content: ${res.statusText}`);
      }

      alert(`Content deleted successfully! File: ${currentFilePath}`);
      // Clear form and refresh file list
      setTitle('');
      setSlug('');
      setMarkdownContent('');
      setFrontmatter(''); // Clear frontmatter
      setParsedFrontmatterData({});
      setCurrentFilePath(null);
      setCurrentFileSha(undefined); // Clear SHA
      setImage(''); // Clear new fields
      setTags('');
      setCategory('');
      setFileFormat('mdx'); // Reset file format to default
      fetchFiles(); // Refresh list after delete
    } catch (error: any) {
      console.error("Error deleting content:", error);
      alert(`Failed to delete content: ${error || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };


  // --- Render Loading State ---
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Skeleton className="h-[200px] w-[300px] rounded-xl" />
        <div className="mt-4 space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

  // --- Render Editor if Authenticated ---
  if (session) {
    return (
      <div>
        {/* <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Welcome to the Admin Editor, {session.user?.name || 'Admin'}!</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Signed in via {session.provider} (
              {session.user?.email ? session.user.email : session.user?.githubUsername})
            </span>
            <Button onClick={() => signOut()} variant="outline">
              Sign Out
            </Button>
          </div>
        </div> */}

        {/* File Management / New File Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manage Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create New File */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Create New Content</h3>
                {/* Content Type Selection */}
                <div className="mb-4">
                    <Label className="mb-2 block">Content Type</Label>
                    <RadioGroup
                        defaultValue="posts"
                        value={contentBaseDir}
                        onValueChange={(value: 'posts' | 'courses') => {
                            setContentBaseDir(value);
                            setCourseFolderName(''); // Clear folder name when switching type
                        }}
                        className="flex space-x-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="posts" id="type-post" />
                            <Label htmlFor="type-post">Blog Post</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="courses" id="type-course" />
                            <Label htmlFor="type-course">Course Lesson</Label>
                        </div>
                    </RadioGroup>
                </div>

                 {/* Course Folder Name Input (conditional) */}
                {contentBaseDir === 'courses' && (
                  <div className="mb-4">
                      <Label htmlFor="courseFolderName">Course Folder Name (e.g., introduction-to-js)</Label>
                      <Input
                        id="courseFolderName"
                        placeholder="Enter course folder name"
                        value={courseFolderName}
                        onChange={handleCourseFolderNameChange}
                      />
                      <p className="text-xs text-gray-500 mt-1">This will be the folder within the 'courses' directory.</p>
                  </div>
                )}
                <Separator className="my-4" /> {/* Separator for visual clarity */}

                {/* --- NEW FILE FORMAT SELECTION --- */}
                <div className="mb-4">
                    <Label className="mb-2 block">File Format</Label>
                    <RadioGroup
                        defaultValue="mdx"
                        value={fileFormat}
                        onValueChange={(value: 'mdx' | 'md') => setFileFormat(value)}
                        className="flex space-x-4"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="mdx" id="format-mdx" />
                            <Label htmlFor="format-mdx">.mdx</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="md" id="format-md" />
                            <Label htmlFor="format-md">.md</Label>
                        </div>
                    </RadioGroup>
                </div>
                {/* --- END NEW FILE FORMAT SELECTION --- */}
                <Button
                  onClick={() => {
                    setTitle('');
                    setSlug('');
                    setMarkdownContent('');
                    setFrontmatter('');
                    setParsedFrontmatterData({});
                    setCurrentFilePath(null);
                    setCurrentFileSha(undefined);
                    setImage('');
                    setTags('');
                    setCategory('');
                    setFileFormat('mdx'); // Reset format to default
                    setContentBaseDir('posts'); // Reset to default
                    setCourseFolderName('');    // Clear course folder name

                    alert("New content file created. Start writing!");
                  }}
                  className="w-full"
                >
                  New Empty File
                </Button>
              </div>

              {/* Load Existing File */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Load Existing Content</h3>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-100 dark:bg-gray-800">
                  {fileList.length > 0 ? (
                    <ul className="space-y-1">
                      {fileList.map((file) => (
                        <li key={file.path}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-auto py-1 px-2 text-sm"
                            onClick={() => handleFileSelect(file.path)}
                          >
                            {file.path}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-center text-sm text-gray-500">No existing files found.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editor Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Content Details</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Enter content title"
                  value={title}
                  onChange={handleTitleChange}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (Auto-generated / Editable)</Label>
                <Input
                  id="slug"
                  placeholder="content-slug"
                  value={slug}
                  onChange={handleSlugChange} // Use new handler for slug
                  disabled={!title && !slug} // Disable if no title
                />
              </div>
              {/* --- NEW INPUTS FOR IMAGE, CATEGORY, TAGS --- */}
              <div>
                <Label htmlFor="image">Cover Image URL</Label>
                <Input
                  id="image"
                  placeholder="e.g., https://raw.githubusercontent.com/user/repo/branch/images/cover.jpg"
                  value={image}
                  onChange={handleImageChange}
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g., Development, Design, Life"
                  value={category}
                  onChange={handleCategoryChange}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="e.g., javascript, react, nextjs"
                  value={tags}
                  onChange={handleTagsChange}
                />
              </div>
              {/* --- END NEW INPUTS --- */}
              {/* <div>
                <Label htmlFor="frontmatter">Frontmatter (YAML)</Label>
                <Textarea
                  id="frontmatter"
                  placeholder={`date: ${new Date().toISOString().split('T')[0]}\ndescription: Your content description`}
                  value={frontmatter}
                  onChange={(e) => setFrontmatter(e.target.value)}
                  className="min-h-[100px] font-mono text-xs"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Add additional YAML frontmatter here (e.g., tags, categories).
                </p>
              </div> */}
              <div>
                <Label htmlFor="markdownContent">Markdown Content</Label>
                <Textarea
                  id="markdownContent"
                  className="min-h-[400px] font-mono"
                  placeholder="Start writing your Markdown content here..."
                  value={markdownContent}
                  onChange={handleMarkdownContentChange} // Use new handler for markdown content
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supports LaTeX with $...$ and $$...$$, and code highlighting.
                </p>
              </div>
            </div>
            <div className="mt-6 flex space-x-4">
              <Button onClick={handleSave} disabled={isSaving || !title || !markdownContent}>
                {isSaving ? 'Saving...' : 'Save Content'}
              </Button>
              {currentFilePath && (
                <Button onClick={handleDelete} disabled={isDeleting} variant="destructive">
                  {isDeleting ? 'Deleting...' : 'Delete Content'}
                </Button>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div>
            <h2 className="text-xl font-semibold mb-3">Preview</h2>
            <Card className="min-h-[700px] overflow-auto">
              <CardContent className="p-4">
                <MarkdownPreview markdown={markdownContent} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unauthenticated state (should be covered by useEffect redirect)
  return null;
}