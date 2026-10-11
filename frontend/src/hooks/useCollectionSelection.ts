import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { Collection } from "@algodeck/shared";
import { api } from "../services/api";
export function useCollectionSelection() {
  const collections = useQuery({
    queryKey: ["collections", false],
    queryFn: () => api<Collection[]>("/collections"),
  });
  const [params, setParams] = useSearchParams();
  const selected = params.get("collection");
  const id =
    collections.data?.find((c) => c.id === selected)?.id ??
    collections.data?.[0]?.id;
  return {
    collections,
    id,
    setId: (value: string) => setParams({ collection: value }),
  };
}
