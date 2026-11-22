import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { SourceStep } from '@/features/catalogue/components/SourceStep';
import { useStartCatalogueFlow } from '@/features/catalogue/hooks/useCatalogueSource';

/**
 * /catalogue?productIds=a,b&categoryId=&customerId=  Step 1 of 4: what to send.
 * `quick=1` (Showroom's small catalogue) skips straight to the preview with the remembered options.
 */
export default function CatalogueRoute() {
  const params = useLocalSearchParams<{ productIds?: string; categoryId?: string; customerId?: string; quick?: string }>();
  useStartCatalogueFlow(params);
  const jumped = useRef(false);
  useEffect(() => {
    if (params.quick === '1' && !jumped.current) {
      jumped.current = true;
      router.push('/catalogue/preview');
    }
  }, [params.quick]);
  return <SourceStep />;
}
