// src/app/admin/page.tsx
'use client';

import { useSession, signIn } from 'next-auth/react'; // 'signIn' and 'useSession' still from 'next-auth/react'
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/editor');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Editor Login</CardTitle>
          <CardDescription>Sign in to access the content editor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => signIn('github')}
            className="w-full"
            variant="outline"
          >
            Sign in with GitHub
          </Button>
          <Button
            onClick={() => signIn('google')}
            className="w-full"
            variant="outline"
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}