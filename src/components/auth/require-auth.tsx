'use client';

import { type ReactNode, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Auth guard component. Redirects to /login if the user is not authenticated.
 * Shows a loading skeleton while the auth state is being determined.
 */
export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return fallback ? <>{fallback}</> : (
      <div className="space-y-8 pb-24 px-4">
        <Skeleton className="h-20 w-full md:w-2/3 bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-[2.5rem] bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
