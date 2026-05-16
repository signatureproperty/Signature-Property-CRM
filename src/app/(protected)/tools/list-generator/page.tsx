
'use client';

import { ListGeneratorTool } from '@/components/list-generator-tool';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, or } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import type { Property } from '@/lib/types';
import { useMemo } from 'react';

export default function ListGeneratorPage() {
  const { profile } = useProfile();
  const firestore = useFirestore();

  const agencyPropertiesQuery = useMemoFirebase(() => {
      if (!profile.agency_id) return null;
      const ref = collection(firestore, 'agencies', profile.agency_id, 'properties');
      
      // If Agent, restrict to assigned or created properties
      if (profile.role === 'Agent') {
          return query(ref, 
            or(
                where('assignedTo', 'array-contains', profile.user_id),
                where('created_by', '==', profile.user_id)
            )
          );
      }
      return ref;
  }, [profile.agency_id, profile.role, profile.user_id, firestore]);

  const agentPropertiesQuery = useMemoFirebase(() => profile.user_id ? collection(firestore, 'agents', profile.user_id, 'properties') : null, [profile.user_id, firestore]);
  
  const { data: agencyProperties, isLoading: isAgencyLoading } = useCollection<Property>(agencyPropertiesQuery);
  const { data: agentProperties, isLoading: isAgentLoading } = useCollection<Property>(agentPropertiesQuery);

  const allProperties = useMemo(() => {
      const combined = [...(agencyProperties || []), ...(agentProperties || [])];
      const unique = Array.from(new Map(combined.map(p => [p.id, p])).values());
      return unique;
  }, [agencyProperties, agentProperties]);

  const isLoading = isAgencyLoading || isAgentLoading;

  return (
    <div className="space-y-8">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground font-bold uppercase tracking-widest animate-pulse">
            Loading your inventory...
        </div>
      ) : (
        <ListGeneratorTool allProperties={allProperties} />
      )}
    </div>
  );
}
