'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { saasmaker } from '@/lib/saasmaker';

export function SaasMakerAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    saasmaker?.analytics.track({ name: 'page_view', url: pathname }).catch(() => {});
  }, [pathname]);

  return null;
}
