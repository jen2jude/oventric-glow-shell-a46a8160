import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getDiscoveryFeed,
  getAcademyRecommendations,
  type DiscoveryFeed,
  type AcademyRecommendations,
} from "@/lib/discovery.functions";

/**
 * Shared discovery data for the app newsfeed: powers the inline commerce cards
 * in "For you" and every rail in the "Discover" explore tab.
 */
export function useFeedDiscovery(enabled: boolean) {
  const loadDiscovery = useServerFn(getDiscoveryFeed);
  const loadAcademy = useServerFn(getAcademyRecommendations);

  const discovery = useQuery<DiscoveryFeed>({
    queryKey: ["feed-discovery"],
    queryFn: () => loadDiscovery(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const academy = useQuery<AcademyRecommendations>({
    queryKey: ["feed-academy-reco"],
    queryFn: () => loadAcademy(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    peers: discovery.data?.topPeersAny ?? discovery.data?.peers ?? [],
    products: discovery.data?.products ?? [],
    bounties: discovery.data?.bounties ?? [],
    courses: academy.data?.courses ?? [],
    circles: academy.data?.circles ?? [],
    loading: discovery.isLoading || academy.isLoading,
  };
}
