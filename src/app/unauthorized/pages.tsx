// app/unauthorized/page.tsx
"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-center">
      <div className="p-8 bg-white dark:bg-gray-800 rounded shadow-md">
        <h1 className="text-3xl font-bold mb-4 text-red-600 dark:text-red-400">Unauthorized Access</h1>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          You do not have administrative privileges to access this page.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 mr-4"
        >
          Sign Out
        </button>
        <Link href="/" className="px-6 py-3 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors duration-200">
            Go to Home
        </Link>
      </div>
    </div>
  );
}