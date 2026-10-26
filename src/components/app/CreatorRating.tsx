import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useMyProfile } from "@/lib/auth";

/** Brand ratings for a creator. The streak counts recent 4★+ ratings in a row (computed in the database). */
export function CreatorRating({ creatorId }: { creatorId: string }) {
  const { user } = useAuth();
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const canRate = me?.account_type === "brand" && user?.id !== creatorId;

  const { data: summary } = useQuery({
    queryKey: ["creator-rating", creatorId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("creator_rating_summary", { _creator: creatorId });
      if (error) throw error;
      return data?.[0] ?? { average: null, total: 0, streak: 0 };
    },
  });
  const { data: mine } = useQuery({
    queryKey: ["creator-rating", creatorId, "mine", user?.id],
    enabled: !!canRate,
    queryFn: async () => {
      const { data } = await supabase.from("v2_creator_ratings").select("rating, comment").eq("creator_id", creatorId).eq("brand_id", user!.id).maybeSingle();
      return data;
    },
  });

  const [hover, setHover] = useState(0);
  const [busy, setBusy] = useState(false);
  const rate = async (rating: number) => {
    if (!user) return undefined;
    setBusy(true);
    const { error } = await supabase.from("v2_creator_ratings").upsert({ brand_id: user.id, creator_id: creatorId, rating }, { onConflict: "brand_id,creator_id" });
    setBusy(false);
    if (error) { toast.error(error.message); return undefined; }
    toast.success("Rating saved");
    qc.invalidateQueries({ queryKey: ["creator-rating", creatorId] });
    return undefined;
  };

  const total = Number(summary?.total ?? 0);
  const current = hover || mine?.rating || 0;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-4 py-3 text-sm">
      <span className="flex items-center gap-1.5" title="Brand ratings of 4 stars or more in a row">
        <Flame className="h-5 w-5 fill-foreground" />
        <b>{summary?.streak ?? 0}</b><span className="text-muted-foreground">streak</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Star className="h-4 w-4 fill-foreground" />
        <b>{total ? Number(summary?.average).toFixed(1) : "–"}</b>
        <span className="text-muted-foreground">{total} brand {total === 1 ? "rating" : "ratings"}</span>
      </span>
      {canRate && (
        <span className="ml-auto flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          <span className="mr-1 text-muted-foreground">{mine ? "Your rating" : "Rate"}</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" disabled={busy} aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`} onMouseEnter={() => setHover(n)} onClick={() => rate(n)}>
              <Star className={`h-5 w-5 ${n <= current ? "fill-foreground" : "text-muted-foreground"}`} />
            </button>
          ))}
        </span>
      )}
    </div>
  );
}
