// src/app/admin/editor/page.tsx
"use client"; // This component must be a Client Component

import { useSession, signOut } from "next-auth/react"; // Import signOut for the logout button
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import matter from "gray-matter"; // Import gray-matter

// UI Components (assuming shadcn/ui or similar)
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input"; // For title/slug input
import { Label } from "@/components/ui/label"; // For form labels
// --- NEW IMPORTS FOR RADIO GROUP ---
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator"; // Add separator for visual grouping
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"; // For Combobox
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"; // For Combobox
import { Check, ChevronsUpDown } from "lucide-react"; // For Combobox icon
import { cn } from "@/lib/utils"; // <--- ADDED THIS IMPORT STATEMENT
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"; // Import Alert components

// Your custom components
import { MarkdownPreview } from "@/components/editor/markdown-preview"; // For rendering markdown preview

// Utility functions (assuming you have these)
import { slugify } from "@/lib/utils"; // For slugifying titles
// import { PopoverAnchor } from '@/components/ui/popover';

// Define the interface for a GitHub file object, matching your API response
interface GitHubFile {
  name: string; // e.g., "my-post.mdx"
  path: string; // e.g., "posts/my-post.mdx" (full path in repo)
  sha: string; // SHA hash of the file content
  url: string; // API URL to get the file
  type: "file" | "dir";
  size: number;
  download_url: string | null;
  rateLimit: {
    limit: number | null;
    remaining: number | null;
    reset: Date; // reset is a UNIX timestamp; convert on frontend if needed
  };
}

// Content types for the Combobox
const contentTypes = [
  { value: "posts", label: "Blog Post" },
  { value: "courses", label: "Course Lesson" },
];

// --- Main Editor Component ---
export default function AdminEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State for content management
  const [title, setTitle] = useState<string>("");
  const [slug, setSlug] = useState<string>("");
  const [markdownContent, setMarkdownContent] = useState<string>(""); // This is now JUST the markdown body
  // New state to hold all parsed front matter as an object
  const [parsedFrontmatterData, setParsedFrontmatterData] = useState<
    Record<string, any>
  >({});
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null); // To store the path of the file being edited (for updates/deletes)
  const [currentFileSha, setCurrentFileSha] = useState<string | undefined>(
    undefined
  ); // To send SHA for updates
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [fileList, setFileList] = useState<GitHubFile[]>([]); // To display existing files for selection

  // --- Common Front Matter States (for both posts & courses) ---
  const [author, setAuthor] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // --- NEW STATES FOR IMAGE, TAGS, CATEGORY ---
  const [image, setImage] = useState<string>(""); // For the cover image URL
  const [tags, setTags] = useState<string>(""); // Comma-separated string for tags
  const [category, setCategory] = useState<string>(""); // For the category string

  // --- Course Lesson Specific Front Matter States ---
  const [lessonOrder, setLessonOrder] = useState<number | "">(""); // e.g., 1, 2, 3
  const [duration, setDuration] = useState<string>(""); // e.g., "15 min", "1 hour"
  const [videoUrl, setVideoUrl] = useState<string>(""); // e.g., YouTube URL, Vimeo URL

  // --- NEW STATES FOR CONTENT TYPE AND FOLDER STRUCTURE ---
  const [contentBaseDir, setContentBaseDir] = useState<"posts" | "courses">(
    "posts"
  ); // 'posts' or 'courses'
  const [courseFolderName, setCourseFolderName] = useState<string>(""); // For 'courses/{folder_name}/file.mdx'
  // --- END NEW STATES ---

  // --- NEW STATE FOR FILE FORMAT ---
  const [fileFormat, setFileFormat] = useState<"mdx" | "md">("mdx"); // Default to MDX

  // NEW STATES for GitHub Rate Limits
  const [postsFiles, setPostsFiles] = useState<GitHubFile[]>([]);
  const [coursesFolders, setCoursesFolders] = useState<GitHubFile[]>([]);
  const [gitHubRateLimit, setGitHubRateLimit] = useState<{
    limit: number | null;
    remaining: number | null;
    reset: Date | null;
  }>({ limit: null, remaining: null, reset: null });

  // State for Shadcn UI Alert
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    type: "success" | "error";
    title: string;
    description: string;
  }>({
    visible: false,
    type: "success",
    title: "",
    description: "",
  });

  // State for Combobox open/close
  const [openContentTypeSelect, setOpenContentTypeSelect] = useState(false);

  // --- Authentication and Redirection ---
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin"); // Redirect to login page if not authenticated
    }
  }, [status, router]);

  // Function to show Shadcn UI Alert
  const showAlert = (
    type: "success" | "error",
    title: string,
    description: string
  ) => {
    setAlertState({ visible: true, type, title, description });
    setTimeout(() => {
      setAlertState((prev) => ({ ...prev, visible: false }));
    }, 3000); // Hide alert after 3 seconds
  };

  // --- Fetching Existing Files ---
const fetchFiles = async () => {
  try {
    const postsRes = await fetch("/api/admin/files?path=posts");
    const coursesRes = await fetch("/api/admin/files?path=courses");

    if (!postsRes.ok || !coursesRes.ok) {
      throw new Error(
        `Failed to fetch file list: ${postsRes.statusText || coursesRes.statusText}`
      );
    }

    // Parse JSON responses that now have { files, rateLimit }
    const postsData: { files: GitHubFile[]; rateLimit: { limit: number; remaining: number; reset: number } } = await postsRes.json();
    const coursesData: { files: GitHubFile[]; rateLimit: { limit: number; remaining: number; reset: number } } = await coursesRes.json();

    // Update states separately for files and folders
    setPostsFiles(postsData.files);
    setCoursesFolders(coursesData.files);

    // Use the rateLimit info from either response (should be same or very close)
    const rateLimit = postsData.rateLimit || coursesData.rateLimit;
    setGitHubRateLimit({
      limit: rateLimit?.limit ?? null,
      remaining: rateLimit?.remaining ?? null,
      reset: rateLimit?.reset ? new Date(rateLimit.reset * 1000) : null,
    });

    // Aggregate all markdown files from posts and courses directories
    let allFiles: GitHubFile[] = [];

    allFiles = allFiles.concat(
      postsData.files.filter(
        (file) =>
          file.type === "file" &&
          (file.name.endsWith(".md") || file.name.endsWith(".mdx"))
      )
    );

    // Recursively fetch files inside course folders
    const courseLessonPromises = coursesData.files
      .filter((folder) => folder.type === "dir")
      .map(async (folder) => {
        const folderFilesRes = await fetch(
          `/api/admin/files?path=${encodeURIComponent(folder.path)}`
        );
        if (!folderFilesRes.ok) {
          console.error(
            `Failed to fetch files from course folder ${folder.path}: ${folderFilesRes.statusText}`
          );
          return [];
        }
        const folderFilesData: { files: GitHubFile[] } = await folderFilesRes.json();
        return folderFilesData.files.filter(
          (file) =>
            file.type === "file" &&
            (file.name.endsWith(".md") || file.name.endsWith(".mdx"))
        );
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
    if (status === "authenticated") {
      fetchFiles();
    }
  }, [status]);

  // --- Handle File Selection for Editing ---
  const handleFileSelect = async (filePath: string) => {
    try {
      // You'll need an API route to fetch a single file's content
      // e.g., `/api/admin/file?path=some/file.md`
      const res = await fetch(
        `/api/admin/file?path=${encodeURIComponent(filePath)}`
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch file content: ${res.statusText}`);
      }
      const data = await res.json();
      // Assuming data contains { content: "---frontmatter---\nmarkdown content", sha: "..." }
      const { content: rawContent, sha } = data;

      // Use gray-matter to parse the content
      const { data: parsedData, content: markdownBody } = matter(rawContent);

      // Determine content type and folder based on filePath
      if (filePath.startsWith("posts/")) {
        setContentBaseDir("posts");
        setCourseFolderName(""); // Clear course folder for posts
      } else if (filePath.startsWith("courses/")) {
        setContentBaseDir("courses");
        // Extract course folder name: e.g., "courses/my-course/lesson.mdx" -> "my-course"
        const pathParts = filePath.split("/");
        if (pathParts.length >= 3) {
          // Expecting at least "courses", "course-folder", "file.mdx"
          setCourseFolderName(pathParts[1]); // The second part is the course folder name
        } else {
          setCourseFolderName(""); // Fallback
        }
      } else {
        // Default or error handling for unknown paths
        setContentBaseDir("posts");
        setCourseFolderName("");
        console.warn(
          `Unknown file path structure: ${filePath}. Defaulting to 'posts'.`
        );
      }

      // Set states based on parsed data
      setParsedFrontmatterData(parsedData); // Store the full parsed frontmatter object
      setTitle(parsedData.title || "");
      setSlug(parsedData.slug || slugify(parsedData.title || "", new Set())); // Use existing slug or generate
      setMarkdownContent(markdownBody); // This is just the markdown content, no frontmatter
      setCurrentFilePath(filePath);

      // --- Populate Common Front Matter Fields ---
      setAuthor(parsedData.author || "");
      setDescription(parsedData.description || "");

      // --- Populate Type-Specific Front Matter Fields and Clear Others ---
      if (filePath.startsWith("posts/")) {
        setImage(parsedData.image || "");
        setCategory(parsedData.category || "");
        setTags(
          Array.isArray(parsedData.tags) ? parsedData.tags.join(", ") : ""
        );
        // Clear course-specific fields
        setLessonOrder("");
        setDuration("");
        setVideoUrl("");
      } else if (filePath.startsWith("courses/")) {
        setLessonOrder(parsedData.lessonOrder ?? "");
        setDuration(parsedData.duration || "");
        setVideoUrl(parsedData.videoUrl || "");
        // Clear blog-specific fields
        setImage("");
        setCategory("");
        setTags("");
      }

      setCurrentFilePath(filePath); // Store the path for updates
      setCurrentFileSha(sha); // Store SHA for updates

      // --- SET FILE FORMAT BASED ON LOADED FILE'S EXTENSION ---
      const extension = filePath.split(".").pop()?.toLowerCase();
      if (extension === "mdx" || extension === "md") {
        setFileFormat(extension as "mdx" | "md");
      } else {
        // Default to mdx if extension is unknown or missing
        setFileFormat("mdx");
      }

      alert(`Loaded file: ${filePath}`);
      // showAlert("success", "Loaded File", "${filePath}");
    } catch (error) {
      console.error("Error loading file:", error);
      alert(`Failed to load file: ${error || "Unknown error"}`);
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
    setParsedFrontmatterData((prev) => ({ ...prev, title: newTitle }));
  };

  // --- Handle Slug Change (manual override) ---
  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value;
    setSlug(newSlug);
    // Update slug in parsedFrontmatterData
    setParsedFrontmatterData((prev) => ({ ...prev, slug: newSlug }));
  };

  // --- Handle Markdown Content Change ---
  const handleMarkdownContentChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setMarkdownContent(e.target.value);
  };

  const handleAuthorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAuthor(e.target.value);
    setParsedFrontmatterData((prev) => ({ ...prev, author: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDescription(e.target.value);
    setParsedFrontmatterData((prev) => ({
      ...prev,
      description: e.target.value,
    }));
  };

  // Blog-specific handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImage(e.target.value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategory(e.target.value);
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTags(e.target.value);
  };

  // Course-specific handlers
  const handleLessonOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLessonOrder(value === "" ? "" : Number(value));
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuration(e.target.value);
  };

  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
  };

  const handleCourseFolderNameChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newFolderName = slugify(e.target.value, new Set());
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

      if (contentBaseDir === "courses" && !courseFolderName) {
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
        if (contentBaseDir === "posts") {
          filePathToSave = `posts/${finalSlug}.${fileFormat}`;
        } else {
          // 'courses'
          filePathToSave = `courses/${courseFolderName}/${finalSlug}.${fileFormat}`;
        }
      }

      // Convert comma-separated tags string to an array for front matter
      const tagsArray = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // --- Construct Final Front Matter Data based on Content Type ---
      const finalFrontmatterData: Record<string, any> = {
        ...parsedFrontmatterData, // Start with any existing parsed front matter
        title: title, // Override with current title input
        slug: finalSlug, // Override with current slug input
        // Ensure date is always present and updated
        date: new Date().toISOString().split("T")[0], // Always set current date
        author: author,
        description: description,
      };

      if (contentBaseDir === "posts") {
        finalFrontmatterData.image = image;
        finalFrontmatterData.category = category;
        finalFrontmatterData.tags = tagsArray;
      } else {
        // courses
        if (lessonOrder !== "")
          finalFrontmatterData.lessonOrder = Number(lessonOrder);
        finalFrontmatterData.duration = duration;
        finalFrontmatterData.videoUrl = videoUrl;
        // You can still include category/tags for courses if desired, or make them common
        // finalFrontmatterData.category = category;
        // finalFrontmatterData.tags = tagsArray;
      }

      // Use gray-matter's stringify to combine front matter and content
      const fullContent = matter.stringify(
        markdownContent,
        finalFrontmatterData
      );

      // Log for debugging
      console.log("--- Final Content to be Saved ---");
      console.log(fullContent);
      console.log("---------------------------------");

      // Call your API route to save/update the file
      const res = await fetch("/api/admin/save", {
        method: "POST", // Or 'PUT' if you prefer for updates
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: filePathToSave,
          // filePath: filePathToSave, // Use the path to save
          content: fullContent,
          commitMessage: currentFilePath
            ? `Update: ${title}`
            : `Create: ${title} (${
                contentBaseDir === "posts" ? "post" : "course lesson"
              })`,
          // You might need to pass the SHA for updates if your save API requires it for concurrency control
          sha: currentFileSha,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `Failed to save content: ${res.statusText}`
        );
      }

      alert(
        `Content saved successfully! File: ${filePathToSave} (${
          currentFilePath ? "updated" : "created"
        })`
      );
      // Optionally clear form or refresh file list
      // setTitle('');
      // setSlug('');
      // setMarkdownContent('');
      // setFrontmatter('');
      // setCurrentFilePath(null);
      fetchFiles(); // Refresh list after save
    } catch (error: any) {
      console.error("Error saving content:", error);
      alert(`Failed to save content: ${error || "Unknown error"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Handle Delete (Optional) ---
  const handleDelete = async () => {
    if (
      !currentFilePath ||
      !currentFileSha ||
      !confirm(`Are you sure you want to delete "${currentFilePath}"?`)
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: currentFilePath,
          sha: currentFileSha,
        }), // Pass SHA for delete
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `Failed to delete content: ${res.statusText}`
        );
      }

      alert(`Content deleted successfully! File: ${currentFilePath}`);
      // Clear form and refresh file list
      setTitle("");
      setSlug("");
      setMarkdownContent("");
      setParsedFrontmatterData({});
      setCurrentFilePath(null);
      setCurrentFileSha(undefined);

      // Reset all front matter states
      setAuthor("");
      setDescription("");
      setImage("");
      setTags("");
      setCategory("");
      setLessonOrder("");
      setDuration("");
      setVideoUrl("");

      setFileFormat("mdx");
      setContentBaseDir("posts");
      setCourseFolderName("");
      fetchFiles(); // Refresh list after delete
    } catch (error: any) {
      console.error("Error deleting content:", error);
      alert(`Failed to delete content: ${error || "Unknown error"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Render Loading State ---
  if (status === "loading") {
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
      <div className="container mx-auto text-foreground min-h-screen">
        {/* Display Rate Limit Info */}
        {gitHubRateLimit.limit !== null && (
          <div className="fixed bottom-4 right-4 bg-background border border-border p-3 rounded-md shadow-lg text-sm z-50">
            <p className="font-semibold text-muted-foreground">
              GitHub API Limit:
            </p>
            <p>
              Remaining: {gitHubRateLimit.remaining} / {gitHubRateLimit.limit}
            </p>
            {gitHubRateLimit.reset && (
              <p>Resets in: {gitHubRateLimit.reset.toLocaleTimeString()}</p>
            )}
          </div>
        )}
        {/* File Management / New File Section */}
        <Card className="mb-8 shadow-lg rounded-xl border border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold text-card-foreground">
              Manage Content
            </CardTitle>
            {/* Content Type Selection Combobox */}
            <div className="flex items-center space-x-2">
              <Label
                htmlFor="contentTypeSelect"
                className="text-sm font-medium text-muted-foreground"
              >
                Content Type:
              </Label>
              <Popover
                open={openContentTypeSelect}
                onOpenChange={setOpenContentTypeSelect}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openContentTypeSelect}
                    className="w-[180px] justify-between"
                  >
                    {contentTypes.find((type) => type.value === contentBaseDir)
                      ?.label || "Select type..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-0">
                  <Command>
                    <CommandInput placeholder="Search type..." />
                    <CommandEmpty>No type found.</CommandEmpty>
                    <CommandGroup>
                      {contentTypes.map((type) => (
                        <CommandItem
                          key={type.value}
                          value={type.value}
                          onSelect={(currentValue) => {
                            setContentBaseDir(
                              currentValue === "posts" ? "posts" : "courses"
                            );
                            setCourseFolderName(""); // Clear folder name when switching type
                            setOpenContentTypeSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              contentBaseDir === type.value
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {type.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Create New File */}
              <div className="p-4 border border-border rounded-lg bg-secondary/20 shadow-inner">
                <h3 className="text-xl font-semibold mb-4 text-secondary-foreground">
                  Create New Content
                </h3>
                {/* Content Type Selection */}
                <div className="mb-5">
                  <Label className="mb-2 block text-sm font-medium text-muted-foreground">
                    Content Type
                  </Label>
                  <RadioGroup
                    defaultValue="posts"
                    value={contentBaseDir}
                    onValueChange={(value: "posts" | "courses") => {
                      setContentBaseDir(value);
                      setCourseFolderName(""); // Clear folder name when switching type
                    }}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="posts" id="type-post" />
                      <Label htmlFor="type-post" className="text-base">
                        Blog Post
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="courses" id="type-course" />
                      <Label htmlFor="type-course" className="text-base">
                        Course Lesson
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Course Folder Name Input (conditional) */}
                {contentBaseDir === "courses" && (
                  <div className="mb-5">
                    <Label
                      htmlFor="courseFolderName"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Course Folder Name (e.g., introduction-to-js)
                    </Label>
                    <Input
                      id="courseFolderName"
                      placeholder="Enter course folder name"
                      value={courseFolderName}
                      onChange={handleCourseFolderNameChange}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be the folder within the 'courses' directory.
                    </p>
                  </div>
                )}
                <Separator className="my-6 bg-border" />

                {/* --- NEW FILE FORMAT SELECTION --- */}
                <div className="mb-6">
                  <Label className="mb-2 block text-sm font-medium text-muted-foreground">
                    File Format
                  </Label>
                  <RadioGroup
                    defaultValue="mdx"
                    value={fileFormat}
                    onValueChange={(value: "mdx" | "md") =>
                      setFileFormat(value)
                    }
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mdx" id="format-mdx" />
                      <Label htmlFor="format-mdx" className="text-base">
                        .mdx
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="md" id="format-md" />
                      <Label htmlFor="format-md" className="text-base">
                        .md
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                {/* --- END NEW FILE FORMAT SELECTION --- */}
                <Button
                  onClick={() => {
                    setTitle("");
                    setSlug("");
                    setMarkdownContent("");
                    setParsedFrontmatterData({});
                    setCurrentFilePath(null);
                    setCurrentFileSha(undefined);
                    setAuthor("");
                    setDescription("");
                    setImage("");
                    setTags("");
                    setCategory("");
                    setLessonOrder("");
                    setDuration("");
                    setVideoUrl("");
                    setFileFormat("mdx"); // Reset format to default
                    setContentBaseDir("posts"); // Reset to default
                    setCourseFolderName(""); // Clear course folder name

                    alert("New content file created. Start writing!");
                  }}
                  className="w-full py-3 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.01]"
                >
                  New Empty File
                </Button>
              </div>

              {/* Load Existing File */}
              <div className="p-4 border border-border rounded-lg bg-secondary/20 shadow-inner">
                <h3 className="text-xl font-semibold mb-4 text-secondary-foreground">
                  Load Existing Content
                </h3>
                <div className="max-h-64 overflow-y-auto border border-border rounded-md p-3 bg-background shadow-sm">
                  {fileList.length > 0 ? (
                    <ul className="space-y-2">
                      {fileList.map((file) => (
                        <li key={file.path}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start h-auto py-2 px-3 text-sm text-left text-foreground hover:bg-accent hover:text-accent-foreground rounded-md transition-colors duration-150"
                            onClick={() => handleFileSelect(file.path)}
                          >
                            <span className="truncate">{file.path}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No existing files found.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Editor Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="p-4 bg-card rounded-xl shadow-lg border border-border">
            <h2 className="text-2xl font-semibold mb-5 text-card-foreground">
              Content Details
            </h2>
            <div className="space-y-6">
              <div>
                <Label
                  htmlFor="title"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Title
                </Label>
                <Input
                  id="title"
                  placeholder="Enter content title"
                  value={title}
                  onChange={handleTitleChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="slug"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Slug (Auto-generated / Editable)
                </Label>
                <Input
                  id="slug"
                  placeholder="content-slug"
                  value={slug}
                  onChange={handleSlugChange}
                  disabled={!title && !slug} // Disable if no title
                  className="mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="author"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Author
                </Label>
                <Input
                  id="author"
                  placeholder="e.g., John Doe"
                  value={author}
                  onChange={handleAuthorChange}
                  className="mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="description"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Description
                </Label>
                <Input
                  id="description"
                  placeholder="A brief summary of the content"
                  value={description}
                  onChange={handleDescriptionChange}
                  className="mt-1"
                />
              </div>

              {/* Blog Post Specific Fields (Conditional) */}
              {contentBaseDir === "posts" && (
                <>
                  <Separator className="my-6 bg-border" />
                  <h3 className="text-xl font-semibold text-card-foreground">
                    Blog Post Specific Front Matter
                  </h3>
                  <div>
                    <Label
                      htmlFor="image"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Cover Image URL
                    </Label>
                    <Input
                      id="image"
                      placeholder="e.g., https://raw.githubusercontent.com/user/repo/branch/images/cover.jpg"
                      value={image}
                      onChange={handleImageChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="category"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Category
                    </Label>
                    <Input
                      id="category"
                      placeholder="e.g., Development, Design, Life"
                      value={category}
                      onChange={handleCategoryChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="tags"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Tags (comma-separated)
                    </Label>
                    <Input
                      id="tags"
                      placeholder="e.g., javascript, react, nextjs"
                      value={tags}
                      onChange={handleTagsChange}
                      className="mt-1"
                    />
                  </div>
                </>
              )}

              {/* Course Lesson Specific Fields (Conditional) */}
              {contentBaseDir === "courses" && (
                <>
                  <Separator className="my-6 bg-border" />
                  <h3 className="text-xl font-semibold text-card-foreground">
                    Course Lesson Specific Front Matter
                  </h3>
                  <div>
                    <Label
                      htmlFor="lessonOrder"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Lesson Order (Number)
                    </Label>
                    <Input
                      id="lessonOrder"
                      type="number"
                      placeholder="e.g., 1"
                      value={lessonOrder}
                      onChange={handleLessonOrderChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="duration"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Duration
                    </Label>
                    <Input
                      id="duration"
                      placeholder="e.g., 15 min, 1 hour"
                      value={duration}
                      onChange={handleDurationChange}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor="videoUrl"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Video URL
                    </Label>
                    <Input
                      id="videoUrl"
                      placeholder="e.g., https://www.youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={handleVideoUrlChange}
                      className="mt-1"
                    />
                  </div>
                </>
              )}
              {/* --- END NEW INPUTS --- */}
              {/* Markdown Content (Common to both) */}
              <div>
                <Label
                  htmlFor="markdownContent"
                  className="text-sm font-medium text-muted-foreground"
                >
                  Markdown Content
                </Label>
                <Textarea
                  id="markdownContent"
                  className="min-h-[400px] font-mono mt-1 border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background"
                  placeholder="Start writing your Markdown content here..."
                  value={markdownContent}
                  onChange={handleMarkdownContentChange}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Supports LaTeX with $...$ and $$...$$, and code highlighting.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !title || !markdownContent}
                className="w-full sm:w-auto py-3 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.01]"
              >
                {isSaving ? "Saving..." : "Save Content"}
              </Button>
              {currentFilePath && (
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  variant="destructive"
                  className="w-full sm:w-auto py-3 text-lg font-semibold rounded-lg shadow-md transition-all duration-200 ease-in-out transform hover:scale-[1.01]"
                >
                  {isDeleting ? "Deleting..." : "Delete Content"}
                </Button>
              )}
            </div>
          </div>

          {/* Preview Section */}
          <div className="p-4 bg-card rounded-xl shadow-lg border border-border">
            <h2 className="text-2xl font-semibold mb-5 text-card-foreground">
              Preview
            </h2>
            <Card className="min-h-[700px] overflow-auto border border-border rounded-lg shadow-inner bg-background">
              <CardContent className="p-6">
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
